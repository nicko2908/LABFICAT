<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import { useNotificar } from "@/composables/useNotificar";
import { obtener } from "@/services/encuestas.service";
import { formatDateTime } from "@/utils/formatDate";

const route = useRoute();
const { notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const encuesta = ref(null);

const preguntas = computed(() => {
  const datos = encuesta.value || {};
  return [
    { etiqueta: "Satisfaccion general", valor: datos.satisfaccion_general },
    { etiqueta: "Tiempo de entrega", valor: datos.tiempo_entrega },
    { etiqueta: "Atencion del personal", valor: datos.atencion_personal },
    { etiqueta: "Claridad del informe", valor: datos.claridad_informe },
  ];
});

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await obtener(route.params.id);
    encuesta.value = respuesta.datos;
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
      titulo="Encuesta de satisfaccion"
      :subtitulo="encuesta?.solicitud?.codigo_solicitud || 'Tu respuesta'"
      icono="poll"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'mis-encuestas' }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !encuesta"
      titulo="No se pudo cargar la encuesta"
      detalle="Verifica que la encuesta exista."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <q-card v-else flat class="tarjeta q-pa-lg">
      <div class="section-box__title q-mb-md">Tus respuestas</div>

      <div class="row q-col-gutter-md">
        <div v-for="pregunta in preguntas" :key="pregunta.etiqueta" class="col-12 col-sm-6">
          <div class="data-label">{{ pregunta.etiqueta }}</div>
          <div class="row items-center q-mt-xs">
            <q-rating
              :model-value="Number(pregunta.valor) || 0"
              :max="5"
              size="24px"
              color="warning"
              readonly
            />
            <span class="q-ml-sm text-weight-medium">{{ pregunta.valor }} / 5</span>
          </div>
        </div>

        <div class="col-12 col-sm-6">
          <div class="data-label">Recomendaria el servicio</div>
          <div class="data-value">{{ encuesta.recomendaria_servicio ? "Si" : "No" }}</div>
        </div>

        <div class="col-12 col-sm-6">
          <div class="data-label">Fecha de respuesta</div>
          <div class="data-value">{{ formatDateTime(encuesta.fecha_respuesta) }}</div>
        </div>

        <div class="col-12">
          <div class="data-label">Comentarios</div>
          <div class="data-value">{{ encuesta.comentarios || "-" }}</div>
        </div>
      </div>
    </q-card>
  </q-page>
</template>
