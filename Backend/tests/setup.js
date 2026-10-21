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

process.env.NODE_ENV ??= 'test';
process.env.MONGO_URI ??= 'mongodb://127.0.0.1:27017/labficat_test';
process.env.JWT_SECRET ??= 'test-jwt-secret-labficat-no-usar-en-produccion-1234567890';
process.env.CUPON_VIGENCIA_DIAS ??= '5';
process.env.CUPON_UMBRAL_RECORDATORIO_DIAS ??= '5';
process.env.TOKEN_RECUPERACION_MINUTOS ??= '30';
