<script setup>
import { formatDateTime } from "@/utils/formatDate";

defineProps({
  items: { type: Array, default: () => [] },
});
</script>

<template>
  <div v-if="items.length === 0" class="text-caption texto-suave q-pa-md">
    Todavia no hay movimientos registrados para esta muestra.
  </div>

  <q-timeline v-else color="primary" class="q-px-sm">
    <q-timeline-entry
      v-for="item in items"
      :key="item._id"
      :title="item.etapa?.nombre || 'Avance'"
      :subtitle="formatDateTime(item.fecha_hora)"
      icon="science"
    >
      <div class="text-body2">
        {{ item.observaciones || "Sin observaciones." }}
      </div>
      <div class="text-caption texto-suave q-mt-xs">
        Registrado por:
        {{ item.usuario?.nombres || "" }} {{ item.usuario?.apellidos || "" }}
      </div>
    </q-timeline-entry>
  </q-timeline>
</template>
