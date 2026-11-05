/**
 * Controlador del modulo: ordenes (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/orden.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  crearOrden,
  avanzarEstadoOrden,
  registrarResultadosOrden,
  repetirOrden,
  poblarOrden,
  listar as listarOrdenes,
  listarMias as listarOrdenesMias,
  obtenerPorId as obtenerOrden,
} from '../services/orden.service.js';
import {
  esPersonalLaboratorio,
  obtenerClienteDelUsuario,
  verificarPropietarioOrden,
} from '../utils/propietario.js';

/** GET /ordenes */
async function listar(req, res, next) {
  try {
    const datos = await listarOrdenes(req.query);
    res.json(new ApiResponse(datos, 'Ordenes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'orden', femenino: true }));
  }
}

/** GET /ordenes/mias */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarOrdenesMias(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis ordenes listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'orden', femenino: true }));
  }
}

/** GET /ordenes/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerOrden(req.params.id);
    if (!esPersonalLaboratorio(req.usuario)) {
      await verificarPropietarioOrden(doc, req.usuario);
    }
    res.json(new ApiResponse(doc, 'Orden obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'orden', femenino: true }));
  }
}

/** POST /ordenes */
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
    await poblarOrden(doc);
    res.status(201).json(new ApiResponse(doc, 'Orden creada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'orden', femenino: true }));
  }
}

/** PATCH /ordenes/:id/estado */
async function avanzarEstado(req, res, next) {
  try {
    const { estado } = req.body || {};
    const doc = await avanzarEstadoOrden({
      ordenId: req.params.id,
      estadoNuevo: estado,
    });
    await poblarOrden(doc);
    res.json(new ApiResponse(doc, `Orden en estado ${estado}`));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'orden', femenino: true }));
  }
}

/** PUT /ordenes/:id/resultados — RF-13. */
async function registrarResultados(req, res, next) {
  try {
    const { resultados } = req.body || {};
    const doc = await registrarResultadosOrden({
      ordenId: req.params.id,
      resultados,
    });
    await poblarOrden(doc);
    res.json(new ApiResponse(doc, 'Resultados registrados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'orden', femenino: true }));
  }
}

/** POST /ordenes/:id/repetir — RF-14. */
async function repetir(req, res, next) {
  try {
    const doc = await repetirOrden({
      ordenId: req.params.id,
      usuarioId: actorId(req),
      observaciones: req.body?.observaciones || null,
    });
    await poblarOrden(doc);
    res.status(201).json(new ApiResponse(doc, 'Orden repetida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'orden', femenino: true }));
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
