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
import Cliente from '../models/clientes/Cliente.js';
import Usuario from '../models/seguridad/Usuario.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';
import { generarInformePdf } from '../utils/generadores/pdf.js';
import {
  subirArchivo,
  descargarArchivo,
  eliminarArchivo,
} from './storage.service.js';

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

async function cargarContextoInforme({ muestraId, usuarioId }) {
  const muestra = await Muestra.findById(muestraId)
    .populate('tipo_muestra', 'nombre')
    .populate('solicitud', 'codigo_solicitud cliente estado analisis');
  if (!muestra) throw ApiError.badRequest('La muestra indicada no existe');

  const solicitud = muestra.solicitud;
  if (!solicitud) {
    throw ApiError.badRequest('La solicitud de la muestra no existe');
  }

  const [cliente, usuario, ordenes] = await Promise.all([
    Cliente.findById(solicitud.cliente)
      .populate('usuario', 'nombres apellidos correo')
      .lean(),
    Usuario.findById(usuarioId).select('nombres apellidos correo').lean(),
    OrdenAnalisis.find({ muestra: muestra._id })
      .populate('analisis', 'nombre codigo metodo tecnica unidades')
      .populate('resultados.parametro', 'nombre unidad_medida')
      .lean(),
  ]);

  return { muestra, solicitud, cliente, usuario, ordenes };
}

function validarContextoInforme({ muestra, solicitud, ordenes }) {
  if (muestra.estado_recepcion !== ESTADO_RECEPCION_MUESTRA.ACEPTADA) {
    throw ApiError.conflict('Solo se genera informe de una muestra ACEPTADA');
  }

  if (
    solicitud.estado !== ESTADO_SOLICITUD.EN_ANALISIS &&
    solicitud.estado !== ESTADO_SOLICITUD.INFORME_LISTO
  ) {
    throw ApiError.conflict(
      'La solicitud debe estar En analisis o Informe listo para generar el informe'
    );
  }

  const activas = ordenes.filter(
    (orden) => orden.estado !== ESTADO_ORDEN.INVALIDADA
  );

  if (activas.length === 0) {
    throw ApiError.conflict(
      'La muestra no tiene ordenes validas para generar el informe'
    );
  }

  if (activas.some((orden) => orden.estado !== ESTADO_ORDEN.FINALIZADA)) {
    throw ApiError.conflict('Todas las ordenes activas deben estar FINALIZADAS');
  }

  return activas;
}

/**
 * Genera el informe 1:1 de una muestra, genera el PDF y lo sube a R2.
 */
async function generarInforme({ muestraId, usuarioId }) {
  if (!muestraId) throw ApiError.badRequest('muestra es obligatoria');
  if (!usuarioId) throw ApiError.unauthorized();

  const contexto = await cargarContextoInforme({ muestraId, usuarioId });
  const { muestra, solicitud, cliente, usuario, ordenes } = contexto;
  const activas = validarContextoInforme({ muestra, solicitud, ordenes });

  const previo = await Informe.exists({ muestra: muestra._id });
  if (previo) throw ApiError.conflict('La muestra ya tiene informe');

  const requeridos = await analisisDeMuestra(muestra, solicitud);
  const idAnalisis = (orden) =>
    String(orden.analisis?._id || orden.analisis || '');
  const finalizados = new Set(activas.map((orden) => idAnalisis(orden)));
  const faltantes = requeridos.filter((id) => !finalizados.has(id));

  if (faltantes.length > 0) {
    throw ApiError.conflict(
      'Falta una orden finalizada para uno o mas analisis del item de la muestra'
    );
  }

  const buffer = await generarInformePdf({
    informe: { fecha_generacion: new Date() },
    muestra,
    solicitud,
    cliente,
    usuario,
    ordenes,
  });

  const key = `informes/${muestra._id}-${Date.now()}.pdf`;
  const archivo = await subirArchivo({
    buffer,
    key,
    contentType: 'application/pdf',
    metadata: { muestra: muestra.codigo_muestra },
  });

  try {
    return await conTransaccion(async (session) => {
      const previoTx = await Informe.findOne({ muestra: muestra._id }).session(session);
      if (previoTx) throw ApiError.conflict('La muestra ya tiene informe');

      const solicitudTx = await Solicitud.findById(solicitud._id).session(session);
      if (!solicitudTx) {
        throw ApiError.badRequest('La solicitud de la muestra no existe');
      }

      const [informe] = await Informe.create(
        [
          {
            muestra: muestra._id,
            usuario: usuarioId,
            archivo_pdf: {
              ...archivo,
              nombre_original: `informe-${muestra.codigo_muestra || muestra._id}.pdf`,
            },
          },
        ],
        { session }
      );

      const itemsCompletos = await todosLosItemsTienenMuestra({
        solicitud: solicitudTx,
        session,
      });
      const muestrasCompletas = await todasLasMuestrasTienenInforme({
        solicitud: solicitudTx,
        session,
      });

      if (
        itemsCompletos &&
        muestrasCompletas &&
        solicitudTx.estado === ESTADO_SOLICITUD.EN_ANALISIS
      ) {
        await transicionarSolicitud(
          solicitudTx._id,
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
  } catch (error) {
    await eliminarArchivo(key).catch(() => {});
    throw error;
  }
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

/**
 * Descarga el PDF del informe. Para clientes exige encuesta respondida.
 * @param {{ informeId: string, usuario: object }} params
 * @returns {Promise<{ informe: object, buffer: Buffer, nombre: string }>}
 */
async function obtenerPdfInforme({ informeId, usuario }) {
  if (!informeId) throw ApiError.badRequest('informe es obligatorio');

  const informe = await Informe.findById(informeId).populate(
    'muestra',
    'codigo_muestra solicitud'
  );
  if (!informe) throw ApiError.notFound('Informe no encontrado');

  const key = informe.archivo_pdf?.key || informe.ruta_pdf;
  if (!key) throw ApiError.notFound('El informe no tiene PDF generado');

  const solicitudId = informe.muestra?.solicitud;
  if (!solicitudId) {
    throw ApiError.badRequest('El informe no tiene solicitud asociada');
  }

  const esCoordinadorUsuario = usuario?.rol === 'coordinador';
  if (!esCoordinadorUsuario) {
    const encuesta = await Encuesta.exists({ solicitud: solicitudId });
    if (!encuesta) {
      throw ApiError.forbidden(
        'Debe responder la encuesta de satisfaccion antes de descargar (RF-17)'
      );
    }

  }

  const buffer = await descargarArchivo(key);

  if (!esCoordinadorUsuario) {
    await Informe.findByIdAndUpdate(informeId, {
      $set: { fecha_descarga: new Date() },
    });
  }

  const nombre = `informe-${informe.muestra?.codigo_muestra || informe._id}.pdf`;

  return { informe, buffer, nombre };
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
  obtenerPdfInforme,
  poblarInforme,
  listar,
  listarMios,
  obtenerPorId,
};
export default {
  generarInforme,
  registrarEnvioInforme,
  registrarDescargaInforme,
  obtenerPdfInforme,
  poblarInforme,
  listar,
  listarMios,
  obtenerPorId,
};
