import { descargar, get, patch, post, subir } from "./api.service";

export const listar = (params = {}) => get("/reclamaciones", { params });
export const listarMias = (params = {}) => get("/reclamaciones/mias", { params });
export const obtener = (id) => get(`/reclamaciones/${id}`);
export const crear = (datos) => post("/reclamaciones", datos);
export const cambiarEstado = (id, datos) => patch(`/reclamaciones/${id}/estado`, datos);

export const agregarEvidencias = (id, archivos = []) => {
  const formData = new FormData();
  archivos.forEach((archivo) => formData.append("evidencias", archivo));
  return subir(`/reclamaciones/${id}/evidencias`, formData);
};

export const descargarEvidencia = (id, evidenciaId, nombrePorDefecto = "evidencia") =>
  descargar(`/reclamaciones/${id}/evidencias/${evidenciaId}`, { nombrePorDefecto });
