/**
 * Maquina de estados del flujo LABFICAT (Fase 2A).
 *
 * Cada mapa define, para un estado actual, los estados a los que se puede
 * transicionar. La validacion es pura (no toca la base de datos) para poder
 * probarla de forma unitaria y reutilizarla desde los servicios.
 *
 * Reglas de negocio acordadas:
 *  - Cliente interno: no pasa por pago; va de Aceptada a En analisis.
 *  - Cliente externo: Aceptada -> Pago pendiente -> Pago aprobado -> En analisis.
 *  - Cotizacion rechazada: la solicitud pasa a Desistida.
 *  - Pago rechazado: el cliente puede reenviar y vuelve a Pago pendiente.
 *  - La solicitud pasa a Finalizada cuando se envia el informe.
 *  - Cerrada es un cierre administrativo posterior.
 */
import {
  ESTADO_SOLICITUD,
  ESTADO_COTIZACION,
  ESTADO_CUPON,
  ESTADO_SOPORTE_PAGO,
  ESTADO_ORDEN,
} from './constants.js';

const TRANSICIONES_SOLICITUD = {
  [ESTADO_SOLICITUD.REGISTRADA]: [
    ESTADO_SOLICITUD.COTIZADA,
    ESTADO_SOLICITUD.DESISTIDA,
  ],
  [ESTADO_SOLICITUD.COTIZADA]: [
    ESTADO_SOLICITUD.ACEPTADA,
    ESTADO_SOLICITUD.DESISTIDA,
  ],
  [ESTADO_SOLICITUD.ACEPTADA]: [
    ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION,
    ESTADO_SOLICITUD.EN_ANALISIS,
    ESTADO_SOLICITUD.DESISTIDA,
  ],
  [ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION]: [
    ESTADO_SOLICITUD.PAGO_APROBADO,
    ESTADO_SOLICITUD.PAGO_RECHAZADO,
  ],
  [ESTADO_SOLICITUD.PAGO_RECHAZADO]: [
    ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION,
    ESTADO_SOLICITUD.DESISTIDA,
  ],
  [ESTADO_SOLICITUD.PAGO_APROBADO]: [
    ESTADO_SOLICITUD.EN_ANALISIS,
  ],
  [ESTADO_SOLICITUD.EN_ANALISIS]: [
    ESTADO_SOLICITUD.INFORME_LISTO,
    ESTADO_SOLICITUD.DESISTIDA,
  ],
  [ESTADO_SOLICITUD.INFORME_LISTO]: [
    ESTADO_SOLICITUD.FINALIZADA,
  ],
  [ESTADO_SOLICITUD.FINALIZADA]: [
    ESTADO_SOLICITUD.CERRADA,
  ],
  [ESTADO_SOLICITUD.DESISTIDA]: [],
  [ESTADO_SOLICITUD.CERRADA]: [],
};

const ESTADOS_TERMINALES_SOLICITUD = [
  ESTADO_SOLICITUD.DESISTIDA,
  ESTADO_SOLICITUD.CERRADA,
];

const TRANSICIONES_COTIZACION = {
  [ESTADO_COTIZACION.PENDIENTE]: [
    ESTADO_COTIZACION.ACEPTADA,
    ESTADO_COTIZACION.RECHAZADA,
  ],
  [ESTADO_COTIZACION.ACEPTADA]: [],
  [ESTADO_COTIZACION.RECHAZADA]: [],
};

const TRANSICIONES_CUPON = {
  [ESTADO_CUPON.PENDIENTE]: [ESTADO_CUPON.GENERADO],
  [ESTADO_CUPON.GENERADO]: [
    ESTADO_CUPON.UTILIZADO,
    ESTADO_CUPON.VENCIDO,
  ],
  [ESTADO_CUPON.UTILIZADO]: [],
  [ESTADO_CUPON.VENCIDO]: [],
};

const TRANSICIONES_SOPORTE_PAGO = {
  [ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION]: [
    ESTADO_SOPORTE_PAGO.APROBADO,
    ESTADO_SOPORTE_PAGO.RECHAZADO,
  ],
  [ESTADO_SOPORTE_PAGO.APROBADO]: [],
  [ESTADO_SOPORTE_PAGO.RECHAZADO]: [
    ESTADO_SOPORTE_PAGO.PENDIENTE_VERIFICACION,
  ],
};

const TRANSICIONES_ORDEN = {
  [ESTADO_ORDEN.PENDIENTE]: [ESTADO_ORDEN.EN_PROCESO],
  [ESTADO_ORDEN.EN_PROCESO]: [
    ESTADO_ORDEN.FINALIZADA,
    ESTADO_ORDEN.INVALIDADA,
  ],
  [ESTADO_ORDEN.FINALIZADA]: [ESTADO_ORDEN.INVALIDADA],
  [ESTADO_ORDEN.INVALIDADA]: [],
};

/**
 * Indica si un estado nuevo es alcanzable desde el estado actual.
 * @param {Record<string, string[]>} mapa
 * @param {string} estadoActual
 * @param {string} estadoNuevo
 * @returns {boolean}
 */
function puedeTransicionar(mapa, estadoActual, estadoNuevo) {
  const siguientes = mapa[estadoActual];
  return Array.isArray(siguientes) && siguientes.includes(estadoNuevo);
}

/**
 * Lista los estados alcanzables desde el estado actual.
 * @param {Record<string, string[]>} mapa
 * @param {string} estadoActual
 * @returns {string[]}
 */
function estadosSiguientes(mapa, estadoActual) {
  return mapa[estadoActual] || [];
}

function puedeTransicionarSolicitud(estadoActual, estadoNuevo) {
  return puedeTransicionar(TRANSICIONES_SOLICITUD, estadoActual, estadoNuevo);
}

function estadosSiguientesSolicitud(estadoActual) {
  return estadosSiguientes(TRANSICIONES_SOLICITUD, estadoActual);
}

function esEstadoTerminalSolicitud(estado) {
  return ESTADOS_TERMINALES_SOLICITUD.includes(estado);
}

function puedeTransicionarCotizacion(estadoActual, estadoNuevo) {
  return puedeTransicionar(TRANSICIONES_COTIZACION, estadoActual, estadoNuevo);
}

function puedeTransicionarCupon(estadoActual, estadoNuevo) {
  return puedeTransicionar(TRANSICIONES_CUPON, estadoActual, estadoNuevo);
}

function puedeTransicionarSoportePago(estadoActual, estadoNuevo) {
  return puedeTransicionar(TRANSICIONES_SOPORTE_PAGO, estadoActual, estadoNuevo);
}

function puedeTransicionarOrden(estadoActual, estadoNuevo) {
  return puedeTransicionar(TRANSICIONES_ORDEN, estadoActual, estadoNuevo);
}

export {
  TRANSICIONES_SOLICITUD,
  TRANSICIONES_COTIZACION,
  TRANSICIONES_CUPON,
  TRANSICIONES_SOPORTE_PAGO,
  TRANSICIONES_ORDEN,
  ESTADOS_TERMINALES_SOLICITUD,
  puedeTransicionar,
  estadosSiguientes,
  puedeTransicionarSolicitud,
  estadosSiguientesSolicitud,
  esEstadoTerminalSolicitud,
  puedeTransicionarCotizacion,
  puedeTransicionarCupon,
  puedeTransicionarSoportePago,
  puedeTransicionarOrden,
};

export default {
  TRANSICIONES_SOLICITUD,
  TRANSICIONES_COTIZACION,
  TRANSICIONES_CUPON,
  TRANSICIONES_SOPORTE_PAGO,
  TRANSICIONES_ORDEN,
  ESTADOS_TERMINALES_SOLICITUD,
  puedeTransicionar,
  estadosSiguientes,
  puedeTransicionarSolicitud,
  estadosSiguientesSolicitud,
  esEstadoTerminalSolicitud,
  puedeTransicionarCotizacion,
  puedeTransicionarCupon,
  puedeTransicionarSoportePago,
  puedeTransicionarOrden,
};
