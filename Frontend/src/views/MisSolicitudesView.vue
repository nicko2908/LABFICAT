<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { listarMias } from "@/services/solicitudes.service";
import { ESTADO_SOLICITUD } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";

const router = useRouter();
const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listarMias,
  { filtros: { estado: "", search: "" } }
);

const columnas = [
  { name: "codigo", label: "Codigo", field: "codigo_solicitud", align: "left", sortable: true },
  { name: "fecha", label: "Fecha", field: "createdAt", align: "left" },
  {
    name: "ensayos",
    label: "Ensayos",
    field: (fila) => (fila.analisis || []).length,
    align: "center",
  },
  { name: "descripcion", label: "Descripcion", field: "descripcion_inicial", align: "left" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_SOLICITUD);

onMounted(cargar);

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function buscar(texto) {
  filtros.search = texto;
  aplicarFiltros();
}

function ver(fila) {
  router.push({ name: "mi-solicitud", params: { id: fila._id } });
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis solicitudes"
      subtitulo="Historial de solicitudes de analisis"
      icono="description"
    >
      <template #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Nueva solicitud"
          :to="{ name: 'mis-solicitudes-nueva' }"
        />
      </template>
    </EncabezadoPagina>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-5 col-md-4">
        <q-select
          v-model="filtros.estado"
          :options="opcionesEstado"
          outlined
          dense
          clearable
          label="Filtrar por estado"
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
      mensaje-vacio="Todavia no tienes solicitudes registradas"
      @request="onRequest"
      @buscar="buscar"
    >
      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-descripcion="{ value }">
        <q-td class="ellipsis" style="max-width: 280px">
          {{ value || "-" }}
        </q-td>
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
