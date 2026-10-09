/**
 * Punto unico de acceso a los modelos.
 * Registrar aqui cada modelo a medida que se implementa,
 * para que populate() y el resto del codigo los encuentren.
 */
// Seguridad
import Rol from './seguridad/Rol.js';
import Usuario from './seguridad/Usuario.js';

// Clientes
import TipologiaPoblacional from './clientes/TipologiaPoblacional.js';
import Cliente from './clientes/Cliente.js';

// Laboratorio
import TipoMuestra from './laboratorio/TipoMuestra.js';
import Parametro from './laboratorio/Parametro.js';
import EtapaProceso from './laboratorio/EtapaProceso.js';
import Analisis from './laboratorio/Analisis.js';
import Muestra from './laboratorio/Muestra.js';
import Rotulo from './laboratorio/Rotulo.js';
import SeguimientoMuestra from './laboratorio/SeguimientoMuestra.js';
import HistorialPrioridad from './laboratorio/HistorialPrioridad.js';

// Servicios
import Solicitud from './servicios/Solicitud.js';
import HistorialEstadoSolicitud from './servicios/HistorialEstadoSolicitud.js';
import Cotizacion from './servicios/Cotizacion.js';
import CuponPago from './servicios/CuponPago.js';
import SoportePago from './servicios/SoportePago.js';

// Sistema
import ConfiguracionSistema from './sistema/ConfiguracionSistema.js';

export {
  Rol,
  Usuario,
  TipologiaPoblacional,
  Cliente,
  TipoMuestra,
  Parametro,
  EtapaProceso,
  Analisis,
  Muestra,
  Rotulo,
  SeguimientoMuestra,
  HistorialPrioridad,
  Solicitud,
  HistorialEstadoSolicitud,
  Cotizacion,
  CuponPago,
  SoportePago,
  ConfiguracionSistema,
};
