/**
 * Controlador del modulo: catalogos (capa C de MVC).
 *
 * Solo traduce HTTP -> service -> respuesta. La logica vive en
 * services/catalogos.service.js.
 */
import ApiResponse from '../utils/ApiResponse.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import {
  listarTipologias as listarTipologiasService,
  crearTipologia as crearTipologiaService,
  actualizarTipologia as actualizarTipologiaService,
  cambiarEstadoTipologia as cambiarEstadoTipologiaService,
  listarTiposMuestra as listarTiposMuestraService,
  crearTipoMuestra as crearTipoMuestraService,
  actualizarTipoMuestra as actualizarTipoMuestraService,
  cambiarEstadoTipoMuestra as cambiarEstadoTipoMuestraService,
  listarParametros as listarParametrosService,
  crearParametro as crearParametroService,
  actualizarParametro as actualizarParametroService,
  cambiarEstadoParametro as cambiarEstadoParametroService,
  listarEtapas as listarEtapasService,
  crearEtapa as crearEtapaService,
  actualizarEtapa as actualizarEtapaService,
  cambiarEstadoEtapa as cambiarEstadoEtapaService,
  listarAnalisis as listarAnalisisService,
  obtenerAnalisisPorId as obtenerAnalisisService,
  crearAnalisis as crearAnalisisService,
  actualizarAnalisis as actualizarAnalisisService,
  cambiarEstadoAnalisis as cambiarEstadoAnalisisService,
  listarConfiguracion as listarConfiguracionService,
  obtenerConfiguracionPorClave as obtenerConfiguracionService,
  actualizarConfiguracion as actualizarConfiguracionService,
} from '../services/catalogos.service.js';

// ---------------------------------------------------------------------------
// Tipologias poblacionales
// ---------------------------------------------------------------------------

async function listarTipologias(req, res, next) {
  try {
    const datos = await listarTipologiasService(req.query);
    if (!datos.paginado) {
      return res.json(new ApiResponse(datos.items, 'Tipologias activas'));
    }
    const { items, total, page, pages } = datos;
    res.json(new ApiResponse({ items, total, page, pages }, 'Tipologias listadas'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipologia', femenino: true }));
  }
}

async function crearTipologia(req, res, next) {
  try {
    const doc = await crearTipologiaService(req.body || {});
    res.status(201).json(new ApiResponse(doc, 'Tipologia creada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipologia', femenino: true }));
  }
}

async function actualizarTipologia(req, res, next) {
  try {
    const doc = await actualizarTipologiaService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Tipologia actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipologia', femenino: true }));
  }
}

async function cambiarEstadoTipologia(req, res, next) {
  try {
    const { doc, activo } = await cambiarEstadoTipologiaService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, activo ? 'Tipologia activada' : 'Tipologia desactivada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipologia', femenino: true }));
  }
}

// ---------------------------------------------------------------------------
// Tipos de muestra
// ---------------------------------------------------------------------------

async function listarTiposMuestra(req, res, next) {
  try {
    const items = await listarTiposMuestraService(req.query);
    res.json(new ApiResponse(items, 'Tipos de muestra listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipo de muestra' }));
  }
}

async function crearTipoMuestra(req, res, next) {
  try {
    const doc = await crearTipoMuestraService(req.body || {});
    res.status(201).json(new ApiResponse(doc, 'Tipo de muestra creado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipo de muestra' }));
  }
}

async function actualizarTipoMuestra(req, res, next) {
  try {
    const doc = await actualizarTipoMuestraService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Tipo de muestra actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipo de muestra' }));
  }
}

async function cambiarEstadoTipoMuestra(req, res, next) {
  try {
    const { doc, activo } = await cambiarEstadoTipoMuestraService(req.params.id, req.body || {});
    res.json(
      new ApiResponse(doc, activo ? 'Tipo de muestra activado' : 'Tipo de muestra desactivado')
    );
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'tipo de muestra' }));
  }
}

// ---------------------------------------------------------------------------
// Parametros
// ---------------------------------------------------------------------------

async function listarParametros(req, res, next) {
  try {
    const items = await listarParametrosService(req.query);
    res.json(new ApiResponse(items, 'Parametros listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'parametro' }));
  }
}

async function crearParametro(req, res, next) {
  try {
    const doc = await crearParametroService(req.body || {});
    res.status(201).json(new ApiResponse(doc, 'Parametro creado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'parametro' }));
  }
}

async function actualizarParametro(req, res, next) {
  try {
    const doc = await actualizarParametroService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Parametro actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'parametro' }));
  }
}

async function cambiarEstadoParametro(req, res, next) {
  try {
    const { doc, activo } = await cambiarEstadoParametroService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, activo ? 'Parametro activado' : 'Parametro desactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'parametro' }));
  }
}

// ---------------------------------------------------------------------------
// Etapas de proceso
// ---------------------------------------------------------------------------

async function listarEtapas(req, res, next) {
  try {
    const datos = await listarEtapasService(req.query);
    res.json(
      new ApiResponse(
        datos.items,
        datos.oficial ? 'Etapas listadas en orden oficial' : 'Etapas listadas'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'etapa', femenino: true }));
  }
}

async function crearEtapa(req, res, next) {
  try {
    const doc = await crearEtapaService(req.body || {});
    res.status(201).json(new ApiResponse(doc, 'Etapa creada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'etapa', femenino: true }));
  }
}

async function actualizarEtapa(req, res, next) {
  try {
    const doc = await actualizarEtapaService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Etapa actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'etapa', femenino: true }));
  }
}

async function cambiarEstadoEtapa(req, res, next) {
  try {
    const { doc, activo } = await cambiarEstadoEtapaService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, activo ? 'Etapa activada' : 'Etapa desactivada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'etapa', femenino: true }));
  }
}

// ---------------------------------------------------------------------------
// Analisis
// ---------------------------------------------------------------------------

async function listarAnalisis(req, res, next) {
  try {
    const items = await listarAnalisisService(req.query);
    res.json(new ApiResponse(items, 'Analisis listados'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'analisis' }));
  }
}

async function obtenerAnalisisPorId(req, res, next) {
  try {
    const doc = await obtenerAnalisisService(req.params.id);
    res.json(new ApiResponse(doc, 'Analisis obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'analisis' }));
  }
}

async function crearAnalisis(req, res, next) {
  try {
    const doc = await crearAnalisisService(req.body || {});
    res.status(201).json(new ApiResponse(doc, 'Analisis creado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'analisis' }));
  }
}

async function actualizarAnalisis(req, res, next) {
  try {
    const doc = await actualizarAnalisisService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, 'Analisis actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'analisis' }));
  }
}

async function cambiarEstadoAnalisis(req, res, next) {
  try {
    const { doc, activo } = await cambiarEstadoAnalisisService(req.params.id, req.body || {});
    res.json(new ApiResponse(doc, activo ? 'Analisis activado' : 'Analisis desactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'analisis' }));
  }
}

// ---------------------------------------------------------------------------
// Configuracion del sistema
// ---------------------------------------------------------------------------

async function listarConfiguracion(req, res, next) {
  try {
    const items = await listarConfiguracionService();
    res.json(new ApiResponse(items, 'Configuracion listada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'configuracion', femenino: true }));
  }
}

async function obtenerConfiguracionPorClave(req, res, next) {
  try {
    const doc = await obtenerConfiguracionService(req.params.clave);
    res.json(new ApiResponse(doc, 'Configuracion obtenida'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'configuracion', femenino: true }));
  }
}

async function actualizarConfiguracion(req, res, next) {
  try {
    const doc = await actualizarConfiguracionService(req.params.clave, req.body || {});
    res.json(new ApiResponse(doc, 'Configuracion actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err, { entidad: 'configuracion', femenino: true }));
  }
}

export {
  listarTipologias,
  crearTipologia,
  actualizarTipologia,
  cambiarEstadoTipologia,
  listarTiposMuestra,
  crearTipoMuestra,
  actualizarTipoMuestra,
  cambiarEstadoTipoMuestra,
  listarParametros,
  crearParametro,
  actualizarParametro,
  cambiarEstadoParametro,
  listarEtapas,
  crearEtapa,
  actualizarEtapa,
  cambiarEstadoEtapa,
  listarAnalisis,
  obtenerAnalisisPorId,
  crearAnalisis,
  actualizarAnalisis,
  cambiarEstadoAnalisis,
  listarConfiguracion,
  obtenerConfiguracionPorClave,
  actualizarConfiguracion,
};
export default {
  listarTipologias,
  crearTipologia,
  actualizarTipologia,
  cambiarEstadoTipologia,
  listarTiposMuestra,
  crearTipoMuestra,
  actualizarTipoMuestra,
  cambiarEstadoTipoMuestra,
  listarParametros,
  crearParametro,
  actualizarParametro,
  cambiarEstadoParametro,
  listarEtapas,
  crearEtapa,
  actualizarEtapa,
  cambiarEstadoEtapa,
  listarAnalisis,
  obtenerAnalisisPorId,
  crearAnalisis,
  actualizarAnalisis,
  cambiarEstadoAnalisis,
  listarConfiguracion,
  obtenerConfiguracionPorClave,
  actualizarConfiguracion,
};
