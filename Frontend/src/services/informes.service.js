import { descargar, get, patch, post } from "./api.service";

export const listar = (params = {}) => get("/informes", { params });
export const listarMios = (params = {}) => get("/informes/mios", { params });
export const obtener = (id) => get(`/informes/${id}`);
export const generar = (muestra) => post("/informes", { muestra });
export const registrarEnvio = (id) => patch(`/informes/${id}/envio`);
export const registrarDescarga = (id) => patch(`/informes/${id}/descarga`);

export const descargarPdf = (id) =>
  descargar(`/informes/${id}/pdf`, { nombrePorDefecto: `informe-${id}.pdf` });
