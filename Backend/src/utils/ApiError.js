/**
 * Error de aplicacion con codigo HTTP asociado.
 * Uso: throw new ApiError(404, 'Muestra no encontrada');
 */
class ApiError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }

  static badRequest(mensaje, detalles) {
    return new ApiError(400, mensaje, detalles);
  }

  static unauthorized(mensaje = 'No autenticado') {
    return new ApiError(401, mensaje);
  }

  static forbidden(mensaje = 'No autorizado') {
    return new ApiError(403, mensaje);
  }

  static notFound(mensaje = 'Recurso no encontrado') {
    return new ApiError(404, mensaje);
  }

  static conflict(mensaje, detalles) {
    return new ApiError(409, mensaje, detalles);
  }
}

export default ApiError;
