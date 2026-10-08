/**
 * Modelo Mongoose: CuponPago (dominio: servicios).
 *
 * Cupon de pago que Produccion de Centro emite para clientes EXTERNOS (RF-06).
 * El coordinador lo solicita; el cliente lo paga en un plazo maximo.
 *
 * Decisiones:
 *  - Solo aplica a usuarios externos y es de UNICO USO (reglas del service).
 *  - Vigencia FIJA de 5 dias desde la generacion (la establece Produccion de Centro);
 *    la constante es LIMITES.CUPON_VIGENCIA_DIAS.
 *  - codigo_cupon: referencia de Produccion de Centro/Bancolombia. Unico cuando
 *    tiene valor (varios null no colisionan). NO es la PK (la PK es _id).
 *  - recordatorios: subdocumentos (ex-tabla recordatorio_cupon), RF-24.
 *  - fecha_solicitud = timestamps.createdAt.
 */
const mongoose = require('mongoose');
const {
  ESTADO_CUPON,
  ESTADO_CUPON_LISTA,
  LIMITES,
} = require('../../config/constants');

const recordatorioSchema = new mongoose.Schema(
  { fecha_envio: { type: Date, default: Date.now } },
  { _id: false }
);

const cuponPagoSchema = new mongoose.Schema(
  {
    cotizacion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cotizacion',
      required: true,
      index: true,
    },
    solicitado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },

    codigo_cupon: { type: String, trim: true, maxlength: 45, default: null },
    valor: { type: Number, required: true, min: 0 },

    estado: {
      type: String,
      required: true,
      enum: ESTADO_CUPON_LISTA,
      default: ESTADO_CUPON.PENDIENTE,
      index: true,
    },

    fecha_generacion: { type: Date, default: null },
    fecha_vencimiento: { type: Date, default: null },

    recordatorios: { type: [recordatorioSchema], default: [] },
  },
  { timestamps: { createdAt: 'fecha_solicitud', updatedAt: true } }
);

// Codigo unico solo cuando tiene valor real (string).
cuponPagoSchema.index(
  { codigo_cupon: 1 },
  { unique: true, partialFilterExpression: { codigo_cupon: { $type: 'string' } } }
);

// Vigencia fija: al fijar fecha_generacion se calcula fecha_vencimiento (+5 dias).
cuponPagoSchema.pre('validate', function () {
  if (this.fecha_generacion && !this.fecha_vencimiento) {
    const vencimiento = new Date(this.fecha_generacion);
    vencimiento.setDate(vencimiento.getDate() + LIMITES.CUPON_VIGENCIA_DIAS);
    this.fecha_vencimiento = vencimiento;
  }
});

module.exports = mongoose.model('CuponPago', cuponPagoSchema);
