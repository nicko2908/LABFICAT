/**
 * Service del modulo: trazabilidad (RF-12 / RF-26).
 *
 * Registra el avance de la muestra por las etapas del proceso y expone la
 * linea de tiempo. La validacion de resultados vive en validacion.service.js.
 */
import ApiError from '../utils/ApiError.js';
import SeguimientoMuestra from '../models/laboratorio/SeguimientoMuestra.js';
import ValidacionResultado from '../models/laboratorio/ValidacionResultado.js';
import Muestra from '../models/laboratorio/Muestra.js';
import EtapaProceso from '../models/laboratorio/EtapaProceso.js';

/** POST /trazabilidad/seguimiento */
async function registrarSeguimiento({ muestraId, etapaId, usuarioId, observaciones = null } = {}) {
  if (!muestraId || !etapaId) {
    throw ApiError.badRequest('muestra y etapa son obligatorias');
  }

  const [muestra, etapa] = await Promise.all([
    Muestra.exists({ _id: muestraId }),
    EtapaProceso.exists({ _id: etapaId }),
  ]);
  if (!muestra) throw ApiError.badRequest('La muestra indicada no existe');
  if (!etapa) throw ApiError.badRequest('La etapa indicada no existe');
  if (!usuarioId) throw ApiError.unauthorized();

  const doc = await SeguimientoMuestra.create({
    muestra: muestraId,
    etapa: etapaId,
    usuario: usuarioId,
    observaciones: observaciones || null,
  });

  await doc.populate([
    { path: 'muestra', select: 'codigo_muestra estado_recepcion' },
    { path: 'etapa', select: 'nombre orden' },
    { path: 'usuario', select: 'nombres apellidos' },
  ]);

  return doc;
}

/**
 * GET /trazabilidad/muestra/:muestraId
 * @returns {Promise<{ muestra: object, items: object[] }>}
 */
async function lineaTiempoMuestra(muestraId) {
  const muestra = await Muestra.findById(muestraId);
  if (!muestra) throw ApiError.notFound('Muestra no encontrada');

  const items = await SeguimientoMuestra.find({ muestra: muestraId })
    .populate('etapa', 'nombre orden')
    .populate('usuario', 'nombres apellidos')
    .sort({ fecha_hora: 1 });

  return { muestra, items };
}

/** GET /trazabilidad/validaciones/orden/:ordenId */
async function historialValidaciones(ordenId) {
  return ValidacionResultado.find({ orden: ordenId })
    .populate('usuario', 'nombres apellidos')
    .sort({ fecha_hora: 1 });
}

export { registrarSeguimiento, lineaTiempoMuestra, historialValidaciones };
export default { registrarSeguimiento, lineaTiempoMuestra, historialValidaciones };
