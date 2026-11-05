/**
 * Controlador del modulo: auth (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/auth.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  registrar as registrarUsuario,
  login as iniciarSesion,
  obtenerPerfil as obtenerPerfilUsuario,
  cambiarContrasena as actualizarContrasena,
} from '../services/auth.service.js';

/** POST /auth/registro — RF-01 / RF-02. */
async function registrar(req, res, next) {
  try {
    const datos = await registrarUsuario(req.body || {});
    res.status(201).json(new ApiResponse(datos, 'Registro exitoso'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'usuario' }));
  }
}

/** POST /auth/login — RF-27. */
async function login(req, res, next) {
  try {
    const datos = await iniciarSesion(req.body || {});
    res.json(new ApiResponse(datos, 'Acceso concedido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'usuario' }));
  }
}

/** GET /auth/perfil. */
async function obtenerPerfil(req, res, next) {
  try {
    const datos = await obtenerPerfilUsuario(actorId(req));
    res.json(new ApiResponse(datos, 'Perfil obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'usuario' }));
  }
}

/** PATCH /auth/contrasena. */
async function cambiarContrasena(req, res, next) {
  try {
    const { actual, nueva } = req.body || {};
    await actualizarContrasena({ usuarioId: actorId(req), actual, nueva });
    res.json(new ApiResponse(null, 'Contrasena actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'usuario' }));
  }
}

export { registrar, login, obtenerPerfil, cambiarContrasena };
export default { registrar, login, obtenerPerfil, cambiarContrasena };
