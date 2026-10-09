/**
 * Controlador del modulo: pagos (capa C de MVC).
 * Basado en: SoportePago (-> CuponPago 1:1, validador -> Usuario). RF-07 / RF-08.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_SOPORTE_PAGO_LISTA } from '../config/constants.js';
import SoportePago from '../models/servicios/SoportePago.js';
import CuponPago from '../models/servicios/CuponPago.js';

const POPULATE_SOPORTE = [
  { path: 'cupon', select: 'codigo_cupon valor estado cotizacion' },
  { path: 'validador', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un soporte con ese ${campo}`, err.keyValue);
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

function actorId(req) {
  return (req.usuario && (req.usuario.id || req.usuario.sub)) || req.usuarioId || null;
}

/** GET /pagos — lista paginada. Filtros: estado, cupon. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_SOPORTE_PAGO_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.cupon) filtro.cupon = req.query.cupon;
    const [items, total] = await Promise.all([
      SoportePago.find(filtro).populate(POPULATE_SOPORTE).sort({ fecha_carga: -1 }).skip(skip).limit(limit),
      SoportePago.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Soportes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /pagos/:id — detalle. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await SoportePago.findById(req.params.id).populate(POPULATE_SOPORTE);
    if (!doc) throw ApiError.notFound('Soporte no encontrado');
    res.json(new ApiResponse(doc, 'Soporte obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /pagos — RF-07 el cliente carga el comprobante de un cupon GENERADO.
 * Body: { cupon, ruta_archivo, formato }.
 */
async function cargar(req, res, next) {
  try {
    const { cupon, ruta_archivo, formato } = req.body || {};
    if (!cupon || !ruta_archivo || !formato) throw ApiError.badRequest('cupon, ruta_archivo y formato son obligatorios');
    const cup = await CuponPago.findById(cupon);
    if (!cup) throw ApiError.badRequest('El cupon indicado no existe');
    if (cup.estado !== 'GENERADO') throw ApiError.badRequest('Solo se carga soporte de un cupon GENERADO');
    const previo = await SoportePago.exists({ cupon });
    if (previo) throw ApiError.conflict('El cupon ya tiene soporte. Use reenviar si fue rechazado');
    const doc = await SoportePago.create({ cupon, ruta_archivo, formato });
    await doc.populate(POPULATE_SOPORTE);
    res.status(201).json(new ApiResponse(doc, 'Soporte cargado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PUT /pagos/:id/reenviar — si fue RECHAZADO el cliente actualiza el mismo documento.
 * Body: { ruta_archivo, formato }.
 */
async function reenviar(req, res, next) {
  try {
    const { ruta_archivo, formato } = req.body || {};
    if (!ruta_archivo || !formato) throw ApiError.badRequest('ruta_archivo y formato son obligatorios');
    const doc = await SoportePago.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Soporte no encontrado');
    if (doc.estado !== 'RECHAZADO') throw ApiError.badRequest('Solo se reenvia un soporte RECHAZADO');
    doc.ruta_archivo = ruta_archivo;
    doc.formato = formato;
    doc.estado = 'PENDIENTE_VERIFICACION';
    doc.validador = null;
    doc.fecha_validacion = null;
    await doc.save();
    await doc.populate(POPULATE_SOPORTE);
    res.json(new ApiResponse(doc, 'Soporte reenviado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /pagos/:id/validar — RF-08 el coordinador aprueba o rechaza.
 * Body: { decision: 'APROBADO' | 'RECHAZADO', observaciones? }.
 */
async function validar(req, res, next) {
  try {
    const { decision, observaciones } = req.body || {};
    if (!['APROBADO', 'RECHAZADO'].includes(decision)) throw ApiError.badRequest('decision debe ser APROBADO o RECHAZADO');
    const validador = actorId(req);
    if (!validador) throw ApiError.unauthorized();
    const doc = await SoportePago.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Soporte no encontrado');
    if (doc.estado !== 'PENDIENTE_VERIFICACION') throw ApiError.badRequest('El soporte ya fue validado');
    doc.estado = decision;
    doc.validador = validador;
    doc.fecha_validacion = new Date();
    if (observaciones !== undefined) doc.observaciones = observaciones;
    await doc.save();
    await doc.populate(POPULATE_SOPORTE);
    res.json(new ApiResponse(doc, `Soporte ${decision.toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, cargar, reenviar, validar };
export default { listar, obtenerPorId, cargar, reenviar, validar };
