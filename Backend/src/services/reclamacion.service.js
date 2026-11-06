/**
 * Service del modulo: reclamaciones (RF-18).
 *
 * Basado en: Reclamacion (-> Solicitud) + evidencias embebidas.
 * El codigo REC-AAAA-NNNN lo autogenera el modelo.
 *
 * Las evidencias se guardan en R2; en MongoDB solo viven sus metadatos.
 */
import crypto from 'node:crypto';
import { crearRegexBusqueda } from '../utils/regex.js';
import { paginacion } from '../utils/paginacion.js';
import { LIMITES, ESTADO_RECLAMACION_LISTA } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import Reclamacion from '../models/calidad/Reclamacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import {
  subirArchivo,
  descargarArchivo,
  eliminarArchivo,
} from './storage.service.js';
import { validarArchivo } from '../utils/archivos.js';
import {
  verificarPropietarioSolicitud,
  verificarPropietarioReclamacion,
} from '../utils/propietario.js';

const POPULATE_RECLAMACION = [{ path: 'solicitud', select: 'codigo_solicitud estado cliente' }];
const MIME_EVIDENCIA = ['image/png', 'image/jpeg'];
const MAX_BYTES_EVIDENCIA = LIMITES.EVIDENCIA_MAX_MB * 1024 * 1024;

function filtroListado(query = {}) {
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
  return filtro;
}

/** GET /reclamaciones — lista paginada (coordinador). */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = filtroListado(query);

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

/** GET /reclamaciones/mias — reclamaciones del cliente autenticado. */
async function listarMias(clienteId, query = {}) {
  if (!clienteId) throw ApiError.unauthorized();
  const { page, limit, skip } = paginacion(query);
  const filtro = filtroListado(query);

  const solicitudes = await Solicitud.find({ cliente: clienteId }).select('_id').lean();
  filtro.solicitud = { $in: solicitudes.map((solicitud) => solicitud._id) };

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

/** GET /reclamaciones/:id — coordinador o cliente propietario. */
async function obtenerPorId(id, usuario) {
  const doc = await Reclamacion.findById(id).populate(POPULATE_RECLAMACION);
  if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
  await verificarPropietarioReclamacion(doc, usuario);
  return doc;
}

/** POST /reclamaciones — el cliente reclama sobre una solicitud propia. */
async function crear(body = {}, usuario) {
  const { solicitud, motivo, evidencias } = body;
  if (!solicitud || !motivo) {
    throw ApiError.badRequest('solicitud y motivo son obligatorios');
  }
  if (evidencias !== undefined) {
    throw ApiError.badRequest(
      'Las evidencias se adjuntan con POST /reclamaciones/:id/evidencias'
    );
  }

  const solicitudDoc = await Solicitud.findById(solicitud);
  if (!solicitudDoc) throw ApiError.badRequest('La solicitud indicada no existe');
  await verificarPropietarioSolicitud(solicitudDoc, usuario);

  const doc = await Reclamacion.create({
    solicitud: solicitudDoc._id,
    motivo: String(motivo).trim(),
  });
  await doc.populate(POPULATE_RECLAMACION);
  return doc;
}

/**
 * POST /reclamaciones/:id/evidencias — sube imagenes a R2.
 * @param {string} id
 * @param {{ files?: Array, usuario: object }} params
 */
async function agregarEvidencia(id, { files = [], usuario } = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw ApiError.badRequest('Debe adjuntar al menos una evidencia en el campo evidencias');
  }

  const doc = await Reclamacion.findById(id);
  if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
  await verificarPropietarioReclamacion(doc, usuario);

  if (doc.estado !== 'ABIERTA') {
    throw ApiError.badRequest('Solo se agregan evidencias a una reclamacion ABIERTA');
  }

  if (doc.evidencias.length + files.length > LIMITES.EVIDENCIA_MAX_ARCHIVOS) {
    throw ApiError.badRequest(
      `Una reclamacion admite maximo ${LIMITES.EVIDENCIA_MAX_ARCHIVOS} evidencias`
    );
  }

  const subidas = [];

  try {
    for (const file of files) {
      const tipo = await validarArchivo(file.buffer, {
        permitidos: MIME_EVIDENCIA,
        maxBytes: MAX_BYTES_EVIDENCIA,
      });

      const key = `evidencias/${doc._id}/${crypto.randomUUID()}.${tipo.ext}`;
      const archivo = await subirArchivo({
        buffer: file.buffer,
        key,
        contentType: tipo.mime,
        metadata: { nombre_original: file.originalname },
      });

      subidas.push(archivo.key);
      doc.evidencias.push({
        archivo: {
          ...archivo,
          nombre_original: file.originalname || null,
        },
      });
    }

    await doc.save();
  } catch (error) {
    await Promise.all(
      subidas.map((key) => eliminarArchivo(key).catch(() => {}))
    );
    throw error;
  }

  await doc.populate(POPULATE_RECLAMACION);
  return doc;
}

/** GET /reclamaciones/:id/evidencias/:evidenciaId — descarga autenticada. */
async function obtenerEvidencia(id, evidenciaId, usuario) {
  const doc = await Reclamacion.findById(id);
  if (!doc) throw ApiError.notFound('Reclamacion no encontrada');
  await verificarPropietarioReclamacion(doc, usuario);

  const evidencia = doc.evidencias.id(evidenciaId);
  if (!evidencia || !evidencia.archivo?.key) {
    throw ApiError.notFound('Evidencia no encontrada');
  }

  const buffer = await descargarArchivo(evidencia.archivo.key);
  return { doc, evidencia, buffer };
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

export {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  agregarEvidencia,
  obtenerEvidencia,
  cambiarEstado,
};
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  agregarEvidencia,
  obtenerEvidencia,
  cambiarEstado,
};
