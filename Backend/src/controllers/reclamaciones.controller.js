/**
 * Controlador del modulo: reclamaciones (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/reclamacion.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  listar as listarReclamaciones,
  obtenerPorId as obtenerReclamacion,
  crear as crearReclamacion,
  agregarEvidencia as agregarEvidenciaService,
  cambiarEstado as cambiarEstadoService,
} from '../services/reclamacion.service.js';

async function listar(req, res, next) {
  try {
    const datos = await listarReclamaciones(req.query);
    res.json(new ApiResponse(datos, 'Reclamaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerReclamacion(req.params.id);
    res.json(new ApiResponse(doc, 'Reclamacion obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function crear(req, res, next) {
  try {
    const doc = await crearReclamacion(req.body || {});
    res.status(201).json(new ApiResponse(doc, 'Reclamacion registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function agregarEvidencia(req, res, next) {
  try {
    const doc = await agregarEvidenciaService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Evidencia agregada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function cambiarEstado(req, res, next) {
  try {
    const { doc, estado } = await cambiarEstadoService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, `Reclamacion ${estado.toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

export { listar, obtenerPorId, crear, agregarEvidencia, cambiarEstado };
export default { listar, obtenerPorId, crear, agregarEvidencia, cambiarEstado };
