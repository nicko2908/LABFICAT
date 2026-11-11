import { get, patch, post } from "./api.service";

export const listar = (params = {}) => get("/cupones", { params });
export const listarMios = (params = {}) => get("/cupones/mios", { params });
export const obtener = (id) => get(`/cupones/${id}`);
export const crear = (datos) => post("/cupones", datos);
export const generar = (id, codigo_cupon) =>
  patch(`/cupones/${id}/generar`, { codigo_cupon });
export const registrarRecordatorio = (id) => post(`/cupones/${id}/recordatorios`);
export const cambiarEstado = (id, estado) => patch(`/cupones/${id}/estado`, { estado });
