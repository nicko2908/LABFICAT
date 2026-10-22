/**
 * Controlador del modulo: ordenes (capa C de MVC).
 * Basado en: OrdenAnalisis (-> Muestra, Analisis, Usuario, orden_anterior).
 * RF-12 / RF-13 / RF-14.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_ORDEN_LISTA } from '../config/constants.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Muestra from '../models/laboratorio/Muestra.js';
import {
  crearOrden,
  avanzarEstadoOrden,
  registrarResultadosOrden,
  repetirOrden,
} from '../services/orden.service.js';
import {
  esPersonalLaboratorio,
  obtenerClienteDelUsuario,
  verificarPropietarioOrden,
} from '../utils/propietario.js';

const POPULATE_ORDEN = [
  { path: 'muestra', select: 'codigo_muestra estado_recepcion prioridad solicitud' },
  { path: 'analisis', select: 'nombre tarifa_externo' },
  { path: 'usuario', select: 'nombres apellidos correo' },
  { path: 'resultados.parametro', select: 'nombre unidad_medida' },
  { path: 'orden_anterior', select: 'numero_iteracion estado' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una orden con ese ${campo}`, err.keyValue);
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

/** GET /ordenes — lista paginada (coordinador/analista). */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_ORDEN_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.muestra) filtro.muestra = req.query.muestra;
    if (req.query.analisis) filtro.analisis = req.query.analisis;
    if (req.query.usuario) filtro.usuario = req.query.usuario;

    const [items, total] = await Promise.all([
      OrdenAnalisis.find(filtro).populate(POPULATE_ORDEN).sort({ createdAt: -1 }).skip(skip).limit(limit),
      OrdenAnalisis.countDocuments(filtro),
    ]);

    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Ordenes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /ordenes/mias — ordenes de las muestras del cliente autenticado. */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const { page, limit, skip } = paginacion(req);

    const solicitudes = await Solicitud.find({ cliente: cliente._id })
      .select('_id')
      .lean();
    const muestras = await Muestra.find({
      solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) },
    })
      .select('_id')
      .lean();

    const filtro = {
      muestra: { $in: muestras.map((muestra) => muestra._id) },
    };

    if (req.query.estado) {
      if (!ESTADO_ORDEN_LISTA.includes(req.query.estado)) {
        throw ApiError.badRequest('estado invalido');
      }
      filtro.estado = req.query.estado;
    }

    const [items, total] = await Promise.all([
      OrdenAnalisis.find(filtro)
        .populate(POPULATE_ORDEN)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      OrdenAnalisis.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Mis ordenes listadas'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /ordenes/:id — detalle (coordinador, analista o cliente propietario). */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await OrdenAnalisis.findById(req.params.id).populate(POPULATE_ORDEN);
    if (!doc) throw ApiError.notFound('Orden no encontrada');

    if (!esPersonalLaboratorio(req.usuario)) {
      await verificarPropietarioOrden(doc, req.usuario);
    }

    res.json(new ApiResponse(doc, 'Orden obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /ordenes — crea la orden de trabajo de un analisis sobre una muestra.
 * Body: { muestra, analisis, proceso?, observaciones? }. usuario sale del token.
 */
async function crear(req, res, next) {
  try {
    const { muestra, analisis, proceso, observaciones } = req.body || {};

    const doc = await crearOrden({
      muestraId: muestra,
      analisisId: analisis,
      usuarioId: actorId(req),
      proceso,
      observaciones,
    });

    await doc.populate(POPULATE_ORDEN);
    res.status(201).json(new ApiResponse(doc, 'Orden creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /ordenes/:id/estado — avanza PENDIENTE -> EN_PROCESO -> FINALIZADA / INVALIDADA.
 * Body: { estado }.
 */
async function avanzarEstado(req, res, next) {
  try {
    const { estado } = req.body || {};

    const doc = await avanzarEstadoOrden({
      ordenId: req.params.id,
      estadoNuevo: estado,
    });

    await doc.populate(POPULATE_ORDEN);
    res.json(new ApiResponse(doc, `Orden en estado ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PUT /ordenes/:id/resultados — RF-13 registra valores por parametro.
 * Body: { resultados: [{ parametro, valor }] }.
 */
async function registrarResultados(req, res, next) {
  try {
    const { resultados } = req.body || {};

    const doc = await registrarResultadosOrden({
      ordenId: req.params.id,
      resultados,
    });

    await doc.populate(POPULATE_ORDEN);
    res.json(new ApiResponse(doc, 'Resultados registrados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /ordenes/:id/repetir — RF-14 crea la siguiente iteracion de una orden INVALIDADA.
 */
async function repetir(req, res, next) {
  try {
    const doc = await repetirOrden({
      ordenId: req.params.id,
      usuarioId: actorId(req),
      observaciones: req.body?.observaciones || null,
    });

    await doc.populate(POPULATE_ORDEN);
    res.status(201).json(new ApiResponse(doc, 'Orden repetida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, listarMias, obtenerPorId, crear, avanzarEstado, registrarResultados, repetir };
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  avanzarEstado,
  registrarResultados,
  repetir,
};
