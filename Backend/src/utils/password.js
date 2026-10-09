/**
 * Util: hasheo y verificacion de contrasenas con bcryptjs.
 * Toda contrasena se guarda CIFRADA (RF-27); nunca en texto plano.
 */
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Genera el hash de una contrasena en texto plano.
 * @param {string} plano
 * @returns {Promise<string>}
 */
async function hash(plano) {
  return bcrypt.hash(plano, SALT_ROUNDS);
}

/**
 * Compara una contrasena en texto plano contra el hash almacenado.
 * @param {string} plano
 * @param {string} hashGuardado
 * @returns {Promise<boolean>}
 */
async function comparar(plano, hashGuardado) {
  if (!plano || !hashGuardado) return false;
  return bcrypt.compare(plano, hashGuardado);
}

module.exports = { hash, comparar };
