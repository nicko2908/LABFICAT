/**
 * Modelo Mongoose: Muestra (dominio: laboratorio).
 *
 * Registro de ingreso de una muestra al laboratorio (RF-09, RF-10, RF-22).
 * Es la unidad que se rastrea, rotula, analiza y prioriza.
 *
 * Decisiones:
 *  - codigo_muestra: NNNN-AAAA (ej. 0015-2026), autogenerado con un contador
 *    atomico anual. Se acepta tambien el formato legado LAB-AAAA-NNNN.
 *  - cotizacion + cotizacion_item: una muestra corresponde a UN item de la
 *    cotizacion aceptada. El indice unico parcial (cotizacion, cotizacion_item)
 *    solo aplica a muestras ACEPTADAS, de modo que un rechazo se puede
 *    reintentar con otra muestra del mismo item.
 *  - matriz: texto libre (ej. "Cacao"); tipo_muestra es la presentacion
 *    (Pasta, Polvo, Liquido, Grano, etc.).
 *  - cantidad_recibida / unidad_medida: opcionales. El acta de recepcion no
 *    las imprime; se conservan para control interno cuando se conocen.
 *  - numero_envases NO es unico (el numero_envases_UNIQUE del SQL era un error).
 *  - prioridad: entero 1-10 (los RF definen Alta=1, Media=3, Baja=5).
 */
import mongoose from 'mongoose';
import {
  ESTADO_RECEPCION_MUESTRA,
  OBSERVACIONES_RECEPCION,
} from '../../config/constants.js';
import { generarCodigoMuestra } from '../../services/codigo.service.js';

const UNIDADES_MEDIDA = ['ml', 'gr'];
const ESTADOS_RECEPCION = Object.values(ESTADO_RECEPCION_MUESTRA);
const REGEX_CODIGO = /^(?:\d{4}-\d{4}|LAB-\d{4}-\d{4})$/;

const muestraSchema = new mongoose.Schema(
  {
    codigo_muestra: {
      type: String,
      unique: true,
      trim: true,
      match: [REGEX_CODIGO, 'El codigo de muestra debe tener el formato NNNN-AAAA'],
    },

    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
      index: true,
    },
    cotizacion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cotizacion',
      default: null,
      index: true,
    },
    cotizacion_item: { type: Number, default: 1, min: 1 },

    tipo_muestra: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TipoMuestra',
      required: true,
      index: true,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },

    fecha_asignacion_codigo: { type: Date, default: null },

    nombre: { type: String, trim: true, maxlength: 100, default: null },
    descripcion: { type: String, trim: true, maxlength: 255, default: null },

    // Matriz (Cacao, agua, suelo, etc.) y datos de recoleccion del acta.
    matriz: { type: String, trim: true, maxlength: 100, default: null },
    municipio_recoleccion: { type: String, trim: true, maxlength: 100, default: null },
    direccion_toma: { type: String, trim: true, maxlength: 200, default: null },
    lugar_toma: { type: String, trim: true, maxlength: 200, default: null },
    recolectada_por: { type: String, trim: true, maxlength: 150, default: null },
    procedimiento_muestreo: { type: String, trim: true, maxlength: 200, default: 'No Reporta' },
    fecha_hora_recoleccion: { type: Date, default: null },
    observaciones_predefinidas: {
      type: [{ type: Number, min: 1, max: OBSERVACIONES_RECEPCION.length }],
      default: [],
    },

    cantidad_recibida: { type: Number, default: null, min: 0 },
    unidad_medida: { type: String, enum: UNIDADES_MEDIDA, default: null },
    numero_envases: { type: Number, default: 1, min: 1 },
    condiciones_conservacion: { type: String, trim: true, maxlength: 200, default: null },

    estado_recepcion: { type: String, required: true, enum: ESTADOS_RECEPCION },
    motivo_rechazo: { type: String, trim: true, maxlength: 200, default: null },

    prioridad: { type: Number, default: 3, min: 1, max: 10 },
    fecha_recepcion: { type: Date, required: true },
    observaciones: { type: String, trim: true, maxlength: 200, default: null },
  },
  { timestamps: true }
);

// Una sola muestra ACEPTADA por item de cotizacion. El filtro exige que la
// muestra tenga cotizacion para no chocar con registros legados sin ella.
muestraSchema.index(
  { cotizacion: 1, cotizacion_item: 1 },
  {
    unique: true,
    partialFilterExpression: {
      estado_recepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
      cotizacion: { $type: 'objectId' },
    },
  }
);

// Cola de trabajo: orden por prioridad y llegada.
muestraSchema.index({ prioridad: 1, fecha_recepcion: 1 });

/**
 * Genera el codigo NNNN-AAAA (consecutivo anual atomico) si no viene asignado.
 * Usa la sesion de la transaccion cuando el documento se crea con una.
 */
muestraSchema.pre('validate', async function () {
  if (this.codigo_muestra) return;

  this.codigo_muestra = await generarCodigoMuestra({ session: this.$session() });
  if (!this.fecha_asignacion_codigo) this.fecha_asignacion_codigo = new Date();
});

export default mongoose.model('Muestra', muestraSchema);
