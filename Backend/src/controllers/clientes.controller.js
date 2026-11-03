/**
 * Controlador del modulo: clientes (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/cliente.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  listar as listarClientes,
  obtenerPorId as obtenerCliente,
  crear as crearCliente,
  actualizar as actualizarCliente,
  establecerActivo,
} from '../services/cliente.service.js';

/** GET /clientes */
async function listar(req, res, next) {
  try {
    const datos = await listarClientes(req.query);
    res.json(new ApiResponse(datos, 'Clientes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cliente' }));
  }
}

/** GET /clientes/:id */
async function obtenerPorId(req, res, next) {
  try {
    const cliente = await obtenerCliente(req.params.id);
    res.json(new ApiResponse(cliente, 'Cliente obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cliente' }));
  }
}

/** POST /clientes */
async function crear(req, res, next) {
  try {
    const cliente = await crearCliente(req.body || {});
    res.status(201).json(new ApiResponse(cliente, 'Cliente creado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cliente' }));
  }
}

/** PUT /clientes/:id */
async function actualizar(req, res, next) {
  try {
    const cliente = await actualizarCliente(req.params.id, req.body || {});
    res.json(new ApiResponse(cliente, 'Cliente actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cliente' }));
  }
}

/** PATCH /clientes/:id/desactivar — RF-23. */
async function desactivar(req, res, next) {
  try {
    const cliente = await establecerActivo(req.params.id, false);
    res.json(new ApiResponse(cliente, 'Cliente desactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cliente' }));
  }
}

/** PATCH /clientes/:id/reactivar. */
async function reactivar(req, res, next) {
  try {
    const cliente = await establecerActivo(req.params.id, true);
    res.json(new ApiResponse(cliente, 'Cliente reactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'cliente' }));
  }
}

export { listar, obtenerPorId, crear, actualizar, desactivar, reactivar };
export default { listar, obtenerPorId, crear, actualizar, desactivar, reactivar };
