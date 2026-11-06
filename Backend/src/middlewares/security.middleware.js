/**
 * Limitadores de tasa para endpoints sensibles.
 *
 * En pruebas se desactivan para no interferir con la suite; en desarrollo y
 * produccion aplican los limites configurados.
 */
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const enPruebas = env.nodeEnv === 'test';
const mensaje = {
  ok: false,
  mensaje: 'Demasiadas solicitudes. Intente nuevamente mas tarde.',
};

function crearLimitador({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: mensaje,
    skip: () => enPruebas,
  });
}

export const loginLimiter = crearLimitador({
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

export const registroLimiter = crearLimitador({
  windowMs: 60 * 60 * 1000,
  limit: 10,
});

export const recuperacionLimiter = crearLimitador({
  windowMs: 15 * 60 * 1000,
  limit: 5,
});

export default { loginLimiter, registroLimiter, recuperacionLimiter };
