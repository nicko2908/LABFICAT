<script setup>
import { useAuthStore } from "@/store/Auth";

const auth = useAuthStore();
</script>

<template>
  <q-page class="contenedor-app column flex-center text-center" style="min-height: 70vh">
    <q-icon name="search_off" size="84px" color="grey-4" />
    <h1 class="titulo-vista q-mt-md">Pagina no encontrada</h1>
    <p class="texto-suave q-mt-sm">
      La ruta que intentas abrir no existe o fue movida.
    </p>

    <div class="q-mt-lg q-gutter-sm">
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="space_dashboard"
        label="Ir al inicio"
        :to="{ name: auth.estaAutenticado ? 'inicio' : 'login' }"
      />
    </div>
  </q-page>
</template>
