/**
 * Cliente S3 compatible con Cloudflare R2.
 *
 * La inicializacion es perezosa: importar este modulo no exige credenciales.
 * Si R2 no esta configurado, solo los endpoints que usan storage reciben 503.
 */
import { S3Client } from '@aws-sdk/client-s3';
import env from './env.js';
import ApiError from '../utils/ApiError.js';

let cliente = null;

/**
 * Devuelve el cliente S3 de R2, creandolo la primera vez que se usa.
 * @returns {S3Client}
 * @throws {ApiError} 503 si faltan variables R2.
 */
export function getR2() {
  if (!env.r2.configurado) {
    throw new ApiError(
      503,
      'R2 no configurado: defina R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_ENDPOINT en .env'
    );
  }

  if (!cliente) {
    cliente = new S3Client({
      region: env.r2.region,
      endpoint: env.r2.endpoint,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }

  return cliente;
}

/** Indica si R2 tiene configuracion suficiente para operar. */
export function r2Configurado() {
  return env.r2.configurado;
}

export default getR2;
