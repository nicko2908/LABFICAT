<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { usePaginacion } from "@/composables/usePaginacion";
import { listarMios } from "@/services/informes.service";
import { formatDate } from "@/utils/formatDate";

const router = useRouter();

const { filas, cargando, paginacion, cargar, onRequest } = usePaginacion(
  listarMios,
  { filtros: {} }
);

const columnas = [
  {
    name: "muestra",
    label: "Muestra",
    field: (fila) => fila.muestra?.codigo_muestra || "-",
    align: "left",
  },
  { name: "generacion", label: "Generado", field: "fecha_generacion", align: "left" },
  { name: "envio", label: "Enviado", field: "fecha_envio", align: "left" },
  { name: "descarga", label: "Descargado", field: "fecha_descarga", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

onMounted(cargar);

function ver(fila) {
  router.push({ name: "mi-informe", params: { id: fila._id } });
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis informes"
      subtitulo="Informes de resultados de tus muestras"
      icono="summarize"
    />

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      :buscable="false"
      mensaje-vacio="Todavia no tienes informes"
      @request="onRequest"
    >
      <template #body-cell-generacion="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-envio="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-descarga="{ value }">
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
