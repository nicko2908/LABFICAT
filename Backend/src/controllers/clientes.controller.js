/**
 * Controlador del modulo: clientes (capa C de MVC).
 * Basado en los modelos: Cliente, Usuario y TipologiaPoblacional.
 *
 * Decisiones del modelo (Cliente.js):
 *  - Los datos personales viven en Usuario; aqui solo lo especifico del cliente.
 *  - tipologia nullable (prospecto de operador); obligatoria en RF-02 (registro publico).
 *  - nit unico parcial (solo colisiona cuando tiene valor string).
 *  - Sin borrado fisico: desactivar = Usuario.activo=false (RF-23).
 */
<<<<<<< HEAD
const { TIPO_CLIENTE } = require('../config/constants');
const { determinarTipoCliente } = require('../utils/dominios');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Cliente = require('../models/clientes/Cliente');
const Usuario = require('../models/seguridad/Usuario');
const Rol = require('../models/seguridad/Rol');
const TipologiaPoblacional = require('../models/clientes/TipologiaPoblacional');
const { ROLES } = require('../config/constants');

const POPULATE_CLIENTE = [
  { path: 'usuario', select: 'nombres apellidos tipo_documento numero_documento correo activo rol' },
  { path: 'tipologia', select: 'nombre descripcion activo' },
];

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un cliente con ese ${campo}`, err.keyValue);
  }
  if (err && err.name === 'ValidationError') {
    return ApiError.badRequest('Datos invalidos', err.errors);
  }
  if (err && err.name === 'CastError') {
    return ApiError.badRequest('Identificador invalido');
  }
  return err;
}

/**
 * GET /clientes — lista paginada con filtros.
 * Query: page, limit, search (nombre/correo/documento/nit), tipo_cliente, activo.
 */
async function listar(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const { search, tipo_cliente } = req.query;

    const filtro = {};
    if (tipo_cliente) {
      if (!Object.values(TIPO_CLIENTE).includes(tipo_cliente)) {
        throw ApiError.badRequest(`tipo_cliente debe ser ${Object.values(TIPO_CLIENTE).join(' o ')}`);
      }
      filtro.tipo_cliente = tipo_cliente;
    }
    if (search) {
      const rx = new RegExp(String(search).trim(), 'i');
      const usuarios = await Usuario.find({
        $or: [{ nombres: rx }, { apellidos: rx }, { correo: rx }, { numero_documento: rx }],
      }).select('_id');
      filtro.$or = [
        { usuario: { $in: usuarios.map((u) => u._id) } },
        { razon_social: rx },
        { nit: rx },
      ];
    }

    const [items, total] = await Promise.all([
      Cliente.find(filtro)
        .populate(POPULATE_CLIENTE)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Cliente.countDocuments(filtro),
    ]);

    res.json(
      new ApiResponse(
        { items, total, page, pages: Math.ceil(total / limit) || 1 },
        'Clientes listados'
      )
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /clientes/:id — detalle con populate usuario + tipologia.
 */
async function obtenerPorId(req, res, next) {
  try {
    const cliente = await Cliente.findById(req.params.id).populate(POPULATE_CLIENTE);
    if (!cliente) throw ApiError.notFound('Cliente no encontrado');
    res.json(new ApiResponse(cliente, 'Cliente obtenido'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /clientes — prospecto registrado por el operador (coordinador).
 * Crea Usuario SIN contrasena (contrasena_hash=null) + Cliente.
 * El tipo_cliente se asigna automaticamente segun el dominio del correo.
 */
async function crear(req, res, next) {
  let usuarioCreado = null;
  try {
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
    } = req.body || {};

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

    let tipologiaDoc = null;
    if (tipologia) {
      tipologiaDoc = await TipologiaPoblacional.findById(tipologia);
      if (!tipologiaDoc) throw ApiError.badRequest('La tipologia indicada no existe');
    }

    usuarioCreado = await Usuario.create({
      rol: rolCliente._id,
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      tipo_documento,
      numero_documento: String(numero_documento).trim(),
      correo: correoNorm,
      contrasena_hash: null, // prospecto sin credenciales (las define en RF-02 / recuperacion)
    });

    const cliente = await Cliente.create({
      usuario: usuarioCreado._id,
      tipologia: tipologiaDoc ? tipologiaDoc._id : null,
      tipo_cliente: determinarTipoCliente(correoNorm),
      telefono: telefono || null,
      razon_social: razon_social || null,
      nit: nit || null,
      acepta_tratamiento_datos: false,
      fecha_aceptacion_datos: null,
    });

    await cliente.populate(POPULATE_CLIENTE);
    res.status(201).json(new ApiResponse(cliente, 'Cliente creado'));
  } catch (err) {
    if (usuarioCreado) {
      // Rollback: no dejar usuario huerfano si falla el perfil.
      await Usuario.deleteOne({ _id: usuarioCreado._id }).catch(() => {});
    }
    next(traducirErrorMongoose(err));
  }
}

/**
 * PUT /clientes/:id — solo campos del perfil (RF-23 parcial).
 * Permite: telefono, razon_social, nit, tipologia.
 */
async function actualizar(req, res, next) {
  try {
    const permitidos = ['telefono', 'razon_social', 'nit', 'tipologia'];
    const cambios = {};
    for (const k of permitidos) {
      if (req.body && req.body[k] !== undefined) cambios[k] = req.body[k];
    }
    if (Object.keys(cambios).length === 0) {
      throw ApiError.badRequest('No hay campos validos para actualizar');
    }

    if (cambios.tipologia) {
      const t = await TipologiaPoblacional.findById(cambios.tipologia);
      if (!t) throw ApiError.badRequest('La tipologia indicada no existe');
    }

    const cliente = await Cliente.findByIdAndUpdate(req.params.id, cambios, {
      new: true,
      runValidators: true,
    }).populate(POPULATE_CLIENTE);
    if (!cliente) throw ApiError.notFound('Cliente no encontrado');
    res.json(new ApiResponse(cliente, 'Cliente actualizado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /clientes/:id/desactivar — RF-23.
 * No elimina el Cliente; desactiva el Usuario (activo=false).
 */
async function desactivar(req, res, next) {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) throw ApiError.notFound('Cliente no encontrado');
    await Usuario.updateOne({ _id: cliente.usuario }, { $set: { activo: false } });
    const actualizado = await Cliente.findById(cliente._id).populate(POPULATE_CLIENTE);
    res.json(new ApiResponse(actualizado, 'Cliente desactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * PATCH /clientes/:id/reactivar.
 * Revierte la desactivacion (Usuario.activo=true).
 */
async function reactivar(req, res, next) {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) throw ApiError.notFound('Cliente no encontrado');
    await Usuario.updateOne({ _id: cliente.usuario }, { $set: { activo: true } });
    const actualizado = await Cliente.findById(cliente._id).populate(POPULATE_CLIENTE);
    res.json(new ApiResponse(actualizado, 'Cliente reactivado'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, desactivar, reactivar };
=======
export default {};
>>>>>>> ca5957decbb225619fdc681b279fd672eba8a7f5
