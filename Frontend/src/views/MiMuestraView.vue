<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import DetalleMuestra from "@/components/Domain/DetalleMuestra.vue";
import { useNotificar } from "@/composables/useNotificar";
import * as muestrasService from "@/services/muestras.service";

const route = useRoute();
const { notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const detalle = ref(null);

const muestra = computed(() => detalle.value?.muestra || null);
const rotulo = computed(() => detalle.value?.rotulo || null);

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await muestrasService.obtener(route.params.id);
    detalle.value = respuesta.datos;
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
      titulo="Detalle de muestra"
      :subtitulo="muestra?.codigo_muestra || 'Informacion de tu muestra'"
      icono="science"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'mis-muestras' }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !detalle"
      titulo="No se pudo cargar la muestra"
      detalle="Verifica que la muestra exista y que tengas acceso."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <DetalleMuestra v-else :detalle="detalle" :mostrar-prioridad="false">
      <template #acciones>
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="download" size="18px" class="q-mr-sm" />
            Documentos
          </div>

          <div class="q-pa-md column q-gutter-sm">
            <BotonDescarga
              :obtener="() => muestrasService.descargarActa(muestra._id)"
              label="Acta de recepcion"
              icono="description"
              color="primary"
              mensaje="Acta descargada"
              outline
            />

            <BotonDescarga
              v-if="rotulo"
              :obtener="() => muestrasService.descargarRotulo(muestra._id)"
              label="Rotulo de la muestra"
              icono="qr_code"
              color="primary"
              mensaje="Rotulo descargado"
              outline
            />

            <div v-else class="text-caption texto-suave">
              El rotulo estara disponible cuando el laboratorio lo genere.
            </div>

            <q-btn
              flat
              no-caps
              color="primary"
              icon="timeline"
              label="Ver trazabilidad"
              :to="{ name: 'trazabilidad', params: { id: muestra._id } }"
            />
          </div>
        </q-card>
      </template>
    </DetalleMuestra>
  </q-page>
</template>
