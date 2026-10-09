/**
 * Util: firmar y verificar tokens JWT (RF-27).
 * Centraliza el uso de jsonwebtoken para no repetir jwt.sign/jwt.verify
 * en controladores ni middlewares. Usa la configuracion de config/env.js.
 */
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Firma un token de sesion.
 * @param {Object} payload  Datos a incluir (ej. { sub, rol }).
 * @returns {string} Token firmado.
 */
function firmar(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * Verifica y decodifica un token.
 * Lanza error si el token es invalido o esta vencido.
 * @param {string} token
 * @returns {Object} Payload decodificado.
 */
function verificar(token) {
  return jwt.verify(token, env.jwtSecret);
}

export { firmar, verificar };
export default { firmar, verificar };
