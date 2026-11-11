import { get, patch, post, put } from "./api.service";

export const listar = (params = {}) => get("/solicitudes", { params });
export const listarMias = (params = {}) => get("/solicitudes/mias", { params });
export const obtener = (id) => get(`/solicitudes/${id}`);
export const historial = (id) => get(`/solicitudes/${id}/historial`);
export const crear = (datos) => post("/solicitudes", datos);
export const actualizar = (id, datos) => put(`/solicitudes/${id}`, datos);
export const cambiarEstado = (id, datos) => patch(`/solicitudes/${id}/estado`, datos);
