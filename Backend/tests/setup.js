/**
 * Bootstrap de pruebas.
 *
 * Se carga antes que los tests (ver script "test" en package.json).
 * Carga .env si existe y, si no existe o faltan variables, define valores
 * de prueba para que la suite de humo funcione en CI sin depender de un
 * archivo .env local.
 *
 * Importante: las pruebas de humo no abren conexion a MongoDB; solo
 * necesitan que config/env.js pueda cargarse.
 */
import 'dotenv/config';
import fs from 'node:fs';

// Si hay un mongod local, usarlo para evitar la descarga de ~780 MB.
// En CI sin mongod se deja que mongodb-memory-server descargue el binario.
if (!process.env.MONGOMS_SYSTEM_BINARY) {
  const candidatos = [
    'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
    '/usr/bin/mongod',
    '/usr/local/bin/mongod',
  ];
  const encontrado = candidatos.find((ruta) => fs.existsSync(ruta));
  if (encontrado) process.env.MONGOMS_SYSTEM_BINARY = encontrado;
}

process.env.NODE_ENV ??= 'test';
process.env.MONGO_URI ??= 'mongodb://127.0.0.1:27017/labficat_test';
process.env.JWT_SECRET ??= 'test-jwt-secret-labficat-no-usar-en-produccion-1234567890';
process.env.CUPON_VIGENCIA_DIAS ??= '5';
process.env.CUPON_UMBRAL_RECORDATORIO_DIAS ??= '5';
process.env.TOKEN_RECUPERACION_MINUTOS ??= '30';

// En pruebas no se debe llamar a R2 real. Los valores permiten construir el
// cliente S3 y firmar URLs, pero el SDK se mockea en los tests.
process.env.R2_ACCOUNT_ID = 'test-account';
process.env.R2_ACCESS_KEY_ID = 'test-key';
process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
process.env.R2_BUCKET = 'labficat-test';
process.env.R2_ENDPOINT = 'https://test-account.r2.cloudflarestorage.com';
process.env.R2_REGION = 'auto';
process.env.R2_PRESIGN_EXPIRES = '300';

// CORS fijo para pruebas y correo deshabilitado (nunca se envia SMTP real).
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.MAIL_HOST = '';
process.env.MAIL_USER = '';
process.env.MAIL_PASS = '';
