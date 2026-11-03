/**
 * Service del modulo: catalogos.
 *
 * Agrupa los catalogos del sistema:
 *  - TipologiaPoblacional (clientes) — RF-01 / RF-21
 *  - TipoMuestra, Parametro, EtapaProceso, Analisis (laboratorio) — RF-25
 *  - ConfiguracionSistema (sistema) — RF-24
 *
 * Reglas comunes: nunca se elimina, solo se activa/desactiva; "nombre" es unico.
 */
import { TIPOLOGIA_CODIGO, TIPOLOGIA_NINGUNA_NOMBRE } from '../config/constants.js';
import { parseBoolean } from '../utils/booleanos.js';
import { crearRegexBusqueda } from '../utils/regex.js';
import { paginacion } from '../utils/paginacion.js';
import ApiError from '../utils/ApiError.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import TipoMuestra from '../models/laboratorio/TipoMuestra.js';
import Parametro from '../models/laboratorio/Parametro.js';
import EtapaProceso from '../models/laboratorio/EtapaProceso.js';
import Analisis from '../models/laboratorio/Analisis.js';
import ConfiguracionSistema from '../models/sistema/ConfiguracionSistema.js';

const POPULATE_ANALISIS = [
  { path: 'parametros', select: 'nombre unidad_medida activo' },
  { path: 'tipos_muestra', select: 'nombre estado_fisico activo' },
];

const CAMPOS_ANALISIS = [
  'codigo',
  'nombre',
  'descripcion',
  'unidades',
  'metodo',
  'tecnica',
  'acreditado',
  'tarifa_externo',
  'cantidad_minima',
  'unidad_cantidad',
  'parametros',
  'tipos_muestra',
];

function tomarCamposAnalisis(body = {}) {
  const datos = {};
  for (const campo of CAMPOS_ANALISIS) {
    if (body[campo] !== undefined) datos[campo] = body[campo];
  }

  if (datos.acreditado !== undefined) {
    const acreditado = parseBoolean(datos.acreditado);
    if (acreditado === null) {
      throw ApiError.badRequest('acreditado debe ser true o false');
    }
    datos.acreditado = acreditado;
  }

  return datos;
}

function tomarActivo(body = {}) {
  if (body.activo === undefined) {
    throw ApiError.badRequest('activo es obligatorio (true/false)');
  }
  const activo = parseBoolean(body.activo);
  if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
  return activo;
}

async function validarReferenciasAnalisis(parametros, tiposMuestra) {
  if (parametros !== undefined) {
    if (!Array.isArray(parametros)) {
      throw ApiError.badRequest('parametros debe ser un arreglo');
    }
    const n = await Parametro.countDocuments({ _id: { $in: parametros } });
    if (n !== parametros.length) throw ApiError.badRequest('Uno o mas parametros no existen');
  }
  if (tiposMuestra !== undefined) {
    if (!Array.isArray(tiposMuestra)) {
      throw ApiError.badRequest('tipos_muestra debe ser un arreglo');
    }
    const n = await TipoMuestra.countDocuments({ _id: { $in: tiposMuestra } });
    if (n !== tiposMuestra.length) throw ApiError.badRequest('Uno o mas tipos de muestra no existen');
  }
}

// ---------------------------------------------------------------------------
// Tipologias poblacionales — RF-01 / RF-21
// ---------------------------------------------------------------------------

async function listarTipologias(query = {}) {
  // ?soloActivas=true -> desplegable RF-01.
  if (query.soloActivas === 'true' || query.soloActivas === '1') {
    return { items: await TipologiaPoblacional.listarActivas(), paginado: false };
  }

  const { page, limit, skip } = paginacion(query);
  const filtro = {};
  if (query.activo !== undefined) {
    const activo = parseBoolean(query.activo);
    if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
    filtro.activo = activo;
  }
  const rx = query.search !== undefined ? crearRegexBusqueda(query.search) : null;
  if (rx) filtro.nombre = rx;

  const [items, total] = await Promise.all([
    TipologiaPoblacional.find(filtro).sort({ nombre: 1 }).skip(skip).limit(limit),
    TipologiaPoblacional.countDocuments(filtro),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) || 1, paginado: true };
}

async function crearTipologia(body = {}) {
  const { nombre, descripcion } = body;
  if (!nombre) throw ApiError.badRequest('nombre es obligatorio');
  // Las tipologias creadas por API son externas. Las 4 internas solo se
  // cargan por seed/migracion para no conceder tarifa 0 por error.
  return TipologiaPoblacional.create({
    nombre: String(nombre).trim(),
    descripcion,
    es_interno: false,
  });
}

async function actualizarTipologia(id, body = {}) {
  // El codigo es un identificador estable: no se edita por API.
  if (body.codigo !== undefined) {
    throw ApiError.badRequest('El codigo de la tipologia no se puede modificar');
  }

  const cambios = {};
  for (const campo of ['nombre', 'descripcion']) {
    if (body[campo] !== undefined) cambios[campo] = body[campo];
  }
  if (Object.keys(cambios).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  const doc = await TipologiaPoblacional.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw ApiError.notFound('Tipologia no encontrada');
  return doc;
}

async function cambiarEstadoTipologia(id, body = {}) {
  const activo = tomarActivo(body);

  const doc = await TipologiaPoblacional.findById(id);
  if (!doc) throw ApiError.notFound('Tipologia no encontrada');

  // NINGUNA es una tipologia legado. No se puede reactivar: el catalogo
  // vigente tiene las 16 categorias comerciales.
  const esNinguna =
    doc.codigo === TIPOLOGIA_CODIGO.NINGUNA ||
    doc.nombre === TIPOLOGIA_NINGUNA_NOMBRE;
  if (esNinguna && activo === true) {
    throw ApiError.conflict(
      'La tipologia NINGUNA es legado y no se puede reactivar; use el catalogo de 16 tipologias'
    );
  }

  doc.activo = activo;
  await doc.save();
  return { doc, activo };
}

// ---------------------------------------------------------------------------
// Tipos de muestra
// ---------------------------------------------------------------------------

async function listarTiposMuestra(query = {}) {
  const filtro = {};
  if (query.activo !== undefined) {
    const activo = parseBoolean(query.activo);
    if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
    filtro.activo = activo;
  }
  if (query.estado_fisico) filtro.estado_fisico = query.estado_fisico;
  return TipoMuestra.find(filtro).sort({ nombre: 1 });
}

async function crearTipoMuestra(body = {}) {
  const { nombre, estado_fisico } = body;
  if (!nombre || !estado_fisico) {
    throw ApiError.badRequest('nombre y estado_fisico son obligatorios');
  }
  return TipoMuestra.create({ nombre: String(nombre).trim(), estado_fisico });
}

async function actualizarTipoMuestra(id, body = {}) {
  const cambios = {};
  for (const campo of ['nombre', 'estado_fisico']) {
    if (body[campo] !== undefined) cambios[campo] = body[campo];
  }
  if (Object.keys(cambios).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  const doc = await TipoMuestra.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw ApiError.notFound('Tipo de muestra no encontrado');
  return doc;
}

async function cambiarEstadoTipoMuestra(id, body = {}) {
  const activo = tomarActivo(body);
  const doc = await TipoMuestra.findByIdAndUpdate(id, { activo }, { new: true });
  if (!doc) throw ApiError.notFound('Tipo de muestra no encontrado');
  return { doc, activo };
}

// ---------------------------------------------------------------------------
// Parametros
// ---------------------------------------------------------------------------

async function listarParametros(query = {}) {
  const filtro = {};
  if (query.activo !== undefined) {
    const activo = parseBoolean(query.activo);
    if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
    filtro.activo = activo;
  }
  const rx = query.search !== undefined ? crearRegexBusqueda(query.search) : null;
  if (rx) filtro.nombre = rx;
  return Parametro.find(filtro).sort({ nombre: 1 });
}

async function crearParametro(body = {}) {
  const { nombre, unidad_medida } = body;
  if (!nombre) throw ApiError.badRequest('nombre es obligatorio');
  return Parametro.create({ nombre: String(nombre).trim(), unidad_medida });
}

async function actualizarParametro(id, body = {}) {
  const cambios = {};
  for (const campo of ['nombre', 'unidad_medida']) {
    if (body[campo] !== undefined) cambios[campo] = body[campo];
  }
  if (Object.keys(cambios).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  const doc = await Parametro.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw ApiError.notFound('Parametro no encontrado');
  return doc;
}

async function cambiarEstadoParametro(id, body = {}) {
  const activo = tomarActivo(body);
  const doc = await Parametro.findByIdAndUpdate(id, { activo }, { new: true });
  if (!doc) throw ApiError.notFound('Parametro no encontrado');
  return { doc, activo };
}

// ---------------------------------------------------------------------------
// Etapas de proceso (trazabilidad)
// ---------------------------------------------------------------------------

async function listarEtapas(query = {}) {
  if (query.todas !== 'true' && query.todas !== '1') {
    return { items: await EtapaProceso.listarOrdenadas(), oficial: true };
  }
  return { items: await EtapaProceso.find({}).sort({ orden: 1 }), oficial: false };
}

async function crearEtapa(body = {}) {
  const { nombre, orden } = body;
  if (!nombre || orden === undefined) {
    throw ApiError.badRequest('nombre y orden son obligatorios');
  }
  return EtapaProceso.create({ nombre: String(nombre).trim(), orden });
}

async function actualizarEtapa(id, body = {}) {
  const cambios = {};
  for (const campo of ['nombre', 'orden']) {
    if (body[campo] !== undefined) cambios[campo] = body[campo];
  }
  if (Object.keys(cambios).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  const doc = await EtapaProceso.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw ApiError.notFound('Etapa no encontrada');
  return doc;
}

async function cambiarEstadoEtapa(id, body = {}) {
  const activo = tomarActivo(body);
  const doc = await EtapaProceso.findByIdAndUpdate(id, { activo }, { new: true });
  if (!doc) throw ApiError.notFound('Etapa no encontrada');
  return { doc, activo };
}

// ---------------------------------------------------------------------------
// Analisis — RF-25 (tarifa interna = 0 por regla, no se almacena)
// ---------------------------------------------------------------------------

async function listarAnalisis(query = {}) {
  const filtro = {};
  if (query.activo !== undefined) {
    const activo = parseBoolean(query.activo);
    if (activo === null) throw ApiError.badRequest('activo debe ser true o false');
    filtro.activo = activo;
  }
  const rx = query.search !== undefined ? crearRegexBusqueda(query.search) : null;
  if (rx) filtro.nombre = rx;
  return Analisis.find(filtro).populate(POPULATE_ANALISIS).sort({ nombre: 1 });
}

async function obtenerAnalisisPorId(id) {
  const doc = await Analisis.findById(id).populate(POPULATE_ANALISIS);
  if (!doc) throw ApiError.notFound('Analisis no encontrado');
  return doc;
}

async function crearAnalisis(body = {}) {
  const { nombre, tarifa_externo } = body;
  if (!nombre || tarifa_externo === undefined) {
    throw ApiError.badRequest('nombre y tarifa_externo son obligatorios');
  }

  const datos = tomarCamposAnalisis(body);
  await validarReferenciasAnalisis(datos.parametros, datos.tipos_muestra);
  const doc = await Analisis.create(datos);
  await doc.populate(POPULATE_ANALISIS);
  return doc;
}

async function actualizarAnalisis(id, body = {}) {
  const datos = tomarCamposAnalisis(body);
  if (Object.keys(datos).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  await validarReferenciasAnalisis(datos.parametros, datos.tipos_muestra);
  const doc = await Analisis.findByIdAndUpdate(id, datos, {
    new: true,
    runValidators: true,
  }).populate(POPULATE_ANALISIS);
  if (!doc) throw ApiError.notFound('Analisis no encontrado');
  return doc;
}

async function cambiarEstadoAnalisis(id, body = {}) {
  const activo = tomarActivo(body);
  const doc = await Analisis.findByIdAndUpdate(id, { activo }, { new: true }).populate(
    POPULATE_ANALISIS
  );
  if (!doc) throw ApiError.notFound('Analisis no encontrado');
  return { doc, activo };
}

// ---------------------------------------------------------------------------
// Configuracion del sistema — RF-24
// ---------------------------------------------------------------------------

async function listarConfiguracion() {
  return ConfiguracionSistema.find({}).sort({ clave: 1 });
}

async function obtenerConfiguracionPorClave(clave) {
  const doc = await ConfiguracionSistema.findOne({ clave });
  if (!doc) throw ApiError.notFound('Clave de configuracion no encontrada');
  return doc;
}

async function actualizarConfiguracion(clave, body = {}) {
  const { valor, descripcion } = body;
  if (valor === undefined) throw ApiError.badRequest('valor es obligatorio');
  return ConfiguracionSistema.findOneAndUpdate(
    { clave },
    {
      $set: {
        valor: String(valor).trim(),
        ...(descripcion !== undefined ? { descripcion } : {}),
      },
    },
    { new: true, runValidators: true, upsert: true }
  );
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
