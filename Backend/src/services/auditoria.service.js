/**
 * Service del modulo: auditoria (RNF-03 / RF-27).
 *
 * - La bitacora es append-only: solo se registra y se consulta.
 * - Los tokens de recuperacion se guardan hasheados y son de un solo uso.
 */
import crypto from 'node:crypto';
import { crearRegexBusqueda } from '../utils/regex.js';
import { paginacion } from '../utils/paginacion.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import Auditoria from '../models/seguridad/Auditoria.js';
import TokenRecuperacion from '../models/seguridad/TokenRecuperacion.js';
import Usuario from '../models/seguridad/Usuario.js';

const POPULATE_AUDITORIA = [{ path: 'usuario', select: 'nombres apellidos correo rol' }];

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** GET /auditoria — lista paginada de solo lectura. */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.usuario) filtro.usuario = query.usuario;
  const rx = query.accion !== undefined ? crearRegexBusqueda(query.accion) : null;
  if (rx) filtro.accion = rx;
  if (query.desde || query.hasta) {
    filtro.fecha_hora = {};
    if (query.desde) filtro.fecha_hora.$gte = new Date(query.desde);
    if (query.hasta) filtro.fecha_hora.$lte = new Date(query.hasta);
  }

  const [items, total] = await Promise.all([
    Auditoria.find(filtro).populate(POPULATE_AUDITORIA).sort({ fecha_hora: -1 }).skip(skip).limit(limit),
    Auditoria.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /auditoria/:id */
async function obtenerPorId(id) {
  const doc = await Auditoria.findById(id).populate(POPULATE_AUDITORIA);
  if (!doc) throw ApiError.notFound('Registro no encontrado');
  return doc;
}

/** POST /auditoria — registra una accion. */
async function registrar(body = {}, ipPorDefecto = null) {
  const { usuario, accion, ip } = body;
  if (!usuario || !accion) throw ApiError.badRequest('usuario y accion son obligatorios');

  const existe = await Usuario.exists({ _id: usuario });
  if (!existe) throw ApiError.badRequest('El usuario indicado no existe');

  const doc = await Auditoria.create({
    usuario,
    accion: String(accion).trim(),
    ip: ip || ipPorDefecto || null,
  });
  await doc.populate(POPULATE_AUDITORIA);
  return doc;
}

/**
 * POST /auditoria/recuperacion/solicitar — RF-27.
 * Devuelve null cuando el correo no existe (respuesta generica).
 */
async function solicitarRecuperacion(correo) {
  if (!correo) throw ApiError.badRequest('correo es obligatorio');

  const usuario = await Usuario.findOne({ correo: String(correo).toLowerCase().trim() });
  if (!usuario) return null;

  const plano = crypto.randomBytes(32).toString('hex');
  const minutos = env.negocio.tokenRecuperacionMinutos || 30;

  await TokenRecuperacion.create({
    usuario: usuario._id,
    token_hash: hashToken(plano),
    fecha_expiracion: new Date(Date.now() + minutos * 60 * 1000),
    usado: false,
  });

  return { token: plano, expira_minutos: minutos };
}

/** POST /auditoria/recuperacion/consumir — RF-27. */
async function consumirRecuperacion(body = {}) {
  const { token, nueva } = body;
  if (!token || !nueva) throw ApiError.badRequest('token y nueva son obligatorios');
  if (String(nueva).length < 8) {
    throw ApiError.badRequest('La nueva contrasena debe tener minimo 8 caracteres');
  }

  const registro = await TokenRecuperacion.findOne({
    token_hash: hashToken(token),
    usado: false,
  });
  if (!registro) throw ApiError.badRequest('Token invalido o ya usado');
  if (registro.fecha_expiracion < new Date()) throw ApiError.badRequest('Token vencido');

  const usuario = await Usuario.findById(registro.usuario).select('+contrasena_hash');
  if (!usuario) throw ApiError.notFound('Usuario no encontrado');

  await usuario.establecerContrasena(String(nueva));
  await usuario.save();
  registro.usado = true;
  await registro.save();
  return null;
}

export {
  listar,
  obtenerPorId,
  registrar,
  solicitarRecuperacion,
  consumirRecuperacion,
};
export default {
  listar,
  obtenerPorId,
  registrar,
  solicitarRecuperacion,
  consumirRecuperacion,
};
