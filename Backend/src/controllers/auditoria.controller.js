/**
 * Controlador del modulo: auditoria (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/auditoria.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  listar as listarAuditoria,
  obtenerPorId as obtenerRegistro,
  registrar as registrarAccion,
  solicitarRecuperacion as solicitarToken,
  consumirRecuperacion as consumirToken,
} from '../services/auditoria.service.js';

/** GET /auditoria */
async function listar(req, res, next) {
  try {
    const datos = await listarAuditoria(req.query);
    res.json(new ApiResponse(datos, 'Auditoria listada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'registro' }));
  }
}

/** GET /auditoria/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerRegistro(req.params.id);
    res.json(new ApiResponse(doc, 'Registro obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'registro' }));
  }
}

/** POST /auditoria */
async function registrar(req, res, next) {
  try {
    const doc = await registrarAccion(req.body || {}, req.ip);
    res.status(201).json(new ApiResponse(doc, 'Accion registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'registro' }));
  }
}

/** POST /auditoria/recuperacion/solicitar — RF-27. */
async function solicitarRecuperacion(req, res, next) {
  try {
    const datos = await solicitarToken(req.body?.correo);
    if (!datos) {
      return res.json(new ApiResponse(null, 'Si el correo existe, se envio el token'));
    }
    res.json(new ApiResponse(datos, 'Token generado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'token' }));
  }
}

/** POST /auditoria/recuperacion/consumir — RF-27. */
async function consumirRecuperacion(req, res, next) {
  try {
    await consumirToken(req.body || {});
    res.json(new ApiResponse(null, 'Contrasena restablecida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'token' }));
  }
}

export { listar, obtenerPorId, registrar, solicitarRecuperacion, consumirRecuperacion };
export default { listar, obtenerPorId, registrar, solicitarRecuperacion, consumirRecuperacion };
