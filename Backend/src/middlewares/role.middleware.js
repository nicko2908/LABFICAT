/**
 * Middleware: Restringe el acceso segun rol/permisos (RNF-01).
 * Expone permitir(...roles), que se usa DESPUES de auth.middleware
 * (cuando req.usuario.rol ya esta disponible).
 *
 * Uso: router.get('/', permitir('coordinador'), ctrl.listar);
 */
import ApiError from '../utils/ApiError.js';

/**
 * @param {...string} roles Roles autorizados ('cliente' | 'analista' | 'coordinador').
 * @returns {import('express').RequestHandler}
 */
function permitir(...roles) {
  return (req, res, next) => {
    const rol = req.usuario && req.usuario.rol;
    if (!rol) return next(ApiError.unauthorized());
    if (!roles.includes(rol)) {
      return next(ApiError.forbidden('No tiene permisos para esta accion'));
    }
    next();
  };
}

export { permitir };
export default { permitir };
