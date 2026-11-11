<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps({
  valor: { type: [String, Number], default: 0 },
  etiqueta: { type: String, required: true },
  icono: { type: String, default: "insights" },
  color: { type: String, default: "primary" },
  detalle: { type: String, default: "" },
  ruta: { type: String, default: "" },
});

const componente = computed(() => (props.ruta ? RouterLink : "div"));
const enlace = computed(() => (props.ruta ? { name: props.ruta } : {}));
</script>

<template>
  <component :is="componente" v-bind="enlace" class="sin-decoracion">
    <q-card flat class="tarjeta tarjeta-hover stat-card">
      <q-avatar :color="color" text-color="white" size="42px">
        <q-icon :name="icono" size="22px" />
      </q-avatar>

      <div>
        <div class="stat-card__valor">{{ valor }}</div>
        <div class="stat-card__etiqueta">{{ etiqueta }}</div>
        <div v-if="detalle" class="stat-card__detalle">{{ detalle }}</div>
      </div>
    </q-card>
  </component>
</template>
