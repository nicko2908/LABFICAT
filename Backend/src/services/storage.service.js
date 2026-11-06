/**
 * Service: Storage sobre Cloudflare R2 (S3 compatible).
 *
 * En MongoDB se guarda la clave del objeto y sus metadatos, nunca una URL
 * publica. Los archivos son privados y se descargan desde el backend o con
 * una URL prefirmada de corta duracion.
 *
 * La capa es generica para firmas, evidencias, informes y rotulos. El soporte
 * de pago NO se almacena: lo gestiona Produccion de Centro por fuera.
 */
import crypto from 'node:crypto';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from '../config/env.js';
import { getR2 } from '../config/r2.js';
import ApiError from '../utils/ApiError.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_FIRMA_BYTES = 2 * 1024 * 1024;

function esPng(buffer) {
  return buffer.length >= PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

function normalizarMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, valor]) => valor !== undefined && valor !== null)
      .map(([clave, valor]) => [clave, String(valor)])
  );
}

function esErrorNoEncontrado(error) {
  return (
    error?.name === 'NoSuchKey' ||
    error?.name === 'NotFound' ||
    error?.$metadata?.httpStatusCode === 404
  );
}

/**
 * Sube un buffer a R2.
 * @param {{ buffer: Buffer, key: string, contentType?: string, metadata?: Record<string, unknown> }} params
 * @returns {Promise<{ proveedor: string, bucket: string, key: string, content_type: string, bytes: number }>}
 */
export async function subirArchivo({ buffer, key, contentType = 'application/octet-stream', metadata = {} } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw ApiError.badRequest('El archivo esta vacio');
  }
  if (!key || typeof key !== 'string') {
    throw ApiError.badRequest('La clave del archivo es obligatoria');
  }

  const r2 = getR2();

  await r2.send(
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: normalizarMetadata(metadata),
    })
  );

  return {
    proveedor: 'r2',
    bucket: env.r2.bucket,
    key,
    content_type: contentType,
    bytes: buffer.length,
  };
}

/**
 * Descarga un objeto de R2 como Buffer.
 * @param {string} key
 * @returns {Promise<Buffer>}
 */
export async function descargarArchivo(key) {
  if (!key || typeof key !== 'string') {
    throw ApiError.badRequest('La clave del archivo es obligatoria');
  }

  try {
    const r2 = getR2();
    const respuesta = await r2.send(
      new GetObjectCommand({ Bucket: env.r2.bucket, Key: key })
    );

    if (!respuesta.Body) {
      throw ApiError.notFound('Archivo no encontrado');
    }

    return Buffer.from(await respuesta.Body.transformToByteArray());
  } catch (error) {
    if (esErrorNoEncontrado(error)) {
      throw ApiError.notFound('Archivo no encontrado');
    }
    throw error;
  }
}

/**
 * Elimina un objeto de R2. Es idempotente: borrar una clave inexistente no falla.
 * @param {string} key
 */
export async function eliminarArchivo(key) {
  if (!key || typeof key !== 'string') {
    throw ApiError.badRequest('La clave del archivo es obligatoria');
  }

  const r2 = getR2();
  await r2.send(new DeleteObjectCommand({ Bucket: env.r2.bucket, Key: key }));

  return { key, eliminado: true };
}

/**
 * Genera una URL prefirmada de descarga.
 * @param {string} key
 * @param {{ expiresIn?: number, contentType?: string, downloadName?: string }} [opciones]
 * @returns {Promise<string>}
 */
export async function urlFirmada(key, {
  expiresIn = env.r2.presignExpires,
  contentType,
  downloadName,
} = {}) {
  if (!key || typeof key !== 'string') {
    throw ApiError.badRequest('La clave del archivo es obligatoria');
  }

  const r2 = getR2();
  const comando = new GetObjectCommand({
    Bucket: env.r2.bucket,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: downloadName
      ? `attachment; filename="${downloadName}"`
      : undefined,
  });

  return getSignedUrl(r2, comando, { expiresIn });
}

/**
 * Fachada de compatibilidad para la firma digital (RF-05).
 * Recibe un PNG en base64, valida que sea PNG, calcula SHA-256 y lo sube.
 * @param {{ base64: string, nombre: string }} params
 * @returns {Promise<{ ruta: string, key: string, hash: string, bucket: string, content_type: string, bytes: number }>}
 */
export async function subirFirma({ base64, nombre }) {
  const limpio = String(base64 || '').replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(limpio, 'base64');

  if (buffer.length === 0) {
    throw ApiError.badRequest('La firma esta vacia o no es un PNG valido');
  }
  if (buffer.length > MAX_FIRMA_BYTES) {
    throw ApiError.badRequest('La firma supera el tamano permitido (2 MB)');
  }
  if (!esPng(buffer)) {
    throw ApiError.badRequest('La firma no es un PNG valido');
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const nombreLimpio = String(nombre || `firma_${Date.now()}.png`)
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = nombreLimpio.startsWith('firmas/') ? nombreLimpio : `firmas/${nombreLimpio}`;

  const archivo = await subirArchivo({
    buffer,
    key,
    contentType: 'image/png',
    metadata: { sha256: hash },
  });

  return { ruta: archivo.key, key: archivo.key, hash, ...archivo };
}

/**
 * Fachada de compatibilidad para descargar una firma.
 * @param {string} ruta
 * @returns {Promise<Buffer>}
 */
export async function descargarFirma(ruta) {
  return descargarArchivo(ruta);
}

export default {
  subirArchivo,
  descargarArchivo,
  eliminarArchivo,
  urlFirmada,
  subirFirma,
  descargarFirma,
};
