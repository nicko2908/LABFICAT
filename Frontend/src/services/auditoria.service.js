import { get, post } from "./api.service";

export const listar = (params = {}) => get("/auditoria", { params });
export const obtener = (id) => get(`/auditoria/${id}`);
export const registrar = (datos) => post("/auditoria", datos);
