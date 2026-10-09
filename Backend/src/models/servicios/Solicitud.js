/**
 * Modelo Mongoose: Solicitud (dominio: servicios).
 *
 * Solicitud de servicio que un Cliente hace al laboratorio (RF-01, RF-03, RF-04, RF-05).
 * Es la raiz del flujo: solicitud -> cotizacion -> pago -> muestra -> informe.
 *
 * Decisiones:
 *  - estado: enum (ESTADO_SOLICITUD_LISTA); el historial guarda cada transicion.
 *  - analisis: relacion M:N embebida como array de referencias
 *    (reemplaza la tabla puente solicitud_analisis).
 *  - codigo_solicitud: SOL-AAAA-NNNN, generado automaticamente (consecutivo anual),
 *    igual que el codigo de muestra del modelo original.
 *  - SIN campo "tipo_solicitud": RF-20 filtra por los analisis de la solicitud.
 */
import mongoose from 'mongoose';
import { ESTADO_SOLICITUD, ESTADO_SOLICITUD_LISTA } from '../../config/constants.js';

const REGEX_CODIGO = /^SOL-\d{4}-\d{4}$/;

const solicitudSchema = new mongoose.Schema(
  {
    codigo_solicitud: {
      type: String,
      unique: true,
      trim: true,
      match: [REGEX_CODIGO, 'El codigo de solicitud debe tener el formato SOL-AAAA-NNNN'],
    },

    cliente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true,
      index: true,
    },

    estado: {
      type: String,
      required: true,
      enum: ESTADO_SOLICITUD_LISTA,
      default: ESTADO_SOLICITUD.REGISTRADA,
      index: true,
    },

    descripcion_inicial: { type: String, trim: true, maxlength: 200, default: null },

    // Analisis solicitados (ex-tabla solicitud_analisis).
    analisis: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Analisis' }],

    fecha_cierre: { type: Date, default: null },
    motivo_desistimiento: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true } // createdAt (~fecha_creacion), updatedAt
);

/**
 * Genera el consecutivo anual SOL-AAAA-NNNN antes de validar, si no viene asignado.
 * (Equivale al trigger trg_muestra_codigo_automatico del modelo SQL.)
 */
solicitudSchema.pre('validate', async function () {
  if (this.codigo_solicitud) return;

  const anio = new Date().getFullYear();
  const prefijo = `SOL-${anio}-`;

  const ultima = await this.constructor
    .findOne({ codigo_solicitud: new RegExp(`^${prefijo}`) })
    .sort({ codigo_solicitud: -1 })
    .select('codigo_solicitud')
    .lean();

  const consecutivo = ultima ? parseInt(ultima.codigo_solicitud.slice(-4), 10) + 1 : 1;
  this.codigo_solicitud = `${prefijo}${String(consecutivo).padStart(4, '0')}`;
});

export default mongoose.model('Solicitud', solicitudSchema);
