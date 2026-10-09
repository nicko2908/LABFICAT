/**
 * Formato uniforme de respuestas exitosas.
 * Uso: res.json(new ApiResponse(datos, 'Muestra registrada'));
 */
class ApiResponse {
  constructor(datos = null, mensaje = 'OK') {
    this.ok = true;
    this.mensaje = mensaje;
    this.datos = datos;
  }
}

export default ApiResponse;
