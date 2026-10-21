/**
 * Util: construccion segura de expresiones regulares para busquedas.
 *
 * Problema que resuelve:
 *  - new RegExp('[', 'i') lanza SyntaxError y termina en un 500.
 *  - Un patron malicioso puede provocar ReDoS.
 *
 * La solucion escapa los metacaracteres y limita la longitud del termino.
 */
import ApiError from './ApiError.js';

const MAX_LONGITUD_BUSQUEDA = 100;

/**
 * Escapa los caracteres con significado especial en una expresion regular.
 * @param {string} texto
 * @returns {string}
 */
function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Crea una expresion regular "contiene" e insensible a mayusculas.
 * Devuelve null si el termino esta vacio (para omitir el filtro).
 *
 * @param {unknown} valor Termino recibido por query string.
 * @param {{ maxLongitud?: number }} [opciones]
 * @returns {RegExp|null}
 * @throws {ApiError} 400 si el termino supera la longitud maxima.
 */
function crearRegexBusqueda(valor, { maxLongitud = MAX_LONGITUD_BUSQUEDA } = {}) {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;

  if (texto.length > maxLongitud) {
    throw ApiError.badRequest(
      `El termino de busqueda no puede superar ${maxLongitud} caracteres`
    );
  }

  return new RegExp(escaparRegex(texto), 'i');
}

export { escaparRegex, crearRegexBusqueda, MAX_LONGITUD_BUSQUEDA };
export default { escaparRegex, crearRegexBusqueda };
