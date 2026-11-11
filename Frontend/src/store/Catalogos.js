import { computed, ref } from "vue";
import { defineStore } from "pinia";

import {
  listarAnalisis,
  listarEtapas,
  listarParametros,
  listarTipologias,
  listarTiposMuestra,
} from "@/services/catalogos.service";

function itemsDe(datos) {
  if (Array.isArray(datos)) return datos;
  return datos?.items || [];
}

/**
 * Cache de catalogos para no repetir la misma consulta en cada formulario.
 */
export const useCatalogosStore = defineStore("catalogos", () => {
  const tipologias = ref([]);
  const tiposMuestra = ref([]);
  const parametros = ref([]);
  const etapas = ref([]);
  const analisis = ref([]);
  const cargando = ref(false);

  const tipologiasActivas = computed(() =>
    tipologias.value.filter((item) => item.activo !== false)
  );

  async function cargarTipologias(forzar = false) {
    if (tipologias.value.length > 0 && !forzar) return tipologias.value;
    const respuesta = await listarTipologias({ soloActivas: true });
    tipologias.value = itemsDe(respuesta?.datos);
    return tipologias.value;
  }

  async function cargarTiposMuestra(forzar = false) {
    if (tiposMuestra.value.length > 0 && !forzar) return tiposMuestra.value;
    const respuesta = await listarTiposMuestra({ activo: true, limit: 100 });
    tiposMuestra.value = itemsDe(respuesta?.datos);
    return tiposMuestra.value;
  }

  async function cargarParametros(forzar = false) {
    if (parametros.value.length > 0 && !forzar) return parametros.value;
    const respuesta = await listarParametros({ activo: true, limit: 100 });
    parametros.value = itemsDe(respuesta?.datos);
    return parametros.value;
  }

  async function cargarEtapas(forzar = false) {
    if (etapas.value.length > 0 && !forzar) return etapas.value;
    const respuesta = await listarEtapas();
    etapas.value = itemsDe(respuesta?.datos);
    return etapas.value;
  }

  async function cargarAnalisis(forzar = false) {
    if (analisis.value.length > 0 && !forzar) return analisis.value;
    const respuesta = await listarAnalisis({ activo: true, limit: 100 });
    analisis.value = itemsDe(respuesta?.datos);
    return analisis.value;
  }

  async function cargarTodo() {
    cargando.value = true;
    try {
      await Promise.all([
        cargarTipologias(),
        cargarTiposMuestra(),
        cargarParametros(),
        cargarEtapas(),
        cargarAnalisis(),
      ]);
    } finally {
      cargando.value = false;
    }
  }

  return {
    tipologias,
    tiposMuestra,
    parametros,
    etapas,
    analisis,
    cargando,
    tipologiasActivas,
    cargarTipologias,
    cargarTiposMuestra,
    cargarParametros,
    cargarEtapas,
    cargarAnalisis,
    cargarTodo,
  };
});
