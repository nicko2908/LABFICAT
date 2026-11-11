/**
 * Validaciones de payload para los formularios de negocio.
 *
 * Cada funcion devuelve un arreglo de mensajes de error (vacio = valido).
 * Se usan al enviar el formulario, cuando las reglas por campo de Quasar no
 * alcanzan (listas, objetos anidados, campos condicionales o archivos).
 *
 * Los limites salen de `utils/contrato.js` (espejo de los modelos del backend).
 * El backend sigue validando; esto solo evita viajes innecesarios y mejora los
 * mensajes.
 */
import { ENUMS, LIMITES, LONGITUDES } from "./contrato.js";

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

const vacio = (valor) =>
  valor === null || valor === undefined || String(valor).trim() === "";

const largo = (valor) => String(valor ?? "").trim().length;

const numero = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

const lista = (valor) => {
  if (!valor) return [];
  return Array.isArray(valor) ? valor : [valor];
};

/** Agrega el error de longitud solo si el texto viene informado. */
function validarLargo(errores, valor, maximo, etiqueta) {
  if (!vacio(valor) && largo(valor) > maximo) {
    errores.push(`${etiqueta} no puede superar los ${maximo} caracteres`);
  }
}

// ---------------------------------------------------------------------------
// Solicitudes
// ---------------------------------------------------------------------------

/**
 * POST /solicitudes
 * @param {{ analisis?: unknown[], descripcion_inicial?: string }} datos
 * @returns {string[]}
 */
export function validarSolicitud({ analisis, descripcion_inicial } = {}) {
  const errores = [];

  if (!Array.isArray(analisis) || analisis.length === 0) {
    errores.push("Debes seleccionar al menos un ensayo");
  } else {
    const unicos = new Set(analisis.map((item) => String(item)));
    if (unicos.size !== analisis.length) {
      errores.push("No se permiten ensayos duplicados en la solicitud");
    }
  }

  validarLargo(
    errores,
    descripcion_inicial,
    LONGITUDES.solicitud.descripcion_inicial,
    "La descripcion inicial"
  );

  return errores;
}

// ---------------------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------------------

/**
 * Valida la estructura items[].detalle[] que espera POST/PUT /cotizaciones.
 * @param {unknown[]} items
 * @returns {string[]}
 */
export function validarItemsCotizacion(items = []) {
  const errores = [];

  if (!Array.isArray(items) || items.length === 0) {
    return ["Debes agregar al menos un item a la cotizacion"];
  }

  const numeros = new Set();

  items.forEach((item, indice) => {
    const numeroItem = Number(item?.numero ?? indice + 1);
    const etiquetaItem = Number.isInteger(numeroItem) ? `El item ${numeroItem}` : `El item ${indice + 1}`;

    if (!Number.isInteger(numeroItem) || numeroItem < 1) {
      errores.push(`${etiquetaItem}: el numero de item no es valido`);
    } else if (numeros.has(numeroItem)) {
      errores.push(`${etiquetaItem}: el numero de item esta repetido`);
    } else {
      numeros.add(numeroItem);
    }

    validarLargo(
      errores,
      item?.descripcion_muestra,
      LONGITUDES.cotizacion.descripcion_muestra,
      `${etiquetaItem}: la descripcion de la muestra`
    );

    if (!Array.isArray(item?.detalle) || item.detalle.length === 0) {
      errores.push(`${etiquetaItem}: debe tener al menos un ensayo`);
      return;
    }

    const ensayos = new Set();

    item.detalle.forEach((linea, indiceLinea) => {
      const etiquetaLinea = `${etiquetaItem}, ensayo ${indiceLinea + 1}`;

      if (vacio(linea?.analisis)) {
        errores.push(`${etiquetaLinea}: selecciona un ensayo`);
      } else {
        const id = String(linea.analisis);
        if (ensayos.has(id)) {
          errores.push(`${etiquetaItem}: no se permiten ensayos duplicados`);
        } else {
          ensayos.add(id);
        }
      }

      const cantidad = numero(linea?.cantidad);
      // El backend acepta cantidad 0; el negocio no tiene sentido con 0.
      if (cantidad === null || cantidad <= 0) {
        errores.push(`${etiquetaLinea}: la cantidad debe ser mayor a 0`);
      }
    });
  });

  return errores;
}

/**
 * POST/PUT /cotizaciones
 * @param {{
 *   items?: unknown[],
 *   observaciones_propuesta?: string,
 *   fecha_validez?: string,
 * }} datos
 * @returns {string[]}
 */
export function validarCotizacion({ items, observaciones_propuesta, fecha_validez } = {}) {
  const errores = validarItemsCotizacion(items);

  validarLargo(
    errores,
    observaciones_propuesta,
    LONGITUDES.cotizacion.observaciones_propuesta,
    "Las observaciones de la propuesta"
  );

  if (!vacio(fecha_validez) && Number.isNaN(new Date(fecha_validez).getTime())) {
    errores.push("La fecha de validez no es una fecha valida");
  }

  return errores;
}

/**
 * PATCH /cotizaciones/:id/decision
 * @param {{ decision?: string, firma_base64?: string, motivo_rechazo?: string }} datos
 * @returns {string[]}
 */
export function validarDecisionCotizacion({
  decision,
  firma_base64,
  motivo_rechazo,
} = {}) {
  const errores = [];

  if (!ENUMS.decisionCotizacion.includes(decision)) {
    errores.push("La decision debe ser ACEPTADA o RECHAZADA");
    return errores;
  }

  if (decision === "ACEPTADA") {
    errores.push(...validarFirma(firma_base64));
  } else {
    if (vacio(motivo_rechazo)) {
      errores.push("El motivo de rechazo es obligatorio");
    } else {
      validarLargo(
        errores,
        motivo_rechazo,
        LONGITUDES.cotizacion.motivo_rechazo,
        "El motivo de rechazo"
      );
    }
  }

  return errores;
}

// ---------------------------------------------------------------------------
// Cupones y pagos
// ---------------------------------------------------------------------------

/**
 * POST /pagos y PUT /pagos/:id/reenviar
 * @param {{ cupon?: string, referencia_externa?: string, observaciones?: string }} datos
 * @returns {string[]}
 */
export function validarPago({ cupon, referencia_externa, observaciones } = {}) {
  const errores = [];

  if (vacio(cupon)) errores.push("Selecciona el cupon a pagar");

  validarLargo(
    errores,
    referencia_externa,
    LONGITUDES.pago.referencia_externa,
    "La referencia externa"
  );
  validarLargo(
    errores,
    observaciones,
    LONGITUDES.pago.observaciones,
    "Las observaciones"
  );

  return errores;
}

/**
 * PATCH /pagos/:id/validar
 * @param {{ decision?: string, observaciones?: string }} datos
 * @returns {string[]}
 */
export function validarDecisionPago({ decision, observaciones } = {}) {
  const errores = [];

  if (!ENUMS.decisionPago.includes(decision)) {
    errores.push("La decision debe ser APROBADO o RECHAZADO");
  }

  validarLargo(
    errores,
    observaciones,
    LONGITUDES.pago.observaciones,
    "Las observaciones"
  );

  return errores;
}

// ---------------------------------------------------------------------------
// Recepcion de muestras
// ---------------------------------------------------------------------------

/**
 * POST /muestras (RF-09).
 * @param {Record<string, unknown>} datos
 * @returns {string[]}
 */
export function validarRecepcionMuestra(datos = {}) {
  const errores = [];

  if (vacio(datos.solicitud)) errores.push("La solicitud es obligatoria");
  if (vacio(datos.tipo_muestra)) errores.push("Selecciona el tipo de muestra");

  if (vacio(datos.fecha_recepcion)) {
    errores.push("La fecha de recepcion es obligatoria");
  } else if (Number.isNaN(new Date(datos.fecha_recepcion).getTime())) {
    errores.push("La fecha de recepcion no es valida");
  }

  if (!ENUMS.estadosRecepcion.includes(datos.estado_recepcion)) {
    errores.push("El estado de recepcion debe ser ACEPTADA o RECHAZADA");
  }

  if (!vacio(datos.unidad_medida) && !ENUMS.unidadesMedida.includes(datos.unidad_medida)) {
    errores.push("La unidad de medida debe ser ml o gr");
  }

  const cantidad = numero(datos.cantidad_recibida);
  if (cantidad !== null && cantidad < 0) {
    errores.push("La cantidad recibida no puede ser negativa");
  }

  const envases = numero(datos.numero_envases);
  if (envases !== null && (!Number.isInteger(envases) || envases < 1)) {
    errores.push("El numero de envases debe ser un entero mayor o igual a 1");
  }

  validarLargo(
    errores,
    datos.condiciones_conservacion,
    LONGITUDES.muestra.condiciones_conservacion,
    "Las condiciones de conservacion"
  );

  const observaciones = lista(datos.observaciones_predefinidas);
  const fueraDeRango = observaciones.some((n) => {
    const valor = Number(n);
    return (
      !Number.isInteger(valor) ||
      valor < LIMITES.observacionesRecepcion.min ||
      valor > LIMITES.observacionesRecepcion.max
    );
  });
  if (fueraDeRango) {
    errores.push(
      `Las observaciones deben estar entre ${LIMITES.observacionesRecepcion.min} y ${LIMITES.observacionesRecepcion.max}`
    );
  }

  if (datos.estado_recepcion === "RECHAZADA") {
    if (observaciones.length === 0 && vacio(datos.motivo_rechazo)) {
      errores.push("Para rechazar indica una observacion o el motivo de rechazo");
    }
    validarLargo(
      errores,
      datos.motivo_rechazo,
      LONGITUDES.muestra.motivo_rechazo,
      "El motivo de rechazo"
    );
  }

  return errores;
}

// ---------------------------------------------------------------------------
// Ordenes y resultados
// ---------------------------------------------------------------------------

/**
 * POST /ordenes
 * @param {{ muestra?: string, analisis?: string }} datos
 * @returns {string[]}
 */
export function validarOrden({ muestra, analisis } = {}) {
  const errores = [];

  if (vacio(muestra)) errores.push("Selecciona la muestra");
  if (vacio(analisis)) errores.push("Selecciona el ensayo");

  return errores;
}

/**
 * PUT /ordenes/:id/resultados
 * @param {Array<{ parametro?: string, valor?: unknown }>} resultados
 * @param {Array<{ _id: string, nombre?: string }>} parametros
 * @returns {string[]}
 */
export function validarResultados(resultados = [], parametros = []) {
  const errores = [];

  if (!Array.isArray(parametros) || parametros.length === 0) {
    return ["El ensayo no tiene parametros configurados"];
  }

  if (!Array.isArray(resultados) || resultados.length === 0) {
    return ["Registra al menos un resultado"];
  }

  const vistos = new Set();

  for (const resultado of resultados) {
    if (vacio(resultado?.parametro)) {
      errores.push("Cada resultado debe indicar el parametro");
      continue;
    }

    const id = String(resultado.parametro);
    if (vistos.has(id)) {
      errores.push("No se permiten parametros duplicados");
      continue;
    }
    vistos.add(id);

    if (numero(resultado?.valor) === null) {
      const parametro = parametros.find((item) => String(item._id) === id);
      errores.push(`El valor de ${parametro?.nombre || "un parametro"} debe ser numerico`);
    }
  }

  for (const parametro of parametros) {
    if (!vistos.has(String(parametro._id))) {
      errores.push(`Falta el valor de ${parametro.nombre || "un parametro"}`);
    }
  }

  return errores;
}

// ---------------------------------------------------------------------------
// Encuestas
// ---------------------------------------------------------------------------

/**
 * POST /encuestas
 * @param {Record<string, unknown>} datos
 * @returns {string[]}
 */
export function validarEncuesta(datos = {}) {
  const errores = [];
  const { min, max } = LIMITES.puntajeEncuesta;

  if (vacio(datos.solicitud)) errores.push("La solicitud es obligatoria");

  const campos = [
    "satisfaccion_general",
    "tiempo_entrega",
    "atencion_personal",
    "claridad_informe",
  ];

  for (const campo of campos) {
    const valor = Number(datos[campo]);
    if (!Number.isInteger(valor) || valor < min || valor > max) {
      errores.push(`${campo}: debe ser un entero entre ${min} y ${max}`);
    }
  }

  if (typeof datos.recomendaria_servicio !== "boolean") {
    errores.push("Debes indicar si recomendarias el servicio");
  }

  validarLargo(
    errores,
    datos.comentarios,
    LONGITUDES.encuesta.comentarios,
    "Los comentarios"
  );

  return errores;
}

// ---------------------------------------------------------------------------
// Reclamaciones
// ---------------------------------------------------------------------------

/**
 * POST /reclamaciones (las evidencias van en una peticion aparte).
 * @param {{ solicitud?: string, motivo?: string }} datos
 * @returns {string[]}
 */
export function validarReclamacion({ solicitud, motivo } = {}) {
  const errores = [];

  if (vacio(solicitud)) errores.push("Selecciona la solicitud");
  if (vacio(motivo)) {
    errores.push("El motivo de la reclamacion es obligatorio");
  } else {
    validarLargo(errores, motivo, LONGITUDES.reclamacion.motivo, "El motivo");
  }

  return errores;
}

/**
 * POST /reclamaciones/:id/evidencias
 * @param {unknown} archivos
 * @param {{ maxArchivos?: number, maxMB?: number, mimes?: string[] }} [opciones]
 * @returns {string[]}
 */
export function validarEvidencias(archivos, opciones = {}) {
  const { maxArchivos, maxMB, mimes } = { ...LIMITES.evidencias, ...opciones };
  const errores = [];
  const seleccion = lista(archivos);

  if (seleccion.length === 0) {
    errores.push("Adjunta al menos una evidencia");
    return errores;
  }

  if (seleccion.length > maxArchivos) {
    errores.push(`Solo se permiten ${maxArchivos} evidencias`);
  }

  const tiposValidos = mimes.join(", ");

  for (const archivo of seleccion) {
    if (archivo?.type && !mimes.includes(archivo.type)) {
      errores.push(`Formato no permitido (${archivo.name || "archivo"}). Usa: ${tiposValidos}`);
    }
    if (archivo?.size && archivo.size > maxMB * 1024 * 1024) {
      errores.push(`${archivo.name || "El archivo"} supera ${maxMB} MB`);
    }
  }

  return errores;
}

// ---------------------------------------------------------------------------
// Firma digital
// ---------------------------------------------------------------------------

/**
 * PNG en base64 (data URL) que espera PATCH /cotizaciones/:id/decision.
 * @param {unknown} base64
 * @returns {string[]}
 */
export function validarFirma(base64) {
  if (vacio(base64)) return ["La firma es obligatoria para aceptar"];

  const valor = String(base64);
  if (!valor.startsWith(LIMITES.firma.prefijo)) {
    return ["La firma debe ser una imagen PNG"];
  }

  const limpio = valor.slice(LIMITES.firma.prefijo.length);
  const relleno = (limpio.match(/=+$/) || [""])[0].length;
  const bytes = Math.max(0, Math.floor((limpio.length * 3) / 4) - relleno);

  if (bytes > LIMITES.firma.maxMB * 1024 * 1024) {
    return [`La firma no puede superar ${LIMITES.firma.maxMB} MB`];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

/**
 * POST/PUT /clientes. El coordinador registra un prospecto sin contrasena.
 * @param {Record<string, unknown>} datos
 * @returns {string[]}
 */
export function validarCliente(datos = {}) {
  const errores = [];

  if (vacio(datos.nombres)) errores.push("Los nombres son obligatorios");
  if (vacio(datos.apellidos)) errores.push("Los apellidos son obligatorios");
  if (!ENUMS.tiposDocumento.includes(datos.tipo_documento)) {
    errores.push("Selecciona un tipo de documento valido");
  }
  if (vacio(datos.numero_documento)) {
    errores.push("El numero de documento es obligatorio");
  } else {
    const documento = String(datos.numero_documento).trim();
    const { documentoMin, documentoMax } = LONGITUDES.usuario;
    if (!/^\d+$/.test(documento)) {
      errores.push("El documento solo admite digitos");
    } else if (documento.length < documentoMin || documento.length > documentoMax) {
      errores.push(`El documento debe tener entre ${documentoMin} y ${documentoMax} digitos`);
    }
  }
  if (vacio(datos.correo)) {
    errores.push("El correo es obligatorio");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(datos.correo).trim())) {
    errores.push("El correo no es valido");
  }

  validarLargo(errores, datos.nombres, LONGITUDES.usuario.nombres, "Los nombres");
  validarLargo(errores, datos.apellidos, LONGITUDES.usuario.apellidos, "Los apellidos");
  validarLargo(errores, datos.correo, LONGITUDES.usuario.correo, "El correo");
  validarLargo(errores, datos.razon_social, LONGITUDES.cliente.razon_social, "La razon social");
  validarLargo(errores, datos.nit, LONGITUDES.cliente.nit, "El NIT");
  validarLargo(errores, datos.direccion, LONGITUDES.cliente.direccion, "La direccion");
  validarLargo(errores, datos.ciudad, LONGITUDES.cliente.ciudad, "La ciudad");
  validarLargo(errores, datos.departamento, LONGITUDES.cliente.departamento, "El departamento");
  validarLargo(errores, datos.cargo, LONGITUDES.cliente.cargo, "El cargo");
  validarLargo(
    errores,
    datos.persona_contacto,
    LONGITUDES.cliente.persona_contacto,
    "La persona de contacto"
  );

  if (!vacio(datos.telefono)) {
    const telefono = String(datos.telefono).trim();
    if (!/^\d+$/.test(telefono) || telefono.length !== LONGITUDES.cliente.telefono) {
      errores.push(`El telefono debe tener ${LONGITUDES.cliente.telefono} digitos`);
    }
  }

  return errores;
}
