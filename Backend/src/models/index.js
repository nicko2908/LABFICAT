/**
 * Punto unico de acceso a los modelos.
 * Registrar aqui cada modelo a medida que se implementa,
 * para que populate() y el resto del codigo los encuentren.
 */
// Seguridad
const Rol = require('./seguridad/Rol');
const Usuario = require('./seguridad/Usuario');

// Clientes
const TipologiaPoblacional = require('./clientes/TipologiaPoblacional');
const Cliente = require('./clientes/Cliente');

// Laboratorio (catalogos)
const TipoMuestra = require('./laboratorio/TipoMuestra');
const Parametro = require('./laboratorio/Parametro');
const EtapaProceso = require('./laboratorio/EtapaProceso');
const Analisis = require('./laboratorio/Analisis');

// Sistema
const ConfiguracionSistema = require('./sistema/ConfiguracionSistema');

module.exports = {
  Rol,
  Usuario,
  TipologiaPoblacional,
  Cliente,
  TipoMuestra,
  Parametro,
  EtapaProceso,
  Analisis,
  ConfiguracionSistema,
};
