import { get, patch, post, put } from "./api.service";

export const listar = (params = {}) => get("/ordenes", { params });
export const listarMias = (params = {}) => get("/ordenes/mias", { params });
export const obtener = (id) => get(`/ordenes/${id}`);
export const crear = (datos) => post("/ordenes", datos);
export const avanzarEstado = (id, estado) => patch(`/ordenes/${id}/estado`, { estado });
export const registrarResultados = (id, resultados) =>
  put(`/ordenes/${id}/resultados`, { resultados });
export const repetir = (id, observaciones = null) =>
  post(`/ordenes/${id}/repetir`, { observaciones });
