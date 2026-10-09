/**
 * Modelo Mongoose: Informe (dominio: calidad).
 *
 * Informe final de resultados de una muestra (RF-15, RF-16). Relacion 1:1.
 *
 * Decisiones:
 *  - ruta_pdf apunta a storage/informes (solo la ruta).
 *  - Regla del service (ex-trigger): no se puede descargar sin responder la
 *    encuesta de satisfaccion (RF-17).
 *  - fecha_generacion = timestamps.createdAt.
 */
import mongoose from 'mongoose';

const informeSchema = new mongoose.Schema(
  {
    muestra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Muestra',
      required: true,
      unique: true, // 1:1 con la muestra
      index: true,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    ruta_pdf: { type: String, trim: true, maxlength: 255, default: null },
    fecha_envio: { type: Date, default: null },
    fecha_descarga: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'fecha_generacion', updatedAt: true } }
);

export default mongoose.model('Informe', informeSchema);
