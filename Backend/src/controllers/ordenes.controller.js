/**
 * Controlador del modulo: ordenes (capa C de MVC).
 * Basado en: OrdenAnalisis (-> Muestra, Analisis, Usuario, orden_anterior). RF-12 / RF-13 / RF-14.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_ORDEN_LISTA } from '../config/constants.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Analisis from '../models/laboratorio/Analisis.js';
import Parametro from '../models/laboratorio/Parametro.js';

const POPULATE_ORDEN = [
  { path: 'muestra', select: 'codigo_muestra estado_recepcion prioridad solicitud' },
  { path: 'analisis', select: 'nombre tarifa_externo' },
  { path: 'usuario', select: 'nombres apellidos correo' },
  { path: 'resultados.parametro', select: 'nombre unidad_medida' },
  { path: 'orden_anterior', select: 'numero_iteracion estado' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una orden con ese ${campo}`, err.keyValue);
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

/** GET /ordenes — lista paginada. Filtros: estado, muestra, analisis, usuario. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_ORDEN_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.muestra) filtro.muestra = req.query.muestra;
    if (req.query.analisis) filtro.analisis = req.query.analisis;
    if (req.query.usuario) filtro.usuario = req.query.usuario;
    const [items, total] = await Promise.all([
      OrdenAnalisis.find(filtro).populate(POPULATE_ORDEN).sort({ createdAt: -1 }).skip(skip).limit(limit),
      OrdenAnalisis.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Ordenes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /ordenes/:id — detalle. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await OrdenAnalisis.findById(req.params.id).populate(POPULATE_ORDEN);
    if (!doc) throw ApiError.notFound('Orden no encontrada');
    res.json(new ApiResponse(doc, 'Orden obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /ordenes — crea la orden de trabajo de un analisis sobre una muestra.
 * Body: { muestra, analisis, proceso?, observaciones? }. usuario sale del token.
 */
async function crear(req, res, next) {
  try {
    const { muestra, analisis, proceso, observaciones } = req.body || {};
    if (!muestra || !analisis) throw ApiError.badRequest('muestra y analisis son obligatorios');
    const [m, a] = await Promise.all([Muestra.exists({ _id: muestra }), Analisis.exists({ _id: analisis })]);
    if (!m) throw ApiError.badRequest('La muestra indicada no existe');
    if (!a) throw ApiError.badRequest('El analisis indicado no existe');
    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();
    const doc = await OrdenAnalisis.create({ muestra, analisis, usuario, proceso: proceso || null, observaciones: observaciones || null });
    await doc.populate(POPULATE_ORDEN);
    res.status(201).json(new ApiResponse(doc, 'Orden creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /ordenes/:id/estado — avanza PENDIENTE -> EN_PROCESO -> FINALIZADA / INVALIDADA.
 * Body: { estado }.
 */
async function avanzarEstado(req, res, next) {
  try {
    const { estado } = req.body || {};
    if (!ESTADO_ORDEN_LISTA.includes(estado)) throw ApiError.badRequest('estado invalido');
    const doc = await OrdenAnalisis.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Orden no encontrada');
    doc.estado = estado;
    if (estado === 'EN_PROCESO' && !doc.fecha_inicio) doc.fecha_inicio = new Date();
    if ((estado === 'FINALIZADA' || estado === 'INVALIDADA') && !doc.fecha_fin) doc.fecha_fin = new Date();
    await doc.save();
    await doc.populate(POPULATE_ORDEN);
    res.json(new ApiResponse(doc, `Orden en estado ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PUT /ordenes/:id/resultados — RF-13 registra valores por parametro.
 * Body: { resultados: [{ parametro, valor }] }.
 */
async function registrarResultados(req, res, next) {
  try {
    const { resultados } = req.body || {};
    if (!Array.isArray(resultados) || resultados.length === 0) throw ApiError.badRequest('resultados debe ser un arreglo no vacio');
    const ids = resultados.map((r) => r.parametro);
    const n = await Parametro.countDocuments({ _id: { $in: ids } });
    if (n !== ids.length) throw ApiError.badRequest('Uno o mas parametros no existen');
    const doc = await OrdenAnalisis.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Orden no encontrada');
    if (doc.estado === 'INVALIDADA') throw ApiError.badRequest('No se registran resultados en una orden INVALIDADA');
    doc.resultados = resultados;
    await doc.save();
    await doc.populate(POPULATE_ORDEN);
    res.json(new ApiResponse(doc, 'Resultados registrados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /ordenes/:id/repetir — RF-14 crea la siguiente iteracion.
 * Copia muestra/analisis/resultados vacios, enlaza orden_anterior e incrementa numero_iteracion.
 */
async function repetir(req, res, next) {
  try {
    const original = await OrdenAnalisis.findById(req.params.id);
    if (!original) throw ApiError.notFound('Orden no encontrada');
    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();
    const doc = await OrdenAnalisis.create({
      muestra: original.muestra,
      analisis: original.analisis,
      usuario,
      orden_anterior: original._id,
      numero_iteracion: (original.numero_iteracion || 1) + 1,
      proceso: original.proceso,
      observaciones: req.body?.observaciones || `Repeticion de ${original._id}`,
    });
    await doc.populate(POPULATE_ORDEN);
    res.status(201).json(new ApiResponse(doc, 'Orden repetida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, crear, avanzarEstado, registrarResultados, repetir };
export default { listar, obtenerPorId, crear, avanzarEstado, registrarResultados, repetir };
