/**
 * Service: codigos legibles (muestra, cotizacion, solicitud, reclamacion).
 *
 * Se mantiene este archivo como fachada del servicio generico para no romper
 * imports existentes. La logica esta en services/codigo.service.js.
 */
export {
  generarCodigoMuestra,
  generarCodigoCotizacion,
  generarCodigoSolicitud,
  generarCodigoReclamacion,
  codigoCompletoCotizacion,
} from './codigo.service.js';
