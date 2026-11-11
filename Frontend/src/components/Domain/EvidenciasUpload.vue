<script setup>
import { computed } from "vue";

import CampoArchivo from "@/components/Forms/CampoArchivo.vue";
import { LIMITES } from "@/utils/contrato";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  maximo: { type: Number, default: LIMITES.evidencias.maxArchivos },
});

const emit = defineEmits(["update:modelValue"]);

const ayuda = computed(
  () =>
    `Maximo ${props.maximo} archivos de ${LIMITES.evidencias.maxMB} MB cada uno (PNG o JPG).`
);

function actualizar(archivos) {
  const lista = Array.isArray(archivos) ? archivos : archivos ? [archivos] : [];
  emit("update:modelValue", lista.slice(0, props.maximo));
}
</script>

<template>
  <div>
    <CampoArchivo
      :model-value="modelValue"
      label="Evidencias (PNG o JPG)"
      accept="image/png,image/jpeg"
      :max-files="maximo"
      :max-file-size="LIMITES.evidencias.maxMB * 1024 * 1024"
      multiple
      :hint="ayuda"
      @update:model-value="actualizar"
    />
    <div class="text-caption texto-suave q-mt-xs">
      {{ modelValue.length }} de {{ maximo }} archivos seleccionados.
    </div>
  </div>
</template>
