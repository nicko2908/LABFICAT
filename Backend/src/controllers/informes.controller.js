/**
 * Controlador del modulo: informes (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/informe.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { actorId } from '../utils/actor.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  generarInforme,
  registrarEnvioInforme,
  registrarDescargaInforme,
  obtenerPdfInforme,
  poblarInforme,
  listar as listarInformes,
  listarMios as listarInformesMios,
  obtenerPorId as obtenerInforme,
} from '../services/informe.service.js';
import {
  esCoordinador,
  obtenerClienteDelUsuario,
  verificarPropietarioInforme,
} from '../utils/propietario.js';

/** GET /informes */
async function listar(req, res, next) {
  try {
    const datos = await listarInformes(req.query);
    res.json(new ApiResponse(datos, 'Informes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'informe' }));
  }
}

/** GET /informes/mios */
async function listarMios(req, res, next) {
  try {
    const cliente = await obtenerClienteDelUsuario(req.usuarioId);
    const datos = await listarInformesMios(cliente._id, req.query);
    res.json(new ApiResponse(datos, 'Mis informes listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'informe' }));
  }
}

/** GET /informes/:id */
async function obtenerPorId(req, res, next) {
  try {
    const doc = await obtenerInforme(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioInforme(doc, req.usuario);
    }
    res.json(new ApiResponse(doc, 'Informe obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'informe' }));
  }
}

/** POST /informes — RF-15. Genera el PDF y lo sube a R2. */
async function generar(req, res, next) {
  try {
    const { muestra } = req.body || {};
    const doc = await generarInforme({
      muestraId: muestra,
      usuarioId: actorId(req),
    });
    await poblarInforme(doc);
    res.status(201).json(new ApiResponse(doc, 'Informe generado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'informe' }));
  }
}

/** GET /informes/:id/pdf — RF-17. */
async function descargarPdf(req, res, next) {
  try {
    const informe = await obtenerInforme(req.params.id);
    if (!esCoordinador(req.usuario)) {
      await verificarPropietarioInforme(informe, req.usuario);
    }

    const { buffer, nombre } = await obtenerPdfInforme({
      informeId: req.params.id,
      usuario: req.usuario,
    });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'informe' }));
  }
}

/** PATCH /informes/:id/envio — RF-16. */
async function registrarEnvio(req, res, next) {
  try {
    const doc = await registrarEnvioInforme({
      informeId: req.params.id,
      usuarioId: actorId(req),
    });
    await poblarInforme(doc);
    res.json(new ApiResponse(doc, 'Envio registrado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'informe' }));
  }
}

/** PATCH /informes/:id/descarga — RF-17. */
async function registrarDescarga(req, res, next) {
  try {
    const informe = await obtenerInforme(req.params.id);
    await verificarPropietarioInforme(informe, req.usuario);

    const doc = await registrarDescargaInforme({ informeId: req.params.id });
    await poblarInforme(doc);
    res.json(new ApiResponse(doc, 'Descarga registrada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'informe' }));
  }
}

export {
  listar,
  listarMios,
  obtenerPorId,
  generar,
  descargarPdf,
  registrarEnvio,
  registrarDescarga,
};
export default {
  listar,
  listarMios,
  obtenerPorId,
  generar,
  descargarPdf,
  registrarEnvio,
  registrarDescarga,
};
