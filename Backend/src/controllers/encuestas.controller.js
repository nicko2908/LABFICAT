/**
 * Controlador del modulo: encuestas (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/encuesta.service.js.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  responderEncuesta,
  poblarEncuesta,
  listar as listarEncuestas,
  listarMias as listarEncuestasMias,
  obtenerPorId as obtenerEncuesta,
  obtenerSolicitud,
  resumen as resumenEncuestas,
} from '../services/encuesta.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioEncuesta,
  verificarPropietarioSolicitud,
} from '../utils/propietario.js';

/** GET /encuestas */
async function listar(req, res, next) {
  try {
    const datos = await listarEncuestas(req.query);
    res.json(new ApiResponse(datos, 'Encuestas listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'encuesta', femenino: true }));
  }
}

/** GET /encuestas/mias */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarEncuestasMias(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis encuestas listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'encuesta', femenino: true }));
  }
}

/** GET /encuestas/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerEncuesta(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioEncuesta(doc, req.usuario);
    }
    res.json(new ApiResponse(doc, 'Encuesta obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'encuesta', femenino: true }));
  }
}

/** POST /encuestas */
async function responder(req, res, next) {
  try {
    const { solicitud } = req.body || {};
    if (!solicitud) throw ApiError.badRequest('solicitud es obligatoria');

    const sol = await obtenerSolicitud(solicitud);
    await verificarPropietarioSolicitud(sol, req.usuario);

    const doc = await responderEncuesta({
      solicitudId: sol._id,
      datos: req.body || {},
    });

    await poblarEncuesta(doc);
    res.status(201).json(new ApiResponse(doc, 'Encuesta registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'encuesta', femenino: true }));
  }
}

/** GET /encuestas/resumen/global */
async function resumen(req, res, next) {
  try {
    const datos = await resumenEncuestas();
    res.json(new ApiResponse(datos, 'Resumen obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'encuesta', femenino: true }));
  }
}

export { listar, listarMias, obtenerPorId, responder, resumen };
export default { listar, listarMias, obtenerPorId, responder, resumen };
