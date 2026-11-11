/**
 * Middleware: registra accesos y cambios en la bitacora de auditoria (RNF-03).
 *
 * Se monta una sola vez en `app.js`. No bloquea la peticion: escucha el evento
 * `finish` de la respuesta y escribe en segundo plano. Cualquier fallo al
 * auditar se registra en consola y NUNCA afecta la respuesta al cliente.
 *
 * Que se audita:
 *  - Cambios: POST, PUT, PATCH y DELETE autenticados.
 *  - Accesos a documentos: GET de PDF, Excel, acta, rotulo, firma y evidencias.
 *
 * Que NO se audita:
 *  - GET de consulta general (evita llenar la bitacora con lecturas).
 *  - Rutas sin usuario autenticado (login, registro, recuperacion).
 *  - El propio modulo /auditoria (evita registrar la auditoria de la auditoria).
 *  - Respuestas 401 (sesion invalida) y errores 5xx.
 */
import Auditoria from '../models/seguridad/Auditoria.js';

const METODOS_CAMBIO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// GET que representan acceso a un documento sensible.
const GET_DOCUMENTO =
  /\/pdf$|\/excel$|\/acta-recepcion$|\/rotulo$|\/firma$|\/evidencias\/[^/]+$/;

const MAX_ACCION = 60;

/**
 * Devuelve la ruta solicitada con los IDs de Mongo normalizados a `:id`, para
 * que la bitacora sea estable: `/api/v1/solicitudes/:id/estado`.
 *
 * Se usa `originalUrl` (no `req.baseUrl`/`req.route`) porque en respuestas de
 * error el router ya se desmonto y esas propiedades pueden venir vacias.
 * @param {import('express').Request} req
 * @returns {string}
 */
function rutaDe(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return url.replace(/\/[a-f0-9]{24}(?=\/|$)/gi, '/:id');
}

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function construirAccion(req) {
  const ruta = rutaDe(req).replace(/^\/api\/v\d+/, '');
  return `${req.method} ${ruta}`.replace(/\/+/g, '/').slice(0, MAX_ACCION);
}

/**
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function debeAuditar(req) {
  if (METODOS_CAMBIO.has(req.method)) return true;
  if (req.method !== 'GET') return false;

  return GET_DOCUMENTO.test(rutaDe(req));
}

/**
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function usuarioId(req) {
  const usuario = req.usuario;
  if (!usuario) return req.usuarioId ? String(req.usuarioId) : null;

  const id = usuario.id || usuario.sub;
  return id ? String(id) : null;
}

/**
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function ipDe(req) {
  const ip = req.ip || req.socket?.remoteAddress || null;
  return ip ? String(ip).slice(0, 45) : null;
}

/**
 * Middleware de auditoria.
 * @type {import('express').RequestHandler}
 */
function auditar(req, res, next) {
  // En pruebas se desactiva para no interferir con los conteos de la suite
  // (el endpoint POST /auditoria sigue disponible para probar la bitacora).
  if (process.env.NODE_ENV === 'test') return next();

  // Se evalua al final, cuando auth.middleware ya adjunto req.usuario
  // y Express ya resolvio req.route.
  res.on('finish', () => {
    try {
      if (!debeAuditar(req)) return;

      const base = req.originalUrl || '';
      if (base.startsWith('/api/v1/auditoria')) return;

      const usuario = usuarioId(req);
      if (!usuario) return;

      const status = res.statusCode;
      if (status === 401 || status >= 500) return;

      // 403: intento de acceso denegado con sesion valida. Se marca para
      // distinguirlo de una accion completada.
      const accion =
        status === 403
          ? `DENEGADO ${construirAccion(req)}`.slice(0, MAX_ACCION)
          : construirAccion(req);

      Auditoria.create({
        usuario,
        accion,
        ip: ipDe(req),
      }).catch((error) => {
        console.error('[audit] No se pudo registrar la accion:', error.message);
      });
    } catch (error) {
      // La auditoria nunca debe romper la peticion.
      console.error('[audit] Error inesperado:', error.message);
    }
  });

  next();
}

export default auditar;
export { auditar };
