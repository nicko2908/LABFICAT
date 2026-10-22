/**
 * Service del modulo: informe.
 *
 * Reglas:
 *  - Solo se genera informe de una muestra ACEPTADA.
 *  - Todas las ordenes activas de la muestra deben estar FINALIZADAS.
 *  - Generar el informe pasa la solicitud a Informe listo.
 *  - Registrar el envio pasa la solicitud a Finalizada.
 *  - La descarga exige una encuesta respondida para la solicitud.
 */
import ApiError from '../utils/ApiError.js';
import {
  ESTADO_ORDEN,
  ESTADO_RECEPCION_MUESTRA,
  ESTADO_SOLICITUD,
} from '../config/constants.js';
import Informe from '../models/calidad/Informe.js';
import Encuesta from '../models/calidad/Encuesta.js';
import Muestra from '../models/laboratorio/Muestra.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import Solicitud from '../models/servicios/Solicitud.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';

/**
 * Genera el informe 1:1 de una muestra.
 *
 * @param {{
 *   muestraId: string|import('mongoose').Types.ObjectId,
 *   rutaPdf?: string|null,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function generarInforme({ muestraId, rutaPdf = null, usuarioId }) {
  if (!muestraId) throw ApiError.badRequest('muestra es obligatoria');
  if (!usuarioId) throw ApiError.unauthorized();

  return conTransaccion(async (session) => {
    const muestra = await Muestra.findById(muestraId).session(session);
    if (!muestra) throw ApiError.badRequest('La muestra indicada no existe');

    if (muestra.estado_recepcion !== ESTADO_RECEPCION_MUESTRA.ACEPTADA) {
      throw ApiError.conflict('Solo se genera informe de una muestra ACEPTADA');
    }

    const solicitud = await Solicitud.findById(muestra.solicitud).session(session);
    if (!solicitud) {
      throw ApiError.badRequest('La solicitud de la muestra no existe');
    }

    if (solicitud.estado !== ESTADO_SOLICITUD.EN_ANALISIS) {
      throw ApiError.conflict(
        'La solicitud debe estar en estado En analisis para generar el informe'
      );
    }

    const previo = await Informe.findOne({ muestra: muestra._id }).session(session);
    if (previo) throw ApiError.conflict('La muestra ya tiene informe');

    const ordenes = await OrdenAnalisis.find({ muestra: muestra._id })
      .select('estado analisis')
      .session(session);

    const activas = ordenes.filter(
      (orden) => orden.estado !== ESTADO_ORDEN.INVALIDADA
    );

    if (activas.length === 0) {
      throw ApiError.conflict(
        'La muestra no tiene ordenes validas para generar el informe'
      );
    }

    if (activas.some((orden) => orden.estado !== ESTADO_ORDEN.FINALIZADA)) {
      throw ApiError.conflict(
        'Todas las ordenes activas deben estar FINALIZADAS'
      );
    }

    const analisisFinalizados = new Set(
      activas.map((orden) => String(orden.analisis))
    );
    const faltantes = (solicitud.analisis || []).filter(
      (analisisId) => !analisisFinalizados.has(String(analisisId))
    );

    if (faltantes.length > 0) {
      throw ApiError.conflict(
        'Falta una orden finalizada para uno o mas analisis de la solicitud'
      );
    }

    const [informe] = await Informe.create(
      [
        {
          muestra: muestra._id,
          usuario: usuarioId,
          ruta_pdf: rutaPdf ? String(rutaPdf).trim() : null,
        },
      ],
      { session }
    );

    await transicionarSolicitud(
      solicitud._id,
      ESTADO_SOLICITUD.INFORME_LISTO,
      {
        session,
        usuario: usuarioId,
        observacion: 'Informe generado',
      }
    );

    return informe;
  });
}

/**
 * Registra el envio del informe al cliente y finaliza la solicitud.
 *
 * @param {{
 *   informeId: string|import('mongoose').Types.ObjectId,
 *   usuarioId: string|import('mongoose').Types.ObjectId,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function registrarEnvioInforme({ informeId, usuarioId }) {
  if (!informeId) throw ApiError.badRequest('informe es obligatorio');
  if (!usuarioId) throw ApiError.unauthorized();

  return conTransaccion(async (session) => {
    const informe = await Informe.findById(informeId).session(session);
    if (!informe) throw ApiError.notFound('Informe no encontrado');

    if (informe.fecha_envio) {
      throw ApiError.conflict('El informe ya fue enviado');
    }

    const muestra = await Muestra.findById(informe.muestra).session(session);
    if (!muestra) throw ApiError.badRequest('La muestra del informe no existe');

    const solicitud = await Solicitud.findById(muestra.solicitud).session(session);
    if (!solicitud) {
      throw ApiError.badRequest('La solicitud del informe no existe');
    }

    const actualizado = await Informe.findOneAndUpdate(
      { _id: informeId, fecha_envio: null },
      { $set: { fecha_envio: new Date() } },
      { new: true, session }
    );

    if (!actualizado) {
      throw ApiError.conflict('El informe ya fue enviado');
    }

    await transicionarSolicitud(
      solicitud._id,
      ESTADO_SOLICITUD.FINALIZADA,
      {
        session,
        usuario: usuarioId,
        observacion: 'Informe enviado al cliente',
      }
    );

    return actualizado;
  });
}

/**
 * Registra la descarga del informe. Exige una encuesta respondida.
 *
 * @param {{ informeId: string|import('mongoose').Types.ObjectId }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function registrarDescargaInforme({ informeId }) {
  if (!informeId) throw ApiError.badRequest('informe es obligatorio');

  const informe = await Informe.findById(informeId).populate(
    'muestra',
    'solicitud'
  );
  if (!informe) throw ApiError.notFound('Informe no encontrado');

  const solicitudId = informe.muestra?.solicitud;
  if (!solicitudId) {
    throw ApiError.badRequest('El informe no tiene solicitud asociada');
  }

  const encuesta = await Encuesta.exists({ solicitud: solicitudId });
  if (!encuesta) {
    throw ApiError.forbidden(
      'Debe responder la encuesta de satisfaccion antes de descargar (RF-17)'
    );
  }

  return Informe.findByIdAndUpdate(
    informeId,
    { $set: { fecha_descarga: new Date() } },
    { new: true }
  );
}

export { generarInforme, registrarEnvioInforme, registrarDescargaInforme };
export default {
  generarInforme,
  registrarEnvioInforme,
  registrarDescargaInforme,
};
