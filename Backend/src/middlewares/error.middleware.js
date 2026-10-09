/**
 * Manejador central de errores.
 * Convierte cualquier error en una respuesta JSON uniforme.
 */
import ApiError from '../utils/ApiError.js';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const esApiError = err instanceof ApiError;
  const status = esApiError ? err.status : 500;
  const mensaje = esApiError ? err.message : 'Error interno del servidor';

  if (!esApiError) {
    console.error('[error]', err);
  }

  res.status(status).json({
    ok: false,
    mensaje,
    ...(err.detalles ? { detalles: err.detalles } : {}),
  });
}

export default errorHandler;
