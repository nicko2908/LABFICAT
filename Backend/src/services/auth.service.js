/**
 * Service del modulo: auth.
 *
 * Reglas de negocio:
 *  - El autorregistro crea Usuario (rol cliente) + perfil Cliente 1:1.
 *  - El tipo_cliente se deriva de la tipologia, no del dominio del correo.
 *  - El login bloquea la cuenta tras varios intentos fallidos.
 *  - Si falla la creacion del perfil, se revierte el usuario (rollback manual).
 */
import { ROLES, SEGURIDAD } from '../config/constants.js';
import { firmar } from '../utils/jwt.js';
import { resolverTipologia, tipoClienteDeTipologia } from '../utils/tipologias.js';
import { traducirErrorMongoose } from '../utils/erroresMongoose.js';
import ApiError from '../utils/ApiError.js';
import Rol from '../models/seguridad/Rol.js';
import Usuario from '../models/seguridad/Usuario.js';
import Cliente from '../models/clientes/Cliente.js';

function firmarToken(usuario) {
  const rolNombre = usuario.rol && usuario.rol.nombre ? usuario.rol.nombre : usuario.rol;
  return firmar({ sub: String(usuario._id), rol: rolNombre });
}

/**
 * POST /auth/registro — RF-01 / RF-02.
 * @param {object} datos
 * @returns {Promise<{ token: string, usuario: object, cliente: object }>}
 */
async function registrar(datos = {}) {
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
    direccion,
    ciudad,
    departamento,
    cargo,
    persona_contacto,
    acepta_tratamiento_datos,
  } = datos;

  if (!nombres || !apellidos || !tipo_documento || !numero_documento || !correo || !contrasena) {
    throw ApiError.badRequest('nombres, apellidos, tipo_documento, numero_documento, correo y contrasena son obligatorios');
  }
  if (String(contrasena).length < 8) {
    throw ApiError.badRequest('La contrasena debe tener minimo 8 caracteres');
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

  // Politica hibrida: el autorregistro exige tipologia (RF-01).
  const tipologiaDoc = await resolverTipologia(tipologia);

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

  let clienteCreado = null;
  try {
    clienteCreado = await Cliente.create({
      usuario: usuario._id,
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
      acepta_tratamiento_datos: true,
      fecha_aceptacion_datos: new Date(),
    });

    await usuario.populate('rol');
    return { token: firmarToken(usuario), usuario, cliente: clienteCreado };
  } catch (errCliente) {
    // Rollback completo: no dejar usuario ni perfil huerfano.
    if (clienteCreado) {
      await Cliente.deleteOne({ _id: clienteCreado._id }).catch(() => {});
    }
    await Usuario.deleteOne({ _id: usuario._id }).catch(() => {});
    throw traducirErrorMongoose(errCliente, { entidad: 'usuario' });
  }
}

/**
 * POST /auth/login — RF-27.
 * @param {{ correo?: string, contrasena?: string }} credenciales
 * @returns {Promise<{ token: string, usuario: object }>}
 */
async function login({ correo, contrasena } = {}) {
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
  return { token, usuario };
}

/**
 * GET /auth/perfil.
 * @param {string} usuarioId
 */
async function obtenerPerfil(usuarioId) {
  if (!usuarioId) throw ApiError.unauthorized();

  const usuario = await Usuario.findById(usuarioId).populate('rol');
  if (!usuario) throw ApiError.notFound('Usuario no encontrado');

  const cliente = await Cliente.findOne({ usuario: usuario._id }).populate('tipologia');
  return { usuario, cliente };
}

/**
 * PATCH /auth/contrasena.
 * @param {{ usuarioId: string, actual?: string, nueva?: string }} params
 */
async function cambiarContrasena({ usuarioId, actual, nueva } = {}) {
  if (!usuarioId) throw ApiError.unauthorized();
  if (!actual || !nueva) throw ApiError.badRequest('actual y nueva son obligatorias');
  if (String(nueva).length < 8) {
    throw ApiError.badRequest('La nueva contrasena debe tener minimo 8 caracteres');
  }

  const usuario = await Usuario.findById(usuarioId).select('+contrasena_hash');
  if (!usuario) throw ApiError.notFound('Usuario no encontrado');

  const ok = await usuario.compararContrasena(String(actual));
  if (!ok) throw ApiError.unauthorized('La contrasena actual no es correcta');

  await usuario.establecerContrasena(String(nueva));
  await usuario.save();
  return null;
}

export { registrar, login, obtenerPerfil, cambiarContrasena };
export default { registrar, login, obtenerPerfil, cambiarContrasena };
