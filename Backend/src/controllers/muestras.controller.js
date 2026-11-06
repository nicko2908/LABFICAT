/**
 * Controlador del modulo: muestras (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/muestra.service.js y services/rotulo.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  crearMuestra,
  poblarMuestra,
  listar as listarMuestras,
  listarMias as listarMuestrasMias,
  obtenerPorId as obtenerMuestra,
  obtenerDocumento,
  actualizar as actualizarMuestra,
  cambiarPrioridad as cambiarPrioridadService,
} from '../services/muestra.service.js';
import {
  generarRotulo as generarRotuloService,
  obtenerPdfRotulo as obtenerPdfRotuloService,
} from '../services/rotulo.service.js';
import { generarActaRecepcionXlsx } from '../services/excel.service.js';
import {
  esPersonalLaboratorio,
  obtenerClienteDelUsuario,
  verificarPropietarioMuestra,
} from '../utils/propietario.js';

/** GET /muestras */
async function listar(req, res, next) {
  try {
    const datos = await listarMuestras(req.query);
    res.json(new ApiResponse(datos, 'Muestras listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'muestra', femenino: true }));
  }
}

/** GET /muestras/mias */
async function listarMias(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarMuestrasMias(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis muestras listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'muestra', femenino: true }));
  }
}

/** GET /muestras/:id */
async function obtenerPorId(req, res, next) {
  try {
    const datos = await obtenerMuestra(req.params.id);
    if (!esPersonalLaboratorio(req.usuario)) {
      await verificarPropietarioMuestra(datos.muestra, req.usuario);
    }
    res.json(new ApiResponse(datos, 'Muestra obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'muestra', femenino: true }));
  }
}

/** POST /muestras — RF-09. */
async function crear(req, res, next) {
  try {
    const {
      solicitud,
      tipo_muestra,
      unidad_medida,
      fecha_recepcion,
      estado_recepcion,
      cantidad_recibida,
      numero_envases,
      condiciones_conservacion,
      nombre,
      descripcion,
      observaciones,
      motivo_rechazo,
      cotizacion,
      cotizacion_item,
      matriz,
      municipio_recoleccion,
      direccion_toma,
      lugar_toma,
      recolectada_por,
      procedimiento_muestreo,
      fecha_hora_recoleccion,
      observaciones_predefinidas,
    } = req.body || {};

    const doc = await crearMuestra({
      solicitudId: solicitud,
      tipoMuestraId: tipo_muestra,
      usuarioId: actorId(req),
      unidadMedida: unidad_medida,
      fechaRecepcion: fecha_recepcion,
      estadoRecepcion: estado_recepcion,
      cantidadRecibida: cantidad_recibida,
      numeroEnvases: numero_envases,
      condicionesConservacion: condiciones_conservacion,
      nombre,
      descripcion,
      observaciones,
      motivoRechazo: motivo_rechazo,
      cotizacionId: cotizacion,
      cotizacionItem: cotizacion_item,
      matriz,
      municipioRecoleccion: municipio_recoleccion,
      direccionToma: direccion_toma,
      lugarToma: lugar_toma,
      recolectadaPor: recolectada_por,
      procedimientoMuestreo: procedimiento_muestreo,
      fechaHoraRecoleccion: fecha_hora_recoleccion,
      observacionesPredefinidas: observaciones_predefinidas,
    });

    await poblarMuestra(doc);
    res.status(201).json(new ApiResponse(doc, 'Muestra registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'muestra', femenino: true }));
  }
}

/** PUT /muestras/:id */
async function actualizar(req, res, next) {
  try {
    const doc = await actualizarMuestra(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Muestra actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'muestra', femenino: true }));
  }
}

/** PATCH /muestras/:id/prioridad — RF-22. */
async function cambiarPrioridad(req, res, next) {
  try {
    const { nivel, motivo } = req.body || {};
    const resultado = await cambiarPrioridadService(req.params.id, {
      nivel,
      motivo,
      usuarioId: actorId(req),
    });
    res.json(new ApiResponse(resultado, 'Prioridad actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'muestra', femenino: true }));
  }
}

/** POST /muestras/:id/rotulo — RF-11. */
async function generarRotulo(req, res, next) {
  try {
    const doc = await generarRotuloService(req.params.id, req.body || {});
    res.status(201).json(new ApiResponse(doc, 'Rotulo generado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'rotulo' }));
  }
}

/** GET /muestras/:id/rotulo */
async function descargarRotulo(req, res, next) {
  try {
    const { buffer, nombre } = await obtenerPdfRotuloService(
      req.params.id,
      req.usuario
    );

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'rotulo' }));
  }
}

/** GET /muestras/:id/acta-recepcion */
async function exportarActa(req, res, next) {
  try {
    const muestra = await obtenerDocumento(req.params.id);
    if (!esPersonalLaboratorio(req.usuario)) {
      await verificarPropietarioMuestra(muestra, req.usuario);
    }

    const { buffer, nombre } = await generarActaRecepcionXlsx(muestra._id);
    res.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.set('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'muestra', femenino: true }));
  }
}

export {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  cambiarPrioridad,
  generarRotulo,
  descargarRotulo,
  exportarActa,
};
export default {
  listar,
  listarMias,
  obtenerPorId,
  crear,
  actualizar,
  cambiarPrioridad,
  generarRotulo,
  descargarRotulo,
  exportarActa,
};
