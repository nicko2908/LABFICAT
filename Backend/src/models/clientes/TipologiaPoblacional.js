/**
 * Modelo Mongoose: TipologiaPoblacional (dominio: clientes).
 *
 * Catalogo administrable de categorias de auto-reconocimiento poblacional
 * (RF-01 / RF-21). El cliente selecciona UNA tipologia desde un desplegable.
 *
 * Decisiones:
 *  - Sin campo "orden": las listas se consultan ordenadas alfabeticamente.
 *  - Nunca se eliminan registros: se desactivan con "activo" (RF-21).
 *  - Unicidad INSENSIBLE a mayusculas/minusculas (collation es, strength 2),
 *    para evitar "Indigena" y "indigena" como dos registros distintos.
 *  - codigo: identificador estable para reglas de negocio. No se usa el
 *    nombre visible porque el coordinador puede editarlo.
 *  - es_interno: define el tipo de cliente. Las tipologias marcadas como
 *    internas (Aprendices SENA, CampeSENA, Comunidad SENA y Cooperativas de
 *    Aprendices) liquidan al 0 %; el resto son clientes externos.
 */
import mongoose from 'mongoose';

// Collation: ignora mayusculas/minusculas; respeta las tildes.
const COLACION_ES = { locale: 'es', strength: 2 };

const tipologiaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    codigo: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      maxlength: 30,
    },
    descripcion: { type: String, trim: true, maxlength: 200, default: null },
    es_interno: { type: Boolean, default: false },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, collation: COLACION_ES }
);

// Indice unico case-insensitive.
tipologiaSchema.index({ nombre: 1 }, { unique: true, collation: COLACION_ES });

/**
 * Lista las tipologias activas ordenadas alfabeticamente (para el desplegable de RF-01).
 */
tipologiaSchema.statics.listarActivas = function () {
  return this.find({ activo: true }).sort({ nombre: 1 });
};

export default mongoose.model('TipologiaPoblacional', tipologiaSchema);
