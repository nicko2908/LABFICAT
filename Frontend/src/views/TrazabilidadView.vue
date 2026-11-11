<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import TimelineTrazabilidad from "@/components/Domain/TimelineTrazabilidad.vue";
import { useNotificar } from "@/composables/useNotificar";
import * as muestrasService from "@/services/muestras.service";
import * as trazabilidadService from "@/services/trazabilidad.service";

const route = useRoute();
const { notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const muestra = ref(null);
const items = ref([]);

const estado = computed(() => muestra.value?.estado_recepcion || "");

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const [respuestaMuestra, respuestaLinea] = await Promise.all([
      muestrasService.obtener(route.params.id),
      trazabilidadService.lineaTiempo(route.params.id),
    ]);
    muestra.value = respuestaMuestra.datos?.muestra || null;
    items.value = respuestaLinea.datos || [];
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Trazabilidad de la muestra"
      :subtitulo="muestra?.codigo_muestra || 'Avance del analisis'"
      icono="timeline"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'mi-muestra', params: { id: route.params.id } }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !muestra"
      titulo="No se pudo cargar la trazabilidad"
      detalle="Verifica que la muestra exista y que tengas acceso."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <div v-else class="row q-col-gutter-lg">
      <div class="col-12 col-lg-4">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="science" size="18px" class="q-mr-sm" />
            Muestra
          </div>
          <div class="q-pa-md">
            <div class="data-label">Codigo</div>
            <div class="data-value">{{ muestra.codigo_muestra }}</div>
            <div class="data-label q-mt-sm">Estado</div>
            <EstadoChip :estado="estado" />
            <div class="data-label q-mt-sm">Tipo</div>
            <div class="data-value">{{ muestra.tipo_muestra?.nombre || "-" }}</div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-8">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="timeline" size="18px" class="q-mr-sm" />
            Avance del proceso
          </div>
          <div class="q-pa-md">
            <TimelineTrazabilidad :items="items" />
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
