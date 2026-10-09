/**
 * Modelo Mongoose: ConfiguracionSistema (dominio: sistema).
 *
 * Parametrizacion clave/valor editable por el coordinador (RF-24).
 * Opcion A: "Produccion de Centro" se guarda aqui como DESTINATARIO
 * configurable de correos (no es un usuario ni un rol del sistema).
 *
 * Ejemplos de claves (ver config/constants.js -> CONFIGURACION_CLAVES):
 *  - PRODUCCION_CENTRO_EMAIL
 *  - PRODUCCION_CENTRO_NOMBRE
 *  - CUPON_VIGENCIA_DIAS
 *  - CUPON_UMBRAL_RECORDATORIO_DIAS
 *  - TOKEN_RECUPERACION_MINUTOS
 */
const mongoose = require('mongoose');

const configuracionSchema = new mongoose.Schema(
  {
    clave: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 60,
    },
    valor: { type: String, required: true, trim: true, maxlength: 200 },
    descripcion: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ConfiguracionSistema', configuracionSchema);
