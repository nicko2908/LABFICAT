<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { listarMias } from "@/services/muestras.service";
import { formatDate } from "@/utils/formatDate";

const router = useRouter();
const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listarMias,
  { filtros: { estado_recepcion: "", search: "" } }
);

const columnas = [
  { name: "codigo", label: "Muestra", field: "codigo_muestra", align: "left", sortable: true },
  {
    name: "solicitud",
    label: "Solicitud",
    field: (fila) => fila.solicitud?.codigo_solicitud || "-",
    align: "left",
  },
  {
    name: "tipo",
    label: "Tipo",
    field: (fila) => fila.tipo_muestra?.nombre || "-",
    align: "left",
  },
  { name: "fecha", label: "Recepcion", field: "fecha_recepcion", align: "left" },
  { name: "estado", label: "Estado", field: "estado_recepcion", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = ["ACEPTADA", "RECHAZADA"];

onMounted(cargar);

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function ver(fila) {
  router.push({ name: "mi-muestra", params: { id: fila._id } });
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis muestras"
      subtitulo="Muestras recibidas por el laboratorio"
      icono="science"
    />

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-5 col-md-4">
        <q-select
          v-model="filtros.estado_recepcion"
          :options="opcionesEstado"
          outlined
          dense
          clearable
          label="Estado de recepcion"
          @update:model-value="aplicarFiltros"
        />
      </div>
    </div>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      mensaje-vacio="Todavia no tienes muestras registradas"
      @request="onRequest"
      @buscar="(texto) => { filtros.search = texto; aplicarFiltros(); }"
    >
      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-estado="{ value }">
        <q-td>
          <EstadoChip :estado="value" />
        </q-td>
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
  </q-page>
</template>
