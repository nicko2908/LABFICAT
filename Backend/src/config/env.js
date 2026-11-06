/**
 * Carga y valida las variables de entorno del sistema.
 * Centraliza el acceso a process.env para no dispersarlo.
 *
 * Reglas:
 *  - MONGO_URI y JWT_SECRET son obligatorias: sin ellas el backend no arranca.
 *  - R2 es opcional: si falta configuracion, el storage responde 503
 *    solo cuando se usa (ver config/r2.js), sin tumbar el resto de la API.
 */
import 'dotenv/config';

const PLACEHOLDER_JWT = 'cambiar_por_una_clave_larga_y_aleatoria';

function texto(nombre) {
  const valor = process.env[nombre];
  return typeof valor === 'string' ? valor.trim() : '';
}

function obligatoria(nombre) {
  const valor = texto(nombre);
  if (!valor) {
    throw new Error(`[env] Falta la variable obligatoria ${nombre} en el archivo .env`);
  }
  return valor;
}

function numero(nombre, porDefecto) {
  const valor = Number(texto(nombre));
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

const nodeEnv = texto('NODE_ENV') || 'development';
const jwtSecret = obligatoria('JWT_SECRET');

const r2AccountId = texto('R2_ACCOUNT_ID') || null;
const r2Endpoint =
  texto('R2_ENDPOINT') ||
  (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : null);

if (nodeEnv === 'production') {
  if (jwtSecret === PLACEHOLDER_JWT || jwtSecret.length < 32) {
    throw new Error(
      '[env] JWT_SECRET insegura para produccion: use una clave aleatoria de al menos 32 caracteres'
    );
  }
} else if (jwtSecret === PLACEHOLDER_JWT || jwtSecret.length < 32) {
  console.warn(
    '[env] Aviso: JWT_SECRET es un valor de plantilla o demasiado corta. Cambiela antes de desplegar.'
  );
}

const env = {
  nodeEnv,
  port: numero('PORT', 3000),
  apiPrefix: texto('API_PREFIX') || '/api/v1',
  corsOrigin: texto('CORS_ORIGIN') || '*',

  mongoUri: obligatoria('MONGO_URI'),

  jwtSecret,
  jwtExpiresIn: texto('JWT_EXPIRES_IN') || '8h',

  mail: {
    host: texto('MAIL_HOST') || null,
    port: numero('MAIL_PORT', 587),
    secure: texto('MAIL_SECURE') === 'true',
    user: texto('MAIL_USER') || null,
    pass: texto('MAIL_PASS') || null,
    from: texto('MAIL_FROM') || 'LABFICAT <no-reply@labficat.local>',
    toProduccion: texto('MAIL_TO_PRODUCCION') || null,
  },

  r2: {
    accountId: r2AccountId,
    accessKeyId: texto('R2_ACCESS_KEY_ID') || null,
    secretAccessKey: texto('R2_SECRET_ACCESS_KEY') || null,
    bucket: texto('R2_BUCKET') || null,
    endpoint: r2Endpoint,
    region: texto('R2_REGION') || 'auto',
    presignExpires: numero('R2_PRESIGN_EXPIRES', 300),
  },

  negocio: {
    cuponVigenciaDias: numero('CUPON_VIGENCIA_DIAS', 5),
    cuponUmbralRecordatorioDias: numero('CUPON_UMBRAL_RECORDATORIO_DIAS', 5),
    tokenRecuperacionMinutos: numero('TOKEN_RECUPERACION_MINUTOS', 30),
  },
};

// Banderas utiles para health checks o diagnosticos, sin exponer credenciales.
env.r2.configurado = Boolean(
  env.r2.accessKeyId &&
  env.r2.secretAccessKey &&
  env.r2.bucket &&
  env.r2.endpoint
);

const mailPassPlaceholder =
  !env.mail.pass || env.mail.pass === '********' || env.mail.pass === 'cambiar';
const mailHostPlaceholder =
  !env.mail.host || env.mail.host === 'smtp.ejemplo.com';

env.mail.configurado = Boolean(
  env.mail.host && env.mail.user && env.mail.pass && !mailPassPlaceholder && !mailHostPlaceholder
);

if (!env.mail.configurado) {
  console.warn(
    '[env] Aviso: SMTP no configurado (MAIL_HOST/MAIL_USER/MAIL_PASS). ' +
      'Las notificaciones por correo no se enviaran hasta completar esas variables.'
  );
}

export default env;
