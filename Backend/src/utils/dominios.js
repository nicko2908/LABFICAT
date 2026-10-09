/**
 * Util: determinacion del tipo de cliente (INTERNO / EXTERNO).
 *
 * RF-02: el sistema asigna el tipo de usuario segun el dominio del correo.
 * Se comparte porque tambien lo usan RF-04 (tarifa 0 para internos)
 * y RF-20 (filtro de reportes por tipo de usuario).
 */

const DOMINIOS_INTERNOS = ['sena.edu.co', 'misena.edu.co'];

/**
 * Deduce el tipo de cliente a partir del correo.
 * @param {string} correo
 * @returns {'INTERNO' | 'EXTERNO'}
 */
function determinarTipoCliente(correo) {
  if (!correo || !correo.includes('@')) return 'EXTERNO';
  const dominio = correo.split('@')[1].toLowerCase();
  return DOMINIOS_INTERNOS.includes(dominio) ? 'INTERNO' : 'EXTERNO';
}

export { DOMINIOS_INTERNOS, determinarTipoCliente };
