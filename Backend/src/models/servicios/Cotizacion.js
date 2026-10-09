/**
 * Modelo Mongoose: Cotizacion (dominio: servicios).
 *
 * Documento de cotizacion de una solicitud (RF-04 / RF-05). Relacion 1:1 con
 * Solicitud: una solicitud puede tener varios analisis, pero todos entran en
 * UNA sola cotizacion.
 *
 * Decisiones:
 *  - detalle: subdocumentos (ex-tabla cotizacion_detalle), una linea por analisis
 *    con la tarifa aplicada. El valor interno es 0 (lo define el service).
 *  - firma digital (RF-05): se guarda el PNG (ruta), fecha/hora e IP.
 *  - fecha_emision = timestamps.createdAt.
 */
import mongoose from 'mongoose';
import { ESTADO_COTIZACION, ESTADO_COTIZACION_LISTA } from '../../config/constants.js';

const detalleSchema = new mongoose.Schema(
  {
    analisis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analisis', required: true },
    tarifa_aplicada: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const cotizacionSchema = new mongoose.Schema(
  {
    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
      unique: true, // 1:1 con la solicitud
      index: true,
    },

    valor_total: { type: Number, required: true, default: 0, min: 0 },

    estado: {
      type: String,
      required: true,
      enum: ESTADO_COTIZACION_LISTA,
      default: ESTADO_COTIZACION.PENDIENTE,
      index: true,
    },

    detalle: { type: [detalleSchema], default: [] },

    fecha_decision: { type: Date, default: null },
    motivo_rechazo: { type: String, trim: true, maxlength: 500, default: null },

    // Firma digital del cliente (RF-05) — bucket privado, respaldo legal.
    firma_ruta: { type: String, trim: true, default: null },  // objeto en bucket 'firmas'
    firma_hash: { type: String, trim: true, default: null },  // SHA-256 para integridad
    firma_fecha: { type: Date, default: null },
    firma_ip: { type: String, trim: true, maxlength: 45, default: null },
  },
  { timestamps: { createdAt: 'fecha_emision', updatedAt: true } }
);

export default mongoose.model('Cotizacion', cotizacionSchema);
