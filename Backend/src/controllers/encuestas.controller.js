/**
 * Controlador del modulo: encuestas (capa C de MVC).
 * Basado en: Encuesta (-> Solicitud, unica por solicitud). RF-17.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Encuesta from '../models/calidad/Encuesta.js';
import Solicitud from '../models/servicios/Solicitud.js';

const POPULATE_ENCUESTA = [{ path: 'solicitud', select: 'codigo_solicitud estado cliente' }];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una encuesta con ese ${campo}`, err.keyValue);
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

/** GET /encuestas — lista paginada. Filtro: solicitud. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.solicitud) filtro.solicitud = req.query.solicitud;
    const [items, total] = await Promise.all([
      Encuesta.find(filtro).populate(POPULATE_ENCUESTA).sort({ fecha_respuesta: -1 }).skip(skip).limit(limit),
      Encuesta.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Encuestas listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /encuestas/:id — detalle. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Encuesta.findById(req.params.id).populate(POPULATE_ENCUESTA);
    if (!doc) throw ApiError.notFound('Encuesta no encontrada');
    res.json(new ApiResponse(doc, 'Encuesta obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /encuestas — el cliente responde una sola vez por solicitud.
 * Body: { solicitud, satisfaccion_general, tiempo_entrega, atencion_personal,
 *         claridad_informe, recomendaria_servicio, comentarios? } (puntajes 1-5).
 */
async function responder(req, res, next) {
  try {
    const { solicitud } = req.body || {};
    if (!solicitud) throw ApiError.badRequest('solicitud es obligatoria');
    const sol = await Solicitud.exists({ _id: solicitud });
    if (!sol) throw ApiError.badRequest('La solicitud indicada no existe');
    const previa = await Encuesta.exists({ solicitud });
    if (previa) throw ApiError.conflict('La solicitud ya tiene encuesta');
    const doc = await Encuesta.create(req.body);
    await doc.populate(POPULATE_ENCUESTA);
    res.status(201).json(new ApiResponse(doc, 'Encuesta registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /encuestas/resumen/global — promedios 1-5 y % recomendacion (RF-20 / reportes). */
async function resumen(req, res, next) {
  try {
    const [agg] = await Encuesta.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          satisfaccion_general: { $avg: '$satisfaccion_general' },
          tiempo_entrega: { $avg: '$tiempo_entrega' },
          atencion_personal: { $avg: '$atencion_personal' },
          claridad_informe: { $avg: '$claridad_informe' },
          recomiendan: { $sum: { $cond: ['$recomendaria_servicio', 1, 0] } },
        },
      },
    ]);
    res.json(new ApiResponse(agg || { total: 0 }, 'Resumen obtenido'));
  } catch (err) {
    next(err);
  }
}

export { listar, obtenerPorId, responder, resumen };
export default { listar, obtenerPorId, responder, resumen };
