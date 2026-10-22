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
import {
  ESTADO_CUPON,
  ESTADO_SOLICITUD,
  ESTADO_SOPORTE_PAGO,
  FORMATOS_SOPORTE,
} from '../config/constants.js';
import CuponPago from '../models/servicios/CuponPago.js';
import SoportePago from '../models/servicios/SoportePago.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';

function normalizarFormato(formato) {
  const valor = String(formato || '').trim().toUpperCase();
  if (!FORMATOS_SOPORTE.includes(valor)) {
    throw ApiError.badRequest(
      `formato debe ser uno de: ${FORMATOS_SOPORTE.join(', ')}`
    );
  }
  return valor;
}

function normalizarRuta(rutaArchivo) {
  const valor = String(rutaArchivo || '').trim();
  if (!valor) throw ApiError.badRequest('ruta_archivo es obligatoria');
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
 * Carga el soporte de pago de un cupon y pasa la solicitud a
 * Pago pendiente de verificacion.
 *
 * @param {{
 *   cuponId: string|import('mongoose').Types.ObjectId,
 *   rutaArchivo: string,
 *   formato: string,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function cargarSoportePago({
  cuponId,
  rutaArchivo,
  formato,
  usuarioId,
}) {
  if (!usuarioId) throw ApiError.unauthorized();

  const ruta = normalizarRuta(rutaArchivo);
  const formatoNormalizado = normalizarFormato(formato);

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
          ruta_archivo: ruta,
          formato: formatoNormalizado,
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
        observacion: 'Soporte de pago cargado',
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
 * Reenvia un soporte rechazado y devuelve la solicitud a
 * Pago pendiente de verificacion.
 *
 * @param {{
 *   soporteId: string|import('mongoose').Types.ObjectId,
 *   rutaArchivo: string,
 *   formato: string,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function reenviarSoportePago({
  soporteId,
  rutaArchivo,
  formato,
  usuarioId,
}) {
  if (!usuarioId) throw ApiError.unauthorized();

  const ruta = normalizarRuta(rutaArchivo);
  const formatoNormalizado = normalizarFormato(formato);

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
          ruta_archivo: ruta,
          formato: formatoNormalizado,
          estado: ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION,
          validador: null,
          fecha_validacion: null,
          observaciones: null,
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
        observacion: 'Soporte de pago reenviado',
      }
    );

    return actualizado;
  });
}

export {
  cargarSoportePago,
  validarSoportePago,
  reenviarSoportePago,
};
export default {
  cargarSoportePago,
  validarSoportePago,
  reenviarSoportePago,
};
