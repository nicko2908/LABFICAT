/**
 * Modelo Mongoose: Rotulo (dominio: laboratorio).
 *
 * Etiqueta PDF de identificacion de una muestra (RF-11). Relacion 1:1 con Muestra.
 *
 * Decisiones:
 *  - analisis: lista de referencias (reemplaza la tabla rotulo_parametro).
 *    El rotulo se arma con los analisis solicitados de la muestra.
 *  - ruta_pdf apunta a storage/rotulos (solo la ruta).
 *  - fecha_generacion = timestamps.createdAt.
 */
import mongoose from 'mongoose';

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
    analisis: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Analisis' }],
  },
  { timestamps: { createdAt: 'fecha_generacion', updatedAt: true } }
);

export default mongoose.model('Rotulo', rotuloSchema);
