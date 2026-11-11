import { get, patch, post, put } from "./api.service";

export const listar = (params = {}) => get("/clientes", { params });
export const obtener = (id) => get(`/clientes/${id}`);
export const crear = (datos) => post("/clientes", datos);
export const actualizar = (id, datos) => put(`/clientes/${id}`, datos);
export const desactivar = (id) => patch(`/clientes/${id}/desactivar`);
export const reactivar = (id) => patch(`/clientes/${id}/reactivar`);
