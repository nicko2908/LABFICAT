/**
 * Service del modulo: orden de analisis.
 *
 * Reglas:
 *  - Solo sobre muestras ACEPTADAS de solicitudes En analisis.
 *  - El analisis debe pertenecer a la solicitud.
 *  - No puede haber dos ordenes activas para la misma muestra + analisis.
 *  - Para finalizar se requieren todos los resultados de los parametros.
 *  - Solo se repite una orden INVALIDADA.
 */
import ApiError from '../utils/ApiError.js';
import {
  ESTADO_ORDEN,
  ESTADO_ORDEN_LISTA,
  ESTADO_RECEPCION_MUESTRA,
  ESTADO_SOLICITUD,
} from '../config/constants.js';
import { puedeTransicionarOrden } from '../config/estados.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Analisis from '../models/laboratorio/Analisis.js';
import Solicitud from '../models/servicios/Solicitud.js';

async function validarResultadosCompletos(orden) {
  const analisis = await Analisis.findById(orden.analisis)
    .select('parametros')
    .lean();

  if (!analisis) throw ApiError.badRequest('El analisis de la orden no existe');

  const requeridos = (analisis.parametros || []).map((id) => String(id));
  if (requeridos.length === 0) return;

  const entregados = new Set(
    (orden.resultados || []).map((resultado) => String(resultado.parametro))
  );
  const faltantes = requeridos.filter((id) => !entregados.has(id));

  if (faltantes.length > 0) {
    throw ApiError.badRequest(
      'Faltan resultados para uno o mas parametros del analisis'
    );
  }
}

/**
 * Crea una orden de analisis.
 *
 * @param {{
 *   muestraId: string|import('mongoose').Types.ObjectId,
 *   analisisId: string|import('mongoose').Types.ObjectId,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 *   proceso?: string|null,
 *   observaciones?: string|null,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function crearOrden({
  muestraId,
  analisisId,
  usuarioId,
  proceso = null,
  observaciones = null,
}) {
  if (!muestraId) throw ApiError.badRequest('muestra es obligatoria');
  if (!analisisId) throw ApiError.badRequest('analisis es obligatorio');
  if (!usuarioId) throw ApiError.unauthorized();

  const muestra = await Muestra.findById(muestraId);
  if (!muestra) throw ApiError.badRequest('La muestra indicada no existe');
  if (muestra.estado_recepcion !== ESTADO_RECEPCION_MUESTRA.ACEPTADA) {
    throw ApiError.conflict('Solo se crean ordenes sobre muestras ACEPTADAS');
  }

  const solicitud = await Solicitud.findById(muestra.solicitud);
  if (!solicitud) {
    throw ApiError.badRequest('La solicitud de la muestra no existe');
  }
  if (solicitud.estado !== ESTADO_SOLICITUD.EN_ANALISIS) {
    throw ApiError.conflict('La solicitud no esta en estado En analisis');
  }

  const analisis = await Analisis.findById(analisisId);
  if (!analisis) throw ApiError.badRequest('El analisis indicado no existe');
  if (!analisis.activo) throw ApiError.badRequest('El analisis indicado esta inactivo');

  const pertenece = (solicitud.analisis || []).some(
    (id) => String(id) === String(analisis._id)
  );
  if (!pertenece) {
    throw ApiError.badRequest('El analisis indicado no pertenece a la solicitud');
  }

  if (
    analisis.tipos_muestra &&
    analisis.tipos_muestra.length > 0 &&
    !analisis.tipos_muestra.some(
      (id) => String(id) === String(muestra.tipo_muestra)
    )
  ) {
    throw ApiError.badRequest('El tipo de muestra no corresponde al analisis');
  }

  if (
    analisis.unidad_cantidad &&
    analisis.unidad_cantidad !== muestra.unidad_medida
  ) {
    throw ApiError.badRequest('La unidad de medida no corresponde al analisis');
  }

  const activa = await OrdenAnalisis.findOne({
    muestra: muestra._id,
    analisis: analisis._id,
    estado: { $ne: ESTADO_ORDEN.INVALIDADA },
  });
  if (activa) {
    throw ApiError.conflict(
      'Ya existe una orden activa para este analisis y esta muestra'
    );
  }

  return OrdenAnalisis.create({
    muestra: muestra._id,
    analisis: analisis._id,
    usuario: usuarioId,
    proceso: proceso || null,
    observaciones: observaciones || null,
  });
}

/**
 * Avanza el estado de una orden validando la transicion.
 *
 * @param {{
 *   ordenId: string|import('mongoose').Types.ObjectId,
 *   estadoNuevo: string,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function avanzarEstadoOrden({ ordenId, estadoNuevo }) {
  if (!ordenId) throw ApiError.badRequest('orden es obligatoria');
  if (!ESTADO_ORDEN_LISTA.includes(estadoNuevo)) {
    throw ApiError.badRequest('estado invalido');
  }

  const orden = await OrdenAnalisis.findById(ordenId);
  if (!orden) throw ApiError.notFound('Orden no encontrada');

  if (orden.estado === estadoNuevo) return orden;

  if (!puedeTransicionarOrden(orden.estado, estadoNuevo)) {
    throw ApiError.conflict(
      `Transicion invalida de orden: "${orden.estado}" -> "${estadoNuevo}"`
    );
  }

  if (estadoNuevo === ESTADO_ORDEN.FINALIZADA) {
    await validarResultadosCompletos(orden);
  }

  const cambios = { estado: estadoNuevo };
  if (estadoNuevo === ESTADO_ORDEN.EN_PROCESO && !orden.fecha_inicio) {
    cambios.fecha_inicio = new Date();
  }
  if (
    (estadoNuevo === ESTADO_ORDEN.FINALIZADA ||
      estadoNuevo === ESTADO_ORDEN.INVALIDADA) &&
    !orden.fecha_fin
  ) {
    cambios.fecha_fin = new Date();
  }

  const actualizada = await OrdenAnalisis.findOneAndUpdate(
    { _id: ordenId, estado: orden.estado },
    { $set: cambios },
    { new: true, runValidators: true }
  );

  if (!actualizada) {
    throw ApiError.conflict('La orden cambio de estado durante la operacion');
  }

  return actualizada;
}

/**
 * Registra o reemplaza los resultados de una orden EN_PROCESO.
 *
 * @param {{
 *   ordenId: string|import('mongoose').Types.ObjectId,
 *   resultados: Array<{ parametro: string, valor: number }>,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function registrarResultadosOrden({ ordenId, resultados }) {
  if (!ordenId) throw ApiError.badRequest('orden es obligatoria');
  if (!Array.isArray(resultados) || resultados.length === 0) {
    throw ApiError.badRequest('resultados debe ser un arreglo no vacio');
  }

  const orden = await OrdenAnalisis.findById(ordenId);
  if (!orden) throw ApiError.notFound('Orden no encontrada');

  if (orden.estado !== ESTADO_ORDEN.EN_PROCESO) {
    throw ApiError.conflict('Solo se registran resultados en una orden EN_PROCESO');
  }

  const analisis = await Analisis.findById(orden.analisis)
    .select('parametros')
    .lean();
  if (!analisis) throw ApiError.badRequest('El analisis de la orden no existe');

  const permitidos = new Set(
    (analisis.parametros || []).map((id) => String(id))
  );
  if (permitidos.size === 0) {
    throw ApiError.badRequest('El analisis no tiene parametros configurados');
  }

  const ids = resultados.map((resultado) => {
    if (
      !resultado ||
      resultado.parametro === undefined ||
      resultado.parametro === null
    ) {
      throw ApiError.badRequest('Cada resultado requiere parametro');
    }
    return String(resultado.parametro);
  });

  if (new Set(ids).size !== ids.length) {
    throw ApiError.badRequest('No se permiten parametros duplicados');
  }

  for (const id of ids) {
    if (!permitidos.has(id)) {
      throw ApiError.badRequest('El parametro no pertenece al analisis');
    }
  }

  const normalizados = resultados.map((resultado) => {
    if (
      resultado.valor === undefined ||
      resultado.valor === null ||
      resultado.valor === ''
    ) {
      throw ApiError.badRequest('Cada resultado requiere valor');
    }

    const valor = Number(resultado.valor);
    if (!Number.isFinite(valor)) {
      throw ApiError.badRequest('El valor del resultado debe ser numerico');
    }

    return { parametro: resultado.parametro, valor };
  });

  const actualizada = await OrdenAnalisis.findOneAndUpdate(
    { _id: ordenId, estado: ESTADO_ORDEN.EN_PROCESO },
    { $set: { resultados: normalizados } },
    { new: true, runValidators: true }
  );

  if (!actualizada) {
    throw ApiError.conflict('La orden cambio de estado durante la operacion');
  }

  return actualizada;
}

/**
 * Crea la siguiente iteracion de una orden INVALIDADA.
 *
 * @param {{
 *   ordenId: string|import('mongoose').Types.ObjectId,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 *   observaciones?: string|null,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function repetirOrden({ ordenId, usuarioId, observaciones = null }) {
  if (!ordenId) throw ApiError.badRequest('orden es obligatoria');
  if (!usuarioId) throw ApiError.unauthorized();

  const original = await OrdenAnalisis.findById(ordenId);
  if (!original) throw ApiError.notFound('Orden no encontrada');

  if (original.estado !== ESTADO_ORDEN.INVALIDADA) {
    throw ApiError.conflict('Solo se repite una orden INVALIDADA');
  }

  const activa = await OrdenAnalisis.exists({
    orden_anterior: original._id,
    estado: { $ne: ESTADO_ORDEN.INVALIDADA },
  });
  if (activa) {
    throw ApiError.conflict('Ya existe una repeticion activa de esta orden');
  }

  return OrdenAnalisis.create({
    muestra: original.muestra,
    analisis: original.analisis,
    usuario: usuarioId,
    orden_anterior: original._id,
    numero_iteracion: (original.numero_iteracion || 1) + 1,
    proceso: original.proceso,
    observaciones: observaciones || `Repeticion de ${original._id}`,
  });
}

export {
  crearOrden,
  avanzarEstadoOrden,
  registrarResultadosOrden,
  repetirOrden,
};
export default {
  crearOrden,
  avanzarEstadoOrden,
  registrarResultadosOrden,
  repetirOrden,
};
