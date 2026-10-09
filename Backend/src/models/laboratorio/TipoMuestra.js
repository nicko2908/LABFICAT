/**
 * Modelo Mongoose: TipoMuestra (dominio: laboratorio).
 *
 * Catalogo de tipos de muestra que recibe el laboratorio.
 * Referenciado por Muestra y por Analisis (tipos de muestra que aplica).
 */
const mongoose = require('mongoose');

const ESTADOS_FISICOS = ['SOLIDO', 'LIQUIDO'];

const tipoMuestraSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    estado_fisico: { type: String, required: true, enum: ESTADOS_FISICOS },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TipoMuestra', tipoMuestraSchema);
