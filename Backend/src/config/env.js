/**
 * Carga y valida las variables de entorno del sistema.
 * Centraliza el acceso a process.env para no dispersarlo.
 *
 * Reglas:
 *  - MONGO_URI y JWT_SECRET son obligatorias: sin ellas el backend no arranca.
 *  - Supabase es opcional: si falta configuracion, el storage responde 503
 *    solo cuando se usa (ver config/supabase.js), sin tumbar el resto de la API.
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

  supabase: {
    url: texto('SUPABASE_URL') || null,
    key: texto('API_KEY_SUPABASE') || null,
  },

  negocio: {
    cuponVigenciaDias: numero('CUPON_VIGENCIA_DIAS', 5),
    cuponUmbralRecordatorioDias: numero('CUPON_UMBRAL_RECORDATORIO_DIAS', 5),
    tokenRecuperacionMinutos: numero('TOKEN_RECUPERACION_MINUTOS', 30),
  },
};

// Bandera util para health checks o diagnosticos, sin exponer las credenciales.
env.supabase.configurado = Boolean(env.supabase.url && env.supabase.key);

export default env;
