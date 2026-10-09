/**
 * Modelo Mongoose: OrdenAnalisis (dominio: laboratorio).
 *
 * Orden de trabajo de un analisis sobre una muestra (RF-12, RF-13, RF-14).
 * Registra el avance, los resultados por parametro y las repeticiones.
 *
 * Decisiones:
 *  - resultados: subdocumentos (ex-tabla resultado_parametro): parametro + valor.
 *  - orden_anterior: auto-referencia para la repeticion de analisis (RF-14),
 *    con numero_iteracion incrementandose.
 *  - timestamps incluidos (ademas de fecha_inicio/fecha_fin).
 */
import mongoose from 'mongoose';
import { ESTADO_ORDEN, ESTADO_ORDEN_LISTA } from '../../config/constants.js';

const resultadoSchema = new mongoose.Schema(
  {
    parametro: { type: mongoose.Schema.Types.ObjectId, ref: 'Parametro', required: true },
    valor: { type: Number, default: null }, // DECIMAL(14,4) en el modelo SQL
  },
  { _id: false }
);

const ordenAnalisisSchema = new mongoose.Schema(
  {
    muestra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Muestra',
      required: true,
      index: true,
    },
    analisis: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Analisis',
      required: true,
      index: true,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },

    orden_anterior: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrdenAnalisis',
      default: null,
    },
    numero_iteracion: { type: Number, default: 1, min: 1 },

    proceso: { type: String, trim: true, maxlength: 250, default: null },
    estado: {
      type: String,
      required: true,
      enum: ESTADO_ORDEN_LISTA,
      default: ESTADO_ORDEN.PENDIENTE,
      index: true,
    },

    fecha_inicio: { type: Date, default: null },
    fecha_fin: { type: Date, default: null },
    observaciones: { type: String, trim: true, maxlength: 200, default: null },

    resultados: { type: [resultadoSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('OrdenAnalisis', ordenAnalisisSchema);
