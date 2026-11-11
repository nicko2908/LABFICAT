<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { listar } from "@/services/reclamaciones.service";
import { ESTADO_RECLAMACION } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";

const router = useRouter();
const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listar,
  { filtros: { estado: "", search: "" } }
);

const columnas = [
  { name: "codigo", label: "Reclamacion", field: "codigo_soporte", align: "left" },
  {
    name: "solicitud",
    label: "Solicitud",
    field: (fila) => fila.solicitud?.codigo_solicitud || "-",
    align: "left",
  },
  { name: "motivo", label: "Motivo", field: "motivo", align: "left" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  { name: "fecha", label: "Fecha", field: "fecha_registro", align: "left" },
  {
    name: "evidencias",
    label: "Evidencias",
    field: (fila) => (fila.evidencias || []).length,
    align: "center",
  },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_RECLAMACION);

onMounted(cargar);

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function ver(fila) {
  router.push({ name: "reclamacion-detalle", params: { id: fila._id } });
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Reclamaciones"
      subtitulo="Reclamaciones de los clientes del laboratorio"
      icono="report_problem"
    />

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
      mensaje-vacio="No hay reclamaciones registradas"
      @request="onRequest"
      @buscar="(texto) => { filtros.search = texto; aplicarFiltros(); }"
    >
      <template #body-cell-motivo="{ value }">
        <q-td class="ellipsis" style="max-width: 300px">{{ value }}</q-td>
      </template>

      <template #body-cell-estado="{ value }">
        <q-td>
          <EstadoChip :estado="value" />
        </q-td>
      </template>

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
  </q-page>
</template>
