/**
 * Controlador del modulo: reclamaciones (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/reclamacion.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import { obtenerClienteDelUsuario } from '../utils/propietario.js';
import {
  listar as listarReclamaciones,
  listarMias as listarMisReclamaciones,
  obtenerPorId as obtenerReclamacion,
  crear as crearReclamacion,
  agregarEvidencia as agregarEvidenciaService,
  obtenerEvidencia as obtenerEvidenciaService,
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

async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarMisReclamaciones(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis reclamaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerReclamacion(req.params.id, req.usuario);
    res.json(new ApiResponse(doc, 'Reclamacion obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function crear(req, res, next) {
  try {
    const doc = await crearReclamacion(req.body || {}, req.usuario);
    res.status(201).json(new ApiResponse(doc, 'Reclamacion registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function agregarEvidencia(req, res, next) {
  try {
    const doc = await agregarEvidenciaService(req.params.id, {
      files: req.files || [],
      usuario: req.usuario,
    });
    res.json(new ApiResponse(doc, 'Evidencias agregadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'reclamacion', femenino: true }));
  }
}

async function descargarEvidencia(req, res, next) {
  try {
    const { evidencia, buffer } = await obtenerEvidenciaService(
      req.params.id,
      req.params.evidenciaId,
      req.usuario
    );

    res.set('Content-Type', evidencia.archivo.content_type);
    res.set(
      'Content-Disposition',
      `inline; filename="${evidencia.archivo.nombre_original || 'evidencia'}"`
    );
    res.send(buffer);
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

export {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  agregarEvidencia,
  descargarEvidencia,
  cambiarEstado,
};
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  agregarEvidencia,
  descargarEvidencia,
  cambiarEstado,
};
