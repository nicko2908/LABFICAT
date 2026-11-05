/**
 * Controlador del modulo: solicitudes (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/solicitud.service.js; la autorizacion por propietario se valida
 * aqui antes de responder.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import { ROLES } from '../config/constants.js';
import {
  crearSolicitud,
  poblarSolicitud,
  listar as listarSolicitudes,
  obtenerPorId as obtenerSolicitud,
  actualizar as actualizarSolicitud,
  obtenerHistorial as obtenerHistorialSolicitud,
  cambiarEstado as cambiarEstadoSolicitud,
} from '../services/solicitud.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioSolicitud,
} from '../utils/propietario.js';

/** GET /solicitudes */
async function listar(req, res, next) {
  try {
    const datos = await listarSolicitudes(req.query);
    res.json(new ApiResponse(datos, 'Solicitudes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'solicitud', femenino: true }));
  }
}

/** GET /solicitudes/mias */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarSolicitudes(req.query, { clienteId: cliente._id });
    res.json(new ApiResponse(datos, 'Mis solicitudes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'solicitud', femenino: true }));
  }
}

/** GET /solicitudes/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerSolicitud(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioSolicitud(doc, req.usuario);
    }
    res.json(new ApiResponse(doc, 'Solicitud obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'solicitud', femenino: true }));
  }
}

/** POST /solicitudes */
async function crear(req, res, next) {
  try {
    const { cliente: clienteBody, descripcion_inicial, analisis } = req.body || {};

    let clienteId;
    if (req.usuario && req.usuario.rol === ROLES.CLIENTE) {
      const cliente = await obtenerClienteDelUsuario(req.usuarioId);
      clienteId = cliente._id;
    } else {
      if (!clienteBody) throw ApiError.badRequest('cliente es obligatorio');
      clienteId = clienteBody;
    }

    const doc = await crearSolicitud({
      clienteId,
      descripcionInicial: descripcion_inicial,
      analisis,
      usuarioId: actorId(req),
    });
    await poblarSolicitud(doc);

    res.status(201).json(new ApiResponse(doc, 'Solicitud creada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'solicitud', femenino: true }));
  }
}

/** PUT /solicitudes/:id */
async function actualizar(req, res, next) {
  try {
    const doc = await actualizarSolicitud(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Solicitud actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'solicitud', femenino: true }));
  }
}

/** PATCH /solicitudes/:id/estado */
async function cambiarEstado(req, res, next) {
  try {
    const { estado, observacion, motivo_desistimiento } = req.body || {};
    const doc = await cambiarEstadoSolicitud(req.params.id, {
      estado,
      usuario: actorId(req),
      observacion,
      motivoDesistimiento: motivo_desistimiento,
    });
    await poblarSolicitud(doc);
    res.json(new ApiResponse(doc, `Solicitud en estado ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'solicitud', femenino: true }));
  }
}

/** GET /solicitudes/:id/historial */
async function obtenerHistorial(req, res, next) {
  try {
    const { solicitud, items } = await obtenerHistorialSolicitud(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioSolicitud(solicitud, req.usuario);
    }
    res.json(new ApiResponse(items, 'Historial obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'solicitud', femenino: true }));
  }
}

export {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  obtenerHistorial,
};
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  obtenerHistorial,
};
