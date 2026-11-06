/**
 * Generador de codigos QR en PNG para rotulos y trazabilidad.
 */
import QRCode from 'qrcode';
import ApiError from '../ApiError.js';

/**
 * Genera un PNG con el codigo QR.
 * @param {string} texto
 * @param {import('qrcode').QRCodeToBufferOptions} [opciones]
 * @returns {Promise<Buffer>}
 */
export async function generarQrBuffer(texto, opciones = {}) {
  const contenido = String(texto || '').trim();
  if (!contenido) {
    throw ApiError.badRequest('El texto del QR es obligatorio');
  }

  return QRCode.toBuffer(contenido, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    ...opciones,
  });
}

export default { generarQrBuffer };
