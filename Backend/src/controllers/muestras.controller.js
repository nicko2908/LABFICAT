/**
 * Controlador del modulo: muestras (capa C de MVC).
 * Basado en: Muestra (-> Solicitud, TipoMuestra, Usuario) + Rotulo 1:1 + HistorialPrioridad.
 * RF-09 / RF-10 / RF-11 / RF-22.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { crearRegexBusqueda } from '../utils/regex.js';
import { ESTADO_RECEPCION_MUESTRA } from '../config/constants.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Rotulo from '../models/laboratorio/Rotulo.js';
import HistorialPrioridad from '../models/laboratorio/HistorialPrioridad.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Analisis from '../models/laboratorio/Analisis.js';
import { crearMuestra } from '../services/muestra.service.js';
import { conTransaccion } from '../services/flujo.service.js';
import {
  esPersonalLaboratorio,
  obtenerClienteDelUsuario,
  verificarPropietarioMuestra,
} from '../utils/propietario.js';

const POPULATE_MUESTRA = [
  { path: 'solicitud', select: 'codigo_solicitud estado cliente' },
  { path: 'tipo_muestra', select: 'nombre estado_fisico' },
  { path: 'usuario', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una muestra con ese ${campo}`, err.keyValue);
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

function filtroMuestras(req, solicitudIds = null) {
  const filtro = {};

  if (solicitudIds) {
    filtro.solicitud = { $in: solicitudIds };
  } else if (req.query.solicitud) {
    filtro.solicitud = req.query.solicitud;
  }

  if (req.query.estado_recepcion) {
    const estados = Object.values(ESTADO_RECEPCION_MUESTRA);
    if (!estados.includes(req.query.estado_recepcion)) {
      throw ApiError.badRequest('estado_recepcion invalido');
    }
    filtro.estado_recepcion = req.query.estado_recepcion;
  }

  if (req.query.prioridad !== undefined) {
    const prioridad = Number(req.query.prioridad);
    if (!Number.isInteger(prioridad) || prioridad < 1 || prioridad > 10) {
      throw ApiError.badRequest('prioridad invalida');
    }
    filtro.prioridad = prioridad;
  }

  const rx =
    req.query.search !== undefined
      ? crearRegexBusqueda(req.query.search)
      : null;
  if (rx) filtro.codigo_muestra = rx;

  return filtro;
}

/** GET /muestras — lista paginada (coordinador/analista). */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = filtroMuestras(req);

    const [items, total] = await Promise.all([
      Muestra.find(filtro)
        .populate(POPULATE_MUESTRA)
        .sort({ prioridad: 1, fecha_recepcion: 1 })
        .skip(skip)
        .limit(limit),
      Muestra.countDocuments(filtro),
    ]);

    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Muestras listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /muestras/mias — muestras de las solicitudes del cliente autenticado. */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const { page, limit, skip } = paginacion(req);

    const solicitudes = await Solicitud.find({ cliente: cliente._id })
      .select('_id')
      .lean();
    const filtro = filtroMuestras(
      req,
      solicitudes.map((solicitud) => solicitud._id)
    );

    const [items, total] = await Promise.all([
      Muestra.find(filtro)
        .populate(POPULATE_MUESTRA)
        .sort({ prioridad: 1, fecha_recepcion: 1 })
        .skip(skip)
        .limit(limit),
      Muestra.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Mis muestras listadas'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /muestras/:id — detalle + rotulo + historial de prioridad. */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Muestra.findById(req.params.id).populate(POPULATE_MUESTRA);
    if (!doc) throw ApiError.notFound('Muestra no encontrada');

    if (!esPersonalLaboratorio(req.usuario)) {
      await verificarPropietarioMuestra(doc, req.usuario);
    }

    const [rotulo, historial] = await Promise.all([
      Rotulo.findOne({ muestra: doc._id }).populate('analisis', 'nombre tarifa_externo'),
      HistorialPrioridad.find({ muestra: doc._id }).populate('usuario', 'nombres apellidos').sort({ fecha_hora: 1 }),
    ]);

    res.json(new ApiResponse({ muestra: doc, rotulo, historialPrioridad: historial }, 'Muestra obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /muestras — RF-09 recepcion. El codigo LAB-AAAA-NNNN se autogenera.
 * Body: { solicitud, tipo_muestra, unidad_medida, fecha_recepcion, estado_recepcion, ...opcionales }.
 */
async function crear(req, res, next) {
  try {
    const {
      solicitud,
      tipo_muestra,
      unidad_medida,
      fecha_recepcion,
      estado_recepcion,
      cantidad_recibida,
      numero_envases,
      condiciones_conservacion,
      nombre,
      descripcion,
      observaciones,
      motivo_rechazo,
    } = req.body || {};

    const doc = await crearMuestra({
      solicitudId: solicitud,
      tipoMuestraId: tipo_muestra,
      usuarioId: actorId(req),
      unidadMedida: unidad_medida,
      fechaRecepcion: fecha_recepcion,
      estadoRecepcion: estado_recepcion,
      cantidadRecibida: cantidad_recibida,
      numeroEnvases: numero_envases,
      condicionesConservacion: condiciones_conservacion,
      nombre,
      descripcion,
      observaciones,
      motivoRechazo: motivo_rechazo,
    });

    await doc.populate(POPULATE_MUESTRA);
    res.status(201).json(new ApiResponse(doc, 'Muestra registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PUT /muestras/:id — actualiza datos de recepcion (no estado ni prioridad). */
async function actualizar(req, res, next) {
  try {
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
    ];

    const cambios = {};
    for (const campo of permitidos) {
      if (req.body && req.body[campo] !== undefined) {
        cambios[campo] = req.body[campo];
      }
    }

    if (Object.keys(cambios).length === 0) {
      throw ApiError.badRequest('No hay campos validos para actualizar');
    }

    const doc = await Muestra.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    }).populate(POPULATE_MUESTRA);

    if (!doc) throw ApiError.notFound('Muestra no encontrada');
    res.json(new ApiResponse(doc, 'Muestra actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /muestras/:id/prioridad — RF-22. Cambia prioridad y lo registra (motivo obligatorio).
 * Body: { nivel: 1-10, motivo }.
 */
async function cambiarPrioridad(req, res, next) {
  try {
    const { nivel, motivo } = req.body || {};
    if (nivel === undefined || !motivo) {
      throw ApiError.badRequest('nivel y motivo son obligatorios');
    }

    const numero = Number(nivel);
    if (!Number.isInteger(numero) || numero < 1 || numero > 10) {
      throw ApiError.badRequest('nivel debe ser un entero entre 1 y 10');
    }

    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();

    const resultado = await conTransaccion(async (session) => {
      const muestra = await Muestra.findById(req.params.id).session(session);
      if (!muestra) throw ApiError.notFound('Muestra no encontrada');

      muestra.prioridad = numero;
      await muestra.save({ session });

      const [registro] = await HistorialPrioridad.create(
        [
          {
            muestra: muestra._id,
            usuario,
            nivel: numero,
            motivo: String(motivo).trim(),
          },
        ],
        { session }
      );

      return { muestra, registro };
    });

    await resultado.muestra.populate(POPULATE_MUESTRA);
    res.json(new ApiResponse(resultado, 'Prioridad actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /muestras/:id/rotulo — RF-11 genera o actualiza el rotulo 1:1.
 * Body: { analisis: [ids], ruta_pdf? }.
 */
async function generarRotulo(req, res, next) {
  try {
    const { analisis, ruta_pdf } = req.body || {};

    const muestra = await Muestra.findById(req.params.id);
    if (!muestra) throw ApiError.notFound('Muestra no encontrada');
    if (muestra.estado_recepcion !== ESTADO_RECEPCION_MUESTRA.ACEPTADA) {
      throw ApiError.conflict('Solo se genera rotulo de una muestra ACEPTADA');
    }

    if (analisis !== undefined) {
      if (!Array.isArray(analisis) || analisis.length === 0) {
        throw ApiError.badRequest('analisis debe ser un arreglo no vacio');
      }
      const n = await Analisis.countDocuments({ _id: { $in: analisis } });
      if (n !== analisis.length) {
        throw ApiError.badRequest('Uno o mas analisis no existen');
      }
    }

    const doc = await Rotulo.findOneAndUpdate(
      { muestra: muestra._id },
      {
        $set: {
          ...(analisis !== undefined ? { analisis } : {}),
          ...(ruta_pdf !== undefined ? { ruta_pdf } : {}),
        },
      },
      { new: true, runValidators: true, upsert: true }
    ).populate('analisis', 'nombre tarifa_externo');

    res.status(201).json(new ApiResponse(doc, 'Rotulo generado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, listarMias, obtenerPorId, crear, actualizar, cambiarPrioridad, generarRotulo };
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  cambiarPrioridad,
  generarRotulo,
};
