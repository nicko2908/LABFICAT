/**
 * Service del modulo: muestra.
 *
 * Reglas:
 *  - Cada muestra corresponde a UN item de la cotizacion aceptada.
 *  - Cliente interno (tipologia.es_interno) o cotizacion en 0: recibe muestra
 *    desde Aceptada o En analisis, sin pago.
 *  - Cliente externo con valor > 0: solo despues de Pago aprobado.
 *  - El tipo de muestra y la unidad deben ser compatibles con los analisis
 *    del item (si el analisis define restricciones).
 *  - La primera muestra ACEPTADA pasa la solicitud a En analisis; las demas
 *    se reciben en el mismo estado.
 *  - Una muestra RECHAZADA no cambia el estado y permite reintentar.
 *  - La cantidad minima solo se valida si el operador envia cantidad.
 */
import ApiError from '../utils/ApiError.js';
import { crearRegexBusqueda } from '../utils/regex.js';
import { paginacion } from '../utils/paginacion.js';
import {
  ESTADO_COTIZACION,
  ESTADO_RECEPCION_MUESTRA,
  ESTADO_SOLICITUD,
  OBSERVACIONES_RECEPCION,
  TIPO_CLIENTE,
} from '../config/constants.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Rotulo from '../models/laboratorio/Rotulo.js';
import HistorialPrioridad from '../models/laboratorio/HistorialPrioridad.js';
import TipoMuestra from '../models/laboratorio/TipoMuestra.js';
import Analisis from '../models/laboratorio/Analisis.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Cliente from '../models/clientes/Cliente.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';

const POPULATE_MUESTRA = [
  { path: 'solicitud', select: 'codigo_solicitud estado cliente' },
  { path: 'tipo_muestra', select: 'nombre estado_fisico' },
  { path: 'usuario', select: 'nombres apellidos correo' },
];

const UNIDADES_MEDIDA = ['ml', 'gr'];
const ESTADOS_RECEPCION = Object.values(ESTADO_RECEPCION_MUESTRA);

function normalizarFecha(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw ApiError.badRequest(`${campo} no es una fecha valida`);
  }
  return fecha;
}

function normalizarObservaciones(valor) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    throw ApiError.badRequest('observaciones_predefinidas debe ser un arreglo');
  }

  const numeros = valor.map((n) => Number(n));
  for (const n of numeros) {
    if (!Number.isInteger(n) || n < 1 || n > OBSERVACIONES_RECEPCION.length) {
      throw ApiError.badRequest('Cada observacion debe estar entre 1 y 7');
    }
  }
  return [...new Set(numeros)];
}

function textoObservaciones(numeros) {
  return numeros
    .map((n) => `${n}. ${OBSERVACIONES_RECEPCION[n - 1]}`)
    .join(' ');
}

/**
 * Devuelve los items de la cotizacion (o un item sintetico para datos legados).
 */
function itemsDeCotizacion(cotizacion) {
  if (Array.isArray(cotizacion.items) && cotizacion.items.length > 0) {
    return cotizacion.items;
  }
  return [
    {
      numero: 1,
      descripcion_muestra: null,
      detalle: (cotizacion.detalle || []).map((linea) => ({
        analisis: linea.analisis,
        cantidad: linea.cantidad || 1,
        tarifa_aplicada: linea.tarifa_aplicada,
      })),
    },
  ];
}

/**
 * Registra la recepcion de una muestra.
 *
 * @param {{
 *   solicitudId: string,
 *   tipoMuestraId: string,
 *   usuarioId: string,
 *   unidadMedida?: string|null,
 *   cantidadRecibida?: number|null,
 *   fechaRecepcion: Date|string,
 *   estadoRecepcion: string,
 *   cotizacionId?: string|null,
 *   cotizacionItem?: number|null,
 *   numeroEnvases?: number,
 *   condicionesConservacion?: string|null,
 *   nombre?: string|null,
 *   descripcion?: string|null,
 *   observaciones?: string|null,
 *   motivoRechazo?: string|null,
 *   matriz?: string|null,
 *   municipioRecoleccion?: string|null,
 *   direccionToma?: string|null,
 *   lugarToma?: string|null,
 *   recolectadaPor?: string|null,
 *   procedimientoMuestreo?: string|null,
 *   fechaHoraRecoleccion?: Date|string|null,
 *   observacionesPredefinidas?: number[]|null,
 * }} params
 */
async function crearMuestra({
  solicitudId,
  tipoMuestraId,
  usuarioId,
  unidadMedida = null,
  cantidadRecibida = null,
  fechaRecepcion,
  estadoRecepcion,
  cotizacionId = null,
  cotizacionItem = null,
  numeroEnvases = 1,
  condicionesConservacion = null,
  nombre = null,
  descripcion = null,
  observaciones = null,
  motivoRechazo = null,
  matriz = null,
  municipioRecoleccion = null,
  direccionToma = null,
  lugarToma = null,
  recolectadaPor = null,
  procedimientoMuestreo = null,
  fechaHoraRecoleccion = null,
  observacionesPredefinidas = null,
}) {
  if (!solicitudId) throw ApiError.badRequest('solicitud es obligatoria');
  if (!tipoMuestraId) throw ApiError.badRequest('tipo_muestra es obligatorio');
  if (!usuarioId) throw ApiError.unauthorized();

  if (unidadMedida !== null && unidadMedida !== undefined && !UNIDADES_MEDIDA.includes(unidadMedida)) {
    throw ApiError.badRequest('unidad_medida debe ser ml o gr');
  }
  if (!ESTADOS_RECEPCION.includes(estadoRecepcion)) {
    throw ApiError.badRequest('estado_recepcion debe ser ACEPTADA o RECHAZADA');
  }

  const fecha = normalizarFecha(fechaRecepcion, 'fecha_recepcion');
  if (!fecha) throw ApiError.badRequest('fecha_recepcion es obligatoria');

  let cantidad = null;
  if (cantidadRecibida !== undefined && cantidadRecibida !== null && cantidadRecibida !== '') {
    cantidad = Number(cantidadRecibida);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      throw ApiError.badRequest('cantidad_recibida no es valida');
    }
  }

  const observacionesNumeros = normalizarObservaciones(observacionesPredefinidas);
  const fechaHora = normalizarFecha(fechaHoraRecoleccion, 'fecha_hora_recoleccion');

  if (
    estadoRecepcion === ESTADO_RECEPCION_MUESTRA.RECHAZADA &&
    observacionesNumeros.length === 0 &&
    !String(motivoRechazo || '').trim()
  ) {
    throw ApiError.badRequest(
      'Para rechazar indique una observacion predefinida (1-7) o el motivo_rechazo'
    );
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

    const tipoMuestra = await TipoMuestra.findById(tipoMuestraId).session(session);
    if (!tipoMuestra || !tipoMuestra.activo) {
      throw ApiError.badRequest('El tipo de muestra indicado no existe o esta inactivo');
    }

    // Cotizacion aceptada: por id o la unica aceptada de la solicitud.
    let cotizacion = null;
    if (cotizacionId) {
      cotizacion = await Cotizacion.findById(cotizacionId).session(session);
    } else {
      cotizacion = await Cotizacion.findOne({
        solicitud: solicitud._id,
        estado: ESTADO_COTIZACION.ACEPTADA,
      }).sort({ version: -1 }).session(session);
    }

    if (!cotizacion) {
      throw ApiError.conflict('La solicitud no tiene una cotizacion aceptada');
    }
    if (String(cotizacion.solicitud) !== String(solicitud._id)) {
      throw ApiError.badRequest('La cotizacion no pertenece a la solicitud');
    }
    if (cotizacion.estado !== ESTADO_COTIZACION.ACEPTADA) {
      throw ApiError.conflict('La cotizacion debe estar ACEPTADA para recibir muestras');
    }

    const items = itemsDeCotizacion(cotizacion);
    const numeroItem = cotizacionItem === null || cotizacionItem === undefined
      ? 1
      : Number(cotizacionItem);
    const item = items.find((i) => Number(i.numero) === numeroItem);
    if (!item) {
      throw ApiError.badRequest(`El item ${numeroItem} no existe en la cotizacion aceptada`);
    }

    const idsAnalisis = [...new Set((item.detalle || []).map((linea) => String(linea.analisis)))];
    if (idsAnalisis.length === 0) {
      throw ApiError.conflict('El item de la cotizacion no tiene ensayos');
    }

    const analisisDocs = await Analisis.find({
      _id: { $in: idsAnalisis },
      activo: true,
    }).session(session);

    if (analisisDocs.length !== idsAnalisis.length) {
      throw ApiError.conflict('Uno o mas analisis del item no existen o estan inactivos');
    }

    const esInterno = cliente.tipo_cliente === TIPO_CLIENTE.INTERNO;
    const exenta = esInterno || Number(cotizacion.valor_total) === 0;
    const estadosPermitidos = exenta
      ? [ESTADO_SOLICITUD.ACEPTADA, ESTADO_SOLICITUD.EN_ANALISIS]
      : [ESTADO_SOLICITUD.PAGO_APROBADO, ESTADO_SOLICITUD.EN_ANALISIS];

    if (!estadosPermitidos.includes(solicitud.estado)) {
      throw ApiError.conflict(
        `La solicitud debe estar en estado "${estadosPermitidos.join('" o "')}" para recibir la muestra`
      );
    }

    for (const analisis of analisisDocs) {
      if (
        analisis.tipos_muestra &&
        analisis.tipos_muestra.length > 0 &&
        !analisis.tipos_muestra.some((id) => String(id) === String(tipoMuestra._id))
      ) {
        throw ApiError.badRequest(
          `El tipo de muestra no corresponde al analisis "${analisis.nombre}"`
        );
      }

      if (
        unidadMedida &&
        analisis.unidad_cantidad &&
        analisis.unidad_cantidad !== unidadMedida
      ) {
        throw ApiError.badRequest(
          `La unidad de medida no corresponde al analisis "${analisis.nombre}"`
        );
      }
    }

    if (cantidad !== null) {
      const cantidadMinima = Math.max(
        ...analisisDocs.map((analisis) => Number(analisis.cantidad_minima) || 0),
        0
      );
      if (cantidad < cantidadMinima) {
        throw ApiError.badRequest(
          `La cantidad recibida debe ser al menos ${cantidadMinima} ${unidadMedida || ''}`.trim()
        );
      }
    }

    let motivoFinal = null;
    if (estadoRecepcion === ESTADO_RECEPCION_MUESTRA.RECHAZADA) {
      if (observacionesNumeros.length > 0) {
        motivoFinal = textoObservaciones(observacionesNumeros);
        // La observacion 7 es "Otro": se completa con el texto libre.
        if (
          observacionesNumeros.includes(OBSERVACIONES_RECEPCION.length) &&
          String(motivoRechazo || '').trim()
        ) {
          motivoFinal = `${motivoFinal} ${String(motivoRechazo).trim()}`;
        }
      } else {
        motivoFinal = String(motivoRechazo).trim();
      }
    }

    const [muestra] = await Muestra.create(
      [
        {
          solicitud: solicitud._id,
          cotizacion: cotizacion._id,
          cotizacion_item: numeroItem,
          tipo_muestra: tipoMuestra._id,
          usuario: usuarioId,
          matriz,
          municipio_recoleccion: municipioRecoleccion,
          direccion_toma: direccionToma,
          lugar_toma: lugarToma,
          recolectada_por: recolectadaPor,
          procedimiento_muestreo: procedimientoMuestreo || 'No Reporta',
          fecha_hora_recoleccion: fechaHora,
          observaciones_predefinidas: observacionesNumeros,
          unidad_medida: unidadMedida || null,
          cantidad_recibida: cantidad,
          numero_envases: numeroEnvases,
          condiciones_conservacion: condicionesConservacion,
          estado_recepcion: estadoRecepcion,
          motivo_rechazo: motivoFinal,
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
          observacion: `Muestra ${muestra.codigo_muestra} aceptada (item ${numeroItem})`,
        }
      );
    }

    return muestra;
  });
}

/** Popula la muestra con sus referencias. */
function poblarMuestra(doc) {
  return doc.populate(POPULATE_MUESTRA);
}

function filtroMuestras(query = {}, solicitudIds = null) {
  const filtro = {};

  if (solicitudIds) {
    filtro.solicitud = { $in: solicitudIds };
  } else if (query.solicitud) {
    filtro.solicitud = query.solicitud;
  }

  if (query.estado_recepcion) {
    const estados = Object.values(ESTADO_RECEPCION_MUESTRA);
    if (!estados.includes(query.estado_recepcion)) {
      throw ApiError.badRequest('estado_recepcion invalido');
    }
    filtro.estado_recepcion = query.estado_recepcion;
  }

  if (query.prioridad !== undefined) {
    const prioridad = Number(query.prioridad);
    if (!Number.isInteger(prioridad) || prioridad < 1 || prioridad > 10) {
      throw ApiError.badRequest('prioridad invalida');
    }
    filtro.prioridad = prioridad;
  }

  const rx = query.search !== undefined ? crearRegexBusqueda(query.search) : null;
  if (rx) filtro.codigo_muestra = rx;

  return filtro;
}

/** GET /muestras */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = filtroMuestras(query);

  const [items, total] = await Promise.all([
    Muestra.find(filtro)
      .populate(POPULATE_MUESTRA)
      .sort({ prioridad: 1, fecha_recepcion: 1 })
      .skip(skip)
      .limit(limit),
    Muestra.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /muestras/mias */
async function listarMias(clienteId, query = {}) {
  const { page, limit, skip } = paginacion(query);

  const solicitudes = await Solicitud.find({ cliente: clienteId }).select('_id').lean();
  const filtro = filtroMuestras(query, solicitudes.map((solicitud) => solicitud._id));

  const [items, total] = await Promise.all([
    Muestra.find(filtro)
      .populate(POPULATE_MUESTRA)
      .sort({ prioridad: 1, fecha_recepcion: 1 })
      .skip(skip)
      .limit(limit),
    Muestra.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /muestras/:id — detalle + rotulo + historial de prioridad. */
async function obtenerPorId(id) {
  const muestra = await Muestra.findById(id).populate(POPULATE_MUESTRA);
  if (!muestra) throw ApiError.notFound('Muestra no encontrada');

  const [rotulo, historial] = await Promise.all([
    Rotulo.findOne({ muestra: muestra._id }).populate('analisis', 'nombre tarifa_externo'),
    HistorialPrioridad.find({ muestra: muestra._id })
      .populate('usuario', 'nombres apellidos')
      .sort({ fecha_hora: 1 }),
  ]);

  return { muestra, rotulo, historialPrioridad: historial };
}

/** PUT /muestras/:id — datos de recepcion. */
async function actualizar(id, body = {}) {
  const permitidos = [
    'nombre',
    'descripcion',
    'cantidad_recibida',
    'numero_envases',
    'condiciones_conservacion',
    'motivo_rechazo',
    'observaciones',
    'fecha_recepcion',
    'unidad_medida',
    'matriz',
    'municipio_recoleccion',
    'direccion_toma',
    'lugar_toma',
    'recolectada_por',
    'procedimiento_muestreo',
    'fecha_hora_recoleccion',
    'observaciones_predefinidas',
  ];

  const cambios = {};
  for (const campo of permitidos) {
    if (body[campo] !== undefined) cambios[campo] = body[campo];
  }
  if (Object.keys(cambios).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  const doc = await Muestra.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  }).populate(POPULATE_MUESTRA);
  if (!doc) throw ApiError.notFound('Muestra no encontrada');
  return doc;
}

/**
 * PATCH /muestras/:id/prioridad — RF-22.
 * @returns {Promise<{ muestra: object, registro: object }>}
 */
async function cambiarPrioridad(id, { nivel, motivo, usuarioId } = {}) {
  if (nivel === undefined || !motivo) {
    throw ApiError.badRequest('nivel y motivo son obligatorios');
  }

  const numero = Number(nivel);
  if (!Number.isInteger(numero) || numero < 1 || numero > 10) {
    throw ApiError.badRequest('nivel debe ser un entero entre 1 y 10');
  }
  if (!usuarioId) throw ApiError.unauthorized();

  const resultado = await conTransaccion(async (session) => {
    const muestra = await Muestra.findById(id).session(session);
    if (!muestra) throw ApiError.notFound('Muestra no encontrada');

    muestra.prioridad = numero;
    await muestra.save({ session });

    const [registro] = await HistorialPrioridad.create(
      [
        {
          muestra: muestra._id,
          usuario: usuarioId,
          nivel: numero,
          motivo: String(motivo).trim(),
        },
      ],
      { session }
    );

    return { muestra, registro };
  });

  await resultado.muestra.populate(POPULATE_MUESTRA);
  return resultado;
}

/** GET /muestras/:id (documento sin populares, para autorizar/exportar). */
async function obtenerDocumento(id) {
  const doc = await Muestra.findById(id);
  if (!doc) throw ApiError.notFound('Muestra no encontrada');
  return doc;
}

export {
  crearMuestra,
  poblarMuestra,
  listar,
  listarMias,
  obtenerPorId,
  obtenerDocumento,
  actualizar,
  cambiarPrioridad,
};
export default {
  crearMuestra,
  poblarMuestra,
  listar,
  listarMias,
  obtenerPorId,
  obtenerDocumento,
  actualizar,
  cambiarPrioridad,
};
