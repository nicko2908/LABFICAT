/**
 * Service del modulo: solicitud.
 *
 * Crea la solicitud y su historial inicial dentro de una misma transaccion.
 */
import ApiError from '../utils/ApiError.js';
import { ESTADO_SOLICITUD } from '../config/constants.js';
import Solicitud from '../models/servicios/Solicitud.js';
import HistorialEstadoSolicitud from '../models/servicios/HistorialEstadoSolicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import Analisis from '../models/laboratorio/Analisis.js';
import { conTransaccion } from './flujo.service.js';

function normalizarAnalisis(analisis) {
  if (!Array.isArray(analisis) || analisis.length === 0) {
    throw ApiError.badRequest('analisis debe ser un arreglo no vacio');
  }

  const ids = analisis.map((id) => String(id));
  if (new Set(ids).size !== ids.length) {
    throw ApiError.badRequest('No se permiten analisis duplicados');
  }

  return ids;
}

/**
 * Crea una solicitud en estado Registrada.
 *
 * @param {{
 *   clienteId: string|import('mongoose').Types.ObjectId,
 *   descripcionInicial?: string|null,
 *   analisis: Array<string|import('mongoose').Types.ObjectId>,
 *   usuarioId?: string|import('mongoose').Types.ObjectId|null,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function crearSolicitud({
  clienteId,
  descripcionInicial = null,
  analisis,
  usuarioId = null,
}) {
  const ids = normalizarAnalisis(analisis);

  return conTransaccion(async (session) => {
    const cliente = await Cliente.findById(clienteId).session(session);
    if (!cliente) {
      throw ApiError.badRequest('El cliente indicado no existe');
    }

    const analisisDocs = await Analisis.find({
      _id: { $in: ids },
      activo: true,
    }).session(session);

    if (analisisDocs.length !== ids.length) {
      throw ApiError.badRequest('Uno o mas analisis no existen o estan inactivos');
    }

    const [solicitud] = await Solicitud.create(
      [
        {
          cliente: cliente._id,
          estado: ESTADO_SOLICITUD.REGISTRADA,
          descripcion_inicial: descripcionInicial || null,
          analisis: ids,
        },
      ],
      { session }
    );

    await HistorialEstadoSolicitud.create(
      [
        {
          solicitud: solicitud._id,
          estado: solicitud.estado,
          usuario: usuarioId || null,
          observacion: 'Solicitud registrada',
        },
      ],
      { session }
    );

    return solicitud;
  });
}

export { crearSolicitud };
export default { crearSolicitud };
