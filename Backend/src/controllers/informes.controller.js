/**
 * Controlador del modulo: informes (capa C de MVC).
 * Basado en: Informe (-> Muestra 1:1, Usuario). RF-15 / RF-16 / RF-17.
 * Regla: no se puede descargar sin responder la encuesta.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Informe from '../models/calidad/Informe.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Solicitud from '../models/servicios/Solicitud.js';
import {
  generarInforme,
  registrarEnvioInforme,
  registrarDescargaInforme,
} from '../services/informe.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioInforme,
} from '../utils/propietario.js';

const POPULATE_INFORME = [
  { path: 'muestra', select: 'codigo_muestra estado_recepcion solicitud' },
  { path: 'usuario', select: 'nombres apellidos correo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un informe con ese ${campo}`, err.keyValue);
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

/** GET /informes — lista paginada (coordinador). Filtro: muestra. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.muestra) filtro.muestra = req.query.muestra;

    const [items, total] = await Promise.all([
      Informe.find(filtro)
        .populate(POPULATE_INFORME)
        .sort({ fecha_generacion: -1 })
        .skip(skip)
        .limit(limit),
      Informe.countDocuments(filtro),
    ]);

    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Informes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /informes/mios — informes de las muestras del cliente autenticado. */
async function listarMios(req, res, next) {
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

    const [items, total] = await Promise.all([
      Informe.find(filtro)
        .populate(POPULATE_INFORME)
        .sort({ fecha_generacion: -1 })
        .skip(skip)
        .limit(limit),
      Informe.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Mis informes listados'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /informes/:id — detalle (coordinador o cliente propietario). */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Informe.findById(req.params.id).populate(POPULATE_INFORME);
    if (!doc) throw ApiError.notFound('Informe no encontrado');

    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioInforme(doc, req.usuario);
    }

    res.json(new ApiResponse(doc, 'Informe obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /informes — RF-15 genera el informe 1:1 de una muestra aceptada.
 * Body: { muestra, ruta_pdf? }. usuario sale del token.
 */
async function generar(req, res, next) {
  try {
    const { muestra, ruta_pdf } = req.body || {};

    const doc = await generarInforme({
      muestraId: muestra,
      rutaPdf: ruta_pdf,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_INFORME);
    res.status(201).json(new ApiResponse(doc, 'Informe generado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PATCH /informes/:id/envio — RF-16 registra el envio y finaliza la solicitud. */
async function registrarEnvio(req, res, next) {
  try {
    const doc = await registrarEnvioInforme({
      informeId: req.params.id,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_INFORME);
    res.json(new ApiResponse(doc, 'Envio registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /informes/:id/descarga — RF-17 bloqueada sin encuesta de la solicitud.
 * Exige que exista Encuesta para la solicitud de la muestra.
 */
async function registrarDescarga(req, res, next) {
  try {
    const informe = await Informe.findById(req.params.id);
    if (!informe) throw ApiError.notFound('Informe no encontrado');

    await verificarPropietarioInforme(informe, req.usuario);

    const doc = await registrarDescargaInforme({
      informeId: req.params.id,
    });

    await doc.populate(POPULATE_INFORME);
    res.json(new ApiResponse(doc, 'Descarga registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, listarMios, obtenerPorId, generar, registrarEnvio, registrarDescarga };
export default {
  listar,
  listarMios,
  obtenerPorId,
  generar,
  registrarEnvio,
  registrarDescarga,
};
