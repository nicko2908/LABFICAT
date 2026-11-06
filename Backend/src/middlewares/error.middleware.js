/**
 * Manejador central de errores.
 * Convierte cualquier error en una respuesta JSON uniforme.
 */
import ApiError from '../utils/ApiError.js';

// eslint-disable-next-line no-unused-vars
const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: 'El archivo supera el tamano permitido',
  LIMIT_FILE_COUNT: 'Se adjuntaron demasiados archivos',
  LIMIT_UNEXPECTED_FILE: 'Campo de archivo no permitido',
};

function errorHandler(err, req, res, next) {
  const esApiError = err instanceof ApiError;
  const esMulter = err?.name === 'MulterError';

  // body-parser y otros middlewares adjuntan status/statusCode a sus errores
  // (por ejemplo, JSON mal formado = 400; cuerpo demasiado grande = 413).
  const statusCodigo = err.status || err.statusCode;
  const status = esApiError
    ? err.status
    : esMulter
      ? 400
      : Number.isInteger(statusCodigo) && statusCodigo >= 400 && statusCodigo < 600
        ? statusCodigo
        : 500;

  let mensaje;
  if (esApiError) {
    mensaje = err.message;
  } else if (esMulter) {
    mensaje = MENSAJES_MULTER[err.code] || 'Error al procesar el archivo';
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
