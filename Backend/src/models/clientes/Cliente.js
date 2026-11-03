/**
 * Modelo Mongoose: Cliente (dominio: clientes).
 *
 * Perfil 1:1 de un Usuario que actua como cliente del laboratorio (RF-01/RF-02).
 * Los datos personales (nombres, documento, correo) viven en Usuario; aqui solo
 * lo especifico del cliente.
 *
 * Decisiones:
 *  - tipologia: OBLIGATORIA. Es la clasificacion comercial de la cotizacion
 *    (16 categorias). Si el operador no la conoce, se usa "Persona natural".
 *  - nit: unico solo cuando tiene valor (indice parcial), para no chocar entre
 *    clientes persona natural sin NIT.
 *  - SIN campo "activo": la desactivacion (RF-23) se maneja con Usuario.activo.
 *  - tipo_cliente: se deriva SIEMPRE de tipologia.es_interno. Las 4 tipologias
 *    internas (Aprendices SENA, CampeSENA, Comunidad SENA y Cooperativas de
 *    Aprendices) liquidan al 0 %; el resto son externas. No se usa el dominio
 *    del correo.
 *  - direccion/ciudad/departamento/cargo/persona_contacto: datos que exige la
 *    plantilla de cotizacion y que se congelan en el snapshot de la cotizacion.
 */
import mongoose from 'mongoose';
import { TIPO_CLIENTE } from '../../config/constants.js';

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
      required: true,
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

    // Datos que se imprimen en la Oferta de servicios y en el acta de recepcion.
    direccion: { type: String, trim: true, maxlength: 200, default: null },
    ciudad: { type: String, trim: true, maxlength: 100, default: null },
    departamento: { type: String, trim: true, maxlength: 100, default: null },
    cargo: { type: String, trim: true, maxlength: 100, default: null },
    persona_contacto: { type: String, trim: true, maxlength: 150, default: null },

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

export default mongoose.model('Cliente', clienteSchema);
