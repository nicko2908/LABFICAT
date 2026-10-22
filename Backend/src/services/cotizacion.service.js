/**
 * Service del modulo: cotizacion.
 *
 * Concentra las reglas que tocan Cotizacion + Solicitud:
 *  - una sola cotizacion por solicitud,
 *  - solo se cotiza una solicitud Registrada,
 *  - el detalle solo usa analisis de la solicitud,
 *  - tarifa 0 para clientes internos,
 *  - la decision del cliente transiciona la solicitud en la misma transaccion.
 */
import ApiError from '../utils/ApiError.js';
import {
  ESTADO_COTIZACION,
  ESTADO_SOLICITUD,
  TIPO_CLIENTE,
} from '../config/constants.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import Analisis from '../models/laboratorio/Analisis.js';
import {
  conTransaccion,
  transicionarSolicitud,
} from './flujo.service.js';

function normalizarDetalle(detalle) {
  if (!Array.isArray(detalle) || detalle.length === 0) {
    throw ApiError.badRequest('detalle debe ser un arreglo no vacio');
  }

  const ids = detalle.map((linea) => {
    if (!linea || linea.analisis === undefined || linea.analisis === null) {
      throw ApiError.badRequest('Cada linea del detalle requiere analisis');
    }
    return String(linea.analisis);
  });

  if (new Set(ids).size !== ids.length) {
    throw ApiError.badRequest('No se permiten analisis duplicados en el detalle');
  }

  return ids;
}

/**
 * Valida el detalle contra la solicitud y calcula tarifas y total.
 * Debe ejecutarse dentro de la transaccion.
 */
async function calcularDetalle({ solicitud, detalle, session }) {
  const ids = normalizarDetalle(detalle);
  const analisisSolicitud = new Set(
    (solicitud.analisis || []).map((id) => String(id))
  );

  for (const id of ids) {
    if (!analisisSolicitud.has(id)) {
      throw ApiError.badRequest('El analisis indicado no pertenece a la solicitud');
    }
  }

  const analisisDocs = await Analisis.find({
    _id: { $in: ids },
    activo: true,
  }).session(session);

  if (analisisDocs.length !== ids.length) {
    throw ApiError.badRequest('Uno o mas analisis no existen o estan inactivos');
  }

  const cliente = await Cliente.findById(solicitud.cliente).session(session);
  if (!cliente) {
    throw ApiError.badRequest('El cliente de la solicitud no existe');
  }

  const porId = new Map(analisisDocs.map((doc) => [String(doc._id), doc]));
  const esInterno = cliente.tipo_cliente === TIPO_CLIENTE.INTERNO;

  const detalleCalculado = detalle.map((linea) => {
    const analisis = porId.get(String(linea.analisis));
    const tarifa =
      esInterno
        ? 0
        : Number(
            linea.tarifa_aplicada !== undefined && linea.tarifa_aplicada !== null
              ? linea.tarifa_aplicada
              : analisis.tarifa_externo
          );

    if (!Number.isFinite(tarifa) || tarifa < 0) {
      throw ApiError.badRequest('La tarifa aplicada no es valida');
    }

    return { analisis: analisis._id, tarifa_aplicada: tarifa };
  });

  const valorTotal = detalleCalculado.reduce(
    (acc, linea) => acc + linea.tarifa_aplicada,
    0
  );

  return { detalleCalculado, valorTotal };
}

/**
 * Crea la cotizacion y pasa la solicitud a Cotizada.
 *
 * @param {{
 *   solicitudId: string|import('mongoose').Types.ObjectId,
 *   detalle: Array<{ analisis: string, tarifa_aplicada?: number }>,
 *   usuarioId?: string|import('mongoose').Types.ObjectId|null,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function crearCotizacion({ solicitudId, detalle, usuarioId = null }) {
  return conTransaccion(async (session) => {
    const solicitud = await Solicitud.findById(solicitudId).session(session);
    if (!solicitud) {
      throw ApiError.badRequest('La solicitud indicada no existe');
    }

    if (solicitud.estado !== ESTADO_SOLICITUD.REGISTRADA) {
      throw ApiError.conflict(
        'Solo se puede cotizar una solicitud en estado Registrada'
      );
    }

    const previa = await Cotizacion.findOne({
      solicitud: solicitud._id,
    }).session(session);
    if (previa) {
      throw ApiError.conflict('La solicitud ya tiene cotizacion');
    }

    const { detalleCalculado, valorTotal } = await calcularDetalle({
      solicitud,
      detalle,
      session,
    });

    const [cotizacion] = await Cotizacion.create(
      [
        {
          solicitud: solicitud._id,
          detalle: detalleCalculado,
          valor_total: valorTotal,
        },
      ],
      { session }
    );

    await transicionarSolicitud(solicitud._id, ESTADO_SOLICITUD.COTIZADA, {
      session,
      usuario: usuarioId,
      observacion: 'Cotizacion creada',
    });

    return cotizacion;
  });
}

/**
 * Registra la decision del cliente y sincroniza la solicitud.
 *
 * @param {{
 *   cotizacionId: string|import('mongoose').Types.ObjectId,
 *   decision: 'ACEPTADA'|'RECHAZADA',
 *   motivoRechazo?: string|null,
 *   firma?: { ruta: string, hash?: string|null }|null,
 *   firmaIp?: string|null,
 *   usuarioId?: string|import('mongoose').Types.ObjectId|null,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function decidirCotizacion({
  cotizacionId,
  decision,
  motivoRechazo = null,
  firma = null,
  firmaIp = null,
  usuarioId = null,
}) {
  if (
    decision !== ESTADO_COTIZACION.ACEPTADA &&
    decision !== ESTADO_COTIZACION.RECHAZADA
  ) {
    throw ApiError.badRequest('decision debe ser ACEPTADA o RECHAZADA');
  }

  return conTransaccion(async (session) => {
    const cotizacion = await Cotizacion.findById(cotizacionId).session(session);
    if (!cotizacion) throw ApiError.notFound('Cotizacion no encontrada');

    if (cotizacion.estado !== ESTADO_COTIZACION.PENDIENTE) {
      throw ApiError.conflict('La cotizacion ya fue decidida');
    }

    const cambios = {
      estado: decision,
      fecha_decision: new Date(),
    };

    if (decision === ESTADO_COTIZACION.ACEPTADA) {
      if (!firma || !firma.ruta) {
        throw ApiError.badRequest('La firma es obligatoria para aceptar');
      }
      cambios.firma_ruta = firma.ruta;
      cambios.firma_hash = firma.hash || null;
      cambios.firma_fecha = new Date();
      cambios.firma_ip = firmaIp || null;
      cambios.motivo_rechazo = null;
    } else {
      const motivo = String(motivoRechazo || '').trim();
      if (!motivo) {
        throw ApiError.badRequest('motivo_rechazo es obligatorio para rechazar');
      }
      cambios.motivo_rechazo = motivo;
    }

    const actualizada = await Cotizacion.findOneAndUpdate(
      { _id: cotizacionId, estado: ESTADO_COTIZACION.PENDIENTE },
      { $set: cambios },
      { new: true, runValidators: true, session }
    );

    if (!actualizada) {
      throw ApiError.conflict('La cotizacion ya fue decidida');
    }

    const estadoSolicitud =
      decision === ESTADO_COTIZACION.ACEPTADA
        ? ESTADO_SOLICITUD.ACEPTADA
        : ESTADO_SOLICITUD.DESISTIDA;

    await transicionarSolicitud(cotizacion.solicitud, estadoSolicitud, {
      session,
      usuario: usuarioId,
      observacion:
        decision === ESTADO_COTIZACION.ACEPTADA
          ? 'Cotizacion aceptada'
          : 'Cotizacion rechazada',
      motivoDesistimiento:
        decision === ESTADO_COTIZACION.RECHAZADA ? motivoRechazo : null,
    });

    return actualizada;
  });
}

export { crearCotizacion, decidirCotizacion };
export default { crearCotizacion, decidirCotizacion };
