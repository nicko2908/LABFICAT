/**
 * Convierte el error normalizado por axios en texto legible.
 * @param {{ mensaje?: string, detalles?: any }|string} error
 */
export function mensajeError(error) {
  if (typeof error === "string") return error;
  return error?.mensaje || "Ocurrio un error inesperado";
}

/**
 * Extrae el mensaje de un detalle individual. El backend puede enviar textos,
 * errores de Mongoose (con `message`) o errores propios (con `mensaje`).
 * @param {any} detalle
 * @returns {string}
 */
function textoDetalle(detalle) {
  if (detalle === null || detalle === undefined) return "";
  if (typeof detalle === "string") return detalle;
  if (typeof detalle !== "object") return String(detalle);

  return detalle.mensaje || detalle.message || detalle.msg || detalle.error || "";
}

/**
 * Une los detalles de validacion en una sola linea.
 *
 * Casos soportados:
 *  - arreglo de strings u objetos ({ mensaje } / { message }).
 *  - ValidationError de Mongoose serializado: { campo: { message, ... } }.
 *  - objetos planos: { campo: "mensaje" }.
 * @param {any} detalles
 */
export function textoDetalles(detalles) {
  if (!detalles) return "";

  if (Array.isArray(detalles)) {
    return detalles.map(textoDetalle).filter(Boolean).join(" · ");
  }

  if (typeof detalles === "string") return detalles;

  if (typeof detalles === "object") {
    return Object.entries(detalles)
      .map(([campo, valor]) => {
        if (valor && typeof valor === "object") {
          const mensaje = textoDetalle(valor);
          return mensaje ? `${campo}: ${mensaje}` : null;
        }
        return `${campo}: ${valor}`;
      })
      .filter(Boolean)
      .join(" · ");
  }

  return String(detalles);
}
