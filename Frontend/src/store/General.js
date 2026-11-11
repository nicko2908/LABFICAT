import { computed, ref } from "vue";
import { defineStore } from "pinia";

/**
 * Estado global de interfaz: lo que no pertenece a un modelo del backend
 * pero comparten varias pantallas.
 */
export const useGeneralStore = defineStore("general", () => {
  const titulo = ref(import.meta.env.VITE_APP_TITULO || "LABFICAT");
  const menuAbierto = ref(false);
  const ultimaSincronizacion = ref(null);

  const urlApi = computed(
    () => import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
  );

  function alternarMenu() {
    menuAbierto.value = !menuAbierto.value;
  }

  function marcarSincronizacion() {
    ultimaSincronizacion.value = new Date();
  }

  return {
    titulo,
    menuAbierto,
    ultimaSincronizacion,
    urlApi,
    alternarMenu,
    marcarSincronizacion,
  };
});
