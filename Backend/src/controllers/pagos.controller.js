/**
 * Controlador del modulo: pagos (capa C de MVC).
 * Basado en: SoportePago (-> CuponPago 1:1, validador -> Usuario). RF-07 / RF-08.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_SOPORTE_PAGO_LISTA } from '../config/constants.js';
import SoportePago from '../models/servicios/SoportePago.js';
import CuponPago from '../models/servicios/CuponPago.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import {
  cargarSoportePago,
  validarSoportePago,
  reenviarSoportePago,
} from '../services/pago.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioCupon,
  verificarPropietarioSoportePago,
} from '../utils/propietario.js';

const POPULATE_SOPORTE = [
  { path: 'cupon', select: 'codigo_cupon valor estado cotizacion' },
  { path: 'validador', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un soporte con ese ${campo}`, err.keyValue);
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

/** GET /pagos — lista paginada (coordinador). Filtros: estado, cupon. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_SOPORTE_PAGO_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.cupon) filtro.cupon = req.query.cupon;
    const [items, total] = await Promise.all([
      SoportePago.find(filtro).populate(POPULATE_SOPORTE).sort({ fecha_carga: -1 }).skip(skip).limit(limit),
      SoportePago.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Soportes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /pagos/mios — soportes de pago del cliente autenticado. */
async function listarMios(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const { page, limit, skip } = paginacion(req);

    const solicitudes = await Solicitud.find({ cliente: cliente._id })
      .select('_id')
      .lean();
    const cotizaciones = await Cotizacion.find({
      solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) },
    })
      .select('_id')
      .lean();
    const cupones = await CuponPago.find({
      cotizacion: { $in: cotizaciones.map((cotizacion) => cotizacion._id) },
    })
      .select('_id')
      .lean();

    const filtro = {
      cupon: { $in: cupones.map((cupon) => cupon._id) },
    };

    if (req.query.estado) {
      if (!ESTADO_SOPORTE_PAGO_LISTA.includes(req.query.estado)) {
        throw ApiError.badRequest('estado invalido');
      }
      filtro.estado = req.query.estado;
    }

    const [items, total] = await Promise.all([
      SoportePago.find(filtro)
        .populate(POPULATE_SOPORTE)
        .sort({ fecha_carga: -1 })
        .skip(skip)
        .limit(limit),
      SoportePago.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Mis pagos listados'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /pagos/:id — detalle (coordinador o cliente propietario). */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await SoportePago.findById(req.params.id).populate(POPULATE_SOPORTE);
    if (!doc) throw ApiError.notFound('Soporte no encontrado');

    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioSoportePago(doc, req.usuario);
    }

    res.json(new ApiResponse(doc, 'Soporte obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /pagos — RF-07 el cliente carga el comprobante de un cupon GENERADO.
 * Body: { cupon, ruta_archivo, formato }.
 */
async function cargar(req, res, next) {
  try {
    const { cupon, ruta_archivo, formato } = req.body || {};
    if (!cupon) throw ApiError.badRequest('cupon es obligatorio');

    const cuponDoc = await CuponPago.findById(cupon);
    if (!cuponDoc) throw ApiError.badRequest('El cupon indicado no existe');
    await verificarPropietarioCupon(cuponDoc, req.usuario);

    const doc = await cargarSoportePago({
      cuponId: cupon,
      rutaArchivo: ruta_archivo,
      formato,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_SOPORTE);
    res.status(201).json(new ApiResponse(doc, 'Soporte cargado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PUT /pagos/:id/reenviar — si fue RECHAZADO el cliente actualiza el mismo documento.
 * Body: { ruta_archivo, formato }.
 */
async function reenviar(req, res, next) {
  try {
    const { ruta_archivo, formato } = req.body || {};

    const soporte = await SoportePago.findById(req.params.id);
    if (!soporte) throw ApiError.notFound('Soporte no encontrado');
    await verificarPropietarioSoportePago(soporte, req.usuario);

    const doc = await reenviarSoportePago({
      soporteId: req.params.id,
      rutaArchivo: ruta_archivo,
      formato,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_SOPORTE);
    res.json(new ApiResponse(doc, 'Soporte reenviado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /pagos/:id/validar — RF-08 el coordinador aprueba o rechaza.
 * Body: { decision: 'APROBADO' | 'RECHAZADO', observaciones? }.
 */
async function validar(req, res, next) {
  try {
    const { decision, observaciones } = req.body || {};

    const doc = await validarSoportePago({
      soporteId: req.params.id,
      decision,
      observaciones,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_SOPORTE);
    res.json(new ApiResponse(doc, `Soporte ${String(decision).toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, listarMios, obtenerPorId, cargar, reenviar, validar };
export default { listar, listarMios, obtenerPorId, cargar, reenviar, validar };
