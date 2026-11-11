import { descargar, get, patch, post, put } from "./api.service";

export const listar = (params = {}) => get("/muestras", { params });
export const listarMias = (params = {}) => get("/muestras/mias", { params });
export const obtener = (id) => get(`/muestras/${id}`);
export const crear = (datos) => post("/muestras", datos);
export const actualizar = (id, datos) => put(`/muestras/${id}`, datos);
export const cambiarPrioridad = (id, datos) => patch(`/muestras/${id}/prioridad`, datos);
export const generarRotulo = (id, datos = {}) => post(`/muestras/${id}/rotulo`, datos);

export const descargarActa = (id) =>
  descargar(`/muestras/${id}/acta-recepcion`, { nombrePorDefecto: `acta-${id}.xlsx` });

export const descargarRotulo = (id) =>
  descargar(`/muestras/${id}/rotulo`, { nombrePorDefecto: `rotulo-${id}.pdf` });
