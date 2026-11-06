/**
 * Middleware: carga de archivos en memoria con Multer.
 *
 * Los archivos no se escriben en disco: llegan como Buffer y el service de
 * storage los sube a R2. La validacion de MIME real se hace con
 * utils/archivos.js -> validarArchivo() antes de subir.
 */
import multer from 'multer';
import { LIMITES } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

const MIME_PERMITIDOS = ['image/png', 'image/jpeg', 'application/pdf'];
const MAX_BYTES = LIMITES.SOPORTE_PAGO_MAX_MB * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: LIMITES.EVIDENCIA_MAX_ARCHIVOS,
  },
  fileFilter(req, file, cb) {
    if (!MIME_PERMITIDOS.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Formato no permitido. Use PNG, JPG o PDF'));
    }
    cb(null, true);
  },
});

/** Un solo archivo en el campo "archivo". */
export const subirUnArchivo = upload.single('archivo');

/** Hasta N evidencias en el campo "evidencias". */
export const subirEvidencias = upload.array('evidencias', LIMITES.EVIDENCIA_MAX_ARCHIVOS);

export { MIME_PERMITIDOS, MAX_BYTES };
export default upload;
