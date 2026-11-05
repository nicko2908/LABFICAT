/**
 * Controlador del modulo: pagos (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/pago.service.js.
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  cargarSoportePago,
  validarSoportePago,
  reenviarSoportePago,
  poblarSoporte,
  listar as listarSoportes,
  listarMios as listarSoportesMios,
  obtenerPorId as obtenerSoportePorId,
  obtenerSoporte,
  obtenerCuponParaCarga,
} from '../services/pago.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioCupon,
  verificarPropietarioSoportePago,
} from '../utils/propietario.js';

/** GET /pagos */
async function listar(req, res, next) {
  try {
    const datos = await listarSoportes(req.query);
    res.json(new ApiResponse(datos, 'Soportes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'soporte' }));
  }
}

/** GET /pagos/mios */
async function listarMios(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarSoportesMios(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis pagos listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'soporte' }));
  }
}

/** GET /pagos/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerSoportePorId(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioSoportePago(doc, req.usuario);
    }
    res.json(new ApiResponse(doc, 'Soporte obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'soporte' }));
  }
}

/** POST /pagos — RF-07. */
async function cargar(req, res, next) {
  try {
    const { cupon, ruta_archivo, formato } = req.body || {};
    if (!cupon) throw ApiError.badRequest('cupon es obligatorio');

    const cuponDoc = await obtenerCuponParaCarga(cupon);
    await verificarPropietarioCupon(cuponDoc, req.usuario);

    const doc = await cargarSoportePago({
      cuponId: cupon,
      rutaArchivo: ruta_archivo,
      formato,
      usuarioId: actorId(req),
    });

    await poblarSoporte(doc);
    res.status(201).json(new ApiResponse(doc, 'Soporte cargado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'soporte' }));
  }
}

/** PUT /pagos/:id/reenviar */
async function reenviar(req, res, next) {
  try {
    const { ruta_archivo, formato } = req.body || {};

    const soporte = await obtenerSoporte(req.params.id);
    await verificarPropietarioSoportePago(soporte, req.usuario);

    const doc = await reenviarSoportePago({
      soporteId: req.params.id,
      rutaArchivo: ruta_archivo,
      formato,
      usuarioId: actorId(req),
    });

    await poblarSoporte(doc);
    res.json(new ApiResponse(doc, 'Soporte reenviado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'soporte' }));
  }
}

/** PATCH /pagos/:id/validar — RF-08. */
async function validar(req, res, next) {
  try {
    const { decision, observaciones } = req.body || {};
    const doc = await validarSoportePago({
      soporteId: req.params.id,
      decision,
      observaciones,
      usuarioId: actorId(req),
    });
    await poblarSoporte(doc);
    res.json(new ApiResponse(doc, `Soporte ${String(decision).toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'soporte' }));
  }
}

export { listar, listarMios, obtenerPorId, cargar, reenviar, validar };
export default { listar, listarMios, obtenerPorId, cargar, reenviar, validar };
