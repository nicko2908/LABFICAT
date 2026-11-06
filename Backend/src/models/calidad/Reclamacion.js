/**
 * Modelo Mongoose: Reclamacion (dominio: calidad).
 *
 * Reclamacion del cliente sobre resultados o servicio (RF-18).
 *
 * Decisiones:
 *  - codigo_soporte: REC-AAAA-NNNN, autogenerado (consecutivo anual).
 *  - evidencias: subdocumentos con metadatos de R2. Cada evidencia tiene _id
 *    para poder descargarla sin depender de su posicion en el arreglo.
 *  - fecha_registro = timestamps.createdAt.
 */
import mongoose from 'mongoose';
import { ESTADO_RECLAMACION, ESTADO_RECLAMACION_LISTA } from '../../config/constants.js';
import { generarCodigoReclamacion } from '../../services/codigo.service.js';
import { archivoSchema } from '../comunes/archivo.js';

const REGEX_CODIGO = /^REC-\d{4}-\d{4}$/;

const evidenciaSchema = new mongoose.Schema(
  {
    archivo: { type: archivoSchema, required: true },
    fecha_carga: { type: Date, default: Date.now },
  },
  { _id: true }
);

const reclamacionSchema = new mongoose.Schema(
  {
    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
      index: true,
    },
    codigo_soporte: {
      type: String,
      unique: true,
      trim: true,
      match: [REGEX_CODIGO, 'El codigo de soporte debe tener el formato REC-AAAA-NNNN'],
    },
    motivo: { type: String, required: true, trim: true, maxlength: 500 },
    estado: {
      type: String,
      required: true,
      enum: ESTADO_RECLAMACION_LISTA,
      default: ESTADO_RECLAMACION.ABIERTA,
      index: true,
    },
    fecha_resolucion: { type: Date, default: null },
    evidencias: { type: [evidenciaSchema], default: [] },
  },
  { timestamps: { createdAt: 'fecha_registro', updatedAt: true } }
);

/**
 * Genera el codigo REC-AAAA-NNNN (consecutivo anual atomico) si no viene
 * asignado.
 */
reclamacionSchema.pre('validate', async function () {
  if (this.codigo_soporte) return;
  this.codigo_soporte = await generarCodigoReclamacion({ session: this.$session() });
});

export default mongoose.model('Reclamacion', reclamacionSchema);
