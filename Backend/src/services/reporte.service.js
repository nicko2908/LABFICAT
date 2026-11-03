/**
 * Service del modulo: reportes (RF-20 / RF-24).
 *
 * Sin modelo propio: agrega Solicitud, Muestra, Informe, Encuesta,
 * Reclamacion y OrdenAnalisis.
 */
import ApiError from '../utils/ApiError.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Muestra from '../models/laboratorio/Muestra.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import Informe from '../models/calidad/Informe.js';
import Encuesta from '../models/calidad/Encuesta.js';
import Reclamacion from '../models/calidad/Reclamacion.js';

function filtroFechas(query = {}, campo = 'createdAt') {
  const filtro = {};
  if (query.desde || query.hasta) {
    filtro[campo] = {};
    if (query.desde) filtro[campo].$gte = new Date(query.desde);
    if (query.hasta) filtro[campo].$lte = new Date(query.hasta);
  }
  return filtro;
}

/** GET /reportes/solicitudes — conteo por estado. */
async function resumenSolicitudes(query = {}) {
  const match = filtroFechas(query);
  const items = await Solicitud.aggregate([
    { $match: match },
    { $group: { _id: '$estado', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  return { items, total: items.reduce((acc, r) => acc + r.total, 0) };
}

/** GET /reportes/muestras — recepcion y cola por prioridad. */
async function resumenMuestras(query = {}) {
  const match = filtroFechas(query, 'fecha_recepcion');
  const [porRecepcion, porPrioridad] = await Promise.all([
    Muestra.aggregate([{ $match: match }, { $group: { _id: '$estado_recepcion', total: { $sum: 1 } } }]),
    Muestra.aggregate([
      { $match: match },
      { $group: { _id: '$prioridad', total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  return { porRecepcion, porPrioridad };
}

/** GET /reportes/operacion — ordenes, informes y reclamaciones. */
async function resumenOperacion() {
  const [ordenes, informes, reclamaciones] = await Promise.all([
    OrdenAnalisis.aggregate([{ $group: { _id: '$estado', total: { $sum: 1 } } }]),
    Informe.countDocuments({}),
    Reclamacion.aggregate([{ $group: { _id: '$estado', total: { $sum: 1 } } }]),
  ]);
  return { ordenes, informesGenerados: informes, reclamaciones };
}

/** GET /reportes/satisfaccion — promedios de encuesta. */
async function resumenSatisfaccion(query = {}) {
  const match = {};
  if (query.desde || query.hasta) {
    match.fecha_respuesta = {};
    if (query.desde) match.fecha_respuesta.$gte = new Date(query.desde);
    if (query.hasta) match.fecha_respuesta.$lte = new Date(query.hasta);
  }

  const [agg] = await Encuesta.aggregate([
    { $match: match },
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

  if (!agg) throw ApiError.notFound('Sin encuestas en el periodo');
  return agg;
}

export { resumenSolicitudes, resumenMuestras, resumenOperacion, resumenSatisfaccion };
export default {
  resumenSolicitudes,
  resumenMuestras,
  resumenOperacion,
  resumenSatisfaccion,
};
