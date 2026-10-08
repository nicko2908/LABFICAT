/**
 * Modelo Mongoose: SoportePago (dominio: servicios).
 *
 * Comprobante de pago que el cliente externo carga para un cupon (RF-07) y que
 * el coordinador valida (RF-08).
 *
 * Decisiones:
 *  - Relacion 1:1 con el cupon (un solo soporte por cupon). Si se rechaza y el
 *    cliente reenvia, se ACTUALIZA el mismo documento.
 *  - ruta_archivo apunta a storage/soportes-pago (solo se guarda la ruta).
 *  - validador: usuario coordinador que aprueba/rechaza; null mientras no se valide.
 *  - fecha_carga = timestamps.createdAt.
 */
const mongoose = require('mongoose');
const {
  ESTADO_SOPORTE_PAGO,
  ESTADO_SOPORTE_PAGO_LISTA,
  FORMATOS_SOPORTE,
} = require('../../config/constants');

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

    ruta_archivo: { type: String, required: true, trim: true, maxlength: 255 },
    formato: { type: String, required: true, enum: FORMATOS_SOPORTE },

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

module.exports = mongoose.model('SoportePago', soportePagoSchema);
