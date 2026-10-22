/**
 * Service del modulo: validacion de resultados.
 *
 * Reglas:
 *  - Solo se valida una orden FINALIZADA.
 *  - Una sola validacion por orden.
 *  - APROBADO: la orden queda FINALIZADA.
 *  - RECHAZADO: la orden pasa a INVALIDADA y puede repetirse.
 */
import ApiError from '../utils/ApiError.js';
import {
  DECISION_VALIDACION,
  ESTADO_ORDEN,
} from '../config/constants.js';
import { puedeTransicionarOrden } from '../config/estados.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import ValidacionResultado from '../models/laboratorio/ValidacionResultado.js';
import { conTransaccion } from './flujo.service.js';

/**
 * Registra la decision del coordinador sobre los resultados de una orden.
 *
 * @param {{
 *   ordenId: string|import('mongoose').Types.ObjectId,
 *   decision: 'APROBADO'|'RECHAZADO',
 *   motivo?: string|null,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function validarOrden({
  ordenId,
  decision,
  motivo = null,
  usuarioId,
}) {
  if (!ordenId) throw ApiError.badRequest('orden es obligatoria');
  if (!DECISION_VALIDACION.includes(decision)) {
    throw ApiError.badRequest('decision debe ser APROBADO o RECHAZADO');
  }
  if (!usuarioId) throw ApiError.unauthorized();

  const motivoFinal = motivo ? String(motivo).trim() : null;
  if (decision === 'RECHAZADO' && !motivoFinal) {
    throw ApiError.badRequest('motivo es obligatorio para rechazar');
  }

  return conTransaccion(async (session) => {
    const orden = await OrdenAnalisis.findById(ordenId).session(session);
    if (!orden) throw ApiError.notFound('Orden no encontrada');

    if (orden.estado !== ESTADO_ORDEN.FINALIZADA) {
      throw ApiError.conflict('Solo se valida una orden FINALIZADA');
    }

    const previa = await ValidacionResultado.findOne({
      orden: orden._id,
    }).session(session);
    if (previa) {
      throw ApiError.conflict('La orden ya fue validada');
    }

    if (decision === 'RECHAZADO') {
      if (
        !puedeTransicionarOrden(
          ESTADO_ORDEN.FINALIZADA,
          ESTADO_ORDEN.INVALIDADA
        )
      ) {
        throw ApiError.conflict('No se puede invalidar la orden');
      }

      const actualizada = await OrdenAnalisis.findOneAndUpdate(
        { _id: orden._id, estado: ESTADO_ORDEN.FINALIZADA },
        {
          $set: {
            estado: ESTADO_ORDEN.INVALIDADA,
            fecha_fin: orden.fecha_fin || new Date(),
          },
        },
        { new: true, session }
      );

      if (!actualizada) {
        throw ApiError.conflict(
          'La orden cambio de estado durante la operacion'
        );
      }
    }

    const [validacion] = await ValidacionResultado.create(
      [
        {
          orden: orden._id,
          usuario: usuarioId,
          decision,
          motivo: motivoFinal,
        },
      ],
      { session }
    );

    return validacion;
  });
}

export { validarOrden };
export default { validarOrden };
