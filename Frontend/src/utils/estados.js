/**
 * Catalogos de estados y transiciones del backend LABFICAT.
 * Los textos deben coincidir exactamente con config/constants.js.
 */

export const ESTADO_SOLICITUD = {
  REGISTRADA: "Registrada",
  COTIZADA: "Cotizada",
  ACEPTADA: "Aceptada",
  DESISTIDA: "Desistida",
  PAGO_PENDIENTE_VERIFICACION: "Pago pendiente de verificacion",
  PAGO_APROBADO: "Pago aprobado",
  PAGO_RECHAZADO: "Pago rechazado",
  EN_ANALISIS: "En analisis",
  INFORME_LISTO: "Informe listo",
  FINALIZADA: "Finalizada",
  CERRADA: "Cerrada",
};

export const ESTADO_COTIZACION = {
  PENDIENTE: "PENDIENTE",
  ACEPTADA: "ACEPTADA",
  RECHAZADA: "RECHAZADA",
  REEMPLAZADA: "REEMPLAZADA",
};

export const ESTADO_CUPON = {
  PENDIENTE: "PENDIENTE",
  GENERADO: "GENERADO",
  UTILIZADO: "UTILIZADO",
  VENCIDO: "VENCIDO",
};

export const ESTADO_PAGO = {
  PENDIENTE_VERIFICACION: "PENDIENTE_VERIFICACION",
  APROBADO: "APROBADO",
  RECHAZADO: "RECHAZADO",
};

export const ESTADO_ORDEN = {
  PENDIENTE: "PENDIENTE",
  EN_PROCESO: "EN_PROCESO",
  FINALIZADA: "FINALIZADA",
  INVALIDADA: "INVALIDADA",
};

export const ESTADO_RECEPCION = {
  ACEPTADA: "ACEPTADA",
  RECHAZADA: "RECHAZADA",
};

export const ESTADO_RECLAMACION = {
  ABIERTA: "ABIERTA",
  RESUELTA: "RESUELTA",
};

export const ESTADOS = {
  solicitud: ESTADO_SOLICITUD,
  cotizacion: ESTADO_COTIZACION,
  cupon: ESTADO_CUPON,
  pago: ESTADO_PAGO,
  orden: ESTADO_ORDEN,
  recepcion: ESTADO_RECEPCION,
  reclamacion: ESTADO_RECLAMACION,
};

const COLORES = {
  Registrada: "grey-7",
  Cotizada: "warning",
  Aceptada: "positive",
  Desistida: "negative",
  "Pago pendiente de verificacion": "warning",
  "Pago aprobado": "positive",
  "Pago rechazado": "negative",
  "En analisis": "info",
  "Informe listo": "accent",
  Finalizada: "positive",
  Cerrada: "grey-8",
  PENDIENTE: "warning",
  GENERADO: "info",
  UTILIZADO: "positive",
  VENCIDO: "grey-7",
  PENDIENTE_VERIFICACION: "warning",
  APROBADO: "positive",
  RECHAZADO: "negative",
  EN_PROCESO: "info",
  FINALIZADA: "positive",
  INVALIDADA: "negative",
  ACEPTADA: "positive",
  RECHAZADA: "negative",
  ABIERTA: "warning",
  RESUELTA: "positive",
};

export function colorEstado(estado) {
  return COLORES[estado] || "grey-6";
}

export function etiquetaEstado(estado) {
  if (!estado) return "-";
  return String(estado).replaceAll("_", " ");
}

export const TRANSICIONES_SOLICITUD = {
  [ESTADO_SOLICITUD.REGISTRADA]: [ESTADO_SOLICITUD.COTIZADA, ESTADO_SOLICITUD.DESISTIDA],
  [ESTADO_SOLICITUD.COTIZADA]: [ESTADO_SOLICITUD.ACEPTADA, ESTADO_SOLICITUD.DESISTIDA],
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
  [ESTADO_SOLICITUD.PAGO_APROBADO]: [ESTADO_SOLICITUD.EN_ANALISIS],
  [ESTADO_SOLICITUD.EN_ANALISIS]: [
    ESTADO_SOLICITUD.INFORME_LISTO,
    ESTADO_SOLICITUD.DESISTIDA,
  ],
  [ESTADO_SOLICITUD.INFORME_LISTO]: [ESTADO_SOLICITUD.FINALIZADA],
  [ESTADO_SOLICITUD.FINALIZADA]: [ESTADO_SOLICITUD.CERRADA],
  [ESTADO_SOLICITUD.DESISTIDA]: [],
  [ESTADO_SOLICITUD.CERRADA]: [],
};

export const TRANSICIONES_ORDEN = {
  [ESTADO_ORDEN.PENDIENTE]: [ESTADO_ORDEN.EN_PROCESO],
  [ESTADO_ORDEN.EN_PROCESO]: [ESTADO_ORDEN.FINALIZADA, ESTADO_ORDEN.INVALIDADA],
  [ESTADO_ORDEN.FINALIZADA]: [ESTADO_ORDEN.INVALIDADA],
  [ESTADO_ORDEN.INVALIDADA]: [],
};

export const OBSERVACIONES_RECEPCION = [
  "Recipientes de recolección inadecuados.",
  "Envase roto, abierto o agujereado.",
  "Evidencias visibles de microrganismos.",
  "Evidencias de fermentación.",
  "Cantidad de muestra sea insuficiente.",
  "Falta de información o incongruencias en la identificación de los recipientes.",
  "Otro (explique la situación presentada):",
];

export const TIPOS_DOCUMENTO = [
  { label: "Cedula de ciudadania", value: "CC" },
  { label: "Cedula de extranjeria", value: "CE" },
  { label: "NIT", value: "NIT" },
  { label: "Pasaporte", value: "PP" },
  { label: "Tarjeta de identidad", value: "TI" },
  { label: "Registro civil", value: "RC" },
];

export const TIPOS_CLIENTE = {
  INTERNO: "INTERNO",
  EXTERNO: "EXTERNO",
};

export const PRIORIDADES = [
  { label: "Alta", value: 1 },
  { label: "Media", value: 3 },
  { label: "Baja", value: 5 },
];

export function transicionesSolicitud(estado) {
  return TRANSICIONES_SOLICITUD[estado] || [];
}

export function transicionesOrden(estado) {
  return TRANSICIONES_ORDEN[estado] || [];
}
