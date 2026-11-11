import { get, post } from "./api.service";

export const registrarSeguimiento = (datos) => post("/trazabilidad/seguimiento", datos);
export const lineaTiempo = (muestraId) =>
  get(`/trazabilidad/muestra/${muestraId}`);
export const validarResultado = (datos) => post("/trazabilidad/validaciones", datos);
export const historialValidaciones = (ordenId) =>
  get(`/trazabilidad/validaciones/orden/${ordenId}`);
