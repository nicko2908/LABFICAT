/**
 * Modelo Mongoose: Contador (dominio: sistema).
 *
 * Secuencias atomicas para codigos legibles (solicitud, cotizacion, muestra y
 * reclamacion). Se incrementa con findOneAndUpdate + $inc para evitar
 * duplicados bajo concurrencia.
 *
 * La clave incluye el ano: "muestra-2026", "cotizacion-2026", etc.
 */
import mongoose from 'mongoose';

const contadorSchema = new mongoose.Schema(
  {
    clave: { type: String, required: true, unique: true, trim: true },
    valor: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Contador', contadorSchema);
