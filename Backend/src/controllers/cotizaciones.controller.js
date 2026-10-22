/**
 * Controlador del modulo: cotizaciones (capa C de MVC).
 * Basado en: Cotizacion (-> Solicitud 1:1, detalle -> Analisis). RF-04 / RF-05.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { ESTADO_COTIZACION, ESTADO_COTIZACION_LISTA } from '../config/constants.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Solicitud from '../models/servicios/Solicitud.js';
import { subirFirma, descargarFirma as descargarFirmaService } from '../services/storage.service.js';
import { crearCotizacion, decidirCotizacion } from '../services/cotizacion.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioCotizacion,
} from '../utils/propietario.js';

const POPULATE_COTIZACION = [
  { path: 'solicitud', select: 'codigo_solicitud estado cliente' },
  { path: 'detalle.analisis', select: 'nombre tarifa_externo activo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe una cotizacion con ese ${campo}`, err.keyValue);
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

/** GET /cotizaciones — lista paginada (coordinador). Filtros: estado, solicitud. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.estado) {
      if (!ESTADO_COTIZACION_LISTA.includes(req.query.estado)) throw ApiError.badRequest('estado invalido');
      filtro.estado = req.query.estado;
    }
    if (req.query.solicitud) filtro.solicitud = req.query.solicitud;
    const [items, total] = await Promise.all([
      Cotizacion.find(filtro).populate(POPULATE_COTIZACION).sort({ fecha_emision: -1 }).skip(skip).limit(limit),
      Cotizacion.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Cotizaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /cotizaciones/mias — cotizaciones de las solicitudes del cliente autenticado. */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const { page, limit, skip } = paginacion(req);

    const solicitudes = await Solicitud.find({ cliente: cliente._id })
      .select('_id')
      .lean();

    const filtro = {
      solicitud: { $in: solicitudes.map((solicitud) => solicitud._id) },
    };

    if (req.query.estado) {
      if (!ESTADO_COTIZACION_LISTA.includes(req.query.estado)) {
        throw ApiError.badRequest('estado invalido');
      }
      filtro.estado = req.query.estado;
    }

    const [items, total] = await Promise.all([
      Cotizacion.find(filtro)
        .populate(POPULATE_COTIZACION)
        .sort({ fecha_emision: -1 })
        .skip(skip)
        .limit(limit),
      Cotizacion.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Mis cotizaciones listadas'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /cotizaciones/:id — detalle (coordinador o cliente propietario). */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Cotizacion.findById(req.params.id).populate(POPULATE_COTIZACION);
    if (!doc) throw ApiError.notFound('Cotizacion no encontrada');

    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioCotizacion(doc, req.usuario);
    }

    res.json(new ApiResponse(doc, 'Cotizacion obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /cotizaciones — crea la cotizacion 1:1 de una solicitud.
 * Body: { solicitud, detalle: [{ analisis, tarifa_aplicada? }] }.
 *
 * El valor total y las tarifas se calculan en el service:
 *  - cliente externo: tarifa enviada o tarifa_externo del analisis,
 *  - cliente interno: tarifa 0.
 */
async function crear(req, res, next) {
  try {
    const { solicitud, detalle } = req.body || {};
    if (!solicitud) throw ApiError.badRequest('solicitud es obligatoria');

    const doc = await crearCotizacion({
      solicitudId: solicitud,
      detalle,
      usuarioId: actorId(req),
    });

    await doc.populate(POPULATE_COTIZACION);
    res.status(201).json(new ApiResponse(doc, 'Cotizacion creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** PUT /cotizaciones/:id — actualiza detalle/valor (solo en PENDIENTE). */
async function actualizar(req, res, next) {
  try {
    const actual = await Cotizacion.findById(req.params.id);
    if (!actual) throw ApiError.notFound('Cotizacion no encontrada');
    if (actual.estado !== ESTADO_COTIZACION.PENDIENTE) {
      throw ApiError.conflict('Solo se puede editar una cotizacion PENDIENTE');
    }

    if (req.body.detalle !== undefined) {
      if (!Array.isArray(req.body.detalle) || req.body.detalle.length === 0) {
        throw ApiError.badRequest('detalle debe ser un arreglo no vacio');
      }

      const ids = req.body.detalle.map((linea) => {
        if (!linea || linea.analisis === undefined || linea.analisis === null) {
          throw ApiError.badRequest('Cada linea del detalle requiere analisis');
        }
        return String(linea.analisis);
      });
      if (new Set(ids).size !== ids.length) {
        throw ApiError.badRequest('No se permiten analisis duplicados en el detalle');
      }

      const solicitud = await Solicitud.findById(actual.solicitud).select('analisis').lean();
      const permitidos = new Set((solicitud?.analisis || []).map((id) => String(id)));
      if (ids.some((id) => !permitidos.has(id))) {
        throw ApiError.badRequest('El analisis indicado no pertenece a la solicitud');
      }

      actual.detalle = req.body.detalle;
      actual.valor_total = req.body.valor_total !== undefined
        ? req.body.valor_total
        : req.body.detalle.reduce((acc, linea) => acc + Number(linea.tarifa_aplicada || 0), 0);
    } else if (req.body.valor_total !== undefined) {
      actual.valor_total = req.body.valor_total;
    }

    await actual.save();
    await actual.populate(POPULATE_COTIZACION);
    res.json(new ApiResponse(actual, 'Cotizacion actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /cotizaciones/:id/decision — RF-05 aceptar/rechazar (atomico).
 * Aceptar sube la firma (PNG base64) a Supabase y guarda ruta + hash.
 * Body: { decision: 'ACEPTADA', firma_base64, firma_ip? } o { decision: 'RECHAZADA', motivo_rechazo }.
 */
async function decidir(req, res, next) {
  try {
    const { decision, firma_base64, firma_ip, motivo_rechazo } = req.body || {};
    if (![ESTADO_COTIZACION.ACEPTADA, ESTADO_COTIZACION.RECHAZADA].includes(decision)) {
      throw ApiError.badRequest('decision debe ser ACEPTADA o RECHAZADA');
    }

    const cotizacion = await Cotizacion.findById(req.params.id);
    if (!cotizacion) throw ApiError.notFound('Cotizacion no encontrada');

    await verificarPropietarioCotizacion(cotizacion, req.usuario);

    if (cotizacion.estado !== ESTADO_COTIZACION.PENDIENTE) {
      throw ApiError.conflict('La cotizacion ya fue decidida');
    }

    let firma = null;
    if (decision === ESTADO_COTIZACION.ACEPTADA) {
      if (!firma_base64) {
        throw ApiError.badRequest('firma_base64 es obligatoria para aceptar (firma digital RF-05)');
      }

      // La subida a Supabase es externa a la transaccion. Si la transaccion
      // falla despues, el objeto queda huerfano y puede limpiarse con un job.
      firma = await subirFirma({
        base64: firma_base64,
        nombre: `firma_${cotizacion._id}_${Date.now()}.png`,
      });
    }

    const actualizada = await decidirCotizacion({
      cotizacionId: cotizacion._id,
      decision,
      motivoRechazo: motivo_rechazo,
      firma,
      firmaIp: firma_ip || req.ip || null,
      usuarioId: actorId(req),
    });

    await actualizada.populate(POPULATE_COTIZACION);
    res.json(new ApiResponse(actualizada, `Cotizacion ${decision.toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * GET /cotizaciones/:id/firma — respaldo legal: descarga el PNG de la firma.
 * Solo coordinador; el cliente no tiene acceso a su propia firma.
 */
async function descargarFirma(req, res, next) {
  try {
    const doc = await Cotizacion.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Cotizacion no encontrada');
    if (!doc.firma_ruta) throw ApiError.notFound('Esta cotizacion no tiene firma registrada');
    const buffer = await descargarFirmaService(doc.firma_ruta);
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="firma_${doc._id}.png"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  decidir,
  descargarFirma,
};
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  decidir,
  descargarFirma,
};
