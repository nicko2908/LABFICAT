<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { listar } from "@/services/pagos.service";
import { ESTADO_PAGO } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";

const router = useRouter();
const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listar,
  { filtros: { estado: "" } }
);

const columnas = [
  {
    name: "cupon",
    label: "Cupon",
    field: (fila) => fila.cupon?.codigo_cupon || "Sin codigo",
    align: "left",
  },
  {
    name: "valor",
    label: "Valor",
    field: (fila) => fila.cupon?.valor,
    align: "right",
  },
  { name: "referencia", label: "Referencia", field: "referencia_externa", align: "left" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  { name: "fecha", label: "Carga", field: "fecha_carga", align: "left" },
  {
    name: "validador",
    label: "Validador",
    field: (fila) =>
      fila.validador
        ? `${fila.validador.nombres} ${fila.validador.apellidos}`.trim()
        : "-",
    align: "left",
  },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_PAGO);

onMounted(cargar);

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function ver(fila) {
  router.push({ name: "pago-detalle", params: { id: fila._id } });
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Pagos"
      subtitulo="Soportes de pago reportados por los clientes"
      icono="payments"
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
      mensaje-vacio="No hay pagos reportados"
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

      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-acciones="{ row }">
        <q-td class="text-right">
          <q-btn
            flat
            dense
            no-caps
            :color="row.estado === 'PENDIENTE_VERIFICACION' ? 'primary' : 'grey-8'"
            :icon="row.estado === 'PENDIENTE_VERIFICACION' ? 'fact_check' : 'visibility'"
            :label="row.estado === 'PENDIENTE_VERIFICACION' ? 'Validar' : 'Ver'"
            @click="ver(row)"
          />
        </q-td>
      </template>
    </TablaDatos>
  </q-page>
</template>
