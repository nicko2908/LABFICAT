<script setup>
defineProps({
  titulo: { type: String, default: "No hay registros" },
  detalle: { type: String, default: "Cuando existan datos apareceran aqui." },
  icono: { type: String, default: "inbox" },
});
</script>

<template>
  <div class="column flex-center q-py-xl text-center">
    <q-icon :name="icono" size="56px" color="grey-4" class="q-mb-sm" />
    <div class="text-subtitle1 text-weight-medium">{{ titulo }}</div>
    <div class="text-caption texto-suave q-mt-xs">{{ detalle }}</div>
    <div class="q-mt-md">
      <slot name="acciones" />
    </div>
  </div>
</template>
