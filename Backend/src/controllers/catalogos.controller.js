/**
 * Controlador del modulo: catalogos (capa C de MVC).
 * Basado en los modelos ya desarrollados por el companero:
 *  - TipologiaPoblacional (clientes) — RF-01 / RF-21
 *  - TipoMuestra, Parametro, EtapaProceso, Analisis (laboratorio) — RF-25
 *  - ConfiguracionSistema (sistema) — RF-24
 *
 * Reglas comunes de los catalogos:
 *  - Nunca se eliminan: se activan/desactivan con "activo".
 *  - "nombre" unico (tipologia: case-insensitive por collation es).
 */
import { TIPOLOGIA_CODIGO, TIPOLOGIA_NINGUNA_NOMBRE } from '../config/constants.js';
import { parseBoolean } from '../utils/booleanos.js';
import { crearRegexBusqueda } from '../utils/regex.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import TipoMuestra from '../models/laboratorio/TipoMuestra.js';
import Parametro from '../models/laboratorio/Parametro.js';
import EtapaProceso from '../models/laboratorio/EtapaProceso.js';
import Analisis from '../models/laboratorio/Analisis.js';
import ConfiguracionSistema from '../models/sistema/ConfiguracionSistema.js';

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un registro con ese ${campo}`, err.keyValue);
  }
  if (err && err.name === 'ValidationError') {
    return ApiError.badRequest('Datos invalidos', err.errors);
  }
  if (err && err.name === 'CastError') {
    return ApiError.badRequest('Identificador invalido');
  }
  return err;
}

function paginacion(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// ---------------------------------------------------------------------------
// Tipologias poblacionales — RF-01 / RF-21
// ---------------------------------------------------------------------------

async function listarTipologias(req, res, next) {
  try {
    // ?soloActivas=true -> usa el estatico listarActivas() (desplegable RF-01).
    if (req.query.soloActivas === 'true' || req.query.soloActivas === '1') {
      const items = await TipologiaPoblacional.listarActivas();
      return res.json(new ApiResponse(items, 'Tipologias activas'));
    }
    const { page, limit, skip } = paginacion(req);
    const filtro = {};
    if (req.query.activo !== undefined) {
      const activo = parseBoolean(req.query.activo);
      if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
      filtro.activo = activo;
    }
    const rx = req.query.search !== undefined ? crearRegexBusqueda(req.query.search) : null;
    if (rx) filtro.nombre = rx;
    const [items, total] = await Promise.all([
      TipologiaPoblacional.find(filtro).sort({ nombre: 1 }).skip(skip).limit(limit),
      TipologiaPoblacional.countDocuments(filtro),
    ]);
    res.json(new ApiResponse({ items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Tipologias listadas'));
  } catch (err) {
    next(err);
  }
}

async function crearTipologia(req, res, next) {
  try {
    const { nombre, descripcion } = req.body || {};
    if (!nombre) throw ApiError.badRequest('nombre es obligatorio');
    const doc = await TipologiaPoblacional.create({ nombre: String(nombre).trim(), descripcion });
    res.status(201).json(new ApiResponse(doc, 'Tipologia creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function actualizarTipologia(req, res, next) {
  try {
    // El codigo es un identificador estable: no se edita por API.
    if (req.body && req.body.codigo !== undefined) {
      throw ApiError.badRequest('El codigo de la tipologia no se puede modificar');
    }

    const cambios = {};
    for (const campo of ['nombre', 'descripcion']) {
      if (req.body && req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }
    if (Object.keys(cambios).length === 0) {
      throw ApiError.badRequest('No hay campos validos para actualizar');
    }

    const doc = await TipologiaPoblacional.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw ApiError.notFound('Tipologia no encontrada');
    res.json(new ApiResponse(doc, 'Tipologia actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function cambiarEstadoTipologia(req, res, next) {
  try {
    const { activo } = req.body || {};
    if (activo === undefined) throw ApiError.badRequest('activo es obligatorio (true/false)');
    const nuevoEstado = parseBoolean(activo);
    if (nuevoEstado === null) throw ApiError.badRequest('activo debe ser true o false');

    const doc = await TipologiaPoblacional.findById(req.params.id);
    if (!doc) throw ApiError.notFound('Tipologia no encontrada');

    // NINGUNA es el valor de fallback del sistema: no puede desactivarse.
    // Se compara por codigo y, como respaldo, por el nombre original.
    const esNinguna =
      doc.codigo === TIPOLOGIA_CODIGO.NINGUNA ||
      doc.nombre === TIPOLOGIA_NINGUNA_NOMBRE;
    if (esNinguna && nuevoEstado === false) {
      throw ApiError.conflict('La tipologia NINGUNA no se puede desactivar');
    }

    doc.activo = nuevoEstado;
    await doc.save();
    res.json(
      new ApiResponse(
        doc,
        nuevoEstado ? 'Tipologia activada' : 'Tipologia desactivada'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

// ---------------------------------------------------------------------------
// Tipos de muestra — catalogo laboratorio
// ---------------------------------------------------------------------------

async function listarTiposMuestra(req, res, next) {
  try {
    const filtro = {};
    if (req.query.activo !== undefined) {
      const activo = parseBoolean(req.query.activo);
      if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
      filtro.activo = activo;
    }
    if (req.query.estado_fisico) filtro.estado_fisico = req.query.estado_fisico;
    const items = await TipoMuestra.find(filtro).sort({ nombre: 1 });
    res.json(new ApiResponse(items, 'Tipos de muestra listados'));
  } catch (err) {
    next(err);
  }
}

async function crearTipoMuestra(req, res, next) {
  try {
    const { nombre, estado_fisico } = req.body || {};
    if (!nombre || !estado_fisico) throw ApiError.badRequest('nombre y estado_fisico son obligatorios');
    const doc = await TipoMuestra.create({ nombre: String(nombre).trim(), estado_fisico });
    res.status(201).json(new ApiResponse(doc, 'Tipo de muestra creado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function actualizarTipoMuestra(req, res, next) {
  try {
    const cambios = {};
    for (const campo of ['nombre', 'estado_fisico']) {
      if (req.body && req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }
    if (Object.keys(cambios).length === 0) {
      throw ApiError.badRequest('No hay campos validos para actualizar');
    }

    const doc = await TipoMuestra.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw ApiError.notFound('Tipo de muestra no encontrado');
    res.json(new ApiResponse(doc, 'Tipo de muestra actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function cambiarEstadoTipoMuestra(req, res, next) {
  try {
    const { activo } = req.body || {};
    if (activo === undefined) throw ApiError.badRequest('activo es obligatorio (true/false)');
    const nuevoEstado = parseBoolean(activo);
    if (nuevoEstado === null) throw ApiError.badRequest('activo debe ser true o false');
    const doc = await TipoMuestra.findByIdAndUpdate(
      req.params.id,
      { activo: nuevoEstado },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Tipo de muestra no encontrado');
    res.json(
      new ApiResponse(
        doc,
        nuevoEstado ? 'Tipo de muestra activado' : 'Tipo de muestra desactivado'
      )
    );
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

// ---------------------------------------------------------------------------
// Parametros — catalogo laboratorio
// ---------------------------------------------------------------------------

async function listarParametros(req, res, next) {
  try {
    const filtro = {};
    if (req.query.activo !== undefined) {
      const activo = parseBoolean(req.query.activo);
      if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
      filtro.activo = activo;
    }
    const rx = req.query.search !== undefined ? crearRegexBusqueda(req.query.search) : null;
    if (rx) filtro.nombre = rx;
    const items = await Parametro.find(filtro).sort({ nombre: 1 });
    res.json(new ApiResponse(items, 'Parametros listados'));
  } catch (err) {
    next(err);
  }
}

async function crearParametro(req, res, next) {
  try {
    const { nombre, unidad_medida } = req.body || {};
    if (!nombre) throw ApiError.badRequest('nombre es obligatorio');
    const doc = await Parametro.create({ nombre: String(nombre).trim(), unidad_medida });
    res.status(201).json(new ApiResponse(doc, 'Parametro creado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function actualizarParametro(req, res, next) {
  try {
    const cambios = {};
    for (const campo of ['nombre', 'unidad_medida']) {
      if (req.body && req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }
    if (Object.keys(cambios).length === 0) {
      throw ApiError.badRequest('No hay campos validos para actualizar');
    }

    const doc = await Parametro.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw ApiError.notFound('Parametro no encontrado');
    res.json(new ApiResponse(doc, 'Parametro actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function cambiarEstadoParametro(req, res, next) {
  try {
    const { activo } = req.body || {};
    if (activo === undefined) throw ApiError.badRequest('activo es obligatorio (true/false)');
    const nuevoEstado = parseBoolean(activo);
    if (nuevoEstado === null) throw ApiError.badRequest('activo debe ser true o false');
    const doc = await Parametro.findByIdAndUpdate(
      req.params.id,
      { activo: nuevoEstado },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Parametro no encontrado');
    res.json(new ApiResponse(doc, nuevoEstado ? 'Parametro activado' : 'Parametro desactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

// ---------------------------------------------------------------------------
// Etapas de proceso — trazabilidad (orden oficial)
// ---------------------------------------------------------------------------

async function listarEtapas(req, res, next) {
  try {
    // Por defecto, orden oficial de activas (estatico listarOrdenadas()).
    if (req.query.todas !== 'true' && req.query.todas !== '1') {
      const items = await EtapaProceso.listarOrdenadas();
      return res.json(new ApiResponse(items, 'Etapas listadas en orden oficial'));
    }
    const items = await EtapaProceso.find({}).sort({ orden: 1 });
    res.json(new ApiResponse(items, 'Etapas listadas'));
  } catch (err) {
    next(err);
  }
}

async function crearEtapa(req, res, next) {
  try {
    const { nombre, orden } = req.body || {};
    if (!nombre || orden === undefined) throw ApiError.badRequest('nombre y orden son obligatorios');
    const doc = await EtapaProceso.create({ nombre: String(nombre).trim(), orden });
    res.status(201).json(new ApiResponse(doc, 'Etapa creada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function actualizarEtapa(req, res, next) {
  try {
    const cambios = {};
    for (const campo of ['nombre', 'orden']) {
      if (req.body && req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }
    if (Object.keys(cambios).length === 0) {
      throw ApiError.badRequest('No hay campos validos para actualizar');
    }

    const doc = await EtapaProceso.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw ApiError.notFound('Etapa no encontrada');
    res.json(new ApiResponse(doc, 'Etapa actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function cambiarEstadoEtapa(req, res, next) {
  try {
    const { activo } = req.body || {};
    if (activo === undefined) throw ApiError.badRequest('activo es obligatorio (true/false)');
    const nuevoEstado = parseBoolean(activo);
    if (nuevoEstado === null) throw ApiError.badRequest('activo debe ser true o false');
    const doc = await EtapaProceso.findByIdAndUpdate(
      req.params.id,
      { activo: nuevoEstado },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Etapa no encontrada');
    res.json(new ApiResponse(doc, nuevoEstado ? 'Etapa activada' : 'Etapa desactivada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

// ---------------------------------------------------------------------------
// Analisis — RF-25 (tarifa interna = 0 por regla, no se almacena)
// ---------------------------------------------------------------------------

const POPULATE_ANALISIS = [
  { path: 'parametros', select: 'nombre unidad_medida activo' },
  { path: 'tipos_muestra', select: 'nombre estado_fisico activo' },
];

async function validarReferenciasAnalisis(parametros, tipos_muestra) {
  if (parametros !== undefined) {
    if (!Array.isArray(parametros)) {
      throw ApiError.badRequest('parametros debe ser un arreglo');
    }
    const n = await Parametro.countDocuments({ _id: { $in: parametros } });
    if (n !== parametros.length) throw ApiError.badRequest('Uno o mas parametros no existen');
  }
  if (tipos_muestra !== undefined) {
    if (!Array.isArray(tipos_muestra)) {
      throw ApiError.badRequest('tipos_muestra debe ser un arreglo');
    }
    const n = await TipoMuestra.countDocuments({ _id: { $in: tipos_muestra } });
    if (n !== tipos_muestra.length) throw ApiError.badRequest('Uno o mas tipos de muestra no existen');
  }
}

async function listarAnalisis(req, res, next) {
  try {
    const filtro = {};
    if (req.query.activo !== undefined) {
      const activo = parseBoolean(req.query.activo);
      if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
      filtro.activo = activo;
    }
    const rx = req.query.search !== undefined ? crearRegexBusqueda(req.query.search) : null;
    if (rx) filtro.nombre = rx;
    const items = await Analisis.find(filtro).populate(POPULATE_ANALISIS).sort({ nombre: 1 });
    res.json(new ApiResponse(items, 'Analisis listados'));
  } catch (err) {
    next(err);
  }
}

async function obtenerAnalisisPorId(req, res, next) {
  try {
    const doc = await Analisis.findById(req.params.id).populate(POPULATE_ANALISIS);
    if (!doc) throw ApiError.notFound('Analisis no encontrado');
    res.json(new ApiResponse(doc, 'Analisis obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

const CAMPOS_ANALISIS = [
  'nombre',
  'descripcion',
  'tarifa_externo',
  'cantidad_minima',
  'unidad_cantidad',
  'parametros',
  'tipos_muestra',
];

function tomarCamposAnalisis(body) {
  const datos = {};
  for (const campo of CAMPOS_ANALISIS) {
    if (body && body[campo] !== undefined) datos[campo] = body[campo];
  }
  return datos;
}

async function crearAnalisis(req, res, next) {
  try {
    const { nombre, tarifa_externo } = req.body || {};
    if (!nombre || tarifa_externo === undefined) {
      throw ApiError.badRequest('nombre y tarifa_externo son obligatorios');
    }

    const datos = tomarCamposAnalisis(req.body);
    await validarReferenciasAnalisis(datos.parametros, datos.tipos_muestra);
    const doc = await Analisis.create(datos);
    await doc.populate(POPULATE_ANALISIS);
    res.status(201).json(new ApiResponse(doc, 'Analisis creado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function actualizarAnalisis(req, res, next) {
  try {
    const datos = tomarCamposAnalisis(req.body);
    if (Object.keys(datos).length === 0) {
      throw ApiError.badRequest('No hay campos validos para actualizar');
    }

    await validarReferenciasAnalisis(datos.parametros, datos.tipos_muestra);
    const doc = await Analisis.findByIdAndUpdate(req.params.id, datos, {
      new: true,
      runValidators: true,
    }).populate(POPULATE_ANALISIS);
    if (!doc) throw ApiError.notFound('Analisis no encontrado');
    res.json(new ApiResponse(doc, 'Analisis actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

async function cambiarEstadoAnalisis(req, res, next) {
  try {
    const { activo } = req.body || {};
    if (activo === undefined) throw ApiError.badRequest('activo es obligatorio (true/false)');
    const nuevoEstado = parseBoolean(activo);
    if (nuevoEstado === null) throw ApiError.badRequest('activo debe ser true o false');
    const doc = await Analisis.findByIdAndUpdate(
      req.params.id,
      { activo: nuevoEstado },
      { new: true }
    ).populate(POPULATE_ANALISIS);
    if (!doc) throw ApiError.notFound('Analisis no encontrado');
    // RF-25: nunca se elimina, solo se desactiva.
    res.json(new ApiResponse(doc, nuevoEstado ? 'Analisis activado' : 'Analisis desactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

// ---------------------------------------------------------------------------
// Configuracion del sistema — RF-24 (clave/valor, solo coordinador)
// ---------------------------------------------------------------------------

async function listarConfiguracion(req, res, next) {
  try {
    const items = await ConfiguracionSistema.find({}).sort({ clave: 1 });
    res.json(new ApiResponse(items, 'Configuracion listada'));
  } catch (err) {
    next(err);
  }
}

async function obtenerConfiguracionPorClave(req, res, next) {
  try {
    const doc = await ConfiguracionSistema.findOne({ clave: req.params.clave });
    if (!doc) throw ApiError.notFound('Clave de configuracion no encontrada');
    res.json(new ApiResponse(doc, 'Configuracion obtenida'));
  } catch (err) {
    next(err);
  }
}

async function actualizarConfiguracion(req, res, next) {
  try {
    const { valor, descripcion } = req.body || {};
    if (valor === undefined) throw ApiError.badRequest('valor es obligatorio');
    const doc = await ConfiguracionSistema.findOneAndUpdate(
      { clave: req.params.clave },
      { $set: { valor: String(valor).trim(), ...(descripcion !== undefined ? { descripcion } : {}) } },
      { new: true, runValidators: true, upsert: true }
    );
    res.json(new ApiResponse(doc, 'Configuracion actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
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
