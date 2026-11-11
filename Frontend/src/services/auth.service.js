import { get, patch, post } from "./api.service";

export const login = (credenciales) => post("/auth/login", credenciales);

export const registrar = (datos) => post("/auth/registro", datos);

export const obtenerPerfil = () => get("/auth/perfil");

export const cambiarContrasena = (datos) => patch("/auth/contrasena", datos);

export const solicitarRecuperacion = (correo) =>
  post("/auditoria/recuperacion/solicitar", { correo });

export const consumirRecuperacion = (datos) =>
  post("/auditoria/recuperacion/consumir", datos);
