/**
 * Controlador del modulo: cotizaciones (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica de negocio vive en
 * services/cotizacion.service.js.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import { ESTADO_COTIZACION } from '../config/constants.js';
import { subirFirma } from '../services/storage.service.js';
import { generarCotizacionXlsx } from '../services/excel.service.js';
import {
  crearCotizacion,
  decidirCotizacion,
  crearNuevaVersion,
  actualizarCotizacion,
  poblarCotizacion,
  listar as listarCotizaciones,
  listarMias as listarCotizacionesMias,
  obtenerPorId as obtenerCotizacion,
  obtenerFirma as obtenerFirmaCotizacion,
} from '../services/cotizacion.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioCotizacion,
} from '../utils/propietario.js';

/** GET /cotizaciones */
async function listar(req, res, next) {
  try {
    const datos = await listarCotizaciones(req.query);
    res.json(new ApiResponse(datos, 'Cotizaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

/** GET /cotizaciones/mias */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarCotizacionesMias(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis cotizaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

/** GET /cotizaciones/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerCotizacion(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioCotizacion(doc, req.usuario);
    }
    res.json(new ApiResponse(doc, 'Cotizacion obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

/** POST /cotizaciones */
async function crear(req, res, next) {
  try {
    const { solicitud, items, detalle, observaciones_propuesta, fecha_validez } = req.body || {};
    if (!solicitud) throw ApiError.badRequest('solicitud es obligatoria');

    const doc = await crearCotizacion({
      solicitudId: solicitud,
      items,
      detalle,
      observacionesPropuesta: observaciones_propuesta,
      fechaValidez: fecha_validez,
      usuarioId: actorId(req),
    });

    await poblarCotizacion(doc);
    res.status(201).json(new ApiResponse(doc, 'Cotizacion creada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

/** PUT /cotizaciones/:id */
async function actualizar(req, res, next) {
  try {
    const { items, detalle, observaciones_propuesta, fecha_validez } = req.body || {};
    const doc = await actualizarCotizacion({
      cotizacionId: req.params.id,
      items,
      detalle,
      observacionesPropuesta: observaciones_propuesta,
      fechaValidez: fecha_validez,
    });
    await poblarCotizacion(doc);
    res.json(new ApiResponse(doc, 'Cotizacion actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

/** POST /cotizaciones/:id/nueva-version */
async function nuevaVersion(req, res, next) {
  try {
    const doc = await crearNuevaVersion({
      cotizacionId: req.params.id,
      usuarioId: actorId(req),
    });
    await poblarCotizacion(doc);
    res.status(201).json(new ApiResponse(doc, 'Nueva version de cotizacion creada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

/** PATCH /cotizaciones/:id/decision — RF-05. */
async function decidir(req, res, next) {
  try {
    const { decision, firma_base64, firma_ip, motivo_rechazo } = req.body || {};

    const cotizacion = await obtenerCotizacion(req.params.id);
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

    await poblarCotizacion(actualizada);
    res.json(new ApiResponse(actualizada, `Cotizacion ${String(decision).toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

/** GET /cotizaciones/:id/firma */
async function descargarFirma(req, res, next) {
  try {
    const { doc, buffer } = await obtenerFirmaCotizacion(req.params.id);
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="firma_${doc._id}.png"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/** GET /cotizaciones/:id/excel */
async function exportarExcel(req, res, next) {
  try {
    const cotizacion = await obtenerCotizacion(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioCotizacion(cotizacion, req.usuario);
    }

    const { buffer, nombre, advertencia } = await generarCotizacionXlsx(cotizacion._id);
    res.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.set('Content-Disposition', `attachment; filename="${nombre}"`);
    if (advertencia) res.set('X-Advertencia', advertencia);
    res.send(buffer);
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cotizacion', femenino: true }));
  }
}

export {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  nuevaVersion,
  decidir,
  descargarFirma,
  exportarExcel,
};
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  nuevaVersion,
  decidir,
  descargarFirma,
  exportarExcel,
};
