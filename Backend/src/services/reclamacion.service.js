/**
 * Service del modulo: reclamaciones (RF-18).
 *
 * Basado en: Reclamacion (-> Solicitud) + evidencias embebidas.
 * El codigo REC-AAAA-NNNN lo autogenera el modelo.
 */
import { crearRegexBusqueda } from '../utils/regex.js';
import { paginacion } from '../utils/paginacion.js';
import { ESTADO_RECLAMACION_LISTA } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import Reclamacion from '../models/calidad/Reclamacion.js';
import Solicitud from '../models/servicios/Solicitud.js';

const POPULATE_RECLAMACION = [{ path: 'solicitud', select: 'codigo_solicitud estado cliente' }];

/** GET /reclamaciones — lista paginada. */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.estado) {
    if (!ESTADO_RECLAMACION_LISTA.includes(query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = query.estado;
  }
  if (query.solicitud) filtro.solicitud = query.solicitud;
  const rx = query.search !== undefined ? crearRegexBusqueda(query.search) : null;
  if (rx) filtro.codigo_soporte = rx;

  const [items, total] = await Promise.all([
    Reclamacion.find(filtro)
      .populate(POPULATE_RECLAMACION)
      .sort({ fecha_registro: -1 })
      .skip(skip)
      .limit(limit),
    Reclamacion.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /reclamaciones/:id */
async function obtenerPorId(id) {
  const doc = await Reclamacion.findById(id).populate(POPULATE_RECLAMACION);
  if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
  return doc;
}

/** POST /reclamaciones — el cliente reclama sobre una solicitud. */
async function crear(body = {}) {
  const { solicitud, motivo, evidencias } = body;
  if (!solicitud || !motivo) throw ApiError.badRequest('solicitud y motivo son obligatorios');
  if (evidencias !== undefined && !Array.isArray(evidencias)) {
    throw ApiError.badRequest('evidencias debe ser un arreglo');
  }

  const existe = await Solicitud.exists({ _id: solicitud });
  if (!existe) throw ApiError.badRequest('La solicitud indicada no existe');

  const doc = await Reclamacion.create({ solicitud, motivo, evidencias: evidencias || [] });
  await doc.populate(POPULATE_RECLAMACION);
  return doc;
}

/** POST /reclamaciones/:id/evidencias */
async function agregarEvidencia(id, body = {}) {
  const { ruta_archivo, formato } = body;
  if (!ruta_archivo || !formato) {
    throw ApiError.badRequest('ruta_archivo y formato son obligatorios');
  }

  const doc = await Reclamacion.findById(id);
  if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
  if (doc.estado !== 'ABIERTA') {
    throw ApiError.badRequest('Solo se agregan evidencias a una reclamacion ABIERTA');
  }

  doc.evidencias.push({ ruta_archivo, formato });
  await doc.save();
  await doc.populate(POPULATE_RECLAMACION);
  return doc;
}

/** PATCH /reclamaciones/:id/estado — ABIERTA -> RESUELTA. */
async function cambiarEstado(id, body = {}) {
  const { estado } = body;
  if (!ESTADO_RECLAMACION_LISTA.includes(estado)) {
    throw ApiError.badRequest('estado invalido');
  }

  const doc = await Reclamacion.findById(id);
  if (!doc) throw ApiError.notFound('Reclamacion no encontrada');

  doc.estado = estado;
  if (estado === 'RESUELTA' && !doc.fecha_resolucion) doc.fecha_resolucion = new Date();
  if (estado === 'ABIERTA') doc.fecha_resolucion = null;
  await doc.save();
  await doc.populate(POPULATE_RECLAMACION);
  return { doc, estado };
}

export { listar, obtenerPorId, crear, agregarEvidencia, cambiarEstado };
export default { listar, obtenerPorId, crear, agregarEvidencia, cambiarEstado };
