import { get, patch, post, put } from "./api.service";

export const listar = (params = {}) => get("/pagos", { params });
export const listarMios = (params = {}) => get("/pagos/mios", { params });
export const obtener = (id) => get(`/pagos/${id}`);
export const cargar = (datos) => post("/pagos", datos);
export const reenviar = (id, datos) => put(`/pagos/${id}/reenviar`, datos);
export const validar = (id, datos) => patch(`/pagos/${id}/validar`, datos);
