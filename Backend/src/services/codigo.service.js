/**
 * Service: generacion de codigos legibles.
 *
 * Formatos:
 *  - Muestra:     NNNN-AAAA           (ej. 0015-2026)
 *  - Cotizacion:  NNNN-AAAA + version (ej. 0041-2026V1)
 *  - Solicitud:   SOL-AAAA-NNNN       (se conserva el formato existente)
 *  - Reclamacion: REC-AAAA-NNNN       (se conserva el formato existente)
 *
 * Los consecutivos son anuales y se guardan en la coleccion Contador.
 */
import { siguienteConsecutivo } from './contador.service.js';

function anioActual() {
  return new Date().getFullYear();
}

function pad4(valor) {
  return String(valor).padStart(4, '0');
}

/**
 * @param {{ session?: import('mongoose').ClientSession|null, anio?: number }} [opciones]
 * @returns {Promise<string>} NNNN-AAAA
 */
async function generarCodigoMuestra({ session = null, anio = anioActual() } = {}) {
  const consecutivo = await siguienteConsecutivo(`muestra-${anio}`, session);
  return `${pad4(consecutivo)}-${anio}`;
}

/**
 * @param {{ session?: import('mongoose').ClientSession|null, anio?: number }} [opciones]
 * @returns {Promise<string>} NNNN-AAAA (sin la version)
 */
async function generarCodigoCotizacion({ session = null, anio = anioActual() } = {}) {
  const consecutivo = await siguienteConsecutivo(`cotizacion-${anio}`, session);
  return `${pad4(consecutivo)}-${anio}`;
}

/**
 * @param {{ session?: import('mongoose').ClientSession|null, anio?: number }} [opciones]
 * @returns {Promise<string>} SOL-AAAA-NNNN
 */
async function generarCodigoSolicitud({ session = null, anio = anioActual() } = {}) {
  const consecutivo = await siguienteConsecutivo(`solicitud-${anio}`, session);
  return `SOL-${anio}-${pad4(consecutivo)}`;
}

/**
 * @param {{ session?: import('mongoose').ClientSession|null, anio?: number }} [opciones]
 * @returns {Promise<string>} REC-AAAA-NNNN
 */
async function generarCodigoReclamacion({ session = null, anio = anioActual() } = {}) {
  const consecutivo = await siguienteConsecutivo(`reclamacion-${anio}`, session);
  return `REC-${anio}-${pad4(consecutivo)}`;
}

function codigoCompletoCotizacion(codigoCotizacion, version) {
  return `${codigoCotizacion}V${version}`;
}

export {
  generarCodigoMuestra,
  generarCodigoCotizacion,
  generarCodigoSolicitud,
  generarCodigoReclamacion,
  codigoCompletoCotizacion,
};
export default {
  generarCodigoMuestra,
  generarCodigoCotizacion,
  generarCodigoSolicitud,
  generarCodigoReclamacion,
  codigoCompletoCotizacion,
};
