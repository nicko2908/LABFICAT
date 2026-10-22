/**
 * Service: flujo (orquestador de transiciones de negocio).
 *
 * Centraliza las operaciones que tocan mas de una coleccion para que se
 * ejecuten dentro de una transaccion de MongoDB.
 */
import mongoose from 'mongoose';

import ApiError from '../utils/ApiError.js';
import {
  ESTADO_SOLICITUD,
  ESTADO_SOLICITUD_LISTA,
} from '../config/constants.js';
import { puedeTransicionarSolicitud } from '../config/estados.js';
import Solicitud from '../models/servicios/Solicitud.js';
import HistorialEstadoSolicitud from '../models/servicios/HistorialEstadoSolicitud.js';

const OPCIONES_POR_DEFECTO = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
};

/**
 * Ejecuta un callback dentro de una transaccion de MongoDB.
 *
 * - Si el callback termina bien, hace commit de todos los cambios.
 * - Si lanza un error, hace abort y no deja cambios parciales.
 * - La sesion se pasa al callback para que todas las operaciones la usen.
 *
 * Uso:
 *   await conTransaccion(async (session) => {
 *     await Modelo.create([doc], { session });
 *     await OtroModelo.updateOne(filtro, cambio, { session });
 *   });
 *
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} fn
 * @param {object} [opciones] Opciones adicionales de withTransaction.
 * @returns {Promise<T>}
 * @template T
 */
async function conTransaccion(fn, opciones = {}) {
  const session = await mongoose.startSession();

  try {
    let resultado;
    await session.withTransaction(
      async () => {
        resultado = await fn(session);
      },
      { ...OPCIONES_POR_DEFECTO, ...opciones }
    );
    return resultado;
  } finally {
    await session.endSession();
  }
}

/**
 * Cambia el estado de una solicitud validando la transicion y registrando
 * el historial dentro de la misma transaccion.
 *
 * Si no se recibe una sesion, abre una transaccion propia. Si se recibe,
 * se une a la transaccion del llamador (recomendado para flujos que tocan
 * varios documentos).
 *
 * @param {string|import('mongoose').Types.ObjectId} solicitudId
 * @param {string} estadoNuevo
 * @param {{
 *   session?: import('mongoose').ClientSession,
 *   usuario?: string|import('mongoose').Types.ObjectId|null,
 *   observacion?: string|null,
 *   motivoDesistimiento?: string|null,
 * }} [opciones]
 * @returns {Promise<import('mongoose').Document>}
 */
async function transicionarSolicitud(solicitudId, estadoNuevo, opciones = {}) {
  const {
    session,
    usuario = null,
    observacion = null,
    motivoDesistimiento = null,
  } = opciones;

  // Comodidad: si el llamador no abrio una transaccion, la abrimos aqui.
  if (!session) {
    return conTransaccion((nuevaSession) =>
      transicionarSolicitud(solicitudId, estadoNuevo, {
        ...opciones,
        session: nuevaSession,
      })
    );
  }

  if (!ESTADO_SOLICITUD_LISTA.includes(estadoNuevo)) {
    throw ApiError.badRequest('Estado de solicitud invalido');
  }

  let actual;
  try {
    actual = await Solicitud.findById(solicitudId).session(session);
  } catch (err) {
    if (err && err.name === 'CastError') {
      throw ApiError.badRequest('Identificador de solicitud invalido');
    }
    throw err;
  }

  if (!actual) throw ApiError.notFound('Solicitud no encontrada');

  // Idempotencia: repetir la misma transicion no duplica el historial.
  if (actual.estado === estadoNuevo) return actual;

  if (!puedeTransicionarSolicitud(actual.estado, estadoNuevo)) {
    throw ApiError.conflict(
      `Transicion invalida de solicitud: "${actual.estado}" -> "${estadoNuevo}"`
    );
  }

  const cambios = { estado: estadoNuevo };

  if (estadoNuevo === ESTADO_SOLICITUD.DESISTIDA) {
    cambios.motivo_desistimiento = motivoDesistimiento
      ? String(motivoDesistimiento).trim()
      : null;
    cambios.fecha_cierre = new Date();
  }

  if (
    estadoNuevo === ESTADO_SOLICITUD.FINALIZADA ||
    estadoNuevo === ESTADO_SOLICITUD.CERRADA
  ) {
    cambios.fecha_cierre = actual.fecha_cierre || new Date();
  }

  // Actualizacion condicional: evita que dos requests concurrentes
  // transicionen la misma solicitud desde el mismo estado.
  const actualizada = await Solicitud.findOneAndUpdate(
    { _id: solicitudId, estado: actual.estado },
    { $set: cambios },
    { new: true, runValidators: true, session }
  );

  if (!actualizada) {
    throw ApiError.conflict('La solicitud cambio de estado durante la operacion');
  }

  await HistorialEstadoSolicitud.create(
    [
      {
        solicitud: solicitudId,
        estado: estadoNuevo,
        usuario,
        observacion: observacion ? String(observacion).trim() : null,
      },
    ],
    { session }
  );

  return actualizada;
}

export { conTransaccion, transicionarSolicitud };
export default { conTransaccion, transicionarSolicitud };
