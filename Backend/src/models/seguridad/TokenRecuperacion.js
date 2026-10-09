/**
 * Modelo Mongoose: TokenRecuperacion (dominio: seguridad).
 *
 * Token de un solo uso para recuperar contrasena (RF-27), vigencia 30 min.
 *
 * Decisiones:
 *  - Se guarda SOLO el hash del token, nunca el token plano.
 *  - timestamps incluidos (creacion/actualizacion del registro).
 */
import mongoose from 'mongoose';

const tokenRecuperacionSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    token_hash: { type: String, required: true, trim: true, maxlength: 255 },
    fecha_expiracion: { type: Date, required: true },
    usado: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('TokenRecuperacion', tokenRecuperacionSchema);
