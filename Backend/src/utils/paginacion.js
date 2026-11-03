/**
 * Util: parametros de paginacion a partir del query string.
 *
 * Reglas comunes de la API:
 *  - page empieza en 1,
 *  - limit se limita a 100,
 *  - el default depende del modulo (10 para clientes, 20 para el resto).
 */

/**
 * @param {Record<string, unknown>} [query]
 * @param {number} [limitePorDefecto]
 * @returns {{ page: number, limit: number, skip: number }}
 */
function paginacion(query = {}, limitePorDefecto = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(query.limit, 10) || limitePorDefecto)
  );
  return { page, limit, skip: (page - 1) * limit };
}

export { paginacion };
export default paginacion;
