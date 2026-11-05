/**
 * Service del modulo: rotulo (RF-11).
 *
 * Genera o actualiza el rotulo 1:1 de una muestra ACEPTADA. El PDF se
 * almacena aparte; aqui solo se guarda su ruta.
 */
import { ESTADO_RECEPCION_MUESTRA } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Rotulo from '../models/laboratorio/Rotulo.js';
import Analisis from '../models/laboratorio/Analisis.js';

/**
 * POST /muestras/:id/rotulo.
 * @param {string} muestraId
 * @param {{ analisis?: Array<string>, ruta_pdf?: string }} [body]
 */
async function generarRotulo(muestraId, body = {}) {
  const { analisis, ruta_pdf } = body;

  const muestra = await Muestra.findById(muestraId);
  if (!muestra) throw ApiError.notFound('Muestra no encontrada');
  if (muestra.estado_recepcion !== ESTADO_RECEPCION_MUESTRA.ACEPTADA) {
    throw ApiError.conflict('Solo se genera rotulo de una muestra ACEPTADA');
  }

  if (analisis !== undefined) {
    if (!Array.isArray(analisis) || analisis.length === 0) {
      throw ApiError.badRequest('analisis debe ser un arreglo no vacio');
    }
    const n = await Analisis.countDocuments({ _id: { $in: analisis } });
    if (n !== analisis.length) {
      throw ApiError.badRequest('Uno o mas analisis no existen');
    }
  }

  return Rotulo.findOneAndUpdate(
    { muestra: muestra._id },
    {
      $set: {
        ...(analisis !== undefined ? { analisis } : {}),
        ...(ruta_pdf !== undefined ? { ruta_pdf } : {}),
      },
    },
    { new: true, runValidators: true, upsert: true }
  ).populate('analisis', 'nombre tarifa_externo');
}

export { generarRotulo };
export default { generarRotulo };
