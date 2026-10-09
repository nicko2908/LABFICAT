/**
 * Modelo Mongoose: Analisis (dominio: laboratorio).
 *
 * Catalogo de analisis ofrecidos por el laboratorio (RF-25).
 * Referenciado por Solicitud, Cotizacion, OrdenAnalisis y Rotulo.
 *
 * Decisiones:
 *  - tarifa_externo: precio para clientes externos. La tarifa interna es 0
 *    (regla del servicio, RF-25), por eso NO se almacena.
 *  - cantidad_minima + unidad_cantidad: minimo de muestra requerido (RF-09/RF-25);
 *    no existian en el modelo SQL original.
 *  - parametros / tipos_muestra: relaciones M:N embebidas como arrays de
 *    referencias (reemplazan las tablas analisis_parametro y analisis_tipo_muestra).
 *  - Nunca se elimina: se desactiva con "activo" (RF-25).
 */
import mongoose from 'mongoose';
import { LIMITES } from '../../config/constants.js';

const UNIDADES_CANTIDAD = ['ml', 'gr'];

const analisisSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    descripcion: { type: String, trim: true, maxlength: 200, default: null },

    tarifa_externo: { type: Number, required: true, default: 15000, min: 0 },

    cantidad_minima: { type: Number, default: LIMITES.CANTIDAD_MINIMA_MUESTRA, min: 0 },
    unidad_cantidad: { type: String, enum: UNIDADES_CANTIDAD, default: null },

    parametros: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Parametro' }],
    tipos_muestra: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TipoMuestra' }],

    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Analisis', analisisSchema);
