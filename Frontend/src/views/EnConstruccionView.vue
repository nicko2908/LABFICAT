<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EmptyState from "@/components/Common/EmptyState.vue";

const route = useRoute();

const titulo = computed(() => route.meta?.titulo || "Vista en construccion");
const descripcion = computed(
  () =>
    route.meta?.descripcion ||
    "La estructura, la ruta y los servicios ya estan listos. La interfaz completa de este modulo se implementa en la siguiente fase."
);
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      :titulo="titulo"
      subtitulo="Modulo preparado para la siguiente fase"
      icono="construction"
    />

    <q-banner dense class="bg-blue-1 text-blue-10 rounded-borders q-mb-lg">
      <template #avatar>
        <q-icon name="info" />
      </template>
      Esta vista usa la misma estructura de carpetas, servicios, guards y tema del resto de la aplicacion.
    </q-banner>

    <q-card flat class="tarjeta">
      <EmptyState
        titulo="Vista en construccion"
        :detalle="descripcion"
        icono="design_services"
      >
        <template #acciones>
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="space_dashboard"
            label="Volver al inicio"
            :to="{ name: 'inicio' }"
          />
        </template>
      </EmptyState>
    </q-card>
  </q-page>
</template>
