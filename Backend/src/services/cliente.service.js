/**
 * Service del modulo: clientes.
 *
 * Decisiones del modelo (Cliente.js):
 *  - Los datos personales viven en Usuario; aqui solo lo especifico del cliente.
 *  - tipologia obligatoria en el registro; el operador puede omitirla.
 *  - nit unico parcial (solo colisiona cuando tiene valor string).
 *  - Sin borrado fisico: desactivar = Usuario.activo=false (RF-23).
 */
import { TIPO_CLIENTE, ROLES } from '../config/constants.js';
import { parseBoolean } from '../utils/booleanos.js';
import { crearRegexBusqueda } from '../utils/regex.js';
import { resolverTipologia, tipoClienteDeTipologia } from '../utils/tipologias.js';
import { paginacion } from '../utils/paginacion.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import ApiError from '../utils/ApiError.js';
import Cliente from '../models/clientes/Cliente.js';
import Usuario from '../models/seguridad/Usuario.js';
import Rol from '../models/seguridad/Rol.js';

const POPULATE_CLIENTE = [
  { path: 'usuario', select: 'nombres apellidos tipo_documento numero_documento correo activo rol' },
  { path: 'tipologia', select: 'nombre codigo descripcion es_interno activo' },
];

/**
 * GET /clientes — lista paginada con filtros.
 * @param {Record<string, unknown>} query page, limit, search, tipo_cliente, activo
 */
async function listar(query = {}) {
  const { page, limit, skip } = paginacion(query, 10);
  const { search, tipo_cliente, activo } = query;

  const filtro = {};
  if (tipo_cliente) {
    if (!Object.values(TIPO_CLIENTE).includes(tipo_cliente)) {
      throw ApiError.badRequest(`tipo_cliente debe ser ${Object.values(TIPO_CLIENTE).join(' o ')}`);
    }
    filtro.tipo_cliente = tipo_cliente;
  }

  let activoFiltro;
  if (activo !== undefined) {
    activoFiltro = parseBoolean(activo);
    if (activoFiltro === null) {
      throw ApiError.badRequest('activo debe ser true o false');
    }
  }

  const rx = search !== undefined ? crearRegexBusqueda(search) : null;
  if (rx) {
    const usuarios = await Usuario.find({
      $or: [{ nombres: rx }, { apellidos: rx }, { correo: rx }, { numero_documento: rx }],
    }).select('_id');
    filtro.$or = [
      { usuario: { $in: usuarios.map((u) => u._id) } },
      { razon_social: rx },
      { nit: rx },
    ];
  }

  if (activoFiltro !== undefined) {
    const usuariosPorEstado = await Usuario.find({ activo: activoFiltro }).select('_id');
    filtro.usuario = { $in: usuariosPorEstado.map((u) => u._id) };
  }

  const [items, total] = await Promise.all([
    Cliente.find(filtro)
      .populate(POPULATE_CLIENTE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Cliente.countDocuments(filtro),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) || 1 };
}

/** GET /clientes/:id */
async function obtenerPorId(id) {
  const cliente = await Cliente.findById(id).populate(POPULATE_CLIENTE);
  if (!cliente) throw ApiError.notFound('Cliente no encontrado');
  return cliente;
}

/**
 * POST /clientes — prospecto registrado por el coordinador.
 * Crea Usuario SIN contrasena (contrasena_hash=null) + Cliente.
 */
async function crear(datos = {}) {
  const {
    nombres,
    apellidos,
    tipo_documento,
    numero_documento,
    correo,
    tipologia,
    telefono,
    razon_social,
    nit,
    direccion,
    ciudad,
    departamento,
    cargo,
    persona_contacto,
  } = datos;

  if (!nombres || !apellidos || !tipo_documento || !numero_documento || !correo) {
    throw ApiError.badRequest('nombres, apellidos, tipo_documento, numero_documento y correo son obligatorios');
  }

  const correoNorm = String(correo).toLowerCase().trim();
  const duplicado = await Usuario.findOne({
    $or: [{ correo: correoNorm }, { numero_documento: String(numero_documento).trim() }],
  }).lean();
  if (duplicado) {
    throw ApiError.conflict('Ya existe un usuario con ese correo o numero de documento');
  }

  const rolCliente = await Rol.findOne({ nombre: ROLES.CLIENTE });
  if (!rolCliente) throw new ApiError(500, 'Rol cliente no sembrado. Ejecute npm run seed');

  // Politica hibrida: el operador puede no conocer la tipologia.
  const tipologiaDoc = await resolverTipologia(tipologia, { obligatoria: false });

  let usuarioCreado = null;
  let clienteCreado = null;
  try {
    usuarioCreado = await Usuario.create({
      rol: rolCliente._id,
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      tipo_documento,
      numero_documento: String(numero_documento).trim(),
      correo: correoNorm,
      contrasena_hash: null,
    });

    clienteCreado = await Cliente.create({
      usuario: usuarioCreado._id,
      tipologia: tipologiaDoc._id,
      tipo_cliente: tipoClienteDeTipologia(tipologiaDoc),
      telefono: telefono || null,
      razon_social: razon_social || null,
      nit: nit || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      departamento: departamento || null,
      cargo: cargo || null,
      persona_contacto: persona_contacto || null,
      acepta_tratamiento_datos: false,
      fecha_aceptacion_datos: null,
    });

    await clienteCreado.populate(POPULATE_CLIENTE);
    return clienteCreado;
  } catch (err) {
    if (clienteCreado) {
      await Cliente.deleteOne({ _id: clienteCreado._id }).catch(() => {});
    }
    if (usuarioCreado) {
      await Usuario.deleteOne({ _id: usuarioCreado._id }).catch(() => {});
    }
    throw traducirErrorMongoose(err, { entidad: 'cliente' });
  }
}

/**
 * PUT /clientes/:id — solo campos del perfil (RF-23 parcial).
 * Si cambia la tipologia, se recalcula tipo_cliente.
 */
async function actualizar(id, body = {}) {
  const permitidos = [
    'telefono',
    'razon_social',
    'nit',
    'tipologia',
    'direccion',
    'ciudad',
    'departamento',
    'cargo',
    'persona_contacto',
  ];
  const cambios = {};
  for (const k of permitidos) {
    if (body[k] !== undefined) cambios[k] = body[k];
  }
  if (Object.keys(cambios).length === 0) {
    throw ApiError.badRequest('No hay campos validos para actualizar');
  }

  if (cambios.tipologia !== undefined) {
    if (cambios.tipologia === null || String(cambios.tipologia).trim() === '') {
      throw ApiError.badRequest('tipologia no puede ser null ni vacia');
    }
    const t = await resolverTipologia(cambios.tipologia);
    cambios.tipologia = t._id;
    cambios.tipo_cliente = tipoClienteDeTipologia(t);
  }

  const cliente = await Cliente.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  }).populate(POPULATE_CLIENTE);
  if (!cliente) throw ApiError.notFound('Cliente no encontrado');
  return cliente;
}

/**
 * PATCH /clientes/:id/desactivar|reactivar — RF-23.
 * No elimina el Cliente; cambia Usuario.activo.
 */
async function establecerActivo(id, activo) {
  const cliente = await Cliente.findById(id);
  if (!cliente) throw ApiError.notFound('Cliente no encontrado');
  await Usuario.updateOne({ _id: cliente.usuario }, { $set: { activo } });
  return Cliente.findById(cliente._id).populate(POPULATE_CLIENTE);
}

export { listar, obtenerPorId, crear, actualizar, establecerActivo };
export default { listar, obtenerPorId, crear, actualizar, establecerActivo };
