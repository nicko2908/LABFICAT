/**
 * Controlador del modulo: auth (capa C de MVC).
 * Basado en los modelos: Usuario y Rol (dominio: seguridad).
 *
 * No usa services (capa aun no implementada por el equipo):
 * accede a los modelos Mongoose y responde con ApiResponse.
 * Los errores se delegan a error.middleware con next(err).
 */
<<<<<<< HEAD
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const { ROLES, SEGURIDAD } = require('../config/constants');
const { determinarTipoCliente } = require('../utils/dominios');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Rol = require('../models/seguridad/Rol');
const Usuario = require('../models/seguridad/Usuario');
const Cliente = require('../models/clientes/Cliente');
const TipologiaPoblacional = require('../models/clientes/TipologiaPoblacional');

function firmarToken(usuario) {
  const rolNombre = usuario.rol && usuario.rol.nombre ? usuario.rol.nombre : usuario.rol;
  return jwt.sign({ sub: String(usuario._id), rol: rolNombre }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function traducirErrorMongoose(err) {
  if (err && err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'registro';
    return ApiError.conflict(`Ya existe un usuario con ese ${campo}`, err.keyValue);
  }
  if (err && err.name === 'ValidationError') {
    return ApiError.badRequest('Datos invalidos', err.errors);
  }
  return err;
}

/**
 * POST /auth/registro — RF-01 / RF-02.
 * Crea Usuario (rol cliente) + perfil Cliente 1:1.
 */
async function registrar(req, res, next) {
  try {
    const {
      nombres,
      apellidos,
      tipo_documento,
      numero_documento,
      correo,
      contrasena,
      tipologia,
      telefono,
      razon_social,
      nit,
      acepta_tratamiento_datos,
    } = req.body || {};

    if (!nombres || !apellidos || !tipo_documento || !numero_documento || !correo || !contrasena) {
      throw ApiError.badRequest('nombres, apellidos, tipo_documento, numero_documento, correo y contrasena son obligatorios');
    }
    if (acepta_tratamiento_datos !== true) {
      throw ApiError.badRequest('Debe aceptar el tratamiento de datos (Ley 1581)');
    }

    const correoNorm = String(correo).toLowerCase().trim();
    const duplicado = await Usuario.findOne({
      $or: [{ correo: correoNorm }, { numero_documento: String(numero_documento).trim() }],
    }).lean();
    if (duplicado) {
      throw ApiError.conflict('Ya existe un usuario con ese correo o numero de documento');
    }

    const rolCliente = await Rol.findOne({ nombre: ROLES.CLIENTE });
    if (!rolCliente) {
      throw new ApiError(500, 'Rol cliente no sembrado. Ejecute npm run seed');
    }

    let tipologiaDoc = null;
    if (tipologia) {
      tipologiaDoc = await TipologiaPoblacional.findById(tipologia);
      if (!tipologiaDoc) throw ApiError.badRequest('La tipologia indicada no existe');
    }

    const usuario = new Usuario({
      rol: rolCliente._id,
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      tipo_documento,
      numero_documento: String(numero_documento).trim(),
      correo: correoNorm,
    });
    await usuario.establecerContrasena(String(contrasena));
    await usuario.save();

    try {
      const cliente = await Cliente.create({
        usuario: usuario._id,
        tipologia: tipologiaDoc ? tipologiaDoc._id : null,
        tipo_cliente: determinarTipoCliente(correoNorm),
        telefono: telefono || null,
        razon_social: razon_social || null,
        nit: nit || null,
        acepta_tratamiento_datos: true,
        fecha_aceptacion_datos: new Date(),
      });
      await usuario.populate('rol');
      const token = firmarToken(usuario);
      res
        .status(201)
        .json(new ApiResponse({ token, usuario, cliente }, 'Registro exitoso'));
    } catch (errCliente) {
      // Rollback: si falla el perfil, no dejar el usuario huerfano.
      await Usuario.deleteOne({ _id: usuario._id });
      throw traducirErrorMongoose(errCliente);
    }
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

/**
 * POST /auth/login — RF-27.
 * Valida credenciales, aplica bloqueo por intentos y devuelve JWT.
 */
async function login(req, res, next) {
  try {
    const { correo, contrasena } = req.body || {};
    if (!correo || !contrasena) {
      throw ApiError.badRequest('correo y contrasena son obligatorios');
    }

    const usuario = await Usuario.findOne({ correo: String(correo).toLowerCase().trim() })
      .select('+contrasena_hash')
      .populate('rol');
    // Respuesta generica para no revelar si el correo existe.
    if (!usuario) throw ApiError.unauthorized('Credenciales invalidas');

    if (!usuario.activo) throw ApiError.forbidden('Usuario desactivado. Contacte al coordinador');
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      throw ApiError.forbidden('Cuenta bloqueada temporalmente por intentos fallidos');
    }
    if (!usuario.rol || !usuario.rol.activo) {
      throw ApiError.forbidden('Rol desactivado. Contacte al coordinador');
    }

    const ok = await usuario.compararContrasena(String(contrasena));
    if (!ok) {
      usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;
      if (usuario.intentosFallidos >= SEGURIDAD.MAX_INTENTOS_FALLIDOS) {
        usuario.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        usuario.intentosFallidos = 0;
      }
      await usuario.save();
      throw ApiError.unauthorized('Credenciales invalidas');
    }

    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    usuario.ultimoAcceso = new Date();
    await usuario.save();

    const token = firmarToken(usuario);
    usuario.contrasena_hash = undefined;
    res.json(new ApiResponse({ token, usuario }, 'Acceso concedido'));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/perfil.
 * Requiere auth.middleware (req.usuario.id o req.usuarioId).
 */
async function obtenerPerfil(req, res, next) {
  try {
    const id = (req.usuario && (req.usuario.id || req.usuario.sub)) || req.usuarioId;
    if (!id) throw ApiError.unauthorized();

    const usuario = await Usuario.findById(id).populate('rol');
    if (!usuario) throw ApiError.notFound('Usuario no encontrado');

    const cliente = await Cliente.findOne({ usuario: usuario._id }).populate('tipologia');
    res.json(new ApiResponse({ usuario, cliente }, 'Perfil obtenido'));
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /auth/contrasena.
 * Verifica la actual y guarda la nueva cifrada.
 */
async function cambiarContrasena(req, res, next) {
  try {
    const id = (req.usuario && (req.usuario.id || req.usuario.sub)) || req.usuarioId;
    const { actual, nueva } = req.body || {};
    if (!id) throw ApiError.unauthorized();
    if (!actual || !nueva) throw ApiError.badRequest('actual y nueva son obligatorias');
    if (String(nueva).length < 8) throw ApiError.badRequest('La nueva contrasena debe tener minimo 8 caracteres');

    const usuario = await Usuario.findById(id).select('+contrasena_hash');
    if (!usuario) throw ApiError.notFound('Usuario no encontrado');

    const ok = await usuario.compararContrasena(String(actual));
    if (!ok) throw ApiError.unauthorized('La contrasena actual no es correcta');

    await usuario.establecerContrasena(String(nueva));
    await usuario.save();
    res.json(new ApiResponse(null, 'Contrasena actualizada'));
  } catch (err) {
    next(traducirErrorMongoose(err));
  }
}

module.exports = { registrar, login, obtenerPerfil, cambiarContrasena };
=======
export default {};
>>>>>>> ca5957decbb225619fdc681b279fd672eba8a7f5
