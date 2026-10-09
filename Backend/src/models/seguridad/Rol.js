/**
 * Modelo Mongoose: Rol (dominio: seguridad).
 *
 * Un rol define QUE PUEDE HACER un usuario (RF-27 + RNF-01).
 * Los permisos van EMBEBIDOS: se leen siempre junto al rol al autenticar,
 * por lo que una sola consulta basta (regla "lo que se lee junto, se guarda junto").
 *
 * Decisiones:
 *  - nombre: enum cerrado (cliente | analista | coordinador).
 *  - permisos: array de subdocumentos sin _id propio.
 *  - activo: los roles nunca se eliminan, solo se desactivan.
 */
import mongoose from 'mongoose';
import { ROLES_LISTA, PERMISOS } from '../../config/constants.js';

const permisoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      enum: Object.values(PERMISOS), // solo codigos validos, evita typos
      trim: true,
    },
    modulos: [{ type: String, trim: true }],
    activo: { type: Boolean, default: true },
  },
  { _id: false }
);

const rolSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      unique: true,
      enum: ROLES_LISTA,
      lowercase: true,
      trim: true,
      maxlength: 30,
    },
    descripcion: { type: String, trim: true, maxlength: 100 },
    permisos: { type: [permisoSchema], default: [] },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Rol', rolSchema);
