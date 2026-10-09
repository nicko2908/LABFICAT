/**
 * Controlador del modulo: muestras (capa C de MVC).
 * Basado en: Muestra (-> Solicitud, TipoMuestra, Usuario) + Rotulo 1:1 + HistorialPrioridad.
 * RF-09 / RF-10 / RF-11 / RF-22.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Rotulo from '../models/laboratorio/Rotulo.js';
import HistorialPrioridad from '../models/laboratorio/HistorialPrioridad.js';
import Solicitud from '../models/servicios/Solicitud.js';
import TipoMuestra from '../models/laboratorio/TipoMuestra.js';
import Analisis from '../models/laboratorio/Analisis.js';

const POPULATE_MUESTRA = [
  { path: 'solicitud', select: 'codigo_solicitud estado cliente' },
  { path: 'tipo_muestra', select: 'nombre estado_fisico' },
  { path: 'usuario', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una muestra con ese ${campo}`, err.keyValue);
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

/** GET /muestras — lista paginada. Filtros: estado_recepcion, prioridad, solicitud, search (codigo). */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado_recepcion) filtro.estado_recepcion = req.query.estado_recepcion;
    if (req.query.prioridad) filtro.prioridad = Number(req.query.prioridad);
    if (req.query.solicitud) filtro.solicitud = req.query.solicitud;
    if (req.query.search) filtro.codigo_muestra = new RegExp(String(req.query.search).trim(), 'i');
    const [items, total] = await Promise.all([
      Muestra.find(filtro).populate(POPULATE_MUESTRA).sort({ prioridad: 1, fecha_recepcion: 1 }).skip(skip).limit(limit),
      Muestra.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Muestras listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /muestras/:id — detalle + rotulo + historial de prioridad. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Muestra.findById(req.params.id).populate(POPULATE_MUESTRA);
    if (!doc) throw ApiError.notFound('Muestra no encontrada');
    const [rotulo, historial] = await Promise.all([
      Rotulo.findOne({ muestra: doc._id }).populate('analisis', 'nombre tarifa_externo'),
      HistorialPrioridad.find({ muestra: doc._id }).populate('usuario', 'nombres apellidos').sort({ fecha_hora: 1 }),
    ]);
    res.json(new ApiResponse({ muestra: doc, rotulo, historialPrioridad: historial }, 'Muestra obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /muestras — RF-09 recepcion. El codigo LAB-AAAA-NNNN se autogenera.
 * Body: { solicitud, tipo_muestra, unidad_medida, fecha_recepcion, estado_recepcion, ...opcionales }.
 */
async function crear(req, res, next) {
  try {
    const { solicitud, tipo_muestra, unidad_medida, fecha_recepcion, estado_recepcion } = req.body || {};
    if (!solicitud || !tipo_muestra || !unidad_medida || !fecha_recepcion || !estado_recepcion) {
      throw ApiError.badRequest('solicitud, tipo_muestra, unidad_medida, fecha_recepcion y estado_recepcion son obligatorios');
    }
    const [sol, tm] = await Promise.all([
      Solicitud.exists({ _id: solicitud }),
      TipoMuestra.exists({ _id: tipo_muestra }),
    ]);
    if (!sol) throw ApiError.badRequest('La solicitud indicada no existe');
    if (!tm) throw ApiError.badRequest('El tipo de muestra indicado no existe');
    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();
    const doc = await Muestra.create({ ...req.body, usuario });
    await HistorialPrioridad.create({ muestra: doc._id, usuario, nivel: doc.prioridad || 3, motivo: 'Prioridad inicial de recepcion' });
    await doc.populate(POPULATE_MUESTRA);
    res.status(201).json(new ApiResponse(doc, 'Muestra registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PUT /muestras/:id — actualiza datos de recepcion (no codigo ni prioridad; ver endpoints propios). */
async function actualizar(req, res, next) {
  try {
    const prohibidos = ['codigo_muestra', 'prioridad', 'solicitud'];
    const cambios = { ...req.body };
    for (const k of prohibidos) delete cambios[k];
    if (Object.keys(cambios).length === 0) throw ApiError.badRequest('No hay campos validos para actualizar');
    const doc = await Muestra.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true }).populate(POPULATE_MUESTRA);
    if (!doc) throw ApiError.notFound('Muestra no encontrada');
    res.json(new ApiResponse(doc, 'Muestra actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /muestras/:id/prioridad — RF-22. Cambia prioridad y lo registra (motivo obligatorio).
 * Body: { nivel: 1-10, motivo }.
 */
async function cambiarPrioridad(req, res, next) {
  try {
    const { nivel, motivo } = req.body || {};
    if (nivel === undefined || !motivo) throw ApiError.badRequest('nivel y motivo son obligatorios');
    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();
    const doc = await Muestra.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Muestra no encontrada');
    doc.prioridad = nivel;
    await doc.save();
    const registro = await HistorialPrioridad.create({ muestra: doc._id, usuario, nivel, motivo });
    await doc.populate(POPULATE_MUESTRA);
    res.json(new ApiResponse({ muestra: doc, historial: registro }, 'Prioridad actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /muestras/:id/rotulo — RF-11 genera o actualiza el rotulo 1:1.
 * Body: { analisis: [ids], ruta_pdf? }.
 */
async function generarRotulo(req, res, next) {
  try {
    const { analisis, ruta_pdf } = req.body || {};
    const muestra = await Muestra.findById(req.params.id);
    if (!muestra) throw ApiError.notFound('Muestra no encontrada');
    if (analisis) {
      const n = await Analisis.countDocuments({ _id: { $in: analisis } });
      if (n !== analisis.length) throw ApiError.badRequest('Uno o mas analisis no existen');
    }
    const doc = await Rotulo.findOneAndUpdate(
      { muestra: muestra._id },
      { $set: { ...(analisis !== undefined ? { analisis } : {}), ...(ruta_pdf !== undefined ? { ruta_pdf } : {}) } },
      { new: true, runValidators: true, upsert: true }
    ).populate('analisis', 'nombre tarifa_externo');
    res.status(201).json(new ApiResponse(doc, 'Rotulo generado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, crear, actualizar, cambiarPrioridad, generarRotulo };
export default { listar, obtenerPorId, crear, actualizar, cambiarPrioridad, generarRotulo };
