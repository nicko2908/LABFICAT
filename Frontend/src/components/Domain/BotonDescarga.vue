<script setup>
import { ref } from "vue";

import { useDescargarArchivo } from "@/composables/useDescargarArchivo";

const props = defineProps({
  obtener: { type: Function, required: true },
  label: { type: String, default: "Descargar" },
  icono: { type: String, default: "download" },
  color: { type: String, default: "primary" },
  mensaje: { type: String, default: "Archivo descargado" },
  outline: { type: Boolean, default: false },
});

const { descargarArchivo } = useDescargarArchivo();
const cargando = ref(false);

async function ejecutar() {
  cargando.value = true;
  try {
    await descargarArchivo(props.obtener, props.mensaje);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <q-btn
    :label="label"
    :icon="icono"
    :color="color"
    :outline="outline"
    no-caps
    :loading="cargando"
    @click="ejecutar"
  />
</template>
