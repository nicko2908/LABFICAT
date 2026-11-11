import { get } from "./api.service";

export const resumenSolicitudes = (params = {}) =>
  get("/reportes/solicitudes", { params });
export const resumenMuestras = (params = {}) => get("/reportes/muestras", { params });
export const resumenOperacion = () => get("/reportes/operacion");
export const resumenSatisfaccion = (params = {}) =>
  get("/reportes/satisfaccion", { params });
