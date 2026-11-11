<script setup>
import { onMounted, ref } from "vue";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import * as reclamacionesService from "@/services/reclamaciones.service";
import { ESTADO_RECLAMACION } from "@/utils/estados";
import { formatDate, formatDateTime } from "@/utils/formatDate";

const { notificarError } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  reclamacionesService.listarMias,
  { filtros: { estado: "" } }
);

const dialogo = ref(false);
const cargandoDetalle = ref(false);
const detalle = ref(null);

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

async function ver(fila) {
  dialogo.value = true;
  cargandoDetalle.value = true;
  detalle.value = null;
  try {
    const respuesta = await reclamacionesService.obtener(fila._id);
    detalle.value = respuesta.datos;
  } catch (err) {
    notificarError(err);
    dialogo.value = false;
  } finally {
    cargandoDetalle.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis reclamaciones"
      subtitulo="Reclamaciones registradas sobre tus servicios"
      icono="report_problem"
    >
      <template #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Nueva reclamacion"
          :to="{ name: 'nueva-reclamacion' }"
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
      :buscable="false"
      mensaje-vacio="Todavia no has registrado reclamaciones"
      @request="onRequest"
    >
      <template #body-cell-motivo="{ value }">
        <q-td class="ellipsis" style="max-width: 320px">{{ value }}</q-td>
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

    <q-dialog v-model="dialogo">
      <q-card style="width: 640px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Detalle de la reclamacion</div>
          <div class="text-caption texto-suave">
            {{ detalle?.codigo_soporte || "Reclamacion" }}
          </div>
        </q-card-section>

        <q-card-section>
          <LoadingBlock v-if="cargandoDetalle" mensaje="Cargando detalle..." />

          <div v-else-if="detalle" class="q-gutter-md">
            <div class="row items-center justify-between">
              <span class="texto-suave">Estado</span>
              <EstadoChip :estado="detalle.estado" />
            </div>
            <div>
              <div class="data-label">Solicitud</div>
              <div class="data-value">{{ detalle.solicitud?.codigo_solicitud || "-" }}</div>
            </div>
            <div>
              <div class="data-label">Motivo</div>
              <div class="data-value">{{ detalle.motivo }}</div>
            </div>
            <div>
              <div class="data-label">Fecha de registro</div>
              <div class="data-value">{{ formatDateTime(detalle.fecha_registro) }}</div>
            </div>
            <div v-if="detalle.fecha_resolucion">
              <div class="data-label">Fecha de resolucion</div>
              <div class="data-value">{{ formatDateTime(detalle.fecha_resolucion) }}</div>
            </div>

            <div>
              <div class="data-label q-mb-sm">
                Evidencias ({{ (detalle.evidencias || []).length }})
              </div>
              <div v-if="(detalle.evidencias || []).length === 0" class="text-caption texto-suave">
                No se adjuntaron evidencias.
              </div>
              <div v-else class="column q-gutter-sm">
                <BotonDescarga
                  v-for="evidencia in detalle.evidencias"
                  :key="evidencia._id"
                  :obtener="() =>
                    reclamacionesService.descargarEvidencia(
                      detalle._id,
                      evidencia._id,
                      evidencia.archivo?.nombre_original || 'evidencia'
                    )"
                  :label="evidencia.archivo?.nombre_original || 'Descargar evidencia'"
                  icono="image"
                  color="primary"
                  mensaje="Evidencia descargada"
                  outline
                />
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cerrar" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
