/**
 * Service del modulo: pago.
 *
 * Reglas:
 *  - Solo se carga soporte de un cupon GENERADO y vigente.
 *  - Un solo soporte por cupon.
 *  - Aprobar el pago marca el cupon UTILIZADO y la solicitud Pago aprobado.
 *  - Rechazar el pago deja el cupon GENERADO y la solicitud Pago rechazado.
 *  - El cliente puede reenviar un soporte RECHAZADO.
 *
 * Todas las operaciones que tocan SoportePago + CuponPago + Solicitud se
 * ejecutan dentro de una transaccion.
 */
import ApiError from '../utils/ApiError.js';
import { paginacion } from '../utils/paginacion.js';
import {
  ESTADO_CUPON,
  ESTADO_SOLICITUD,
  ESTADO_SOPORTE_PAGO,
  ESTADO_SOPORTE_PAGO_LISTA,
} from '../config/constants.js';
import CuponPago from '../models/servicios/CuponPago.js';
import SoportePago from '../models/servicios/SoportePago.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';

function normalizarReferencia(referenciaExterna) {
  const valor = String(referenciaExterna || '').trim();
  if (!valor) return null;
  if (valor.length > 100) {
    throw ApiError.badRequest('referencia_externa no puede superar 100 caracteres');
  }
  return valor;
}

function normalizarObservaciones(observaciones) {
  const valor = String(observaciones || '').trim();
  if (!valor) return null;
  if (valor.length > 200) {
    throw ApiError.badRequest('observaciones no puede superar 200 caracteres');
  }
  return valor;
}

function validarVigenciaCupon(cupon) {
  if (cupon.fecha_vencimiento && cupon.fecha_vencimiento.getTime() < Date.now()) {
    throw ApiError.conflict('El cupon esta vencido');
  }
}

async function obtenerCotizacionDeCupon(cupon, session) {
  const cotizacion = await Cotizacion.findById(cupon.cotizacion).session(session);
  if (!cotizacion) {
    throw ApiError.badRequest('La cotizacion del cupon no existe');
  }
  return cotizacion;
}

/**
 * Registra el pago reportado por el cliente para un cupon y pasa la solicitud
 * a Pago pendiente de verificacion. No se almacena ningun comprobante.
 *
 * @param {{
 *   cuponId: string|import('mongoose').Types.ObjectId,
 *   referenciaExterna?: string|null,
 *   observaciones?: string|null,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function cargarSoportePago({
  cuponId,
  referenciaExterna = null,
  observaciones = null,
  usuarioId,
}) {
  if (!usuarioId) throw ApiError.unauthorized();

  const referencia = normalizarReferencia(referenciaExterna);
  const observacion = normalizarObservaciones(observaciones);

  return conTransaccion(async (session) => {
    const cupon = await CuponPago.findById(cuponId).session(session);
    if (!cupon) throw ApiError.badRequest('El cupon indicado no existe');

    if (cupon.estado !== ESTADO_CUPON.GENERADO) {
      throw ApiError.conflict('Solo se carga soporte de un cupon GENERADO');
    }

    validarVigenciaCupon(cupon);
    const cotizacion = await obtenerCotizacionDeCupon(cupon, session);

    const existente = await SoportePago.findOne({
      cupon: cupon._id,
    }).session(session);
    if (existente) {
      throw ApiError.conflict(
        'El cupon ya tiene soporte. Use reenviar si fue rechazado'
      );
    }

    const [soporte] = await SoportePago.create(
      [
        {
          cupon: cupon._id,
          referencia_externa: referencia,
          observaciones: observacion,
        },
      ],
      { session }
    );

    await transicionarSolicitud(
      cotizacion.solicitud,
      ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION,
      {
        session,
        usuario: usuarioId,
        observacion: 'Pago reportado por el cliente',
      }
    );

    return soporte;
  });
}

/**
 * Valida (aprueba o rechaza) un soporte de pago.
 *
 * @param {{
 *   soporteId: string|import('mongoose').Types.ObjectId,
 *   decision: 'APROBADO'|'RECHAZADO',
 *   observaciones?: string|null,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function validarSoportePago({
  soporteId,
  decision,
  observaciones = null,
  usuarioId,
}) {
  if (
    decision !== ESTADO_SOPORTE_PAGO.APROBADO &&
    decision !== ESTADO_SOPORTE_PAGO.RECHAZADO
  ) {
    throw ApiError.badRequest('decision debe ser APROBADO o RECHAZADO');
  }
  if (!usuarioId) throw ApiError.unauthorized();

  const observacion = observaciones ? String(observaciones).trim() : null;

  return conTransaccion(async (session) => {
    const soporte = await SoportePago.findById(soporteId).session(session);
    if (!soporte) throw ApiError.notFound('Soporte no encontrado');

    if (soporte.estado !== ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION) {
      throw ApiError.conflict('El soporte ya fue validado');
    }

    const cupon = await CuponPago.findById(soporte.cupon).session(session);
    if (!cupon) throw ApiError.badRequest('El cupon del soporte no existe');

    const cotizacion = await obtenerCotizacionDeCupon(cupon, session);

    const actualizado = await SoportePago.findOneAndUpdate(
      {
        _id: soporteId,
        estado: ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION,
      },
      {
        $set: {
          estado: decision,
          validador: usuarioId,
          fecha_validacion: new Date(),
          observaciones: observacion,
        },
      },
      { new: true, runValidators: true, session }
    );

    if (!actualizado) {
      throw ApiError.conflict('El soporte ya fue validado');
    }

    if (decision === ESTADO_SOPORTE_PAGO.APROBADO) {
      if (cupon.estado !== ESTADO_CUPON.GENERADO) {
        throw ApiError.conflict(
          `No se puede utilizar un cupon en estado ${cupon.estado}`
        );
      }

      const cuponActualizado = await CuponPago.findOneAndUpdate(
        { _id: cupon._id, estado: ESTADO_CUPON.GENERADO },
        { $set: { estado: ESTADO_CUPON.UTILIZADO } },
        { new: true, session }
      );

      if (!cuponActualizado) {
        throw ApiError.conflict('El cupon cambio de estado durante la operacion');
      }
    }

    const estadoSolicitud =
      decision === ESTADO_SOPORTE_PAGO.APROBADO
        ? ESTADO_SOLICITUD.PAGO_APROBADO
        : ESTADO_SOLICITUD.PAGO_RECHAZADO;

    await transicionarSolicitud(cotizacion.solicitud, estadoSolicitud, {
      session,
      usuario: usuarioId,
      observacion:
        decision === ESTADO_SOPORTE_PAGO.APROBADO
          ? 'Pago aprobado'
          : 'Pago rechazado',
    });

    return actualizado;
  });
}

/**
 * Reenvia la referencia de un pago rechazado y devuelve la solicitud a
 * Pago pendiente de verificacion. No se almacena ningun comprobante.
 *
 * @param {{
 *   soporteId: string|import('mongoose').Types.ObjectId,
 *   referenciaExterna?: string|null,
 *   observaciones?: string|null,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function reenviarSoportePago({
  soporteId,
  referenciaExterna = null,
  observaciones = null,
  usuarioId,
}) {
  if (!usuarioId) throw ApiError.unauthorized();

  const referencia = normalizarReferencia(referenciaExterna);
  const observacion = normalizarObservaciones(observaciones);

  return conTransaccion(async (session) => {
    const soporte = await SoportePago.findById(soporteId).session(session);
    if (!soporte) throw ApiError.notFound('Soporte no encontrado');

    if (soporte.estado !== ESTADO_SOPORTE_PAGO.RECHAZADO) {
      throw ApiError.conflict('Solo se reenvia un soporte RECHAZADO');
    }

    const cupon = await CuponPago.findById(soporte.cupon).session(session);
    if (!cupon) throw ApiError.badRequest('El cupon del soporte no existe');

    if (cupon.estado !== ESTADO_CUPON.GENERADO) {
      throw ApiError.conflict('El cupon no esta vigente para reenviar');
    }

    validarVigenciaCupon(cupon);
    const cotizacion = await obtenerCotizacionDeCupon(cupon, session);

    const actualizado = await SoportePago.findOneAndUpdate(
      { _id: soporteId, estado: ESTADO_SOPORTE_PAGO.RECHAZADO },
      {
        $set: {
          referencia_externa: referencia,
          estado: ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION,
          validador: null,
          fecha_validacion: null,
          observaciones: observacion,
        },
      },
      { new: true, runValidators: true, session }
    );

    if (!actualizado) {
      throw ApiError.conflict('El soporte cambio de estado durante la operacion');
    }

    await transicionarSolicitud(
      cotizacion.solicitud,
      ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION,
      {
        session,
        usuario: usuarioId,
        observacion: 'Pago reenviado por el cliente',
      }
    );

    return actualizado;
  });
}

const POPULATE_SOPORTE = [
  { path: 'cupon', select: 'codigo_cupon valor estado cotizacion' },
  { path: 'validador', select: 'nombres apellidos correo' },
];

/** Popula el soporte con sus referencias. */
function poblarSoporte(doc) {
  return doc.populate(POPULATE_SOPORTE);
}

/** GET /pagos — lista paginada (coordinador). */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.estado) {
    if (!ESTADO_SOPORTE_PAGO_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }
  if (query.cupon) filtro.cupon = query.cupon;

  const [items, total] = await Promise.all([
    SoportePago.find(filtro)
      .populate(POPULATE_SOPORTE)
      .sort({ fecha_carga: -1 })
      .skip(skip)
      .limit(limit),
    SoportePago.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /pagos/mios — soportes del cliente autenticado. */
async function listarMios(clienteId, query = {}) {
  const { page, limit, skip } = paginacion(query);

  const solicitudes = await Solicitud.find({ cliente: clienteId }).select('_id').lean();
  const cotizaciones = await Cotizacion.find({
    solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) },
  })
    .select('_id')
    .lean();
  const cupones = await CuponPago.find({
    cotizacion: { $in: cotizaciones.map((cotizacion) => cotizacion._id) },
  })
    .select('_id')
    .lean();

  const filtro = { cupon: { $in: cupones.map((cupon) => cupon._id) } };
  if (query.estado) {
    if (!ESTADO_SOPORTE_PAGO_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }

  const [items, total] = await Promise.all([
    SoportePago.find(filtro)
      .populate(POPULATE_SOPORTE)
      .sort({ fecha_carga: -1 })
      .skip(skip)
      .limit(limit),
    SoportePago.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /pagos/:id */
async function obtenerPorId(id) {
  const doc = await SoportePago.findById(id).populate(POPULATE_SOPORTE);
  if (!doc) throw ApiError.notFound('Soporte no encontrado');
  return doc;
}

/** GET /pagos/:id (solo documento, para autorizar antes de reenviar). */
async function obtenerSoporte(id) {
  const doc = await SoportePago.findById(id);
  if (!doc) throw ApiError.notFound('Soporte no encontrado');
  return doc;
}

/** Cupon que se va a pagar (para validar pertenencia antes de cargar el soporte). */
async function obtenerCuponParaCarga(cuponId) {
  const cupon = await CuponPago.findById(cuponId);
  if (!cupon) throw ApiError.badRequest('El cupon indicado no existe');
  return cupon;
}

export {
  cargarSoportePago,
  validarSoportePago,
  reenviarSoportePago,
  poblarSoporte,
  listar,
  listarMios,
  obtenerPorId,
  obtenerSoporte,
  obtenerCuponParaCarga,
};
export default {
  cargarSoportePago,
  validarSoportePago,
  reenviarSoportePago,
  poblarSoporte,
  listar,
  listarMios,
  obtenerPorId,
  obtenerSoporte,
  obtenerCuponParaCarga,
};
