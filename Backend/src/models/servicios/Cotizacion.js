/**
 * Modelo Mongoose: Cotizacion (dominio: servicios).
 *
 * Documento de cotizacion de una solicitud (RF-04 / RF-05). Una solicitud
 * puede tener VARIAS versiones (V1, V2...) y cada version puede tener varios
 * items; cada item agrupa los ensayos de una muestra.
 *
 * Decisiones:
 *  - codigo_cotizacion: NNNN-AAAA (ej. 0041-2026), consecutivo anual atomico.
 *    La version se guarda aparte y el codigo visible es NNNN-AAAAV#.
 *  - items[]: { numero, descripcion_muestra, detalle[{ analisis, cantidad,
 *    tarifa_aplicada }] }. Es la fuente de verdad del detalle.
 *  - detalle[]: se conserva como espejo plano de items[].detalle para no
 *    romper clientes/pruebas de la Fase 2A. Queda marcado como deprecado.
 *  - cliente_snapshot: congela los datos del cliente al emitir la cotizacion
 *    (la plantilla Excel los imprime aunque el cliente cambie despues).
 *  - Indices: (solicitud, version) y (codigo_cotizacion, version) unicos.
 *    El indice legado solicitud_1 debe eliminarse en la migracion 003.
 *  - firma digital (RF-05): PNG en Supabase, fecha/hora e IP.
 */
import mongoose from 'mongoose';
import { ESTADO_COTIZACION, ESTADO_COTIZACION_LISTA } from '../../config/constants.js';
import { generarCodigoCotizacion } from '../../services/codigo.service.js';

const detalleItemSchema = new mongoose.Schema(
  {
    analisis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analisis', required: true },
    cantidad: { type: Number, default: 1, min: 0 },
    tarifa_aplicada: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true, min: 1 },
    descripcion_muestra: { type: String, trim: true, maxlength: 200, default: null },
    detalle: { type: [detalleItemSchema], default: [] },
  },
  { _id: false }
);

const clienteSnapshotSchema = new mongoose.Schema(
  {
    nombre: { type: String, trim: true, default: null },
    nit: { type: String, trim: true, default: null },
    direccion: { type: String, trim: true, default: null },
    ciudad: { type: String, trim: true, default: null },
    departamento: { type: String, trim: true, default: null },
    telefono: { type: String, trim: true, default: null },
    correo: { type: String, trim: true, default: null },
    tipologia: { type: String, trim: true, default: null },
    persona_contacto: { type: String, trim: true, default: null },
    cargo: { type: String, trim: true, default: null },
    tipo_cliente: { type: String, enum: ['INTERNO', 'EXTERNO'], default: null },
  },
  { _id: false }
);

const cotizacionSchema = new mongoose.Schema(
  {
    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
      index: true,
    },

    codigo_cotizacion: { type: String, trim: true },
    version: { type: Number, default: 1, min: 1 },

    valor_total: { type: Number, required: true, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },

    estado: {
      type: String,
      required: true,
      enum: ESTADO_COTIZACION_LISTA,
      default: ESTADO_COTIZACION.PENDIENTE,
      index: true,
    },

    items: { type: [itemSchema], default: [] },

    // Espejo plano de items[].detalle. Deprecado: no agregar logica nueva.
    detalle: { type: [detalleItemSchema], default: [] },

    cliente_snapshot: { type: clienteSnapshotSchema, default: () => ({}) },

    observaciones_propuesta: { type: String, trim: true, maxlength: 1000, default: null },
    fecha_validez: { type: Date, default: null },

    fecha_decision: { type: Date, default: null },
    motivo_rechazo: { type: String, trim: true, maxlength: 500, default: null },

    // Firma digital del cliente (RF-05) — bucket privado, respaldo legal.
    firma_ruta: { type: String, trim: true, default: null },  // objeto en bucket 'firmas'
    firma_hash: { type: String, trim: true, default: null },  // SHA-256 para integridad
    firma_fecha: { type: Date, default: null },
    firma_ip: { type: String, trim: true, maxlength: 45, default: null },
  },
  {
    timestamps: { createdAt: 'fecha_emision', updatedAt: true },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

cotizacionSchema.index({ solicitud: 1, version: 1 }, { unique: true });
cotizacionSchema.index({ codigo_cotizacion: 1, version: 1 }, { unique: true });

cotizacionSchema.virtual('codigo_completo').get(function () {
  if (!this.codigo_cotizacion) return null;
  return `${this.codigo_cotizacion}V${this.version}`;
});

/**
 * Genera el codigo base NNNN-AAAA si no viene asignado. La version no cambia
 * el codigo base: una V2 copia el codigo de la V1.
 */
cotizacionSchema.pre('validate', async function () {
  if (this.codigo_cotizacion) return;
  this.codigo_cotizacion = await generarCodigoCotizacion({ session: this.$session() });
});

export default mongoose.model('Cotizacion', cotizacionSchema);
