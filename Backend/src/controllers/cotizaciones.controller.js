/**
 * Controlador del modulo: cotizaciones (capa C de MVC).
 * Basado en: Cotizacion (-> Solicitud 1:1, detalle -> Analisis). RF-04 / RF-05.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_COTIZACION_LISTA } from '../config/constants.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Analisis from '../models/laboratorio/Analisis.js';

const POPULATE_COTIZACION = [
  { path: 'solicitud', select: 'codigo_solicitud estado cliente' },
  { path: 'detalle.analisis', select: 'nombre tarifa_externo activo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una cotizacion con ese ${campo}`, err.keyValue);
  }
  if (err && err.name === 'ValidationError') return ApiError.badRequest('Datos invalidos', err.errors);
  if (err && err.name === 'CastError') return ApiError.badRequest('Identificador invalido');
  return err;
}

function paginacion(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** GET /cotizaciones — lista paginada. Filtros: estado, solicitud. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_COTIZACION_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.solicitud) filtro.solicitud = req.query.solicitud;
    const [items, total] = await Promise.all([
      Cotizacion.find(filtro).populate(POPULATE_COTIZACION).sort({ fecha_emision: -1 }).skip(skip).limit(limit),
      Cotizacion.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Cotizaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /cotizaciones/:id — detalle. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Cotizacion.findById(req.params.id).populate(POPULATE_COTIZACION);
    if (!doc) throw ApiError.notFound('Cotizacion no encontrada');
    res.json(new ApiResponse(doc, 'Cotizacion obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /cotizaciones — crea la cotizacion 1:1 de una solicitud.
 * Body: { solicitud, detalle: [{ analisis, tarifa_aplicada }] }.
 * valor_total se calcula como suma del detalle si no se envia.
 */
async function crear(req, res, next) {
  try {
    const { solicitud, detalle, valor_total } = req.body || {};
    if (!solicitud || !detalle) throw ApiError.badRequest('solicitud y detalle son obligatorios');
    if (!Array.isArray(detalle) || detalle.length === 0) throw ApiError.badRequest('detalle debe ser un arreglo no vacio');
    const sol = await Solicitud.exists({ _id: solicitud });
    if (!sol) throw ApiError.badRequest('La solicitud indicada no existe');
    const previa = await Cotizacion.exists({ solicitud });
    if (previa) throw ApiError.conflict('La solicitud ya tiene cotizacion');
    const ids = detalle.map((d) => d.analisis);
    const n = await Analisis.countDocuments({ _id: { $in: ids } });
    if (n !== ids.length) throw ApiError.badRequest('Uno o mas analisis del detalle no existen');
    const total = valor_total !== undefined ? valor_total : detalle.reduce((acc, d) => acc + Number(d.tarifa_aplicada || 0), 0);
    const doc = await Cotizacion.create({ solicitud, detalle, valor_total: total });
    await doc.populate(POPULATE_COTIZACION);
    res.status(201).json(new ApiResponse(doc, 'Cotizacion creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PUT /cotizaciones/:id — actualiza detalle/valor (solo en PENDIENTE). */
async function actualizar(req, res, next) {
  try {
    const actual = await Cotizacion.findById(req.params.id);
    if (!actual) throw ApiError.notFound('Cotizacion no encontrada');
    if (actual.estado !== 'PENDIENTE') throw ApiError.badRequest('Solo se puede editar una cotizacion PENDIENTE');
    if (req.body.detalle !== undefined) {
      const ids = req.body.detalle.map((d) => d.analisis);
      const n = await Analisis.countDocuments({ _id: { $in: ids } });
      if (n !== ids.length) throw ApiError.badRequest('Uno o mas analisis del detalle no existen');
      actual.detalle = req.body.detalle;
      actual.valor_total = req.body.valor_total !== undefined
        ? req.body.valor_total
        : req.body.detalle.reduce((acc, d) => acc + Number(d.tarifa_aplicada || 0), 0);
    } else if (req.body.valor_total !== undefined) {
      actual.valor_total = req.body.valor_total;
    }
    await actual.save();
    await actual.populate(POPULATE_COTIZACION);
    res.json(new ApiResponse(actual, 'Cotizacion actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /cotizaciones/:id/decision — RF-05 aceptar/rechazar.
 * Aceptar exige firma digital: { decision: 'ACEPTADA', firma_ruta, firma_ip? }.
 * Rechazar exige motivo: { decision: 'RECHAZADA', motivo_rechazo }.
 */
async function decidir(req, res, next) {
  try {
    const { decision, firma_ruta, firma_ip, motivo_rechazo } = req.body || {};
    if (!['ACEPTADA', 'RECHAZADA'].includes(decision)) throw ApiError.badRequest('decision debe ser ACEPTADA o RECHAZADA');
    const doc = await Cotizacion.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Cotizacion no encontrada');
    if (doc.estado !== 'PENDIENTE') throw ApiError.badRequest('La cotizacion ya fue decidida');
    if (decision === 'ACEPTADA') {
      if (!firma_ruta) throw ApiError.badRequest('firma_ruta es obligatoria para aceptar (firma digital RF-05)');
      doc.estado = 'ACEPTADA';
      doc.firma_ruta = firma_ruta;
      doc.firma_fecha = new Date();
      doc.firma_ip = firma_ip || req.ip || null;
      doc.motivo_rechazo = null;
    } else {
      if (!motivo_rechazo) throw ApiError.badRequest('motivo_rechazo es obligatorio para rechazar');
      doc.estado = 'RECHAZADA';
      doc.motivo_rechazo = motivo_rechazo;
    }
    doc.fecha_decision = new Date();
    await doc.save();
    await doc.populate(POPULATE_COTIZACION);
    res.json(new ApiResponse(doc, `Cotizacion ${decision.toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, crear, actualizar, decidir };
export default { listar, obtenerPorId, crear, actualizar, decidir };
