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

// En pruebas no se debe llamar a Supabase real (firmas). El storage debe
// comportarse como no configurado (503) y los generadores omiten la firma.
process.env.SUPABASE_URL = '';
process.env.API_KEY_SUPABASE = '';
