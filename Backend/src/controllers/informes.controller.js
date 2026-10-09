/**
 * Controlador del modulo: informes (capa C de MVC).
 * Basado en: Informe (-> Muestra 1:1, Usuario). RF-15 / RF-16 / RF-17.
 * Regla: no se puede descargar sin responder la encuesta (se valida contra Encuesta).
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Informe from '../models/calidad/Informe.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Encuesta from '../models/calidad/Encuesta.js';

const POPULATE_INFORME = [
  { path: 'muestra', select: 'codigo_muestra estado_recepcion solicitud' },
  { path: 'usuario', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un informe con ese ${campo}`, err.keyValue);
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

/** GET /informes — lista paginada. Filtros: muestra. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.muestra) filtro.muestra = req.query.muestra;
    const [items, total] = await Promise.all([
      Informe.find(filtro).populate(POPULATE_INFORME).sort({ fecha_generacion: -1 }).skip(skip).limit(limit),
      Informe.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Informes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /informes/:id — detalle. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Informe.findById(req.params.id).populate(POPULATE_INFORME);
    if (!doc) throw ApiError.notFound('Informe no encontrado');
    res.json(new ApiResponse(doc, 'Informe obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /informes — RF-15 genera el informe 1:1 de una muestra aceptada.
 * Body: { muestra, ruta_pdf? }. usuario sale del token.
 */
async function generar(req, res, next) {
  try {
    const { muestra, ruta_pdf } = req.body || {};
    if (!muestra) throw ApiError.badRequest('muestra es obligatoria');
    const m = await Muestra.findById(muestra);
    if (!m) throw ApiError.badRequest('La muestra indicada no existe');
    if (m.estado_recepcion !== 'ACEPTADA') throw ApiError.badRequest('Solo se genera informe de una muestra ACEPTADA');
    const previo = await Informe.exists({ muestra });
    if (previo) throw ApiError.conflict('La muestra ya tiene informe');
    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();
    const doc = await Informe.create({ muestra, usuario, ruta_pdf: ruta_pdf || null });
    await doc.populate(POPULATE_INFORME);
    res.status(201).json(new ApiResponse(doc, 'Informe generado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PATCH /informes/:id/envio — RF-16 registra fecha_envio al cliente. */
async function registrarEnvio(req, res, next) {
  try {
    const doc = await Informe.findById(req.params.id).populate('muestra');
    if (!doc) throw ApiError.notFound('Informe no encontrado');
    doc.fecha_envio = new Date();
    await doc.save();
    await doc.populate(POPULATE_INFORME);
    res.json(new ApiResponse(doc, 'Envio registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /informes/:id/descarga — RF-17 bloqueada sin encuesta de la solicitud.
 * Exige que exista Encuesta para la solicitud de la muestra.
 */
async function registrarDescarga(req, res, next) {
  try {
    const doc = await Informe.findById(req.params.id).populate('muestra');
    if (!doc) throw ApiError.notFound('Informe no encontrado');
    const solicitudId = doc.muestra?.solicitud;
    if (!solicitudId) throw ApiError.badRequest('El informe no tiene solicitud asociada');
    const encuesta = await Encuesta.exists({ solicitud: solicitudId });
    if (!encuesta) throw ApiError.forbidden('Debe responder la encuesta de satisfaccion antes de descargar (RF-17)');
    doc.fecha_descarga = new Date();
    await doc.save();
    await doc.populate(POPULATE_INFORME);
    res.json(new ApiResponse(doc, 'Descarga registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, generar, registrarEnvio, registrarDescarga };
export default { listar, obtenerPorId, generar, registrarEnvio, registrarDescarga };
