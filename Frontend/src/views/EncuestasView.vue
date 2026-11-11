<script setup>
import { computed, onMounted, ref } from "vue";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import StatCard from "@/components/Common/StatCard.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { listar, resumenGlobal } from "@/services/encuestas.service";
import { formatDate, formatDateTime } from "@/utils/formatDate";

const { notificarError } = useNotificar();

const { filas, cargando, paginacion, cargar, onRequest } = usePaginacion(
  listar,
  { filtros: {} }
);

const resumen = ref(null);
const dialogo = ref(false);
const encuestaSeleccionada = ref(null);

const columnas = [
  {
    name: "solicitud",
    label: "Solicitud",
    field: (fila) => fila.solicitud?.codigo_solicitud || "-",
    align: "left",
  },
  { name: "fecha", label: "Respondida", field: "fecha_respuesta", align: "left" },
  { name: "satisfaccion", label: "Satisfaccion", field: "satisfaccion_general", align: "center" },
  { name: "tiempo", label: "Entrega", field: "tiempo_entrega", align: "center" },
  { name: "atencion", label: "Atencion", field: "atencion_personal", align: "center" },
  { name: "claridad", label: "Informe", field: "claridad_informe", align: "center" },
  {
    name: "recomienda",
    label: "Recomienda",
    field: (fila) => (fila.recomendaria_servicio ? "Si" : "No"),
    align: "center",
  },
  { name: "acciones", label: "", align: "right" },
];

const promedios = computed(() => {
  const datos = resumen.value || {};
  const formato = (valor) =>
    Number.isFinite(Number(valor)) && valor !== null && valor !== undefined
      ? Number(valor).toFixed(1)
      : "-";

  return {
    total: Number(datos.total) || 0,
    satisfaccion: formato(datos.satisfaccion_general),
    tiempo: formato(datos.tiempo_entrega),
    atencion: formato(datos.atencion_personal),
    claridad: formato(datos.claridad_informe),
    recomendacion:
      datos.total > 0 ? `${Math.round((Number(datos.recomiendan) / Number(datos.total)) * 100)}%` : "-",
  };
});

onMounted(async () => {
  await cargar();
  try {
    const respuesta = await resumenGlobal();
    resumen.value = respuesta.datos;
  } catch (err) {
    notificarError(err);
  }
});

function ver(fila) {
  encuestaSeleccionada.value = fila;
  dialogo.value = true;
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Encuestas"
      subtitulo="Satisfaccion de los clientes del laboratorio"
      icono="poll"
    />

    <div v-if="promedios.total > 0" class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md-3">
        <StatCard
          etiqueta="Encuestas"
          :valor="promedios.total"
          icono="poll"
          color="primary"
          detalle="Respuestas recibidas"
        />
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <StatCard
          etiqueta="Satisfaccion"
          :valor="promedios.satisfaccion"
          icono="sentiment_satisfied"
          color="positive"
          detalle="Promedio sobre 5"
        />
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <StatCard
          etiqueta="Atencion"
          :valor="promedios.atencion"
          icono="support_agent"
          color="info"
          detalle="Promedio sobre 5"
        />
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <StatCard
          etiqueta="Recomiendan"
          :valor="promedios.recomendacion"
          icono="thumb_up"
          color="accent"
          detalle="Del total de encuestas"
        />
      </div>
    </div>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      :buscable="false"
      mensaje-vacio="No hay encuestas respondidas"
      @request="onRequest"
    >
      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-acciones="{ row }">
        <q-td class="text-right">
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="visibility"
            label="Ver"
            @click="ver(row)"
          />
        </q-td>
      </template>
    </TablaDatos>

    <q-dialog v-model="dialogo">
      <q-card v-if="encuestaSeleccionada" style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Encuesta de satisfaccion</div>
          <div class="text-caption texto-suave">
            {{ encuestaSeleccionada.solicitud?.codigo_solicitud || "Solicitud" }} ·
            {{ formatDateTime(encuestaSeleccionada.fecha_respuesta) }}
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <div class="row justify-between">
            <span class="texto-suave">Satisfaccion general</span>
            <strong>{{ encuestaSeleccionada.satisfaccion_general }} / 5</strong>
          </div>
          <div class="row justify-between">
            <span class="texto-suave">Tiempo de entrega</span>
            <strong>{{ encuestaSeleccionada.tiempo_entrega }} / 5</strong>
          </div>
          <div class="row justify-between">
            <span class="texto-suave">Atencion del personal</span>
            <strong>{{ encuestaSeleccionada.atencion_personal }} / 5</strong>
          </div>
          <div class="row justify-between">
            <span class="texto-suave">Claridad del informe</span>
            <strong>{{ encuestaSeleccionada.claridad_informe }} / 5</strong>
          </div>
          <div class="row justify-between">
            <span class="texto-suave">Recomendaria el servicio</span>
            <strong>{{ encuestaSeleccionada.recomendaria_servicio ? "Si" : "No" }}</strong>
          </div>
          <q-separator class="q-my-sm" />
          <div>
            <div class="data-label">Comentarios</div>
            <div class="data-value">{{ encuestaSeleccionada.comentarios || "-" }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cerrar" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
