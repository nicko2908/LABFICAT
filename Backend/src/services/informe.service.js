/**
 * Service del modulo: informe.
 *
 * Reglas:
 *  - Solo se genera informe de una muestra ACEPTADA.
 *  - Las ordenes activas del ITEM de la muestra deben estar FINALIZADAS.
 *  - La solicitud pasa a Informe listo cuando TODOS los items de la cotizacion
 *    aceptada tienen muestra aceptada y TODAS las muestras aceptadas tienen
 *    informe.
 *  - Registrar el envio pasa la solicitud a Finalizada solo cuando TODOS los
 *    informes de la solicitud fueron enviados.
 *  - La descarga exige una encuesta respondida para la solicitud.
 */
import ApiError from '../utils/ApiError.js';
import { paginacion } from '../utils/paginacion.js';
import {
  ESTADO_COTIZACION,
  ESTADO_ORDEN,
  ESTADO_RECEPCION_MUESTRA,
  ESTADO_SOLICITUD,
} from '../config/constants.js';
import Informe from '../models/calidad/Informe.js';
import Encuesta from '../models/calidad/Encuesta.js';
import Muestra from '../models/laboratorio/Muestra.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';

const POPULATE_INFORME = [
  { path: 'muestra', select: 'codigo_muestra estado_recepcion solicitud' },
  { path: 'usuario', select: 'nombres apellidos correo' },
];

function itemsDeCotizacion(cotizacion) {
  if (Array.isArray(cotizacion.items) && cotizacion.items.length > 0) {
    return cotizacion.items;
  }
  return [{ numero: 1, detalle: cotizacion.detalle || [] }];
}

/**
 * Devuelve los IDs de analisis del item de la muestra. Si no hay cotizacion
 * (datos legados), usa el listado plano de la solicitud.
 */
async function analisisDeMuestra(muestra, solicitud) {
  if (muestra.cotizacion) {
    const cotizacion = await Cotizacion.findById(muestra.cotizacion).lean();
    if (cotizacion) {
      const items = itemsDeCotizacion(cotizacion);
      const item = items.find(
        (i) => Number(i.numero) === Number(muestra.cotizacion_item || 1)
      );
      if (item) {
        return [
          ...new Set((item.detalle || []).map((linea) => String(linea.analisis))),
        ];
      }
    }
  }

  return (solicitud.analisis || []).map((id) => String(id));
}

/**
 * Indica si todos los items de la cotizacion aceptada ya tienen muestra
 * aceptada. Para datos legados sin cotizacion devuelve true.
 */
async function todosLosItemsTienenMuestra({ solicitud, session }) {
  const cotizacion = await Cotizacion.findOne({
    solicitud: solicitud._id,
    estado: ESTADO_COTIZACION.ACEPTADA,
  }).sort({ version: -1 }).session(session).lean();

  if (!cotizacion) return true;

  const items = itemsDeCotizacion(cotizacion);
  for (const item of items) {
    const existe = await Muestra.findOne({
      solicitud: solicitud._id,
      cotizacion: cotizacion._id,
      cotizacion_item: Number(item.numero),
      estado_recepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
    }).select('_id').session(session).lean();

    if (!existe) return false;
  }

  return true;
}

/**
 * Indica si todas las muestras aceptadas de la solicitud tienen informe.
 */
async function todasLasMuestrasTienenInforme({ solicitud, session }) {
  const muestras = await Muestra.find({
    solicitud: solicitud._id,
    estado_recepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
  }).select('_id').session(session).lean();

  for (const muestra of muestras) {
    const informe = await Informe.findOne({ muestra: muestra._id })
      .select('_id')
      .session(session)
      .lean();
    if (!informe) return false;
  }

  return true;
}

/**
 * Genera el informe 1:1 de una muestra.
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

    if (
      solicitud.estado !== ESTADO_SOLICITUD.EN_ANALISIS &&
      solicitud.estado !== ESTADO_SOLICITUD.INFORME_LISTO
    ) {
      throw ApiError.conflict(
        'La solicitud debe estar En analisis o Informe listo para generar el informe'
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

    const requeridos = await analisisDeMuestra(muestra, solicitud);
    const finalizados = new Set(activas.map((orden) => String(orden.analisis)));
    const faltantes = requeridos.filter((id) => !finalizados.has(id));

    if (faltantes.length > 0) {
      throw ApiError.conflict(
        'Falta una orden finalizada para uno o mas analisis del item de la muestra'
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

    const itemsCompletos = await todosLosItemsTienenMuestra({ solicitud, session });
    const muestrasCompletas = await todasLasMuestrasTienenInforme({ solicitud, session });

    if (itemsCompletos && muestrasCompletas && solicitud.estado === ESTADO_SOLICITUD.EN_ANALISIS) {
      await transicionarSolicitud(
        solicitud._id,
        ESTADO_SOLICITUD.INFORME_LISTO,
        {
          session,
          usuario: usuarioId,
          observacion: 'Todos los informes de la solicitud estan generados',
        }
      );
    }

    return informe;
  });
}

/**
 * Registra el envio del informe al cliente. Finaliza la solicitud solo cuando
 * todos los informes de todas las muestras aceptadas fueron enviados.
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

    const muestras = await Muestra.find({
      solicitud: solicitud._id,
      estado_recepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
    }).select('_id').session(session).lean();

    const informes = await Informe.find({
      muestra: { $in: muestras.map((m) => m._id) },
    }).select('fecha_envio').session(session).lean();

    const todosEnviados =
      informes.length === muestras.length &&
      informes.every((doc) => Boolean(doc.fecha_envio));

    if (todosEnviados && solicitud.estado === ESTADO_SOLICITUD.INFORME_LISTO) {
      await transicionarSolicitud(
        solicitud._id,
        ESTADO_SOLICITUD.FINALIZADA,
        {
          session,
          usuario: usuarioId,
          observacion: 'Todos los informes fueron enviados al cliente',
        }
      );
    }

    return actualizado;
  });
}

/**
 * Registra la descarga del informe. Exige una encuesta respondida.
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

/** Popula el informe con sus referencias. */
function poblarInforme(doc) {
  return doc.populate(POPULATE_INFORME);
}

/** GET /informes */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.muestra) filtro.muestra = query.muestra;

  const [items, total] = await Promise.all([
    Informe.find(filtro)
      .populate(POPULATE_INFORME)
      .sort({ fecha_generacion: -1 })
      .skip(skip)
      .limit(limit),
    Informe.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /informes/mios */
async function listarMios(clienteId, query = {}) {
  const { page, limit, skip } = paginacion(query);

  const solicitudes = await Solicitud.find({ cliente: clienteId }).select('_id').lean();
  const muestras = await Muestra.find({
    solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) },
  })
    .select('_id')
    .lean();

  const filtro = { muestra: { $in: muestras.map((muestra) => muestra._id) } };

  const [items, total] = await Promise.all([
    Informe.find(filtro)
      .populate(POPULATE_INFORME)
      .sort({ fecha_generacion: -1 })
      .skip(skip)
      .limit(limit),
    Informe.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /informes/:id */
async function obtenerPorId(id) {
  const doc = await Informe.findById(id).populate(POPULATE_INFORME);
  if (!doc) throw ApiError.notFound('Informe no encontrado');
  return doc;
}

export {
  generarInforme,
  registrarEnvioInforme,
  registrarDescargaInforme,
  poblarInforme,
  listar,
  listarMios,
  obtenerPorId,
};
export default {
  generarInforme,
  registrarEnvioInforme,
  registrarDescargaInforme,
  poblarInforme,
  listar,
  listarMios,
  obtenerPorId,
};
