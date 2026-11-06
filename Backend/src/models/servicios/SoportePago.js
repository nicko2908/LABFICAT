/**
 * Modelo Mongoose: SoportePago (dominio: servicios).
 *
 * Registro del pago que el cliente externo reporta para un cupon (RF-07) y que
 * el coordinador valida (RF-08).
 *
 * Decisiones:
 *  - El comprobante NO se almacena en el sistema: Produccion de Centro lo
 *    gestiona por un proceso externo. Solo se guarda una referencia opcional.
 *  - Relacion 1:1 con el cupon (un solo soporte por cupon). Si se rechaza y el
 *    cliente reenvia, se ACTUALIZA el mismo documento.
 *  - validador: usuario coordinador que aprueba/rechaza; null mientras no se valide.
 *  - fecha_carga = timestamps.createdAt.
 */
import mongoose from 'mongoose';
import {
  ESTADO_SOPORTE_PAGO,
  ESTADO_SOPORTE_PAGO_LISTA,
} from '../../config/constants.js';

const soportePagoSchema = new mongoose.Schema(
  {
    cupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CuponPago',
      required: true,
      unique: true, // 1:1 con el cupon
      index: true,
    },
    validador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },

    // Referencia externa del pago (opcional). El comprobante vive en
    // Produccion de Centro, no en LABFICAT.
    referencia_externa: { type: String, trim: true, maxlength: 100, default: null },

    estado: {
      type: String,
      required: true,
      enum: ESTADO_SOPORTE_PAGO_LISTA,
      default: ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION,
      index: true,
    },

    fecha_validacion: { type: Date, default: null },
    observaciones: { type: String, trim: true, maxlength: 200, default: null },
  },
  { timestamps: { createdAt: 'fecha_carga', updatedAt: true } }
);

export default mongoose.model('SoportePago', soportePagoSchema);
