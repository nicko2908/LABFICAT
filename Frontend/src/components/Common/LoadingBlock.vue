<script setup>
defineProps({
  mensaje: { type: String, default: "Cargando informacion..." },
  tamano: { type: String, default: "42px" },
});
</script>

<template>
  <div class="row justify-center q-py-xl">
    <q-spinner color="primary" :size="tamano" />
    <span class="q-ml-md self-center texto-suave">{{ mensaje }}</span>
  </div>
</template>
