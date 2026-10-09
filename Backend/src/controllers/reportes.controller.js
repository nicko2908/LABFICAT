/**
 * Controlador del modulo: reportes (capa C de MVC).
 * Sin modelo propio: agrega Solicitud, Muestra, Informe, Encuesta, Reclamacion, OrdenAnalisis.
 * RF-20 / RF-24.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Muestra from '../models/laboratorio/Muestra.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import Informe from '../models/calidad/Informe.js';
import Encuesta from '../models/calidad/Encuesta.js';
import Reclamacion from '../models/calidad/Reclamacion.js';

function filtroFechas(req, campo = 'createdAt') {
  const filtro = {};
  if (req.query.desde || req.query.hasta) {
    filtro[campo] = {};
    if (req.query.desde) filtro[campo].$gte = new Date(req.query.desde);
    if (req.query.hasta) filtro[campo].$lte = new Date(req.query.hasta);
  }
  return filtro;
}

/** GET /reportes/solicitudes — conteo por estado (filtros: desde, hasta). */
async function resumenSolicitudes(req, res, next) {
  try {
    const match = filtroFechas(req);
    const items = await Solicitud.aggregate([{ $match: match }, { $group: { _id: '$estado', total: { $sum: 1 } } }, { $sort: { total: -1 } }]);
    const total = items.reduce((acc, r) => acc + r.total, 0);
    res.json(new ApiResponse({ items, total }, 'Resumen de solicitudes'));
  } catch (err) {
    next(err);
  }
}

/** GET /reportes/muestras — recepcion y cola por prioridad (filtros: desde, hasta). */
async function resumenMuestras(req, res, next) {
  try {
    const match = filtroFechas(req, 'fecha_recepcion');
    const [porRecepcion, porPrioridad] = await Promise.all([
      Muestra.aggregate([{ $match: match }, { $group: { _id: '$estado_recepcion', total: { $sum: 1 } } }]),
      Muestra.aggregate([{ $match: match }, { $group: { _id: '$prioridad', total: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    res.json(new ApiResponse({ porRecepcion, porPrioridad }, 'Resumen de muestras'));
  } catch (err) {
    next(err);
  }
}

/** GET /reportes/operacion — ordenes por estado, informes generados, reclamaciones abiertas/resueltas. */
async function resumenOperacion(req, res, next) {
  try {
    const [ordenes, informes, reclamaciones] = await Promise.all([
      OrdenAnalisis.aggregate([{ $group: { _id: '$estado', total: { $sum: 1 } } }]),
      Informe.countDocuments({}),
      Reclamacion.aggregate([{ $group: { _id: '$estado', total: { $sum: 1 } } }]),
    ]);
    res.json(new ApiResponse({ ordenes, informesGenerados: informes, reclamaciones }, 'Resumen operativo'));
  } catch (err) {
    next(err);
  }
}

/** GET /reportes/satisfaccion — promedios de encuesta (filtros: desde, hasta por fecha_respuesta). */
async function resumenSatisfaccion(req, res, next) {
  try {
    const match = {};
    if (req.query.desde || req.query.hasta) {
      match.fecha_respuesta = {};
      if (req.query.desde) match.fecha_respuesta.$gte = new Date(req.query.desde);
      if (req.query.hasta) match.fecha_respuesta.$lte = new Date(req.query.hasta);
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
    res.json(new ApiResponse(agg, 'Satisfaccion promediada'));
  } catch (err) {
    next(err);
  }
}

export { resumenSolicitudes, resumenMuestras, resumenOperacion, resumenSatisfaccion };
export default { resumenSolicitudes, resumenMuestras, resumenOperacion, resumenSatisfaccion };
