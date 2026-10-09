/**
 * Modelo Mongoose: Auditoria (dominio: seguridad).
 *
 * Bitacora de accesos y acciones (RNF-03). Append-only.
 *
 * Decisiones:
 *  - fecha_hora = timestamps.createdAt; sin updatedAt (log inmutable).
 */
import mongoose from 'mongoose';

const auditoriaSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    ip: { type: String, trim: true, maxlength: 45, default: null },
    accion: { type: String, required: true, trim: true, maxlength: 60 },
  },
  { timestamps: { createdAt: 'fecha_hora', updatedAt: false } }
);

export default mongoose.model('Auditoria', auditoriaSchema);
