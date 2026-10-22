/**
 * Controlador del modulo: cupones (capa C de MVC).
 * Basado en: CuponPago (-> Cotizacion, solicitado_por -> Usuario). RF-06 / RF-24.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_CUPON, ESTADO_CUPON_LISTA } from '../config/constants.js';
import { puedeTransicionarCupon } from '../config/estados.js';
import CuponPago from '../models/servicios/CuponPago.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import { crearCupon, generarCupon } from '../services/cupon.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioCupon,
} from '../utils/propietario.js';

const POPULATE_CUPON = [
  { path: 'cotizacion', select: 'valor_total estado solicitud' },
  { path: 'solicitado_por', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un cupon con ese ${campo}`, err.keyValue);
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

/** GET /cupones — lista paginada (coordinador). Filtros: estado, cotizacion. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_CUPON_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.cotizacion) filtro.cotizacion = req.query.cotizacion;
    const [items, total] = await Promise.all([
      CuponPago.find(filtro).populate(POPULATE_CUPON).sort({ fecha_solicitud: -1 }).skip(skip).limit(limit),
      CuponPago.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Cupones listados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /cupones/mios — cupones de las solicitudes del cliente autenticado. */
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

    const filtro = {
      cotizacion: { $in: cotizaciones.map((cotizacion) => cotizacion._id) },
    };

    if (req.query.estado) {
      if (!ESTADO_CUPON_LISTA.includes(req.query.estado)) {
        throw ApiError.badRequest('estado invalido');
      }
      filtro.estado = req.query.estado;
    }

    const [items, total] = await Promise.all([
      CuponPago.find(filtro)
        .populate(POPULATE_CUPON)
        .sort({ fecha_solicitud: -1 })
        .skip(skip)
        .limit(limit),
      CuponPago.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Mis cupones listados'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /cupones/:id — detalle (coordinador o cliente propietario). */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await CuponPago.findById(req.params.id).populate(POPULATE_CUPON);
    if (!doc) throw ApiError.notFound('Cupon no encontrado');

    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioCupon(doc, req.usuario);
    }

    res.json(new ApiResponse(doc, 'Cupon obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /cupones — el coordinador solicita cupon para una cotizacion aceptada.
 * Body: { cotizacion, valor? }. Si no se envia valor, se usa el total de la cotizacion.
 */
async function crear(req, res, next) {
  try {
    const { cotizacion, valor } = req.body || {};
    if (!cotizacion) throw ApiError.badRequest('cotizacion es obligatoria');

    const doc = await crearCupon({
      cotizacionId: cotizacion,
      valor,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_CUPON);
    res.status(201).json(new ApiResponse(doc, 'Cupon solicitado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /cupones/:id/generar — registra el codigo de Produccion de Centro.
 * Body: { codigo_cupon }. Calcula fecha_generacion y fecha_vencimiento.
 */
async function generar(req, res, next) {
  try {
    const { codigo_cupon } = req.body || {};
    if (!codigo_cupon) throw ApiError.badRequest('codigo_cupon es obligatorio');

    const doc = await generarCupon({
      cuponId: req.params.id,
      codigoCupon: codigo_cupon,
    });

    await doc.populate(POPULATE_CUPON);
    res.json(new ApiResponse(doc, 'Cupon generado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** POST /cupones/:id/recordatorios — RF-24, deja constancia de aviso de vencimiento. */
async function registrarRecordatorio(req, res, next) {
  try {
    const doc = await CuponPago.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Cupon no encontrado');
    doc.recordatorios.push({ fecha_envio: new Date() });
    await doc.save();
    await doc.populate(POPULATE_CUPON);
    res.json(new ApiResponse(doc, 'Recordatorio registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PATCH /cupones/:id/estado — marca UTILIZADO o VENCIDO validando la transicion. */
async function cambiarEstado(req, res, next) {
  try {
    const { estado } = req.body || {};
    if (![ESTADO_CUPON.UTILIZADO, ESTADO_CUPON.VENCIDO].includes(estado)) {
      throw ApiError.badRequest('estado debe ser UTILIZADO o VENCIDO');
    }

    const doc = await CuponPago.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Cupon no encontrado');

    if (!puedeTransicionarCupon(doc.estado, estado)) {
      throw ApiError.conflict(
        `Transicion invalida de cupon: "${doc.estado}" -> "${estado}"`
      );
    }

    doc.estado = estado;
    await doc.save();
    await doc.populate(POPULATE_CUPON);
    res.json(new ApiResponse(doc, `Cupon marcado como ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export {
  listar,
  listarMios,
  obtenerPorId,
  crear,
  generar,
  registrarRecordatorio,
  cambiarEstado,
};
export default {
  listar,
  listarMios,
  obtenerPorId,
  crear,
  generar,
  registrarRecordatorio,
  cambiarEstado,
};
