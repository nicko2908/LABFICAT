/**
 * Modelo Mongoose: Usuario (dominio: seguridad).
 *
 * Identidad y acceso de TODAS las personas del sistema (cliente, analista,
 * coordinador). Los datos especificos del cliente (tipologia, telefono, NIT)
 * viven en el modelo Cliente, que referencia a Usuario 1:1.
 *
 * Reglas aplicadas (RF-02 / RF-27):
 *  - nombre y apellidos: solo letras, espacios y tildes, max. 100.
 *  - tipo_documento: enum cerrado (ver config/constants -> TIPOS_DOCUMENTO).
 *  - numero_documento: numerico 6-15 digitos, unico.
 *  - correo: formato valido, max. 100, unico, en minusculas.
 *  - contrasena_hash: CIFRADA y opcional (null). Nunca se devuelve (select:false).
 *  - seguridad: intentosFallidos, bloqueadoHasta, ultimoAcceso.
 */
const mongoose = require('mongoose');
const { TIPOS_DOCUMENTO_LISTA } = require('../../config/constants');
const password = require('../../utils/password');

const REGEX_NOMBRES = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/u;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_DOCUMENTO = /^\d{6,15}$/;

const usuarioSchema = new mongoose.Schema(
  {
    rol: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rol',
      required: true,
      index: true,
    },

    nombres: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      match: [REGEX_NOMBRES, 'Los nombres solo admiten letras, espacios y tildes'],
    },
    apellidos: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      match: [REGEX_NOMBRES, 'Los apellidos solo admiten letras, espacios y tildes'],
    },

    tipo_documento: {
      type: String,
      required: true,
      enum: TIPOS_DOCUMENTO_LISTA,
    },
    numero_documento: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [REGEX_DOCUMENTO, 'El documento debe tener entre 6 y 15 digitos'],
    },

    correo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: [REGEX_CORREO, 'Correo electronico invalido'],
    },

    // Cifrada con bcrypt. Puede ser null (cliente registrado por operador sin credenciales).
    contrasena_hash: { type: String, default: null, select: false },

    activo: { type: Boolean, default: true },

    // --- Seguridad de la cuenta (RF-27) ---
    intentosFallidos: { type: Number, default: 0, min: 0 },
    bloqueadoHasta: { type: Date, default: null },
    ultimoAcceso: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * Establece la contrasena (en texto plano) cifrandola antes de guardar.
 * Uso: await usuario.establecerContrasena('...'); await usuario.save();
 */
usuarioSchema.methods.establecerContrasena = async function (plano) {
  this.contrasena_hash = await password.hash(plano);
  return this.contrasena_hash;
};

/**
 * Compara una contrasena en texto plano con el hash almacenado.
 * Requiere haber cargado el campo con .select('+contrasena_hash').
 */
usuarioSchema.methods.compararContrasena = function (plano) {
  return password.comparar(plano, this.contrasena_hash);
};

/**
 * Oculta el hash de las respuestas JSON.
 */
usuarioSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.contrasena_hash;
  return obj;
};

module.exports = mongoose.model('Usuario', usuarioSchema);
