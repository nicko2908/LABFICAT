/**
 * Modelo Mongoose: SeguimientoMuestra (dominio: laboratorio).
 *
 * Bitacora (append-only) del avance del analisis por etapas del proceso
 * (RF-12 y trazabilidad RF-26). Es la linea de tiempo de la muestra.
 *
 * Decisiones:
 *  - Coleccion aparte (crece); no embebida en Muestra.
 *  - fecha_hora = timestamps.createdAt; sin updatedAt (log inmutable).
 */
import mongoose from 'mongoose';

const seguimientoMuestraSchema = new mongoose.Schema(
  {
    muestra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Muestra',
      required: true,
      index: true,
    },
    etapa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EtapaProceso',
      required: true,
      index: true,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    observaciones: { type: String, trim: true, maxlength: 200, default: null },
  },
  { timestamps: { createdAt: 'fecha_hora', updatedAt: false } }
);

// Linea de tiempo de una muestra.
seguimientoMuestraSchema.index({ muestra: 1, fecha_hora: 1 });

export default mongoose.model('SeguimientoMuestra', seguimientoMuestraSchema);
