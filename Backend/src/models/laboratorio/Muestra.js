/**
 * Modelo Mongoose: Muestra (dominio: laboratorio).
 *
 * Registro de ingreso de una muestra al laboratorio (RF-09, RF-10, RF-22).
 * Es la unidad que se rastrea, rotula, analiza y prioriza.
 *
 * Decisiones:
 *  - codigo_muestra: LAB-AAAA-NNNN, autogenerado (consecutivo anual). En modo
 *    manual el operador lo provee y se valida el formato.
 *  - Indice unico PARCIAL sobre "solicitud" cuando estado_recepcion = ACEPTADA:
 *    replica la columna calculada id_solicitud_aceptada del modelo SQL
 *    (una sola muestra aceptada por solicitud).
 *  - numero_envases NO es unico (el numero_envases_UNIQUE del SQL era un error).
 *  - prioridad: entero 1-10 (los RF definen Alta=1, Media=3, Baja=5).
 */
import mongoose from 'mongoose';
import { ESTADO_RECEPCION_MUESTRA, LIMITES } from '../../config/constants.js';

const UNIDADES_MEDIDA = ['ml', 'gr'];
const ESTADOS_RECEPCION = Object.values(ESTADO_RECEPCION_MUESTRA);
const REGEX_CODIGO = /^LAB-\d{4}-\d{4}$/;

const muestraSchema = new mongoose.Schema(
  {
    codigo_muestra: {
      type: String,
      unique: true,
      trim: true,
      match: [REGEX_CODIGO, 'El codigo de muestra debe tener el formato LAB-AAAA-NNNN'],
    },

    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
    },
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

    cantidad_recibida: { type: Number, default: LIMITES.CANTIDAD_MINIMA_MUESTRA, min: 0 },
    unidad_medida: { type: String, required: true, enum: UNIDADES_MEDIDA },
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

// Una sola muestra ACEPTADA por solicitud (equivale a id_solicitud_aceptada UNIQUE).
muestraSchema.index(
  { solicitud: 1 },
  { unique: true, partialFilterExpression: { estado_recepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA } }
);

// Cola de trabajo: orden por prioridad y llegada.
muestraSchema.index({ prioridad: 1, fecha_recepcion: 1 });

/**
 * Genera el codigo LAB-AAAA-NNNN (consecutivo anual) si no viene asignado.
 */
muestraSchema.pre('validate', async function () {
  if (this.codigo_muestra) return;

  const anio = new Date().getFullYear();
  const prefijo = `LAB-${anio}-`;

  const ultima = await this.constructor
    .findOne({ codigo_muestra: new RegExp(`^${prefijo}`) })
    .sort({ codigo_muestra: -1 })
    .select('codigo_muestra')
    .lean();

  const consecutivo = ultima ? parseInt(ultima.codigo_muestra.slice(-4), 10) + 1 : 1;
  this.codigo_muestra = `${prefijo}${String(consecutivo).padStart(4, '0')}`;
  if (!this.fecha_asignacion_codigo) this.fecha_asignacion_codigo = new Date();
});

export default mongoose.model('Muestra', muestraSchema);
