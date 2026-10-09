/**
 * Controlador del modulo: auditoria (capa C de MVC).
 * Basado en: Auditoria (-> Usuario, append-only) + TokenRecuperacion (-> Usuario). RNF-03 / RF-27.
 */
import crypto from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import env from '../config/env.js';
import Auditoria from '../models/seguridad/Auditoria.js';
import TokenRecuperacion from '../models/seguridad/TokenRecuperacion.js';
import Usuario from '../models/seguridad/Usuario.js';

const POPULATE_AUDITORIA = [{ path: 'usuario', select: 'nombres apellidos correo rol' }];

function traducirErrorMongoose(err) {
  if (err && err.name === 'ValidationError') return ApiError.badRequest('Datos invalidos', err.errors);
  if (err && err.name === 'CastError') return ApiError.badRequest('Identificador invalido');
  return err;
}

function paginacion(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** GET /auditoria — lista paginada de solo lectura. Filtros: usuario, accion, desde, hasta. */
async function listar(req, res, next) {
  try {
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.usuario) filtro.usuario = req.query.usuario;
    if (req.query.accion) filtro.accion = new RegExp(String(req.query.accion).trim(), 'i');
    if (req.query.desde || req.query.hasta) {
      filtro.fecha_hora = {};
      if (req.query.desde) filtro.fecha_hora.$gte = new Date(req.query.desde);
      if (req.query.hasta) filtro.fecha_hora.$lte = new Date(req.query.hasta);
    }
    const [items, total] = await Promise.all([
      Auditoria.find(filtro).populate(POPULATE_AUDITORIA).sort({ fecha_hora: -1 }).skip(skip).limit(limit),
      Auditoria.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Auditoria listada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /auditoria/:id — detalle (la bitacora no se edita ni se borra). */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await Auditoria.findById(req.params.id).populate(POPULATE_AUDITORIA);
    if (!doc) throw ApiError.notFound('Registro no encontrado');
    res.json(new ApiResponse(doc, 'Registro obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /auditoria — registra una accion (la usa el middleware de auditoria).
 * Body: { usuario, accion, ip? }. Sin update ni delete por RNF-03.
 */
async function registrar(req, res, next) {
  try {
    const { usuario, accion, ip } = req.body || {};
    if (!usuario || !accion) throw ApiError.badRequest('usuario y accion son obligatorios');
    const existe = await Usuario.exists({ _id: usuario });
    if (!existe) throw ApiError.badRequest('El usuario indicado no existe');
    const doc = await Auditoria.create({ usuario, accion: String(accion).trim(), ip: ip || req.ip || null });
    await doc.populate(POPULATE_AUDITORIA);
    res.status(201).json(new ApiResponse(doc, 'Accion registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /auditoria/recuperacion/solicitar — RF-27 genera token de un solo uso (30 min).
 * Body: { correo }. Guarda solo el hash; devuelve el token plano una sola vez.
 */
async function solicitarRecuperacion(req, res, next) {
  try {
    const { correo } = req.body || {};
    if (!correo) throw ApiError.badRequest('correo es obligatorio');
    const usuario = await Usuario.findOne({ correo: String(correo).toLowerCase().trim() });
    // Respuesta generica para no revelar si el correo existe.
    if (!usuario) return res.json(new ApiResponse(null, 'Si el correo existe, se envio el token'));
    const plano = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plano).digest('hex');
    const minutos = env.negocio.tokenRecuperacionMinutos || 30;
    await TokenRecuperacion.create({
      usuario: usuario._id,
      token_hash: tokenHash,
      fecha_expiracion: new Date(Date.now() + minutos * 60 * 1000),
      usado: false,
    });
    res.json(new ApiResponse({ token: plano, expira_minutos: minutos }, 'Token generado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /auditoria/recuperacion/consumir — RF-27 restablece la contrasena con el token.
 * Body: { token, nueva }. Marca el token como usado.
 */
async function consumirRecuperacion(req, res, next) {
  try {
    const { token, nueva } = req.body || {};
    if (!token || !nueva) throw ApiError.badRequest('token y nueva son obligatorios');
    if (String(nueva).length < 8) throw ApiError.badRequest('La nueva contrasena debe tener minimo 8 caracteres');
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const registro = await TokenRecuperacion.findOne({ token_hash: tokenHash, usado: false });
    if (!registro) throw ApiError.badRequest('Token invalido o ya usado');
    if (registro.fecha_expiracion < new Date()) throw ApiError.badRequest('Token vencido');
    const usuario = await Usuario.findById(registro.usuario).select('+contrasena_hash');
    if (!usuario) throw ApiError.notFound('Usuario no encontrado');
    await usuario.establecerContrasena(String(nueva));
    await usuario.save();
    registro.usado = true;
    await registro.save();
    res.json(new ApiResponse(null, 'Contrasena restablecida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { listar, obtenerPorId, registrar, solicitarRecuperacion, consumirRecuperacion };
export default { listar, obtenerPorId, registrar, solicitarRecuperacion, consumirRecuperacion };
