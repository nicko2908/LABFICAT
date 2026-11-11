<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { listarMios } from "@/services/cupones.service";
import { ESTADO_CUPON } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";

const router = useRouter();
const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listarMios,
  { filtros: { estado: "" } }
);

const columnas = [
  {
    name: "codigo",
    label: "Cupon",
    field: (fila) => fila.codigo_cupon || "Sin codigo",
    align: "left",
  },
  { name: "valor", label: "Valor", field: "valor", align: "right" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  {
    name: "vencimiento",
    label: "Vence",
    field: "fecha_vencimiento",
    align: "left",
  },
  {
    name: "recordatorios",
    label: "Recordatorios",
    field: (fila) => (fila.recordatorios || []).length,
    align: "center",
  },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_CUPON);

onMounted(cargar);

function estaVigente(fila) {
  if (!fila.fecha_vencimiento) return true;
  return new Date(fila.fecha_vencimiento).getTime() >= Date.now();
}

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function reportarPago(fila) {
  router.push({ name: "mis-pagos", query: { cupon: fila._id } });
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis cupones"
      subtitulo="Cupones de pago emitidos para tus servicios"
      icono="confirmation_number"
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
      mensaje-vacio="Todavia no tienes cupones"
      @request="onRequest"
    >
      <template #body-cell-valor="{ value }">
        <q-td class="text-right">{{ formatMoney(value) }}</q-td>
      </template>

      <template #body-cell-estado="{ value }">
        <q-td>
          <EstadoChip :estado="value" />
        </q-td>
      </template>

      <template #body-cell-vencimiento="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-acciones="{ row }">
        <q-td class="text-right">
          <q-btn
            v-if="row.estado === 'GENERADO' && estaVigente(row)"
            flat
            dense
            no-caps
            color="primary"
            icon="payments"
            label="Reportar pago"
            @click="reportarPago(row)"
          />
          <span v-else-if="row.estado === 'GENERADO'" class="text-caption text-negative">
            Vencido
          </span>
          <span v-else class="text-caption texto-suave">-</span>
        </q-td>
      </template>
    </TablaDatos>
  </q-page>
</template>
