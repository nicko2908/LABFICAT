/**
 * Modelo Mongoose: HistorialEstadoSolicitud (dominio: servicios).
 *
 * Bitacora (append-only) de cada cambio de estado de una solicitud
 * (RF-26 trazabilidad / RNF-03 auditoria). Es la linea de tiempo que
 * consulta el cliente.
 *
 * Decisiones:
 *  - Coleccion aparte (no embebida): el log puede crecer indefinidamente.
 *  - usuario: nullable; "null" significa cambio automatico del sistema
 *    (jobs o procesos sin usuario humano).
 *  - createdAt renombrado a "fecha_hora"; sin updatedAt (log inmutable).
 */
const mongoose = require('mongoose');
const { ESTADO_SOLICITUD_LISTA } = require('../../config/constants');

const historialEstadoSolicitudSchema = new mongoose.Schema(
  {
    solicitud: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
      index: true,
    },
    estado: {
      type: String,
      required: true,
      enum: ESTADO_SOLICITUD_LISTA,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null, // null = cambio automatico del sistema
    },
    observacion: { type: String, trim: true, maxlength: 200, default: null },
  },
  { timestamps: { createdAt: 'fecha_hora', updatedAt: false } }
);

// Indice para reconstruir la linea de tiempo de una solicitud.
historialEstadoSolicitudSchema.index({ solicitud: 1, fecha_hora: 1 });

module.exports = mongoose.model('HistorialEstadoSolicitud', historialEstadoSolicitudSchema);
