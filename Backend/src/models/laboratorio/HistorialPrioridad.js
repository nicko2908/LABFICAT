/**
 * Modelo Mongoose: HistorialPrioridad (dominio: laboratorio).
 *
 * Bitacora (append-only) de los cambios de prioridad de una muestra (RF-22).
 * El motivo es obligatorio y la priorizacion no es visible para el cliente.
 *
 * Decisiones:
 *  - nivel: entero 1-10 (los RF definen Alta=1, Media=3, Baja=5).
 *  - fecha_hora = timestamps.createdAt; sin updatedAt (log inmutable).
 */
import mongoose from 'mongoose';

const historialPrioridadSchema = new mongoose.Schema(
  {
    muestra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Muestra',
      required: true,
      index: true,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    nivel: { type: Number, required: true, min: 1, max: 10 },
    motivo: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { timestamps: { createdAt: 'fecha_hora', updatedAt: false } }
);

export default mongoose.model('HistorialPrioridad', historialPrioridadSchema);
