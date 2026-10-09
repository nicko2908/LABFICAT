/**
 * Controlador del modulo: reclamaciones (capa C de MVC).
 * Basado en: Reclamacion (-> Solicitud) + evidencias embebidas. RF-18.
 * Codigo REC-AAAA-NNNN autogenerado por el modelo.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_RECLAMACION_LISTA } from '../config/constants.js';
import Reclamacion from '../models/calidad/Reclamacion.js';
import Solicitud from '../models/servicios/Solicitud.js';

const POPULATE_RECLAMACION = [{ path: 'solicitud', select: 'codigo_solicitud estado cliente' }];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una reclamacion con ese ${campo}`, err.keyValue);
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

/** GET /reclamaciones — lista paginada. Filtros: estado, solicitud, search (codigo_soporte). */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_RECLAMACION_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.solicitud) filtro.solicitud = req.query.solicitud;
    if (req.query.search) filtro.codigo_soporte = new RegExp(String(req.query.search).trim(), 'i');
    const [items, total] = await Promise.all([
      Reclamacion.find(filtro).populate(POPULATE_RECLAMACION).sort({ fecha_registro: -1 }).skip(skip).limit(limit),
      Reclamacion.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Reclamaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /reclamaciones/:id — detalle. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Reclamacion.findById(req.params.id).populate(POPULATE_RECLAMACION);
    if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
    res.json(new ApiResponse(doc, 'Reclamacion obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /reclamaciones — RF-18 el cliente reclama sobre una solicitud.
 * Body: { solicitud, motivo, evidencias?: [{ ruta_archivo, formato }] }.
 */
async function crear(req, res, next) {
  try {
    const { solicitud, motivo, evidencias } = req.body || {};
    if (!solicitud || !motivo) throw ApiError.badRequest('solicitud y motivo son obligatorios');
    const sol = await Solicitud.exists({ _id: solicitud });
    if (!sol) throw ApiError.badRequest('La solicitud indicada no existe');
    const doc = await Reclamacion.create({ solicitud, motivo, evidencias: evidencias || [] });
    await doc.populate(POPULATE_RECLAMACION);
    res.status(201).json(new ApiResponse(doc, 'Reclamacion registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** POST /reclamaciones/:id/evidencias — agrega imagen de soporte (PNG/JPG/JPEG). */
async function agregarEvidencia(req, res, next) {
  try {
    const { ruta_archivo, formato } = req.body || {};
    if (!ruta_archivo || !formato) throw ApiError.badRequest('ruta_archivo y formato son obligatorios');
    const doc = await Reclamacion.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
    if (doc.estado !== 'ABIERTA') throw ApiError.badRequest('Solo se agregan evidencias a una reclamacion ABIERTA');
    doc.evidencias.push({ ruta_archivo, formato });
    await doc.save();
    await doc.populate(POPULATE_RECLAMACION);
    res.json(new ApiResponse(doc, 'Evidencia agregada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PATCH /reclamaciones/:id/estado — ABIERTA -> RESUELTA (fija fecha_resolucion). */
async function cambiarEstado(req, res, next) {
  try {
    const { estado } = req.body || {};
    if (!ESTADO_RECLAMACION_LISTA.includes(estado)) throw ApiError.badRequest('estado invalido');
    const doc = await Reclamacion.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
    doc.estado = estado;
    if (estado === 'RESUELTA' && !doc.fecha_resolucion) doc.fecha_resolucion = new Date();
    if (estado === 'ABIERTA') doc.fecha_resolucion = null;
    await doc.save();
    await doc.populate(POPULATE_RECLAMACION);
    res.json(new ApiResponse(doc, `Reclamacion ${estado.toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, crear, agregarEvidencia, cambiarEstado };
export default { listar, obtenerPorId, crear, agregarEvidencia, cambiarEstado };
