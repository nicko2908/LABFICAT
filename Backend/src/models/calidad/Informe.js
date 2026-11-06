/**
 * Modelo Mongoose: Informe (dominio: calidad).
 *
 * Informe final de resultados de una muestra (RF-15, RF-16). Relacion 1:1.
 *
 * Decisiones:
 *  - archivo_pdf guarda los metadatos del PDF en R2.
 *  - ruta_pdf se conserva como legado.
 *  - Regla del service (ex-trigger): no se puede descargar sin responder la
 *    encuesta de satisfaccion (RF-17).
 *  - fecha_generacion = timestamps.createdAt.
 */
import mongoose from 'mongoose';
import { archivoSchema } from '../comunes/archivo.js';

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
    archivo_pdf: { type: archivoSchema, default: null },
    fecha_envio: { type: Date, default: null },
    fecha_descarga: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'fecha_generacion', updatedAt: true } }
);

export default mongoose.model('Informe', informeSchema);
