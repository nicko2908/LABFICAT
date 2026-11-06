/**
 * Modelo Mongoose: Rotulo (dominio: laboratorio).
 *
 * Etiqueta PDF de identificacion de una muestra (RF-11). Relacion 1:1 con Muestra.
 *
 * Decisiones:
 *  - analisis: lista de referencias (reemplaza la tabla rotulo_parametro).
 *    El rotulo se arma con los analisis solicitados de la muestra.
 *  - archivo_pdf guarda los metadatos del PDF en R2.
 *  - ruta_pdf se conserva como legado.
 *  - fecha_generacion = timestamps.createdAt.
 */
import mongoose from 'mongoose';
import { archivoSchema } from '../comunes/archivo.js';

const rotuloSchema = new mongoose.Schema(
  {
    muestra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Muestra',
      required: true,
      unique: true, // 1:1 con la muestra
      index: true,
    },
    ruta_pdf: { type: String, trim: true, maxlength: 255, default: null },
    archivo_pdf: { type: archivoSchema, default: null },
    analisis: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Analisis' }],
  },
  { timestamps: { createdAt: 'fecha_generacion', updatedAt: true } }
);

export default mongoose.model('Rotulo', rotuloSchema);
