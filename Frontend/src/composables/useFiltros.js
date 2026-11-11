import { reactive } from "vue";

/**
 * Maneja un objeto de filtros y su limpieza.
 * @param {object} iniciales
 */
export function useFiltros(iniciales = {}) {
  const filtros = reactive({ ...iniciales });

  function limpiar() {
    Object.keys(filtros).forEach((clave) => {
      filtros[clave] = iniciales[clave] ?? "";
    });
  }

  function asignar(nuevos = {}) {
    Object.assign(filtros, nuevos);
  }

  return { filtros, limpiar, asignar };
}
