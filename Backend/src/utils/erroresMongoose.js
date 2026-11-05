/**
 * Util: traduccion de errores de Mongoose a errores de la API.
 *
 * Los controladores delegan aqui los errores de escritura para no repetir
 * la misma traduccion en cada modulo. El error.middleware sigue siendo la
 * red final para todo lo que no se traduzca.
 */
import ApiError from './ApiError.js';

/**
 * @param {unknown} err
 * @param {{ entidad?: string, femenino?: boolean }} [opciones]
 * @returns {unknown} ApiError traducido o el error original.
 */
function traducirErrorMongoose(err, { entidad = 'registro', femenino = false } = {}) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    const articulo = femenino ? 'una' : 'un';
    return ApiError.conflict(
      `Ya existe ${articulo} ${entidad} con ese ${campo}`,
      err.keyValue
    );
  }
  if (err && err.name === 'ValidationError') {
    return ApiError.badRequest('Datos invalidos', err.errors);
  }
  if (err && err.name === 'CastError') {
    return ApiError.badRequest('Identificador invalido');
  }
  return err;
}

export { traducirErrorMongoose };
export default traducirErrorMongoose;
