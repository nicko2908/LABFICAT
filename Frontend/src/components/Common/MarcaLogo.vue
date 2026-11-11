<script setup>
import { computed } from "vue";

import logoCompleto from "@/assets/logo-completo.png";
import logoIcono from "@/assets/logo-icono.png";

const props = defineProps({
  variante: {
    type: String,
    default: "completo",
    validator: (valor) => ["completo", "icono"].includes(valor),
  },
  alto: {
    type: [Number, String],
    default: 40,
  },
  alt: {
    type: String,
    default: "LABFICAT",
  },
});

const src = computed(() => (props.variante === "icono" ? logoIcono : logoCompleto));
const estilo = computed(() => ({
  height: typeof props.alto === "number" ? `${props.alto}px` : props.alto,
}));
</script>

<template>
  <img
    :src="src"
    :alt="alt"
    :style="estilo"
    class="marca-logo"
    draggable="false"
  />
</template>
