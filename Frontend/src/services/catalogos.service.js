import { get, patch, post, put } from "./api.service";

// --- Tipologias -------------------------------------------------------------
export const listarTipologias = (params = { soloActivas: true }) =>
  get("/catalogos/tipologias", { params });
export const crearTipologia = (datos) => post("/catalogos/tipologias", datos);
export const actualizarTipologia = (id, datos) => put(`/catalogos/tipologias/${id}`, datos);
export const cambiarEstadoTipologia = (id, activo) =>
  patch(`/catalogos/tipologias/${id}/estado`, { activo });

// --- Tipos de muestra -------------------------------------------------------
export const listarTiposMuestra = (params = { activo: true }) =>
  get("/catalogos/tipos-muestra", { params });
export const crearTipoMuestra = (datos) => post("/catalogos/tipos-muestra", datos);
export const actualizarTipoMuestra = (id, datos) =>
  put(`/catalogos/tipos-muestra/${id}`, datos);
export const cambiarEstadoTipoMuestra = (id, activo) =>
  patch(`/catalogos/tipos-muestra/${id}/estado`, { activo });

// --- Parametros -------------------------------------------------------------
export const listarParametros = (params = { activo: true }) =>
  get("/catalogos/parametros", { params });
export const crearParametro = (datos) => post("/catalogos/parametros", datos);
export const actualizarParametro = (id, datos) => put(`/catalogos/parametros/${id}`, datos);
export const cambiarEstadoParametro = (id, activo) =>
  patch(`/catalogos/parametros/${id}/estado`, { activo });

// --- Etapas -----------------------------------------------------------------
export const listarEtapas = (params = {}) => get("/catalogos/etapas", { params });
export const crearEtapa = (datos) => post("/catalogos/etapas", datos);
export const actualizarEtapa = (id, datos) => put(`/catalogos/etapas/${id}`, datos);
export const cambiarEstadoEtapa = (id, activo) =>
  patch(`/catalogos/etapas/${id}/estado`, { activo });

// --- Analisis ---------------------------------------------------------------
export const listarAnalisis = (params = { activo: true, limit: 100 }) =>
  get("/catalogos/analisis", { params });
export const obtenerAnalisis = (id) => get(`/catalogos/analisis/${id}`);
export const crearAnalisis = (datos) => post("/catalogos/analisis", datos);
export const actualizarAnalisis = (id, datos) => put(`/catalogos/analisis/${id}`, datos);
export const cambiarEstadoAnalisis = (id, activo) =>
  patch(`/catalogos/analisis/${id}/estado`, { activo });

// --- Configuracion ----------------------------------------------------------
export const listarConfiguracion = () => get("/catalogos/configuracion");
export const obtenerConfiguracion = (clave) => get(`/catalogos/configuracion/${clave}`);
export const actualizarConfiguracion = (clave, datos) =>
  put(
    `/catalogos/configuracion/${clave}`,
    datos && typeof datos === "object" ? datos : { valor: datos }
  );
