<script setup>
import { onMounted, ref } from "vue";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { listar } from "@/services/auditoria.service";
import { formatDateTime } from "@/utils/formatDate";

const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listar,
  { filtros: { accion: "", desde: "", hasta: "" } }
);

const rango = ref({ desde: "", hasta: "" });
const dialogo = ref(false);
const detalle = ref(null);

const columnas = [
  { name: "fecha", label: "Fecha", field: "fecha_hora", align: "left" },
  { name: "accion", label: "Accion", field: "accion", align: "left" },
  {
    name: "usuario",
    label: "Usuario",
    field: (fila) =>
      fila.usuario
        ? `${fila.usuario.nombres} ${fila.usuario.apellidos}`.trim()
        : "-",
    align: "left",
  },
  {
    name: "correo",
    label: "Correo",
    field: (fila) => fila.usuario?.correo || "-",
    align: "left",
  },
  { name: "ip", label: "IP", field: (fila) => fila.ip || "-", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

onMounted(cargar);

function aplicar() {
  filtros.desde = rango.value.desde ? `${rango.value.desde}T00:00:00` : "";
  filtros.hasta = rango.value.hasta ? `${rango.value.hasta}T23:59:59` : "";
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function buscar(texto) {
  filtros.accion = texto;
  aplicar();
}

function limpiar() {
  rango.value = { desde: "", hasta: "" };
  filtros.accion = "";
  aplicar();
}

function ver(fila) {
  detalle.value = fila;
  dialogo.value = true;
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Auditoria"
      subtitulo="Bitacora de acciones del sistema"
      icono="history"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="refresh"
          label="Actualizar"
          :loading="cargando"
          @click="cargar"
        />
      </template>
    </EncabezadoPagina>

    <q-card flat class="tarjeta q-pa-md q-mb-lg">
      <div class="row q-col-gutter-md items-end">
        <div class="col-12 col-sm-4 col-md-3">
          <q-input
            v-model="rango.desde"
            type="date"
            outlined
            dense
            label="Desde"
            @update:model-value="aplicar"
          />
        </div>
        <div class="col-12 col-sm-4 col-md-3">
          <q-input
            v-model="rango.hasta"
            type="date"
            outlined
            dense
            label="Hasta"
            @update:model-value="aplicar"
          />
        </div>
        <div class="col-12 col-sm-auto">
          <q-btn flat no-caps color="primary" label="Limpiar filtros" @click="limpiar" />
        </div>
      </div>
      <div class="text-caption texto-suave q-mt-sm">
        La busqueda filtra por accion; las fechas se incluyen completas.
      </div>
    </q-card>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      mensaje-vacio="No hay registros de auditoria"
      @request="onRequest"
      @buscar="buscar"
    >
      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDateTime(value) }}</q-td>
      </template>

      <template #body-cell-accion="{ value }">
        <q-td>
          <q-badge color="primary" :label="value" />
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

    <q-dialog v-model="dialogo">
      <q-card v-if="detalle" style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Registro de auditoria</div>
          <div class="text-caption texto-suave">
            {{ formatDateTime(detalle.fecha_hora) }}
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <div>
            <div class="data-label">Accion</div>
            <div class="data-value">{{ detalle.accion }}</div>
          </div>
          <div>
            <div class="data-label">Usuario</div>
            <div class="data-value">
              {{
                detalle.usuario
                  ? `${detalle.usuario.nombres} ${detalle.usuario.apellidos}`.trim()
                  : "-"
              }}
            </div>
          </div>
          <div>
            <div class="data-label">Correo</div>
            <div class="data-value">{{ detalle.usuario?.correo || "-" }}</div>
          </div>
          <div>
            <div class="data-label">IP</div>
            <div class="data-value">{{ detalle.ip || "-" }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cerrar" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
