/**
 * Modelo Mongoose: Encuesta (dominio: calidad).
 *
 * Encuesta de satisfaccion del cliente (RF-17). Una sola por solicitud.
 * Debe completarse antes de descargar el informe.
 *
 * Decisiones:
 *  - puntajes en escala 1-5.
 *  - fecha_respuesta = timestamps.createdAt.
 */
import mongoose from 'mongoose';

const PUNTAJE = { type: Number, required: true, min: 1, max: 5 };

const encuestaSchema = new mongoose.Schema(
  {
    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
      unique: true, // una encuesta por solicitud
      index: true,
    },

    satisfaccion_general: PUNTAJE,
    tiempo_entrega: PUNTAJE,
    atencion_personal: PUNTAJE,
    claridad_informe: PUNTAJE,

    recomendaria_servicio: { type: Boolean, required: true },
    comentarios: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: { createdAt: 'fecha_respuesta', updatedAt: true } }
);

export default mongoose.model('Encuesta', encuestaSchema);
