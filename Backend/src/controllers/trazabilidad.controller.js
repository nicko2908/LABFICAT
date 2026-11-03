/**
 * Controlador del modulo: trazabilidad (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/seguimiento.service.js y services/validacion.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  registrarSeguimiento as registrarSeguimientoService,
  lineaTiempoMuestra as lineaTiempoService,
  historialValidaciones as historialValidacionesService,
} from '../services/seguimiento.service.js';
import { validarOrden } from '../services/validacion.service.js';
import { esPersonalLaboratorio, verificarPropietarioMuestra } from '../utils/propietario.js';

/** POST /trazabilidad/seguimiento */
async function registrarSeguimiento(req, res, next) {
  try {
    const { muestra, etapa, observaciones } = req.body || {};
    const doc = await registrarSeguimientoService({
      muestraId: muestra,
      etapaId: etapa,
      usuarioId: actorId(req),
      observaciones,
    });
    res.status(201).json(new ApiResponse(doc, 'Avance registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'seguimiento' }));
  }
}

/** GET /trazabilidad/muestra/:muestraId */
async function lineaTiempoMuestra(req, res, next) {
  try {
    const { muestra, items } = await lineaTiempoService(req.params.muestraId);
    if (!esPersonalLaboratorio(req.usuario)) {
      await verificarPropietarioMuestra(muestra, req.usuario);
    }
    res.json(new ApiResponse(items, 'Linea de tiempo obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'seguimiento' }));
  }
}

/** POST /trazabilidad/validaciones — RF-13. */
async function validarResultado(req, res, next) {
  try {
    const { orden, decision, motivo } = req.body || {};
    const validacion = await validarOrden({
      ordenId: orden,
      decision,
      motivo,
      usuarioId: actorId(req),
    });
    res.status(201).json(
      new ApiResponse(validacion, `Resultado ${String(decision).toLowerCase()}`)
    );
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'validacion', femenino: true }));
  }
}

/** GET /trazabilidad/validaciones/orden/:ordenId */
async function historialValidaciones(req, res, next) {
  try {
    const items = await historialValidacionesService(req.params.ordenId);
    res.json(new ApiResponse(items, 'Validaciones listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'validacion', femenino: true }));
  }
}

export {
  registrarSeguimiento,
  lineaTiempoMuestra,
  validarResultado,
  historialValidaciones,
};
export default {
  registrarSeguimiento,
  lineaTiempoMuestra,
  validarResultado,
  historialValidaciones,
};
