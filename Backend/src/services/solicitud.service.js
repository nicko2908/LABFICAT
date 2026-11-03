/**
 * Service del modulo: solicitud.
 *
 * Crea la solicitud y su historial inicial dentro de una misma transaccion.
 */
import ApiError from '../utils/ApiError.js';
import { crearRegexBusqueda } from '../utils/regex.js';
import { paginacion } from '../utils/paginacion.js';
import { ESTADO_SOLICITUD, ESTADO_SOLICITUD_LISTA } from '../config/constants.js';
import Solicitud from '../models/servicios/Solicitud.js';
import HistorialEstadoSolicitud from '../models/servicios/HistorialEstadoSolicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import Analisis from '../models/laboratorio/Analisis.js';
import { conTransaccion, transicionarSolicitud } from './flujo.service.js';

const POPULATE_SOLICITUD = [
  { path: 'cliente', select: 'tipo_cliente telefono razon_social nit usuario' },
  { path: 'analisis', select: 'nombre tarifa_externo activo' },
];

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

/**
 * Arma el filtro de listado a partir del query string.
 * @param {Record<string, unknown>} query
 * @param {string|null} clienteId
 */
function filtroSolicitudes(query = {}, clienteId = null) {
  const filtro = {};

  if (query.estado) {
    if (!ESTADO_SOLICITUD_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }

  if (clienteId) {
    filtro.cliente = clienteId;
  } else if (query.cliente) {
    filtro.cliente = query.cliente;
  }

  const rx = query.search !== undefined ? crearRegexBusqueda(query.search) : null;
  if (rx) filtro.codigo_solicitud = rx;

  return filtro;
}

/** Popula el documento con las referencias del listado/detalle. */
function poblarSolicitud(doc) {
  return doc.populate(POPULATE_SOLICITUD);
}

/**
 * GET /solicitudes y /solicitudes/mias.
 * @param {Record<string, unknown>} query
 * @param {{ clienteId?: string|null }} [opciones]
 */
async function listar(query = {}, { clienteId = null } = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = filtroSolicitudes(query, clienteId);

  const [items, total] = await Promise.all([
    Solicitud.find(filtro)
      .populate(POPULATE_SOLICITUD)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Solicitud.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /solicitudes/:id */
async function obtenerPorId(id) {
  const doc = await Solicitud.findById(id).populate(POPULATE_SOLICITUD);
  if (!doc) throw ApiError.notFound('Solicitud no encontrada');
  return doc;
}

async function validarReferencias(cliente, analisis) {
  if (cliente) {
    const existe = await Cliente.exists({ _id: cliente });
    if (!existe) throw ApiError.badRequest('El cliente indicado no existe');
  }
  if (analisis) {
    if (!Array.isArray(analisis) || analisis.length === 0) {
      throw ApiError.badRequest('analisis debe ser un arreglo no vacio');
    }
    const n = await Analisis.countDocuments({ _id: { $in: analisis } });
    if (n !== analisis.length) throw ApiError.badRequest('Uno o mas analisis no existen');
  }
}

/**
 * PUT /solicitudes/:id — solo descripcion y analisis (no estado).
 */
async function actualizar(id, body = {}) {
  const actual = await Solicitud.findById(id);
  if (!actual) throw ApiError.notFound('Solicitud no encontrada');
  if (actual.estado !== ESTADO_SOLICITUD.REGISTRADA) {
    throw ApiError.conflict('Solo se puede editar una solicitud en estado Registrada');
  }

  const cambios = {};
  if (body.descripcion_inicial !== undefined) {
    cambios.descripcion_inicial = body.descripcion_inicial;
  }
  if (body.analisis !== undefined) {
    await validarReferencias(null, body.analisis);
    cambios.analisis = body.analisis;
  }
  if (body.cliente !== undefined) {
    await validarReferencias(body.cliente, null);
    cambios.cliente = body.cliente;
  }
  if (Object.keys(cambios).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  const doc = await Solicitud.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  }).populate(POPULATE_SOLICITUD);
  if (!doc) throw ApiError.notFound('Solicitud no encontrada');
  return doc;
}

/**
 * GET /solicitudes/:id/historial — linea de tiempo (RF-26).
 * Devuelve tambien la solicitud para que el controlador autorice.
 */
async function obtenerHistorial(id) {
  const solicitud = await Solicitud.findById(id).select('cliente').lean();
  if (!solicitud) throw ApiError.notFound('Solicitud no encontrada');

  const items = await HistorialEstadoSolicitud.find({ solicitud: id })
    .populate('usuario', 'nombres apellidos correo')
    .sort({ fecha_hora: 1 });

  return { solicitud, items };
}

/**
 * PATCH /solicitudes/:id/estado — transicion + historial.
 */
async function cambiarEstado(id, { estado, usuario = null, observacion = null, motivoDesistimiento = null } = {}) {
  if (!estado) throw ApiError.badRequest('estado es obligatorio');
  return transicionarSolicitud(id, estado, {
    usuario,
    observacion: observacion || null,
    motivoDesistimiento: motivoDesistimiento || null,
  });
}

export {
  crearSolicitud,
  poblarSolicitud,
  listar,
  obtenerPorId,
  actualizar,
  obtenerHistorial,
  cambiarEstado,
};
export default {
  crearSolicitud,
  poblarSolicitud,
  listar,
  obtenerPorId,
  actualizar,
  obtenerHistorial,
  cambiarEstado,
};
