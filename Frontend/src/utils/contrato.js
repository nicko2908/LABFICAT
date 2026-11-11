/**
 * Contrato de validacion del frontend.
 *
 * Es el espejo de `Backend/src/config/constants.js` y de las restricciones
 * declaradas en los modelos Mongoose. Si el backend cambia un limite, se
 * actualiza SOLO este archivo.
 *
 * Importante: estas reglas son para dar buena experiencia de usuario. El
 * backend sigue siendo la autoridad final; ninguna validacion del frontend
 * reemplaza la del servidor.
 *
 * Las importaciones son relativas y con extension `.js` para que el archivo
 * tambien se pueda ejecutar en Node (pruebas de las funciones puras).
 */
import { ESTADOS, TIPOS_DOCUMENTO } from "./estados.js";

// ---------------------------------------------------------------------------
// Longitudes maximas (modelos Mongoose)
// ---------------------------------------------------------------------------

export const LONGITUDES = {
  usuario: {
    nombres: 100,
    apellidos: 100,
    correo: 100,
    documentoMin: 6,
    documentoMax: 15,
  },
  cliente: {
    telefono: 10,
    razon_social: 100,
    nit: 20,
    direccion: 200,
    ciudad: 100,
    departamento: 100,
    cargo: 100,
    persona_contacto: 150,
  },
  solicitud: {
    descripcion_inicial: 200,
    motivo_desistimiento: 500,
  },
  cotizacion: {
    descripcion_muestra: 200,
    observaciones_propuesta: 1000,
    motivo_rechazo: 500,
  },
  cupon: {
    codigo_cupon: 45,
  },
  pago: {
    referencia_externa: 100,
    observaciones: 200,
  },
  muestra: {
    nombre: 100,
    descripcion: 255,
    matriz: 100,
    municipio_recoleccion: 100,
    direccion_toma: 200,
    lugar_toma: 200,
    recolectada_por: 150,
    procedimiento_muestreo: 200,
    condiciones_conservacion: 200,
    motivo_rechazo: 200,
    motivo_prioridad: 200,
    observaciones: 200,
  },
  orden: {
    proceso: 250,
    observaciones: 200,
  },
  analisis: {
    nombre: 100,
    descripcion: 200,
    unidades: 50,
    metodo: 200,
    tecnica: 200,
  },
  parametro: {
    nombre: 100,
    unidad_medida: 100,
  },
  tipoMuestra: {
    nombre: 100,
  },
  configuracion: {
    clave: 60,
    valor: 200,
    descripcion: 200,
  },
  tipologia: {
    nombre: 100,
    codigo: 30,
    descripcion: 200,
  },
  etapa: {
    nombre: 100,
  },
  reclamacion: {
    motivo: 500,
  },
  validacion: {
    motivo: 500,
  },
  encuesta: {
    comentarios: 500,
  },
  informe: {
    ruta_pdf: 255,
  },
};

// ---------------------------------------------------------------------------
// Limites y catalogos cerrados
// ---------------------------------------------------------------------------

export const LIMITES = {
  /** Termino de busqueda aceptado por `utils/regex.js` del backend. */
  busqueda: 100,
  /** RF-09: cantidad minima de muestra en gr/ml. */
  cantidadMinimaMuestra: 300,
  /** Contrasena: minimo exigido por auth.service / auditoria.service. */
  contrasenaMinima: 8,
  prioridad: { min: 1, max: 10 },
  observacionesRecepcion: { min: 1, max: 7 },
  puntajeEncuesta: { min: 1, max: 5 },
  evidencias: {
    maxArchivos: 5,
    maxMB: 5,
    mimes: ["image/png", "image/jpeg"],
    extensiones: ["png", "jpg", "jpeg"],
  },
  firma: {
    maxMB: 2,
    mime: "image/png",
    prefijo: "data:image/png;base64,",
  },
};

export const ENUMS = {
  tiposDocumento: TIPOS_DOCUMENTO.map((tipo) => tipo.value),
  unidadesMedida: ["ml", "gr"],
  tipoCliente: ["INTERNO", "EXTERNO"],
  estadosSolicitud: Object.values(ESTADOS.solicitud),
  estadosCotizacion: Object.values(ESTADOS.cotizacion),
  estadosCupon: Object.values(ESTADOS.cupon),
  estadosPago: Object.values(ESTADOS.pago),
  estadosOrden: Object.values(ESTADOS.orden),
  estadosRecepcion: Object.values(ESTADOS.recepcion),
  estadosReclamacion: Object.values(ESTADOS.reclamacion),
  decisionCotizacion: ["ACEPTADA", "RECHAZADA"],
  decisionPago: ["APROBADO", "RECHAZADO"],
  decisionValidacion: ["APROBADO", "RECHAZADO"],
};

// ---------------------------------------------------------------------------
// Campos que se normalizan (trim) antes de enviar cada payload
// ---------------------------------------------------------------------------

export const CAMPOS_TEXTO = {
  registro: [
    "nombres",
    "apellidos",
    "numero_documento",
    "correo",
    "telefono",
    "razon_social",
    "nit",
    "direccion",
    "ciudad",
    "departamento",
    "cargo",
    "persona_contacto",
  ],
  cliente: [
    "nombres",
    "apellidos",
    "numero_documento",
    "correo",
    "telefono",
    "razon_social",
    "nit",
    "direccion",
    "ciudad",
    "departamento",
    "cargo",
    "persona_contacto",
  ],
  muestra: [
    "nombre",
    "descripcion",
    "matriz",
    "municipio_recoleccion",
    "direccion_toma",
    "lugar_toma",
    "recolectada_por",
    "procedimiento_muestreo",
    "condiciones_conservacion",
    "motivo_rechazo",
    "observaciones",
  ],
  pago: ["referencia_externa", "observaciones"],
  reclamacion: ["motivo"],
  cotizacion: ["observaciones_propuesta", "descripcion_muestra"],
};

// ---------------------------------------------------------------------------
// Normalizacion de payloads
// ---------------------------------------------------------------------------

/**
 * Quita espacios al inicio/fin de los campos indicados. No toca campos que no
 * sean string (numeros, booleanos, ObjectId, archivos, contrasenas).
 *
 * @param {object} datos
 * @param {string[]} campos
 * @returns {object} copia normalizada
 */
export function normalizarCampos(datos = {}, campos = []) {
  const salida = { ...datos };

  for (const campo of campos) {
    if (typeof salida[campo] === "string") salida[campo] = salida[campo].trim();
  }

  return salida;
}

/**
 * Correo siempre en minusculas y sin espacios (el backend lo hace igual).
 * @param {unknown} valor
 * @returns {string}
 */
export function normalizarCorreo(valor) {
  return String(valor ?? "").trim().toLowerCase();
}

/**
 * Convierte un texto vacio en null. El backend usa `campo || null` en varios
 * servicios, pero enviar null explicito evita cadenas vacias en la base.
 * @param {unknown} valor
 * @returns {string|null}
 */
export function textoONull(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}
