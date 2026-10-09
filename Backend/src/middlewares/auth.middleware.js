/**
 * Middleware: Verifica el JWT de sesion y adjunta el usuario a req.usuario (RF-27).
 *
 * Forma dejada en req:
 *  - req.usuario   = { id, sub, rol }  (id/sub = id del usuario; rol = nombre del rol)
 *  - req.usuarioId = id del usuario    (compatibilidad con los controladores)
 *
 * Los controladores leen el actor con:
 *  (req.usuario && (req.usuario.id || req.usuario.sub)) || req.usuarioId
 * por lo que ambas propiedades se dejan para no tocarlos.
 */
import ApiError from '../utils/ApiError.js';
import Usuario from '../models/seguridad/Usuario.js';
import { verificar } from '../utils/jwt.js';

async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');

    if (tipo !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Token no proporcionado');
    }

    let payload;
    try {
      payload = verificar(token);
    } catch {
      throw ApiError.unauthorized('Token invalido o vencido');
    }

    // Confirmar que el usuario sigue existiendo y activo (RNF-01).
    let usuario;
    try {
      usuario = await Usuario.findById(payload.sub).select('rol activo');
    } catch {
      throw ApiError.unauthorized('Token invalido');
    }
    if (!usuario || !usuario.activo) {
      throw ApiError.unauthorized('Usuario no valido o desactivado');
    }

    const id = String(usuario._id);
    req.usuario = { id, sub: id, rol: payload.rol };
    req.usuarioId = id;

    next();
  } catch (err) {
    next(err);
  }
}

export default autenticar;
export { autenticar };
