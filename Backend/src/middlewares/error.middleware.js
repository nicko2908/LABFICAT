/**
 * Manejador central de errores.
 * Convierte cualquier error en una respuesta JSON uniforme.
 */
import ApiError from '../utils/ApiError.js';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const esApiError = err instanceof ApiError;

  // body-parser y otros middlewares adjuntan status/statusCode a sus errores
  // (por ejemplo, JSON mal formado = 400; cuerpo demasiado grande = 413).
  const statusCodigo = err.status || err.statusCode;
  const status = esApiError
    ? err.status
    : Number.isInteger(statusCodigo) && statusCodigo >= 400 && statusCodigo < 600
      ? statusCodigo
      : 500;

  let mensaje;
  if (esApiError) {
    mensaje = err.message;
  } else if (status === 400 && err.type === 'entity.parse.failed') {
    mensaje = 'JSON invalido';
  } else if (status === 413 || err.type === 'entity.too.large') {
    mensaje = 'El cuerpo de la solicitud es demasiado grande';
  } else if (status < 500) {
    mensaje = 'Solicitud invalida';
  } else {
    mensaje = 'Error interno del servidor';
  }

  if (!esApiError && status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    ok: false,
    mensaje,
    ...(err.detalles ? { detalles: err.detalles } : {}),
  });
}

export default errorHandler;
