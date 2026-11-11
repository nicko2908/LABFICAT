/**
 * Una sola instancia de axios para toda la aplicacion.
 *
 * Cadena de responsabilidad:
 *   componente -> store (Pinia) -> service -> ESTE archivo -> backend
 */
import axios from "axios";

import { router } from "@/router";
import { useAuthStore } from "@/store/Auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

/**
 * Antes de cada request se inyecta el token. El backend LABFICAT espera
 * Authorization: Bearer <JWT>.
 */
api.interceptors.request.use((config) => {
  const auth = useAuthStore();

  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }

  return config;
});

/**
 * Rutas donde un 401 es una respuesta de negocio y NO significa que la sesion
 * haya expirado. En estos casos no se debe cerrar la sesion del usuario.
 *  - /auth/login: credenciales incorrectas.
 *  - /auth/contrasena: la contrasena actual no coincide.
 */
const RUTAS_401_ESPERADO = ["/auth/login", "/auth/contrasena"];

/**
 * @param {number} status
 * @param {string|undefined} url
 * @returns {boolean} true si el 401 implica cerrar la sesion.
 */
function esSesionExpirada(status, url) {
  if (status !== 401) return false;
  const ruta = String(url || "");
  return !RUTAS_401_ESPERADO.some((esperada) => ruta.includes(esperada));
}

/**
 * Normaliza los errores a { status, mensaje, detalles }.
 * Si la respuesta es un Blob (descargas), intenta leer el JSON de error
 * que el backend envio dentro del blob.
 */
api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error) => {
    let data = error.response?.data;

    if (data instanceof Blob) {
      try {
        const texto = await data.text();
        data = JSON.parse(texto);
      } catch {
        data = null;
      }
    }

    const errorNormalizado = {
      status: error.response?.status ?? 0,
      mensaje: data?.mensaje || mensajeSegunFallo(error),
      detalles: data?.detalles ?? null,
    };

    if (esSesionExpirada(errorNormalizado.status, error.config?.url)) {
      cerrarSesionYSalir();
    }

    return Promise.reject(errorNormalizado);
  }
);

function cerrarSesionYSalir() {
  const auth = useAuthStore();
  auth.cerrarSesion();

  if (router.currentRoute.value.name !== "login") {
    router.push({ name: "login" });
  }
}

/**
 * @param {any} error
 * @returns {string}
 */
function mensajeSegunFallo(error) {
  if (error.code === "ECONNABORTED") {
    return "El servidor tardo demasiado en responder";
  }
  if (!error.response) {
    return "No hay conexion con el servidor. Verifica que el backend este corriendo.";
  }
  return "Ocurrio un error inesperado";
}

export default api;
