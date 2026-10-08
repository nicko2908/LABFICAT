/**
 * Modelo Mongoose: EtapaProceso (dominio: laboratorio).
 *
 * Catalogo de etapas del proceso de laboratorio, usado en la trazabilidad
 * (seguimiento de la muestra). El campo "orden" define la secuencia oficial
 * (ver mapa de procesos LABFICAT).
 */
const mongoose = require('mongoose');

const etapaProcesoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    orden: { type: Number, required: true, unique: true, min: 1 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * Lista las etapas activas en su orden oficial.
 */
etapaProcesoSchema.statics.listarOrdenadas = function () {
  return this.find({ activo: true }).sort({ orden: 1 });
};

module.exports = mongoose.model('EtapaProceso', etapaProcesoSchema);
