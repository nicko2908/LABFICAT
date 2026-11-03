/**
 * Controlador del modulo: cupones (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/cupon.service.js.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  crearCupon,
  generarCupon,
  poblarCupon,
  listar as listarCupones,
  listarMios as listarCuponesMios,
  obtenerPorId as obtenerCupon,
  registrarRecordatorio as registrarRecordatorioService,
  cambiarEstado as cambiarEstadoService,
} from '../services/cupon.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioCupon,
} from '../utils/propietario.js';

/** GET /cupones */
async function listar(req, res, next) {
  try {
    const datos = await listarCupones(req.query);
    res.json(new ApiResponse(datos, 'Cupones listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cupon' }));
  }
}

/** GET /cupones/mios */
async function listarMios(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarCuponesMios(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis cupones listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cupon' }));
  }
}

/** GET /cupones/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerCupon(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioCupon(doc, req.usuario);
    }
    res.json(new ApiResponse(doc, 'Cupon obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cupon' }));
  }
}

/** POST /cupones */
async function crear(req, res, next) {
  try {
    const { cotizacion, valor } = req.body || {};
    if (!cotizacion) throw ApiError.badRequest('cotizacion es obligatoria');

    const doc = await crearCupon({
      cotizacionId: cotizacion,
      valor,
      usuarioId: actorId(req),
    });

    await poblarCupon(doc);
    res.status(201).json(new ApiResponse(doc, 'Cupon solicitado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cupon' }));
  }
}

/** PATCH /cupones/:id/generar */
async function generar(req, res, next) {
  try {
    const { codigo_cupon } = req.body || {};
    if (!codigo_cupon) throw ApiError.badRequest('codigo_cupon es obligatorio');

    const doc = await generarCupon({ cuponId: req.params.id, codigoCupon: codigo_cupon });
    await poblarCupon(doc);
    res.json(new ApiResponse(doc, 'Cupon generado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cupon' }));
  }
}

/** POST /cupones/:id/recordatorios */
async function registrarRecordatorio(req, res, next) {
  try {
    const doc = await registrarRecordatorioService(req.params.id);
    res.json(new ApiResponse(doc, 'Recordatorio registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cupon' }));
  }
}

/** PATCH /cupones/:id/estado */
async function cambiarEstado(req, res, next) {
  try {
    const { doc, estado } = await cambiarEstadoService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, `Cupon marcado como ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cupon' }));
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
