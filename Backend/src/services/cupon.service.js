/**
 * Service del modulo: cupon.
 *
 * Reglas:
 *  - Solo clientes EXTERNOS requieren cupon.
 *  - Solo se genera cupon de una cotizacion ACEPTADA.
 *  - Un solo cupon por cotizacion.
 *  - El valor del cupon debe coincidir con el total de la cotizacion.
 */
import ApiError from '../utils/ApiError.js';
import { paginacion } from '../utils/paginacion.js';
import {
  ESTADO_COTIZACION,
  ESTADO_CUPON,
  ESTADO_CUPON_LISTA,
  ESTADO_SOLICITUD,
  TIPO_CLIENTE,
} from '../config/constants.js';
import { puedeTransicionarCupon } from '../config/estados.js';
import env from '../config/env.js';
import CuponPago from '../models/servicios/CuponPago.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import { conTransaccion } from './flujo.service.js';

const POPULATE_CUPON = [
  { path: 'cotizacion', select: 'valor_total estado solicitud' },
  { path: 'solicitado_por', select: 'nombres apellidos correo' },
];

/**
 * Crea el cupon manual de una cotizacion aceptada de cliente externo.
 *
 * @param {{
 *   cotizacionId: string|import('mongoose').Types.ObjectId,
 *   valor?: number|string|null,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function crearCupon({ cotizacionId, valor, usuarioId }) {
  if (!usuarioId) throw ApiError.unauthorized();

  return conTransaccion(async (session) => {
    const cotizacion = await Cotizacion.findById(cotizacionId).session(session);
    if (!cotizacion) {
      throw ApiError.badRequest('La cotizacion indicada no existe');
    }

    if (cotizacion.estado !== ESTADO_COTIZACION.ACEPTADA) {
      throw ApiError.conflict('Solo se genera cupon de una cotizacion ACEPTADA');
    }

    const solicitud = await Solicitud.findById(cotizacion.solicitud).session(session);
    if (!solicitud) {
      throw ApiError.badRequest('La solicitud de la cotizacion no existe');
    }

    if (solicitud.estado !== ESTADO_SOLICITUD.ACEPTADA) {
      throw ApiError.conflict('La solicitud no esta en estado Aceptada');
    }

    const cliente = await Cliente.findById(solicitud.cliente).session(session);
    if (!cliente) {
      throw ApiError.badRequest('El cliente de la solicitud no existe');
    }

    if (cliente.tipo_cliente !== TIPO_CLIENTE.EXTERNO) {
      throw ApiError.conflict('Solo los clientes externos requieren cupon');
    }

    const existente = await CuponPago.findOne({
      cotizacion: cotizacion._id,
    }).session(session);
    if (existente) {
      throw ApiError.conflict('La cotizacion ya tiene cupon');
    }

    const valorEsperado = Number(cotizacion.valor_total);

    // Los clientes internos y las cotizaciones en 0 no requieren cupon.
    if (valorEsperado === 0) {
      throw ApiError.conflict('La cotizacion no requiere cupon porque su valor es 0');
    }

    const valorFinal =
      valor === undefined || valor === null ? valorEsperado : Number(valor);

    if (
      !Number.isFinite(valorFinal) ||
      Math.abs(valorFinal - valorEsperado) > 0.01
    ) {
      throw ApiError.badRequest(
        'El valor del cupon debe coincidir con el total de la cotizacion'
      );
    }

    const [cupon] = await CuponPago.create(
      [
        {
          cotizacion: cotizacion._id,
          solicitado_por: usuarioId,
          valor: valorFinal,
        },
      ],
      { session }
    );

    return cupon;
  });
}

/**
 * Registra el codigo del cupon y lo pasa a GENERADO.
 * Calcula la fecha de vencimiento con CUPON_VIGENCIA_DIAS.
 *
 * @param {{ cuponId: string, codigoCupon: string }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function generarCupon({ cuponId, codigoCupon }) {
  const codigo = String(codigoCupon || '').trim();
  if (!codigo) throw ApiError.badRequest('codigo_cupon es obligatorio');

  const fechaGeneracion = new Date();
  const fechaVencimiento = new Date(fechaGeneracion);
  fechaVencimiento.setDate(
    fechaVencimiento.getDate() + env.negocio.cuponVigenciaDias
  );

  const cupon = await CuponPago.findOneAndUpdate(
    { _id: cuponId, estado: ESTADO_CUPON.PENDIENTE },
    {
      $set: {
        codigo_cupon: codigo,
        estado: ESTADO_CUPON.GENERADO,
        fecha_generacion: fechaGeneracion,
        fecha_vencimiento: fechaVencimiento,
      },
    },
    { new: true, runValidators: true }
  );

  if (!cupon) {
    const existe = await CuponPago.exists({ _id: cuponId });
    if (!existe) throw ApiError.notFound('Cupon no encontrado');
    throw ApiError.conflict('Solo se genera un cupon PENDIENTE');
  }

  return cupon;
}

/** Popula el cupon con sus referencias. */
function poblarCupon(doc) {
  return doc.populate(POPULATE_CUPON);
}

/** GET /cupones — lista paginada (coordinador). */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.estado) {
    if (!ESTADO_CUPON_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }
  if (query.cotizacion) filtro.cotizacion = query.cotizacion;

  const [items, total] = await Promise.all([
    CuponPago.find(filtro)
      .populate(POPULATE_CUPON)
      .sort({ fecha_solicitud: -1 })
      .skip(skip)
      .limit(limit),
    CuponPago.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /cupones/mios — cupones de las solicitudes del cliente. */
async function listarMios(clienteId, query = {}) {
  const { page, limit, skip } = paginacion(query);

  const solicitudes = await Solicitud.find({ cliente: clienteId }).select('_id').lean();
  const cotizaciones = await Cotizacion.find({
    solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) },
  })
    .select('_id')
    .lean();

  const filtro = {
    cotizacion: { $in: cotizaciones.map((cotizacion) => cotizacion._id) },
  };

  if (query.estado) {
    if (!ESTADO_CUPON_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }

  const [items, total] = await Promise.all([
    CuponPago.find(filtro)
      .populate(POPULATE_CUPON)
      .sort({ fecha_solicitud: -1 })
      .skip(skip)
      .limit(limit),
    CuponPago.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /cupones/:id */
async function obtenerPorId(id) {
  const doc = await CuponPago.findById(id).populate(POPULATE_CUPON);
  if (!doc) throw ApiError.notFound('Cupon no encontrado');
  return doc;
}

/** POST /cupones/:id/recordatorios — RF-24. */
async function registrarRecordatorio(id) {
  const doc = await CuponPago.findById(id);
  if (!doc) throw ApiError.notFound('Cupon no encontrado');
  doc.recordatorios.push({ fecha_envio: new Date() });
  await doc.save();
  await doc.populate(POPULATE_CUPON);
  return doc;
}

/** PATCH /cupones/:id/estado — UTILIZADO o VENCIDO. */
async function cambiarEstado(id, body = {}) {
  const { estado } = body;
  if (![ESTADO_CUPON.UTILIZADO, ESTADO_CUPON.VENCIDO].includes(estado)) {
    throw ApiError.badRequest('estado debe ser UTILIZADO o VENCIDO');
  }

  const doc = await CuponPago.findById(id);
  if (!doc) throw ApiError.notFound('Cupon no encontrado');

  if (!puedeTransicionarCupon(doc.estado, estado)) {
    throw ApiError.conflict(`Transicion invalida de cupon: "${doc.estado}" -> "${estado}"`);
  }

  doc.estado = estado;
  await doc.save();
  await doc.populate(POPULATE_CUPON);
  return { doc, estado };
}

export {
  crearCupon,
  generarCupon,
  poblarCupon,
  listar,
  listarMios,
  obtenerPorId,
  registrarRecordatorio,
  cambiarEstado,
};
export default {
  crearCupon,
  generarCupon,
  poblarCupon,
  listar,
  listarMios,
  obtenerPorId,
  registrarRecordatorio,
  cambiarEstado,
};
