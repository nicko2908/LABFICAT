/**
 * Controlador del modulo: solicitudes (capa C de MVC).
 * Basado en: Solicitud (-> Cliente, Analisis) + HistorialEstadoSolicitud (-> Solicitud, Usuario).
 * RF-01 / RF-03 / RF-04 / RF-05. Flujo: solicitud -> cotizacion -> pago -> muestra -> informe.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { crearRegexBusqueda } from '../utils/regex.js';
import {
  ROLES,
  ESTADO_SOLICITUD,
  ESTADO_SOLICITUD_LISTA,
} from '../config/constants.js';
import Solicitud from '../models/servicios/Solicitud.js';
import HistorialEstadoSolicitud from '../models/servicios/HistorialEstadoSolicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import Analisis from '../models/laboratorio/Analisis.js';
import { crearSolicitud } from '../services/solicitud.service.js';
import { transicionarSolicitud } from '../services/flujo.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioSolicitud,
} from '../utils/propietario.js';

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

function filtroSolicitudes(req, clienteId = null) {
  const filtro = {};

  if (req.query.estado) {
    if (!ESTADO_SOLICITUD_LISTA.includes(req.query.estado)) {
      throw ApiError.badRequest('estado invalido');
    }
    filtro.estado = req.query.estado;
  }

  if (clienteId) {
    filtro.cliente = clienteId;
  } else if (req.query.cliente) {
    filtro.cliente = req.query.cliente;
  }

  const rx =
    req.query.search !== undefined
      ? crearRegexBusqueda(req.query.search)
      : null;
  if (rx) filtro.codigo_solicitud = rx;

  return filtro;
}

/** GET /solicitudes — lista paginada. Filtros: estado, cliente, search (codigo). */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = filtroSolicitudes(req);
    const [items, total] = await Promise.all([
      Solicitud.find(filtro).populate(POPULATE_SOLICITUD).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Solicitud.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Solicitudes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /solicitudes/mias — solicitudes del cliente autenticado. */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const { page, limit, skip } = paginacion(req);
    const filtro = filtroSolicitudes(req, cliente._id);

    const [items, total] = await Promise.all([
      Solicitud.find(filtro).populate(POPULATE_SOLICITUD).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Solicitud.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Mis solicitudes listadas'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /solicitudes/:id — detalle con cliente y analisis. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Solicitud.findById(req.params.id).populate(POPULATE_SOLICITUD);
    if (!doc) throw ApiError.notFound('Solicitud no encontrada');

    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioSolicitud(doc, req.usuario);
    }

    res.json(new ApiResponse(doc, 'Solicitud obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /solicitudes — crea solicitud en estado Registrada.
 * El cliente autenticado no puede elegir el cliente: se deriva de su perfil.
 */
async function crear(req, res, next) {
  try {
    const { cliente: clienteBody, descripcion_inicial, analisis } = req.body || {};

    let clienteId;
    if (req.usuario && req.usuario.rol === ROLES.CLIENTE) {
      const cliente = await obtenerClienteDelUsuario(req.usuarioId);
      clienteId = cliente._id;
    } else {
      if (!clienteBody) throw ApiError.badRequest('cliente es obligatorio');
      clienteId = clienteBody;
    }

    const doc = await crearSolicitud({
      clienteId,
      descripcionInicial: descripcion_inicial,
      analisis,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_SOLICITUD);
    res.status(201).json(new ApiResponse(doc, 'Solicitud creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PUT /solicitudes/:id — solo descripcion y analisis (no estado; usar PATCH estado). */
async function actualizar(req, res, next) {
  try {
    const actual = await Solicitud.findById(req.params.id);
    if (!actual) throw ApiError.notFound('Solicitud no encontrada');
    if (actual.estado !== ESTADO_SOLICITUD.REGISTRADA) {
      throw ApiError.conflict('Solo se puede editar una solicitud en estado Registrada');
    }

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
    if (!estado) throw ApiError.badRequest('estado es obligatorio');

    const doc = await transicionarSolicitud(req.params.id, estado, {
      usuario: actorId(req),
      observacion: observacion || null,
      motivoDesistimiento: motivo_desistimiento || null,
    });

    await doc.populate(POPULATE_SOLICITUD);
    res.json(new ApiResponse(doc, `Solicitud en estado ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /solicitudes/:id/historial — linea de tiempo (RF-26). */
async function obtenerHistorial(req, res, next) {
  try {
    const solicitud = await Solicitud.findById(req.params.id).select('cliente').lean();
    if (!solicitud) throw ApiError.notFound('Solicitud no encontrada');

    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioSolicitud(solicitud, req.usuario);
    }

    const items = await HistorialEstadoSolicitud.find({ solicitud: req.params.id })
      .populate('usuario', 'nombres apellidos correo')
      .sort({ fecha_hora: 1 });

    res.json(new ApiResponse(items, 'Historial obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  obtenerHistorial,
};
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  obtenerHistorial,
};
