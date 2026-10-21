/**
 * Util: conversion estricta de valores booleanos.
 *
 * Evita el error clasico de JavaScript: Boolean("false") === true.
 * Acepta unicamente true/false, 1/0 y sus representaciones en texto.
 *
 * Uso:
 *   const activo = parseBoolean(req.body.activo);
 *   if (activo === null) throw ApiError.badRequest('activo debe ser booleano');
 */

function parseBoolean(valor) {
  if (valor === true || valor === 1) return true;
  if (valor === false || valor === 0) return false;

  if (typeof valor === 'string') {
    const texto = valor.trim().toLowerCase();
    if (texto === 'true' || texto === '1') return true;
    if (texto === 'false' || texto === '0') return false;
  }

  return null;
}

export { parseBoolean };
export default { parseBoolean };
