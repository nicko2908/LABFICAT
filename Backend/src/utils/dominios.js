/**
 * Util: determinacion del tipo de cliente por dominio de correo.
 *
 * @deprecated El tipo de cliente ya NO se deriva del correo. Ahora se calcula
 * con tipologia.es_interno (ver utils/tipologias.js -> tipoClienteDeTipologia).
 * Se conserva solo como referencia historica; no usar en flujos nuevos.
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
