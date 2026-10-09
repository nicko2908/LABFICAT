/**
 * Controlador del modulo: solicitudes (capa C de MVC).
 * Basado en: Solicitud (-> Cliente, Analisis) + HistorialEstadoSolicitud (-> Solicitud, Usuario).
 * RF-01 / RF-03 / RF-04 / RF-05. Flujo: solicitud -> cotizacion -> pago -> muestra -> informe.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_SOLICITUD_LISTA } from '../config/constants.js';
import Solicitud from '../models/servicios/Solicitud.js';
import HistorialEstadoSolicitud from '../models/servicios/HistorialEstadoSolicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import Analisis from '../models/laboratorio/Analisis.js';

const POPULATE_SOLICITUD = [
  { path: 'cliente', select: 'tipo_cliente telefono razon_social nit usuario' },
  { path: 'analisis', select: 'nombre tarifa_externo activo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una solicitud con ese ${campo}`, err.keyValue);
  }
  if (err && err.name === 'ValidationError') return ApiError.badRequest('Datos invalidos', err.errors);
  if (err && err.name === 'CastError') return ApiError.badRequest('Identificador invalido');
  return err;
}

function paginacion(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function actorId(req) {
  return (req.usuario && (req.usuario.id || req.usuario.sub)) || req.usuarioId || null;
}

async function validarReferencias(cliente, analisis) {
  if (cliente) {
    const existe = await Cliente.exists({ _id: cliente });
    if (!existe) throw ApiError.badRequest('El cliente indicado no existe');
  }
  if (analisis) {
    if (!Array.isArray(analisis) || analisis.length === 0) throw ApiError.badRequest('analisis debe ser un arreglo no vacio');
    const n = await Analisis.countDocuments({ _id: { $in: analisis } });
    if (n !== analisis.length) throw ApiError.badRequest('Uno o mas analisis no existen');
  }
}

async function registrarHistorial(solicitudId, estado, req, observacion = null) {
  await HistorialEstadoSolicitud.create({
    solicitud: solicitudId,
    estado,
    usuario: actorId(req),
    observacion,
  });
}

/** GET /solicitudes — lista paginada. Filtros: estado, cliente, search (codigo). */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_SOLICITUD_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.cliente) filtro.cliente = req.query.cliente;
    if (req.query.search) filtro.codigo_solicitud = new RegExp(String(req.query.search).trim(), 'i');
    const [items, total] = await Promise.all([
      Solicitud.find(filtro).populate(POPULATE_SOLICITUD).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Solicitud.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Solicitudes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /solicitudes/:id — detalle con cliente y analisis. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Solicitud.findById(req.params.id).populate(POPULATE_SOLICITUD);
    if (!doc) throw ApiError.notFound('Solicitud no encontrada');
    res.json(new ApiResponse(doc, 'Solicitud obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** POST /solicitudes — crea solicitud en estado REGISTRADA (el codigo se autogenera). */
async function crear(req, res, next) {
  try {
    const { cliente, descripcion_inicial, analisis } = req.body || {};
    if (!cliente || !analisis) throw ApiError.badRequest('cliente y analisis son obligatorios');
    await validarReferencias(cliente, analisis);
    const doc = await Solicitud.create({ cliente, descripcion_inicial: descripcion_inicial || null, analisis });
    await registrarHistorial(doc._id, doc.estado, req, 'Solicitud registrada');
    await doc.populate(POPULATE_SOLICITUD);
    res.status(201).json(new ApiResponse(doc, 'Solicitud creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PUT /solicitudes/:id — solo descripcion y analisis (no estado; usar PATCH estado). */
async function actualizar(req, res, next) {
  try {
    const cambios = {};
    if (req.body.descripcion_inicial !== undefined) cambios.descripcion_inicial = req.body.descripcion_inicial;
    if (req.body.analisis !== undefined) {
      await validarReferencias(null, req.body.analisis);
      cambios.analisis = req.body.analisis;
    }
    if (req.body.cliente !== undefined) {
      await validarReferencias(req.body.cliente, null);
      cambios.cliente = req.body.cliente;
    }
    if (Object.keys(cambios).length === 0) throw ApiError.badRequest('No hay campos validos para actualizar');
    const doc = await Solicitud.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true }).populate(POPULATE_SOLICITUD);
    if (!doc) throw ApiError.notFound('Solicitud no encontrada');
    res.json(new ApiResponse(doc, 'Solicitud actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /solicitudes/:id/estado — transicion de estado + entrada en historial.
 * Body: { estado, observacion?, motivo_desistimiento? }.
 */
async function cambiarEstado(req, res, next) {
  try {
    const { estado, observacion, motivo_desistimiento } = req.body || {};
    if (!estado || !ESTADO_SOLICITUD_LISTA.includes(estado)) throw ApiError.badRequest('estado invalido');
    const doc = await Solicitud.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Solicitud no encontrada');
    doc.estado = estado;
    if (estado === 'Desistida') {
      doc.motivo_desistimiento = motivo_desistimiento || null;
      doc.fecha_cierre = new Date();
    }
    if (estado === 'Cerrada' || estado === 'Finalizada') doc.fecha_cierre = doc.fecha_cierre || new Date();
    await doc.save();
    await registrarHistorial(doc._id, estado, req, observacion || null);
    await doc.populate(POPULATE_SOLICITUD);
    res.json(new ApiResponse(doc, `Solicitud en estado ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /solicitudes/:id/historial — linea de tiempo (RF-26). */
async function obtenerHistorial(req, res, next) {
  try {
    const solicitud = await Solicitud.exists({ _id: req.params.id });
    if (!solicitud) throw ApiError.notFound('Solicitud no encontrada');
    const items = await HistorialEstadoSolicitud.find({ solicitud: req.params.id })
      .populate('usuario', 'nombres apellidos correo')
      .sort({ fecha_hora: 1 });
    res.json(new ApiResponse(items, 'Historial obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, crear, actualizar, cambiarEstado, obtenerHistorial };
export default { listar, obtenerPorId, crear, actualizar, cambiarEstado, obtenerHistorial };
