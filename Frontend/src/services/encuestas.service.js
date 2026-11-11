import { get, post } from "./api.service";

export const listar = (params = {}) => get("/encuestas", { params });
export const listarMias = (params = {}) => get("/encuestas/mias", { params });
export const obtener = (id) => get(`/encuestas/${id}`);
export const responder = (datos) => post("/encuestas", datos);
export const resumenGlobal = () => get("/encuestas/resumen/global");
