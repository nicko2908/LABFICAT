/**
 * Service del modulo: muestra.
 *
 * Reglas:
 *  - Cliente externo: solo despues del pago aprobado.
 *  - Cliente interno: despues de aceptar la cotizacion (no paga).
 *  - El tipo de muestra y la unidad deben ser compatibles con los analisis.
 *  - Una muestra ACEPTADA pasa la solicitud a En analisis.
 *  - Una muestra RECHAZADA no cambia el estado de la solicitud y permite reintentar.
 */
import ApiError from '../utils/ApiError.js';
import {
  ESTADO_RECEPCION_MUESTRA,
  ESTADO_SOLICITUD,
  LIMITES,
  TIPO_CLIENTE,
} from '../config/constants.js';
import Muestra from '../models/laboratorio/Muestra.js';
import HistorialPrioridad from '../models/laboratorio/HistorialPrioridad.js';
import TipoMuestra from '../models/laboratorio/TipoMuestra.js';
import Analisis from '../models/laboratorio/Analisis.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';

const UNIDADES_MEDIDA = ['ml', 'gr'];
const ESTADOS_RECEPCION = Object.values(ESTADO_RECEPCION_MUESTRA);

/**
 * Registra la recepcion de una muestra.
 *
 * @param {{
 *   solicitudId: string|import('mongoose').Types.ObjectId,
 *   tipoMuestraId: string|import('mongoose').Types.ObjectId,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 *   unidadMedida: string,
 *   fechaRecepcion: Date|string,
 *   estadoRecepcion: string,
 *   cantidadRecibida?: number,
 *   numeroEnvases?: number,
 *   condicionesConservacion?: string|null,
 *   nombre?: string|null,
 *   descripcion?: string|null,
 *   observaciones?: string|null,
 *   motivoRechazo?: string|null,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function crearMuestra({
  solicitudId,
  tipoMuestraId,
  usuarioId,
  unidadMedida,
  fechaRecepcion,
  estadoRecepcion,
  cantidadRecibida = LIMITES.CANTIDAD_MINIMA_MUESTRA,
  numeroEnvases = 1,
  condicionesConservacion = null,
  nombre = null,
  descripcion = null,
  observaciones = null,
  motivoRechazo = null,
}) {
  if (!solicitudId) throw ApiError.badRequest('solicitud es obligatoria');
  if (!tipoMuestraId) throw ApiError.badRequest('tipo_muestra es obligatorio');
  if (!usuarioId) throw ApiError.unauthorized();
  if (!UNIDADES_MEDIDA.includes(unidadMedida)) {
    throw ApiError.badRequest('unidad_medida debe ser ml o gr');
  }
  if (!ESTADOS_RECEPCION.includes(estadoRecepcion)) {
    throw ApiError.badRequest('estado_recepcion debe ser ACEPTADA o RECHAZADA');
  }

  const fecha = new Date(fechaRecepcion);
  if (Number.isNaN(fecha.getTime())) {
    throw ApiError.badRequest('fecha_recepcion no es una fecha valida');
  }

  const cantidad = Number(cantidadRecibida);
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    throw ApiError.badRequest('cantidad_recibida no es valida');
  }

  if (
    estadoRecepcion === ESTADO_RECEPCION_MUESTRA.RECHAZADA &&
    !String(motivoRechazo || '').trim()
  ) {
    throw ApiError.badRequest('motivo_rechazo es obligatorio cuando la muestra se rechaza');
  }

  return conTransaccion(async (session) => {
    const solicitud = await Solicitud.findById(solicitudId).session(session);
    if (!solicitud) {
      throw ApiError.badRequest('La solicitud indicada no existe');
    }

    const cliente = await Cliente.findById(solicitud.cliente).session(session);
    if (!cliente) {
      throw ApiError.badRequest('El cliente de la solicitud no existe');
    }

    const esInterno = cliente.tipo_cliente === TIPO_CLIENTE.INTERNO;
    const estadoEsperado = esInterno
      ? ESTADO_SOLICITUD.ACEPTADA
      : ESTADO_SOLICITUD.PAGO_APROBADO;

    if (solicitud.estado !== estadoEsperado) {
      throw ApiError.conflict(
        `La solicitud debe estar en estado "${estadoEsperado}" para recibir la muestra`
      );
    }

    const tipoMuestra = await TipoMuestra.findById(tipoMuestraId).session(session);
    if (!tipoMuestra || !tipoMuestra.activo) {
      throw ApiError.badRequest('El tipo de muestra indicado no existe o esta inactivo');
    }

    const analisisDocs = await Analisis.find({
      _id: { $in: solicitud.analisis || [] },
      activo: true,
    }).session(session);

    if (analisisDocs.length === 0) {
      throw ApiError.conflict('La solicitud no tiene analisis activos');
    }

    for (const analisis of analisisDocs) {
      if (
        analisis.tipos_muestra &&
        analisis.tipos_muestra.length > 0 &&
        !analisis.tipos_muestra.some(
          (id) => String(id) === String(tipoMuestra._id)
        )
      ) {
        throw ApiError.badRequest(
          `El tipo de muestra no corresponde al analisis "${analisis.nombre}"`
        );
      }

      if (
        analisis.unidad_cantidad &&
        analisis.unidad_cantidad !== unidadMedida
      ) {
        throw ApiError.badRequest(
          `La unidad de medida no corresponde al analisis "${analisis.nombre}"`
        );
      }
    }

    const cantidadMinima = Math.max(
      ...analisisDocs.map((analisis) => Number(analisis.cantidad_minima) || 0),
      0
    );

    if (cantidad < cantidadMinima) {
      throw ApiError.badRequest(
        `La cantidad recibida debe ser al menos ${cantidadMinima} ${unidadMedida}`
      );
    }

    const [muestra] = await Muestra.create(
      [
        {
          solicitud: solicitud._id,
          tipo_muestra: tipoMuestra._id,
          usuario: usuarioId,
          unidad_medida: unidadMedida,
          cantidad_recibida: cantidad,
          numero_envases: numeroEnvases,
          condiciones_conservacion: condicionesConservacion,
          estado_recepcion: estadoRecepcion,
          motivo_rechazo:
            estadoRecepcion === ESTADO_RECEPCION_MUESTRA.RECHAZADA
              ? String(motivoRechazo).trim()
              : null,
          fecha_recepcion: fecha,
          nombre,
          descripcion,
          observaciones,
        },
      ],
      { session }
    );

    await HistorialPrioridad.create(
      [
        {
          muestra: muestra._id,
          usuario: usuarioId,
          nivel: muestra.prioridad || 3,
          motivo: 'Prioridad inicial de recepcion',
        },
      ],
      { session }
    );

    if (estadoRecepcion === ESTADO_RECEPCION_MUESTRA.ACEPTADA) {
      await transicionarSolicitud(
        solicitud._id,
        ESTADO_SOLICITUD.EN_ANALISIS,
        {
          session,
          usuario: usuarioId,
          observacion: 'Muestra aceptada',
        }
      );
    }

    return muestra;
  });
}

export { crearMuestra };
export default { crearMuestra };
