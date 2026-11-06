/**
 * Subdocumento reutilizable para archivos almacenados en R2.
 *
 * No es un modelo: se embebe en Cotizacion.firma, Reclamacion.evidencias[],
 * Informe.archivo_pdf y Rotulo.archivo_pdf.
 */
import mongoose from 'mongoose';

const archivoSchema = new mongoose.Schema(
  {
    proveedor: {
      type: String,
      enum: ['r2'],
      default: 'r2',
    },
    bucket: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    content_type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    bytes: {
      type: Number,
      default: null,
      min: 0,
    },
    hash: {
      type: String,
      trim: true,
      default: null,
      maxlength: 128,
    },
    nombre_original: {
      type: String,
      trim: true,
      default: null,
      maxlength: 255,
    },
  },
  { _id: false }
);

export { archivoSchema };
export default archivoSchema;
