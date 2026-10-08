/**
 * Carga y valida las variables de entorno del sistema.
 * Centraliza el acceso a process.env para no dispersarlo.
 */
require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET || 'labficat-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  mail: {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM || 'LABFICAT <no-reply@labficat.local>',
    toProduccion: process.env.MAIL_TO_PRODUCCION,
  },

  negocio: {
    cuponUmbralRecordatorioDias: Number(process.env.CUPON_UMBRAL_RECORDATORIO_DIAS) || 5,
    tokenRecuperacionMinutos: Number(process.env.TOKEN_RECUPERACION_MINUTOS) || 30,
  },
};

module.exports = env;
