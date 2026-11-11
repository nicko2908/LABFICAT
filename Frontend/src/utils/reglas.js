/**
 * Reglas de validacion para formularios Quasar.
 *
 * Cada regla devuelve `true` (valido) o un mensaje de error. Se usan en el
 * atributo `:rules` de los componentes de Quasar y tambien dentro de las
 * funciones puras de `utils/validaciones.js`.
 *
 * Los limites salen de `utils/contrato.js`, que es el espejo del backend.
 */
import { LIMITES, LONGITUDES } from "./contrato.js";
import { validateEmail } from "./validateEmail";

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export const requerido =
  (campo = "Este campo") =>
  (v) =>
    (v !== null && v !== undefined && String(v).trim() !== "") ||
    `${campo} es obligatorio`;

/**
 * Exige el campo solo cuando la condicion es verdadera.
 * @param {boolean|(() => boolean)} condicion
 * @param {string} campo
 */
export const requeridoCuando =
  (condicion, campo = "Este campo") =>
  (v) => {
    const activa = typeof condicion === "function" ? condicion() : Boolean(condicion);
    if (!activa) return true;
    return (
      (v !== null && v !== undefined && String(v).trim() !== "") ||
      `${campo} es obligatorio`
    );
  };

export const esEmail =
  () =>
  (v) =>
    validateEmail(v) || "El correo no es valido";

export const minimo =
  (min, campo = "Este campo") =>
  (v) =>
    String(v ?? "").trim().length >= min ||
    `${campo} debe tener al menos ${min} caracteres`;

export const maximo =
  (max, campo = "Este campo") =>
  (v) =>
    String(v ?? "").trim().length <= max ||
    `${campo} no puede superar los ${max} caracteres`;

export const longitudEntre =
  (min, max, campo = "Este campo") =>
  (v) => {
    const longitud = String(v ?? "").trim().length;
    return (
      (longitud >= min && longitud <= max) ||
      `${campo} debe tener entre ${min} y ${max} caracteres`
    );
  };

export const soloNumeros =
  () =>
  (v) =>
    /^\d+$/.test(String(v ?? "").trim()) || "Solo se permiten numeros";

export const soloLetras =
  (campo = "Este campo") =>
  (v) =>
    /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/u.test(String(v ?? "").trim()) ||
    `${campo} solo admite letras, espacios y tildes`;

export const documento =
  () =>
  (v) => {
    const texto = String(v ?? "").trim();
    const { documentoMin, documentoMax } = LONGITUDES.usuario;
    const longitudValida = texto.length >= documentoMin && texto.length <= documentoMax;
    return (
      (/^\d+$/.test(texto) && longitudValida) ||
      `El documento debe tener entre ${documentoMin} y ${documentoMax} digitos`
    );
  };

export const telefono =
  () =>
  (v) => {
    if (!v) return true;
    const texto = String(v).trim();
    return (
      (/^\d+$/.test(texto) && texto.length === LONGITUDES.cliente.telefono) ||
      `El telefono debe tener ${LONGITUDES.cliente.telefono} digitos`
    );
  };

// ---------------------------------------------------------------------------
// Numeros
// ---------------------------------------------------------------------------

export const enteroMayorA =
  (min, campo = "El valor") =>
  (v) => {
    const n = Number(v);
    return (
      (Number.isInteger(n) && n > min) ||
      `${campo} debe ser un numero entero mayor a ${min}`
    );
  };

export const enteroMinimo =
  (min, campo = "El valor") =>
  (v) => {
    const n = Number(v);
    return (
      (Number.isInteger(n) && n >= min) ||
      `${campo} debe ser un numero entero mayor o igual a ${min}`
    );
  };

export const numeroValido =
  (campo = "El valor") =>
  (v) => {
    if (v === "" || v === null || v === undefined) return true;
    return Number.isFinite(Number(v)) || `${campo} debe ser un numero`;
  };

export const numeroRequerido =
  (campo = "El valor") =>
  (v) => {
    if (v === "" || v === null || v === undefined) return `${campo} es obligatorio`;
    return Number.isFinite(Number(v)) || `${campo} debe ser un numero`;
  };

export const numeroMayorA =
  (min, campo = "El valor") =>
  (v) => {
    const n = Number(v);
    return (
      (Number.isFinite(n) && n > min) || `${campo} debe ser mayor a ${min}`
    );
  };

export const numeroNoNegativo =
  (campo = "El valor") =>
  (v) => {
    const n = Number(v);
    return (Number.isFinite(n) && n >= 0) || `${campo} no puede ser negativo`;
  };

export const rango =
  (min, max, campo = "El valor") =>
  (v) => {
    const n = Number(v);
    return (
      (Number.isFinite(n) && n >= min && n <= max) ||
      `${campo} debe estar entre ${min} y ${max}`
    );
  };

// ---------------------------------------------------------------------------
// Selecciones
// ---------------------------------------------------------------------------

export const seleccionRequerida =
  (campo = "Este campo") =>
  (v) =>
    (v !== null && v !== undefined && v !== "") || `Debe seleccionar ${campo}`;

export const seleccionMultipleRequerida =
  (campo = "Este campo") =>
  (v) =>
    (Array.isArray(v) && v.length > 0) || `Debe seleccionar ${campo}`;

export const unoDe =
  (valores = [], campo = "El valor") =>
  (v) =>
    valores.includes(v) || `${campo} debe ser uno de: ${valores.join(", ")}`;

export const debeSerVerdadero =
  (mensaje = "Debes aceptar para continuar") =>
  (v) =>
    v === true || mensaje;

export const igualA =
  (obtenerEsperado, mensaje = "Los valores no coinciden") =>
  (v) =>
    v === obtenerEsperado() || mensaje;

export const distintoDe =
  (obtenerOtro, mensaje = "Los valores deben ser diferentes") =>
  (v) =>
    v !== obtenerOtro() || mensaje;

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

export const fechaRequerida =
  (campo = "La fecha") =>
  (v) =>
    Boolean(v) || `${campo} es obligatoria`;

export const fechaValida =
  (campo = "La fecha") =>
  (v) => {
    if (!v) return true;
    return !Number.isNaN(new Date(v).getTime()) || `${campo} no es una fecha valida`;
  };

export const noFutura =
  (campo = "La fecha") =>
  (v) => {
    if (!v) return true;
    const d = new Date(v);
    return d.getTime() <= Date.now() || `${campo} no puede ser futura`;
  };

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

/** @param {unknown} valor */
function listaArchivos(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  if (typeof FileList !== "undefined" && valor instanceof FileList) {
    return Array.from(valor);
  }
  return [valor];
}

/**
 * Valida el MIME real reportado por el navegador (solo UX; el backend valida
 * el contenido con `file-type`).
 * @param {string[]} mimes
 * @param {string} mensaje
 */
export const archivoMime =
  (mimes = [], mensaje = "Formato de archivo no permitido") =>
  (v) =>
    listaArchivos(v).every((archivo) => archivo && mimes.includes(archivo.type)) ||
    mensaje;

export const archivoPesoMax =
  (maxMB = LIMITES.evidencias.maxMB, campo = "El archivo") =>
  (v) => {
    const maxBytes = maxMB * 1024 * 1024;
    return (
      listaArchivos(v).every((archivo) => !archivo?.size || archivo.size <= maxBytes) ||
      `${campo} no puede superar ${maxMB} MB`
    );
  };

export const archivosMaximo =
  (max = LIMITES.evidencias.maxArchivos, campo = "La seleccion") =>
  (v) =>
    listaArchivos(v).length <= max || `${campo} admite maximo ${max} archivos`;
