/**
 * Modelo Mongoose: Parametro (dominio: laboratorio).
 *
 * Catalogo de parametros que puede medir un analisis (pH, turbidez, etc.).
 * Referenciado por Analisis (que parametros mide) y por ResultadoParametro.
 */
import mongoose from 'mongoose';

const parametroSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    unidad_medida: { type: String, trim: true, maxlength: 100, default: null },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Parametro', parametroSchema);
