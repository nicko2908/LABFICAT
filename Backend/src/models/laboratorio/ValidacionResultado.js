/**
 * Modelo Mongoose: ValidacionResultado (dominio: laboratorio).
 *
 * Decision del coordinador sobre los resultados de una orden (RF-13).
 * Si se rechaza, el resultado regresa a analisis (RF-14).
 *
 * Decisiones:
 *  - append-only: fecha_hora = timestamps.createdAt; sin updatedAt.
 */
import mongoose from 'mongoose';
import { DECISION_VALIDACION } from '../../config/constants.js';

const validacionResultadoSchema = new mongoose.Schema(
  {
    orden: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrdenAnalisis',
      required: true,
      index: true,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    decision: { type: String, required: true, enum: DECISION_VALIDACION },
    motivo: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: { createdAt: 'fecha_hora', updatedAt: false } }
);

export default mongoose.model('ValidacionResultado', validacionResultadoSchema);
