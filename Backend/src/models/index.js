/**
 * Punto unico de acceso a los modelos.
 * Registrar aqui cada modelo a medida que se implementa,
 * para que populate() y el resto del codigo los encuentren.
 */
// Seguridad
import Rol from './seguridad/Rol.js';
import Usuario from './seguridad/Usuario.js';
import Auditoria from './seguridad/Auditoria.js';
import TokenRecuperacion from './seguridad/TokenRecuperacion.js';

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
import OrdenAnalisis from './laboratorio/OrdenAnalisis.js';
import ValidacionResultado from './laboratorio/ValidacionResultado.js';

// Servicios
import Solicitud from './servicios/Solicitud.js';
import HistorialEstadoSolicitud from './servicios/HistorialEstadoSolicitud.js';
import Cotizacion from './servicios/Cotizacion.js';
import CuponPago from './servicios/CuponPago.js';
import SoportePago from './servicios/SoportePago.js';

// Calidad
import Informe from './calidad/Informe.js';
import Encuesta from './calidad/Encuesta.js';
import Reclamacion from './calidad/Reclamacion.js';

// Sistema
import ConfiguracionSistema from './sistema/ConfiguracionSistema.js';

export {
  Rol,
  Usuario,
  Auditoria,
  TokenRecuperacion,
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
  OrdenAnalisis,
  ValidacionResultado,
  Solicitud,
  HistorialEstadoSolicitud,
  Cotizacion,
  CuponPago,
  SoportePago,
  Informe,
  Encuesta,
  Reclamacion,
  ConfiguracionSistema,
};
