/**
 * Utilidades de archivos: validacion de MIME real, extensiones y nombres.
 */
import { fileTypeFromBuffer } from 'file-type';
import ApiError from './ApiError.js';

const MIME_A_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};

/**
 * Valida el contenido real de un archivo (no solo la extension declarada).
 * @param {Buffer} buffer
 * @param {{ permitidos?: string[], maxBytes?: number }} [opciones]
 * @returns {Promise<{ mime: string, ext: string }>}
 */
export async function validarArchivo(buffer, {
  permitidos = Object.keys(MIME_A_EXT),
  maxBytes,
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw ApiError.badRequest('El archivo esta vacio');
  }

  if (maxBytes && buffer.length > maxBytes) {
    throw ApiError.badRequest('El archivo supera el tamano permitido');
  }

  const tipo = await fileTypeFromBuffer(buffer);
  if (!tipo || !permitidos.includes(tipo.mime)) {
    throw ApiError.badRequest('El contenido del archivo no corresponde a un formato permitido');
  }

  return { mime: tipo.mime, ext: tipo.ext };
}

/** Devuelve la extension canonica para un MIME soportado. */
export function extensionDeMime(mime) {
  return MIME_A_EXT[mime] || null;
}

/** Limpia un nombre para usarlo dentro de una clave de R2. */
export function nombreSeguro(nombre) {
  return String(nombre || 'archivo')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

export { MIME_A_EXT };
export default { validarArchivo, extensionDeMime, nombreSeguro, MIME_A_EXT };
