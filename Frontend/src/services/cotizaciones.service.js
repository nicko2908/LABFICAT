import { descargar, get, patch, post, put } from "./api.service";

export const listar = (params = {}) => get("/cotizaciones", { params });
export const listarMias = (params = {}) => get("/cotizaciones/mias", { params });
export const obtener = (id) => get(`/cotizaciones/${id}`);
export const crear = (datos) => post("/cotizaciones", datos);
export const actualizar = (id, datos) => put(`/cotizaciones/${id}`, datos);
export const nuevaVersion = (id) => post(`/cotizaciones/${id}/nueva-version`);
export const decidir = (id, datos) => patch(`/cotizaciones/${id}/decision`, datos);

export const descargarExcel = (id) =>
  descargar(`/cotizaciones/${id}/excel`, { nombrePorDefecto: `cotizacion-${id}.xlsx` });

export const descargarFirma = (id) =>
  descargar(`/cotizaciones/${id}/firma`, { nombrePorDefecto: `firma-${id}.png` });
