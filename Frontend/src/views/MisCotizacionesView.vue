<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { descargarExcel, listarMias } from "@/services/cotizaciones.service";
import { ESTADO_COTIZACION } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";

const router = useRouter();
const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listarMias,
  { filtros: { estado: "" } }
);

const columnas = [
  { name: "codigo", label: "Cotizacion", field: "codigo_completo", align: "left" },
  {
    name: "solicitud",
    label: "Solicitud",
    field: (fila) => fila.solicitud?.codigo_solicitud || "-",
    align: "left",
  },
  { name: "fecha", label: "Emision", field: "fecha_emision", align: "left" },
  { name: "valor", label: "Valor total", field: "valor_total", align: "right" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_COTIZACION);

onMounted(cargar);

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function ver(fila) {
  router.push({ name: "mi-cotizacion", params: { id: fila._id } });
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis cotizaciones"
      subtitulo="Revisa, firma o rechaza las cotizaciones del laboratorio"
      icono="request_quote"
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
      :buscable="false"
      mensaje-vacio="Todavia no tienes cotizaciones"
      @request="onRequest"
    >
      <template #body-cell-codigo="{ row }">
        <q-td>
          {{ row.codigo_completo || `${row.codigo_cotizacion || "-"}V${row.version || 1}` }}
        </q-td>
      </template>

      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-valor="{ value }">
        <q-td class="text-right">{{ formatMoney(value) }}</q-td>
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
            class="q-mr-xs"
            @click="ver(row)"
          />
          <BotonDescarga
            :obtener="() => descargarExcel(row._id)"
            label="Excel"
            icono="download"
            color="primary"
            mensaje="Cotizacion descargada"
            outline
          />
        </q-td>
      </template>
    </TablaDatos>
  </q-page>
</template>
