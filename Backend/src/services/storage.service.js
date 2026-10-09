/**
 * Service: Storage (Supabase). Almacena las firmas digitales de forma PRIVADA.
 * En BD solo se guarda la ruta del objeto y su hash SHA-256 (integridad legal);
 * el binario vive en el bucket privado y solo se recupera desde el backend.
 */
import crypto from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import supabase from '../config/supabase.js';

const BUCKET = 'firmas';

/**
 * Sube un PNG (firma digital) en base64 al bucket privado.
 * @param {{ base64: string, nombre: string }} params
 * @returns {Promise<{ ruta: string, hash: string }>} ruta privada + SHA-256 del PNG.
 */
export async function subirFirma({ base64, nombre }) {
  const limpio = String(base64).replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(limpio, 'base64');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const { data, error } = await supabase.storage.from(BUCKET).upload(nombre, buffer, {
    contentType: 'image/png',
    upsert: false,
  });

  if (error) {
    throw new ApiError(500, `Error al subir la firma: ${error.message}`);
  }

  return { ruta: data.path, hash };
}

/**
 * Descarga una firma desde el bucket privado (uso exclusivo del backend/coordinador).
 * @param {string} ruta Ruta del objeto dentro del bucket 'firmas'.
 * @returns {Promise<Buffer>} Contenido binario del PNG.
 */
export async function descargarFirma(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
  if (error) {
    throw new ApiError(404, `Firma no encontrada: ${error.message}`);
  }
  return Buffer.from(await data.arrayBuffer());
}
