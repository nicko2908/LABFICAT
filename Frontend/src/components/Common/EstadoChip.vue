<script setup>
import { computed } from "vue";

import { colorEstado, etiquetaEstado } from "@/utils/estados";

const props = defineProps({
  estado: { type: String, default: "" },
  dense: { type: Boolean, default: true },
});

const color = computed(() => colorEstado(props.estado));
const etiqueta = computed(() => etiquetaEstado(props.estado));
const texto = computed(() =>
  ["warning", "info"].includes(color.value) ? "black" : "white"
);
</script>

<template>
  <q-chip
    :color="color"
    :text-color="texto"
    :dense="dense"
    square
    class="estado-chip text-weight-medium"
  >
    {{ etiqueta }}
  </q-chip>
</template>

<style scoped>
.estado-chip {
  border-radius: 4px;
}
</style>
