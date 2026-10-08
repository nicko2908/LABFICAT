/**
 * Modelo Mongoose: Cliente (dominio: clientes).
 *
 * Perfil 1:1 de un Usuario que actua como cliente del laboratorio (RF-01/RF-02).
 * Los datos personales (nombres, documento, correo) viven en Usuario; aqui solo
 * lo especifico del cliente.
 *
 * Decisiones:
 *  - tipologia: nullable (prospectos registrados por el operador). Obligatoria
 *    en la validacion de RF-02.
 *  - nit: unico solo cuando tiene valor (indice parcial), para no chocar entre
 *    clientes persona natural sin NIT.
 *  - SIN campo "activo": la desactivacion (RF-23) se maneja con Usuario.activo.
 *  - tipo_cliente: lo asigna el sistema a partir del correo (ver utils/dominios).
 */
const mongoose = require('mongoose');
const { TIPO_CLIENTE } = require('../../config/constants');

const REGEX_TELEFONO = /^\d{10}$/;

const clienteSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      unique: true,
      index: true,
    },
    tipologia: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TipologiaPoblacional',
      default: null,
      index: true,
    },
    tipo_cliente: {
      type: String,
      required: true,
      enum: Object.values(TIPO_CLIENTE), // INTERNO | EXTERNO
      index: true,
    },

    telefono: {
      type: String,
      trim: true,
      default: null,
      match: [REGEX_TELEFONO, 'El telefono debe tener 10 digitos'],
    },
    razon_social: { type: String, trim: true, maxlength: 100, default: null },

    // Unico solo cuando hay valor: los clientes sin NIT (null) no colisionan.
    nit: { type: String, trim: true, maxlength: 20, default: null },

    // RNF-13 / Ley 1581
    acepta_tratamiento_datos: { type: Boolean, required: true, default: false },
    fecha_aceptacion_datos: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indice unico parcial: solo indexa NIT con valor real (string).
clienteSchema.index(
  { nit: 1 },
  { unique: true, partialFilterExpression: { nit: { $type: 'string' } } }
);

module.exports = mongoose.model('Cliente', clienteSchema);
