/**
 * Controlador del modulo: reportes (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/reporte.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  resumenSolicitudes as resumenSolicitudesService,
  resumenMuestras as resumenMuestrasService,
  resumenOperacion as resumenOperacionService,
  resumenSatisfaccion as resumenSatisfaccionService,
} from '../services/reporte.service.js';

/** GET /reportes/solicitudes */
async function resumenSolicitudes(req, res, next) {
  try {
    const datos = await resumenSolicitudesService(req.query);
    res.json(new ApiResponse(datos, 'Resumen de solicitudes'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reporte' }));
  }
}

/** GET /reportes/muestras */
async function resumenMuestras(req, res, next) {
  try {
    const datos = await resumenMuestrasService(req.query);
    res.json(new ApiResponse(datos, 'Resumen de muestras'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reporte' }));
  }
}

/** GET /reportes/operacion */
async function resumenOperacion(req, res, next) {
  try {
    const datos = await resumenOperacionService();
    res.json(new ApiResponse(datos, 'Resumen operativo'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reporte' }));
  }
}

/** GET /reportes/satisfaccion */
async function resumenSatisfaccion(req, res, next) {
  try {
    const datos = await resumenSatisfaccionService(req.query);
    res.json(new ApiResponse(datos, 'Satisfaccion promediada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reporte' }));
  }
}

export { resumenSolicitudes, resumenMuestras, resumenOperacion, resumenSatisfaccion };
export default { resumenSolicitudes, resumenMuestras, resumenOperacion, resumenSatisfaccion };
