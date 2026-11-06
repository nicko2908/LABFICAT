/**
 * Service del modulo: cotizacion.
 *
 * Reglas:
 *  - Una solicitud puede tener varias versiones de cotizacion (V1, V2...).
 *  - Cada version tiene items[]; cada item agrupa los ensayos de una muestra.
 *  - Solo se cotiza una solicitud Registrada; solo se versiona una Cotizada.
 *  - El detalle solo usa analisis de la solicitud.
 *  - Cliente interno (tipologia.es_interno) paga 0; externo paga la tarifa
 *    enviada o la tarifa_externo del analisis.
 *  - La decision del cliente transiciona la solicitud en la misma transaccion.
 *  - Solo se puede decidir la ultima version.
 */
import ApiError from '../utils/ApiError.js';
import { paginacion } from '../utils/paginacion.js';
import {
  ESTADO_COTIZACION,
  ESTADO_COTIZACION_LISTA,
  ESTADO_SOLICITUD,
  TIPO_CLIENTE,
} from '../config/constants.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import Usuario from '../models/seguridad/Usuario.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import Analisis from '../models/laboratorio/Analisis.js';
import { descargarFirma } from './storage.service.js';
import {
  conTransaccion,
  transicionarSolicitud,
} from './flujo.service.js';

const POPULATE_COTIZACION = [
  { path: 'solicitud', select: 'codigo_solicitud estado cliente' },
  { path: 'detalle.analisis', select: 'codigo nombre unidades metodo tecnica tarifa_externo activo' },
  { path: 'items.detalle.analisis', select: 'codigo nombre unidades metodo tecnica tarifa_externo activo' },
];

/**
 * Normaliza items[] (o el detalle plano legado) a una estructura unica.
 */
function normalizarItems({ items, detalle }) {
  let entrada = null;

  if (Array.isArray(items) && items.length > 0) {
    entrada = items;
  } else if (Array.isArray(detalle) && detalle.length > 0) {
    entrada = [{ numero: 1, descripcion_muestra: null, detalle }];
  }

  if (!entrada) {
    throw ApiError.badRequest('items (o detalle) debe ser un arreglo no vacio');
  }

  const numeros = new Set();

  return entrada.map((item, indice) => {
    const numero = item.numero === undefined || item.numero === null
      ? indice + 1
      : Number(item.numero);

    if (!Number.isInteger(numero) || numero < 1) {
      throw ApiError.badRequest('El numero de item no es valido');
    }
    if (numeros.has(numero)) {
      throw ApiError.badRequest('Los numeros de item no pueden repetirse');
    }
    numeros.add(numero);

    if (!Array.isArray(item.detalle) || item.detalle.length === 0) {
      throw ApiError.badRequest(`El item ${numero} requiere al menos un ensayo`);
    }

    const vistos = new Set();
    const detalleNormalizado = item.detalle.map((linea) => {
      if (!linea || linea.analisis === undefined || linea.analisis === null) {
        throw ApiError.badRequest('Cada linea del detalle requiere analisis');
      }

      const id = String(linea.analisis);
      if (vistos.has(id)) {
        throw ApiError.badRequest(`No se permiten analisis duplicados en el item ${numero}`);
      }
      vistos.add(id);

      const cantidad = linea.cantidad === undefined || linea.cantidad === null
        ? 1
        : Number(linea.cantidad);
      if (!Number.isFinite(cantidad) || cantidad < 0) {
        throw ApiError.badRequest('La cantidad del ensayo no es valida');
      }

      return {
        analisis: id,
        cantidad,
        tarifa_aplicada:
          linea.tarifa_aplicada === undefined ? undefined : linea.tarifa_aplicada,
      };
    });

    return {
      numero,
      descripcion_muestra: item.descripcion_muestra
        ? String(item.descripcion_muestra).trim()
        : null,
      detalle: detalleNormalizado,
    };
  });
}

/**
 * Construye el snapshot de datos del cliente que se imprime en la cotizacion.
 */
async function construirSnapshot({ cliente, session }) {
  const [usuario, tipologia] = await Promise.all([
    Usuario.findById(cliente.usuario)
      .select('nombres apellidos correo')
      .session(session)
      .lean(),
    cliente.tipologia
      ? TipologiaPoblacional.findById(cliente.tipologia)
          .select('nombre es_interno')
          .session(session)
          .lean()
      : null,
  ]);

  const nombre =
    cliente.razon_social ||
    [usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ').trim() ||
    null;

  const esInterno = tipologia
    ? Boolean(tipologia.es_interno)
    : cliente.tipo_cliente === TIPO_CLIENTE.INTERNO;

  return {
    snapshot: {
      nombre,
      nit: cliente.nit || null,
      direccion: cliente.direccion || null,
      ciudad: cliente.ciudad || null,
      departamento: cliente.departamento || null,
      telefono: cliente.telefono || null,
      correo: usuario?.correo || null,
      tipologia: tipologia?.nombre || null,
      persona_contacto: cliente.persona_contacto || null,
      cargo: cliente.cargo || null,
      tipo_cliente: esInterno ? TIPO_CLIENTE.INTERNO : TIPO_CLIENTE.EXTERNO,
    },
    esInterno,
  };
}

/**
 * Valida los items contra la solicitud, calcula tarifas/totales y arma el
 * snapshot del cliente. Debe ejecutarse dentro de la transaccion.
 */
async function calcularItems({ solicitud, items, session }) {
  const ids = [...new Set(items.flatMap((item) => item.detalle.map((linea) => linea.analisis)))];
  const analisisSolicitud = new Set((solicitud.analisis || []).map((id) => String(id)));

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

  const { snapshot, esInterno } = await construirSnapshot({ cliente, session });

  // Repara el tipo_cliente si quedo desalineado con la tipologia.
  const tipoEsperado = esInterno ? TIPO_CLIENTE.INTERNO : TIPO_CLIENTE.EXTERNO;
  if (cliente.tipo_cliente !== tipoEsperado) {
    cliente.tipo_cliente = tipoEsperado;
    await cliente.save({ session });
  }

  const porId = new Map(analisisDocs.map((doc) => [String(doc._id), doc]));

  const itemsCalculados = items.map((item) => ({
    numero: item.numero,
    descripcion_muestra: item.descripcion_muestra,
    detalle: item.detalle.map((linea) => {
      const analisis = porId.get(String(linea.analisis));
      const tarifa = esInterno
        ? 0
        : Number(
            linea.tarifa_aplicada !== undefined && linea.tarifa_aplicada !== null
              ? linea.tarifa_aplicada
              : analisis.tarifa_externo
          );

      if (!Number.isFinite(tarifa) || tarifa < 0) {
        throw ApiError.badRequest('La tarifa aplicada no es valida');
      }

      return {
        analisis: analisis._id,
        cantidad: linea.cantidad,
        tarifa_aplicada: tarifa,
      };
    }),
  }));

  const detallePlano = itemsCalculados.flatMap((item) => item.detalle);
  const subtotal = detallePlano.reduce(
    (acc, linea) => acc + linea.tarifa_aplicada * (linea.cantidad || 0),
    0
  );

  return {
    itemsCalculados,
    detallePlano,
    subtotal,
    valorTotal: subtotal,
    snapshot,
    esInterno,
    analisisSolicitud: [...new Set(detallePlano.map((linea) => String(linea.analisis)))],
  };
}

/**
 * Crea la cotizacion V1 y pasa la solicitud a Cotizada.
 *
 * @param {{
 *   solicitudId: string,
 *   items?: Array<object>,
 *   detalle?: Array<object>,
 *   observacionesPropuesta?: string|null,
 *   fechaValidez?: Date|string|null,
 *   usuarioId?: string|null,
 * }} params
 */
async function crearCotizacion({
  solicitudId,
  items,
  detalle,
  observacionesPropuesta = null,
  fechaValidez = null,
  usuarioId = null,
}) {
  const itemsNormalizados = normalizarItems({ items, detalle });

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
      throw ApiError.conflict(
        'La solicitud ya tiene cotizacion; use POST /cotizaciones/:id/nueva-version'
      );
    }

    const {
      itemsCalculados,
      detallePlano,
      subtotal,
      valorTotal,
      snapshot,
      analisisSolicitud,
    } = await calcularItems({
      solicitud,
      items: itemsNormalizados,
      session,
    });

    const [cotizacion] = await Cotizacion.create(
      [
        {
          solicitud: solicitud._id,
          version: 1,
          items: itemsCalculados,
          detalle: detallePlano,
          subtotal,
          valor_total: valorTotal,
          cliente_snapshot: snapshot,
          observaciones_propuesta: observacionesPropuesta,
          fecha_validez: fechaValidez ? new Date(fechaValidez) : null,
          estado: ESTADO_COTIZACION.PENDIENTE,
        },
      ],
      { session }
    );

    await Solicitud.updateOne(
      { _id: solicitud._id },
      { $set: { analisis: analisisSolicitud } },
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
 * Edita una cotizacion PENDIENTE y ultima version. Recalcula tarifas y total.
 */
async function actualizarCotizacion({
  cotizacionId,
  items,
  detalle,
  observacionesPropuesta,
  fechaValidez,
}) {
  return conTransaccion(async (session) => {
    const actual = await Cotizacion.findById(cotizacionId).session(session);
    if (!actual) throw ApiError.notFound('Cotizacion no encontrada');

    if (actual.estado !== ESTADO_COTIZACION.PENDIENTE) {
      throw ApiError.conflict('Solo se puede editar una cotizacion PENDIENTE');
    }

    const masNueva = await Cotizacion.findOne({
      solicitud: actual.solicitud,
      version: { $gt: actual.version },
    }).select('_id').session(session).lean();
    if (masNueva) {
      throw ApiError.conflict('Solo se puede editar la ultima version de la cotizacion');
    }

    if (items !== undefined || detalle !== undefined) {
      const solicitud = await Solicitud.findById(actual.solicitud).session(session);
      if (!solicitud) throw ApiError.badRequest('La solicitud de la cotizacion no existe');

      let normalizados;
      if (items !== undefined) {
        normalizados = normalizarItems({ items });
      } else if (detalle !== undefined) {
        normalizados = normalizarItems({ detalle });
      } else if (actual.items.length > 0) {
        normalizados = normalizarItems({ items: actual.items });
      } else {
        normalizados = normalizarItems({ detalle: actual.detalle });
      }

      const {
        itemsCalculados,
        detallePlano,
        subtotal,
        valorTotal,
        snapshot,
        analisisSolicitud,
      } = await calcularItems({ solicitud, items: normalizados, session });

      actual.items = itemsCalculados;
      actual.detalle = detallePlano;
      actual.subtotal = subtotal;
      actual.valor_total = valorTotal;
      actual.cliente_snapshot = snapshot;

      await Solicitud.updateOne(
        { _id: solicitud._id },
        { $set: { analisis: analisisSolicitud } },
        { session }
      );
    }

    if (observacionesPropuesta !== undefined) {
      actual.observaciones_propuesta = observacionesPropuesta;
    }
    if (fechaValidez !== undefined) {
      actual.fecha_validez = fechaValidez ? new Date(fechaValidez) : null;
    }

    await actual.save({ session });
    return actual;
  });
}

/**
 * Crea una nueva version (V2...) a partir de la ultima version PENDIENTE.
 * La version anterior queda REEMPLAZADA y no se puede decidir.
 */
async function crearNuevaVersion({ cotizacionId, usuarioId = null }) {
  return conTransaccion(async (session) => {
    const previa = await Cotizacion.findById(cotizacionId).session(session);
    if (!previa) throw ApiError.notFound('Cotizacion no encontrada');

    const solicitud = await Solicitud.findById(previa.solicitud).session(session);
    if (!solicitud) throw ApiError.badRequest('La solicitud de la cotizacion no existe');

    if (solicitud.estado !== ESTADO_SOLICITUD.COTIZADA) {
      throw ApiError.conflict(
        'Solo se puede crear una nueva version con la solicitud en estado Cotizada'
      );
    }

    if (previa.estado !== ESTADO_COTIZACION.PENDIENTE) {
      throw ApiError.conflict('Solo se puede versionar una cotizacion PENDIENTE');
    }

    const masNueva = await Cotizacion.findOne({
      solicitud: previa.solicitud,
      version: { $gt: previa.version },
    }).select('_id').session(session).lean();
    if (masNueva) {
      throw ApiError.conflict('Ya existe una version posterior de esta cotizacion');
    }

    const marcada = await Cotizacion.findOneAndUpdate(
      { _id: previa._id, estado: ESTADO_COTIZACION.PENDIENTE },
      { $set: { estado: ESTADO_COTIZACION.REEMPLAZADA } },
      { new: true, session }
    );
    if (!marcada) {
      throw ApiError.conflict('La cotizacion cambio de estado durante la operacion');
    }

    const copiarItems = (previa.items || []).map((item) => ({
      numero: item.numero,
      descripcion_muestra: item.descripcion_muestra,
      detalle: (item.detalle || []).map((linea) => ({
        analisis: linea.analisis,
        cantidad: linea.cantidad,
        tarifa_aplicada: linea.tarifa_aplicada,
      })),
    }));

    const copiarDetalle = (previa.detalle || []).map((linea) => ({
      analisis: linea.analisis,
      cantidad: linea.cantidad,
      tarifa_aplicada: linea.tarifa_aplicada,
    }));

    const [nueva] = await Cotizacion.create(
      [
        {
          solicitud: previa.solicitud,
          codigo_cotizacion: previa.codigo_cotizacion,
          version: previa.version + 1,
          items: copiarItems,
          detalle: copiarDetalle,
          subtotal: previa.subtotal,
          valor_total: previa.valor_total,
          cliente_snapshot: previa.cliente_snapshot,
          observaciones_propuesta: previa.observaciones_propuesta,
          fecha_validez: previa.fecha_validez,
          estado: ESTADO_COTIZACION.PENDIENTE,
        },
      ],
      { session }
    );

    await transicionarSolicitud(solicitud._id, ESTADO_SOLICITUD.COTIZADA, {
      session,
      usuario: usuarioId,
      observacion: `Cotizacion version ${previa.version + 1}`,
    });

    return nueva;
  });
}

/**
 * Registra la decision del cliente sobre la ULTIMA version.
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
      throw ApiError.conflict('La cotizacion ya fue decidida o reemplazada');
    }

    const masNueva = await Cotizacion.findOne({
      solicitud: cotizacion.solicitud,
      version: { $gt: cotizacion.version },
    }).select('_id').session(session).lean();
    if (masNueva) {
      throw ApiError.conflict('Solo se puede decidir la ultima version de la cotizacion');
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
      if (firma.bucket) {
        cambios.firma = {
          proveedor: firma.proveedor || 'r2',
          bucket: firma.bucket,
          key: firma.key || firma.ruta,
          content_type: firma.content_type || 'image/png',
          bytes: firma.bytes ?? null,
          hash: firma.hash || null,
          nombre_original: firma.nombre_original || null,
        };
      }
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

/** Popula la cotizacion con sus referencias. */
function poblarCotizacion(doc) {
  return doc.populate(POPULATE_COTIZACION);
}

/** GET /cotizaciones — lista paginada. */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.estado) {
    if (!ESTADO_COTIZACION_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }
  if (query.solicitud) filtro.solicitud = query.solicitud;

  const [items, total] = await Promise.all([
    Cotizacion.find(filtro)
      .populate(POPULATE_COTIZACION)
      .sort({ fecha_emision: -1 })
      .skip(skip)
      .limit(limit),
    Cotizacion.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /cotizaciones/mias — cotizaciones de las solicitudes del cliente. */
async function listarMias(clienteId, query = {}) {
  const { page, limit, skip } = paginacion(query);

  const solicitudes = await Solicitud.find({ cliente: clienteId }).select('_id').lean();
  const filtro = { solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) } };

  if (query.estado) {
    if (!ESTADO_COTIZACION_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }

  const [items, total] = await Promise.all([
    Cotizacion.find(filtro)
      .populate(POPULATE_COTIZACION)
      .sort({ fecha_emision: -1 })
      .skip(skip)
      .limit(limit),
    Cotizacion.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /cotizaciones/:id */
async function obtenerPorId(id) {
  const doc = await Cotizacion.findById(id).populate(POPULATE_COTIZACION);
  if (!doc) throw ApiError.notFound('Cotizacion no encontrada');
  return doc;
}

/**
 * GET /cotizaciones/:id/firma — respaldo legal (solo coordinador).
 * @returns {Promise<{ doc: object, buffer: Buffer }>}
 */
async function obtenerFirma(id) {
  const doc = await Cotizacion.findById(id);
  if (!doc) throw ApiError.notFound('Cotizacion no encontrada');

  const ruta = doc.firma_ruta || doc.firma?.key;
  if (!ruta) throw ApiError.notFound('Esta cotizacion no tiene firma registrada');

  const buffer = await descargarFirma(ruta);
  return { doc, buffer };
}

export {
  crearCotizacion,
  decidirCotizacion,
  crearNuevaVersion,
  actualizarCotizacion,
  normalizarItems,
  poblarCotizacion,
  listar,
  listarMias,
  obtenerPorId,
  obtenerFirma,
};
export default {
  crearCotizacion,
  decidirCotizacion,
  crearNuevaVersion,
  actualizarCotizacion,
  normalizarItems,
  poblarCotizacion,
  listar,
  listarMias,
  obtenerPorId,
  obtenerFirma,
};
