/**
 * Controlador del modulo: trazabilidad (capa C de MVC).
 * Basado en: SeguimientoMuestra (-> Muestra, EtapaProceso, Usuario) + ValidacionResultado (-> OrdenAnalisis).
 * RF-12 / RF-13 / RF-26. Logs append-only (sin updatedAt).
 */
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { DECISION_VALIDACION } from '../config/constants.js';
import SeguimientoMuestra from '../models/laboratorio/SeguimientoMuestra.js';
import ValidacionResultado from '../models/laboratorio/ValidacionResultado.js';
import Muestra from '../models/laboratorio/Muestra.js';
import EtapaProceso from '../models/laboratorio/EtapaProceso.js';
import OrdenAnalisis from '../models/laboratorio/OrdenAnalisis.js';

function traducirErrorMongoose(err) {
  if (err && err.name === 'ValidationError') return ApiError.badRequest('Datos invalidos', err.errors);
  if (err && err.name === 'CastError') return ApiError.badRequest('Identificador invalido');
  return err;
}

function actorId(req) {
  return (req.usuario && (req.usuario.id || req.usuario.sub)) || req.usuarioId || null;
}

/**
 * POST /trazabilidad/seguimiento — RF-12 registra el avance de una muestra por etapa.
 * Body: { muestra, etapa, observaciones? }. usuario sale del token.
 */
async function registrarSeguimiento(req, res, next) {
  try {
    const { muestra, etapa, observaciones } = req.body || {};
    if (!muestra || !etapa) throw ApiError.badRequest('muestra y etapa son obligatorias');
    const [m, e] = await Promise.all([Muestra.exists({ _id: muestra }), EtapaProceso.exists({ _id: etapa })]);
    if (!m) throw ApiError.badRequest('La muestra indicada no existe');
    if (!e) throw ApiError.badRequest('La etapa indicada no existe');
    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();
    const doc = await SeguimientoMuestra.create({ muestra, etapa, usuario, observaciones: observaciones || null });
    await doc.populate([
      { path: 'muestra', select: 'codigo_muestra estado_recepcion' },
      { path: 'etapa', select: 'nombre orden' },
      { path: 'usuario', select: 'nombres apellidos' },
    ]);
    res.status(201).json(new ApiResponse(doc, 'Avance registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /trazabilidad/muestra/:muestraId — linea de tiempo de la muestra (RF-26). */
async function lineaTiempoMuestra(req, res, next) {
  try {
    const { muestraId } = req.params;
    const m = await Muestra.exists({ _id: muestraId });
    if (!m) throw ApiError.notFound('Muestra no encontrada');
    const items = await SeguimientoMuestra.find({ muestra: muestraId })
      .populate('etapa', 'nombre orden')
      .populate('usuario', 'nombres apellidos')
      .sort({ fecha_hora: 1 });
    res.json(new ApiResponse(items, 'Linea de tiempo obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /trazabilidad/validaciones — RF-13 decision del coordinador sobre una orden.
 * Body: { orden, decision: 'APROBADO' | 'RECHAZADO', motivo? }.
 * Si se rechaza, la orden pasa a INVALIDADA (RF-14: regresa a analisis repitiendo).
 */
async function validarResultado(req, res, next) {
  try {
    const { orden, decision, motivo } = req.body || {};
    if (!orden || !decision) throw ApiError.badRequest('orden y decision son obligatorias');
    if (!DECISION_VALIDACION.includes(decision)) throw ApiError.badRequest('decision debe ser APROBADO o RECHAZADO');
    const ord = await OrdenAnalisis.findById(orden);
    if (!ord) throw ApiError.badRequest('La orden indicada no existe');
    const usuario = actorId(req);
    if (!usuario) throw ApiError.unauthorized();
    const doc = await ValidacionResultado.create({ orden, usuario, decision, motivo: motivo || null });
    if (decision === 'RECHAZADO') {
      ord.estado = 'INVALIDADA';
      ord.fecha_fin = new Date();
      await ord.save();
    }
    res.status(201).json(new ApiResponse(doc, `Resultado ${decision.toLowerCase()}`));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/** GET /trazabilidad/validaciones/orden/:ordenId — historial de validaciones de una orden. */
async function historialValidaciones(req, res, next) {
  try {
    const items = await ValidacionResultado.find({ orden: req.params.ordenId })
      .populate('usuario', 'nombres apellidos')
      .sort({ fecha_hora: 1 });
    res.json(new ApiResponse(items, 'Validaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

export { registrarSeguimiento, lineaTiempoMuestra, validarResultado, historialValidaciones };
export default { registrarSeguimiento, lineaTiempoMuestra, validarResultado, historialValidaciones };
