/**
 * Service del modulo: encuesta.
 *
 * Reglas:
 *  - Una sola encuesta por solicitud.
 *  - Solo se responde cuando el informe esta listo o la solicitud finalizada.
 *  - Puntajes enteros de 1 a 5.
 *  - recomendaria_servicio es booleano.
 */
import ApiError from '../utils/ApiError.js';
import { paginacion } from '../utils/paginacion.js';
import { ESTADO_SOLICITUD } from '../config/constants.js';
import { parseBoolean } from '../utils/booleanos.js';
import Encuesta from '../models/calidad/Encuesta.js';
import Solicitud from '../models/servicios/Solicitud.js';

const POPULATE_ENCUESTA = [{ path: 'solicitud', select: 'codigo_solicitud estado cliente' }];

const CAMPOS_PUNTAJE = [
  'satisfaccion_general',
  'tiempo_entrega',
  'atencion_personal',
  'claridad_informe',
];

/**
 * Registra la respuesta de satisfaccion del cliente.
 *
 * @param {{
 *   solicitudId: string|import('mongoose').Types.ObjectId,
 *   datos: Record<string, unknown>,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function responderEncuesta({ solicitudId, datos = {} }) {
  if (!solicitudId) throw ApiError.badRequest('solicitud es obligatoria');

  const solicitud = await Solicitud.findById(solicitudId);
  if (!solicitud) {
    throw ApiError.badRequest('La solicitud indicada no existe');
  }

  const estadosPermitidos = [
    ESTADO_SOLICITUD.INFORME_LISTO,
    ESTADO_SOLICITUD.FINALIZADA,
  ];
  if (!estadosPermitidos.includes(solicitud.estado)) {
    throw ApiError.conflict(
      'La encuesta solo se responde cuando el informe esta listo'
    );
  }

  const previa = await Encuesta.exists({ solicitud: solicitud._id });
  if (previa) throw ApiError.conflict('La solicitud ya tiene encuesta');

  const puntajes = {};
  for (const campo of CAMPOS_PUNTAJE) {
    const valor = Number(datos[campo]);
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      throw ApiError.badRequest(`${campo} debe ser un entero entre 1 y 5`);
    }
    puntajes[campo] = valor;
  }

  const recomendaria = parseBoolean(datos.recomendaria_servicio);
  if (recomendaria === null) {
    throw ApiError.badRequest('recomendaria_servicio debe ser booleano');
  }

  const comentarios =
    datos.comentarios === undefined || datos.comentarios === null
      ? null
      : String(datos.comentarios).trim();

  const [encuesta] = await Encuesta.create([
    {
      solicitud: solicitud._id,
      ...puntajes,
      recomendaria_servicio: recomendaria,
      comentarios,
    },
  ]);

  return encuesta;
}

/** Popula la encuesta con sus referencias. */
function poblarEncuesta(doc) {
  return doc.populate(POPULATE_ENCUESTA);
}

/** GET /encuestas */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.solicitud) filtro.solicitud = query.solicitud;

  const [items, total] = await Promise.all([
    Encuesta.find(filtro)
      .populate(POPULATE_ENCUESTA)
      .sort({ fecha_respuesta: -1 })
      .skip(skip)
      .limit(limit),
    Encuesta.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /encuestas/mias */
async function listarMias(clienteId, query = {}) {
  const { page, limit, skip } = paginacion(query);

  const solicitudes = await Solicitud.find({ cliente: clienteId }).select('_id').lean();
  const filtro = { solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) } };

  const [items, total] = await Promise.all([
    Encuesta.find(filtro)
      .populate(POPULATE_ENCUESTA)
      .sort({ fecha_respuesta: -1 })
      .skip(skip)
      .limit(limit),
    Encuesta.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /encuestas/:id */
async function obtenerPorId(id) {
  const doc = await Encuesta.findById(id).populate(POPULATE_ENCUESTA);
  if (!doc) throw ApiError.notFound('Encuesta no encontrada');
  return doc;
}

/** Solicitud asociada (para autorizar antes de responder). */
async function obtenerSolicitud(solicitudId) {
  const sol = await Solicitud.findById(solicitudId);
  if (!sol) throw ApiError.badRequest('La solicitud indicada no existe');
  return sol;
}

/** GET /encuestas/resumen/global — promedios 1-5 y % recomendacion. */
async function resumen() {
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
  return agg || { total: 0 };
}

export {
  responderEncuesta,
  poblarEncuesta,
  listar,
  listarMias,
  obtenerPorId,
  obtenerSolicitud,
  resumen,
};
export default {
  responderEncuesta,
  poblarEncuesta,
  listar,
  listarMias,
  obtenerPorId,
  obtenerSolicitud,
  resumen,
};
