/**
 * Controlador del modulo: cupones (capa C de MVC).
 * Basado en: CuponPago (-> Cotizacion, solicitado_por -> Usuario). RF-06 / RF-24.
 * Vigencia fija de 5 dias (LIMITES.CUPON_VIGENCIA_DIAS) calculada por el modelo.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_CUPON_LISTA } from '../config/constants.js';
import CuponPago from '../models/servicios/CuponPago.js';
import Cotizacion from '../models/servicios/Cotizacion.js';

const POPULATE_CUPON = [
  { path: 'cotizacion', select: 'valor_total estado solicitud' },
  { path: 'solicitado_por', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un cupon con ese ${campo}`, err.keyValue);
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

/** GET /cupones — lista paginada. Filtros: estado, cotizacion. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_CUPON_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.cotizacion) filtro.cotizacion = req.query.cotizacion;
    const [items, total] = await Promise.all([
      CuponPago.find(filtro).populate(POPULATE_CUPON).sort({ fecha_solicitud: -1 }).skip(skip).limit(limit),
      CuponPago.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Cupones listados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /cupones/:id — detalle. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await CuponPago.findById(req.params.id).populate(POPULATE_CUPON);
    if (!doc) throw ApiError.notFound('Cupon no encontrado');
    res.json(new ApiResponse(doc, 'Cupon obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /cupones — el coordinador solicita cupon para una cotizacion aceptada.
 * Body: { cotizacion, valor }. solicitado_por sale del token.
 */
async function crear(req, res, next) {
  try {
    const { cotizacion, valor } = req.body || {};
    if (!cotizacion || valor === undefined) throw ApiError.badRequest('cotizacion y valor son obligatorios');
    const cot = await Cotizacion.findById(cotizacion);
    if (!cot) throw ApiError.badRequest('La cotizacion indicada no existe');
    if (cot.estado !== 'ACEPTADA') throw ApiError.badRequest('Solo se genera cupon de una cotizacion ACEPTADA');
    const solicitadoPor = actorId(req);
    if (!solicitadoPor) throw ApiError.unauthorized();
    const doc = await CuponPago.create({ cotizacion, valor, solicitado_por: solicitadoPor });
    await doc.populate(POPULATE_CUPON);
    res.status(201).json(new ApiResponse(doc, 'Cupon solicitado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /cupones/:id/generar — registra el codigo de Produccion de Centro.
 * Body: { codigo_cupon }. Fija fecha_generacion (el modelo calcula vencimiento +5 dias).
 */
async function generar(req, res, next) {
  try {
    const { codigo_cupon } = req.body || {};
    if (!codigo_cupon) throw ApiError.badRequest('codigo_cupon es obligatorio');
    const doc = await CuponPago.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Cupon no encontrado');
    if (doc.estado !== 'PENDIENTE') throw ApiError.badRequest('Solo se genera un cupon PENDIENTE');
    doc.codigo_cupon = String(codigo_cupon).trim();
    doc.estado = 'GENERADO';
    doc.fecha_generacion = new Date();
    await doc.save();
    await doc.populate(POPULATE_CUPON);
    res.json(new ApiResponse(doc, 'Cupon generado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** POST /cupones/:id/recordatorios — RF-24, deja constancia de aviso de vencimiento. */
async function registrarRecordatorio(req, res, next) {
  try {
    const doc = await CuponPago.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Cupon no encontrado');
    doc.recordatorios.push({ fecha_envio: new Date() });
    await doc.save();
    await doc.populate(POPULATE_CUPON);
    res.json(new ApiResponse(doc, 'Recordatorio registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PATCH /cupones/:id/estado — marca UTILIZADO o VENCIDO. */
async function cambiarEstado(req, res, next) {
  try {
    const { estado } = req.body || {};
    if (!['UTILIZADO', 'VENCIDO'].includes(estado)) throw ApiError.badRequest('estado debe ser UTILIZADO o VENCIDO');
    const doc = await CuponPago.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Cupon no encontrado');
    doc.estado = estado;
    await doc.save();
    await doc.populate(POPULATE_CUPON);
    res.json(new ApiResponse(doc, `Cupon marcado como ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, crear, generar, registrarRecordatorio, cambiarEstado };
export default { listar, obtenerPorId, crear, generar, registrarRecordatorio, cambiarEstado };
