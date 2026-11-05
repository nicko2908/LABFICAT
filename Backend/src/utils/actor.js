/**
 * Util: identificador del usuario autenticado.
 *
 * El auth.middleware puede dejar los datos del token en `req.usuario` o en
 * `req.usuarioId` segun el punto de la cadena. Este helper unifica la lectura
 * para los controladores.
 */

/**
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function actorId(req) {
  return (req.usuario && (req.usuario.id || req.usuario.sub)) || req.usuarioId || null;
}

export { actorId };
export default actorId;
