<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import * as informesService from "@/services/informes.service";
import * as muestrasService from "@/services/muestras.service";
import { formatDate } from "@/utils/formatDate";

const router = useRouter();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const { filas, cargando, paginacion, cargar, onRequest } = usePaginacion(
  informesService.listar,
  { filtros: {} }
);

const dialogo = ref(false);
const guardando = ref(false);
const cargandoMuestras = ref(false);
const muestrasDisponibles = ref([]);
const muestraSeleccionada = ref(null);

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
  {
    name: "usuario",
    label: "Responsable",
    field: (fila) =>
      fila.usuario ? `${fila.usuario.nombres} ${fila.usuario.apellidos}`.trim() : "-",
    align: "left",
  },
  { name: "acciones", label: "", align: "right" },
];

onMounted(cargar);

function ver(fila) {
  router.push({ name: "informe-detalle", params: { id: fila._id } });
}

async function abrirGenerar() {
  dialogo.value = true;
  muestraSeleccionada.value = null;
  cargandoMuestras.value = true;

  try {
    const [respuestaMuestras, respuestaInformes] = await Promise.all([
      muestrasService.listar({ estado_recepcion: "ACEPTADA", limit: 100 }),
      informesService.listar({ limit: 100 }),
    ]);

    const conInforme = new Set(
      (respuestaInformes.datos?.items || []).map((informe) =>
        String(informe.muestra?._id || informe.muestra)
      )
    );

    muestrasDisponibles.value = (respuestaMuestras.datos?.items || []).filter(
      (muestra) =>
        ["En analisis", "Informe listo"].includes(muestra.solicitud?.estado) &&
        !conInforme.has(String(muestra._id))
    );
  } catch (err) {
    notificarError(err);
  } finally {
    cargandoMuestras.value = false;
  }
}

async function generar() {
  if (!muestraSeleccionada.value) {
    notificarAdvertencia("Selecciona la muestra");
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await informesService.generar(muestraSeleccionada.value);
    dialogo.value = false;
    notificarOk("Informe generado correctamente.");
    router.push({ name: "informe-detalle", params: { id: respuesta.datos._id } });
  } catch (err) {
    notificarError(err);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Informes"
      subtitulo="Informes de resultados generados por el laboratorio"
      icono="summarize"
    >
      <template #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Generar informe"
          @click="abrirGenerar"
        />
      </template>
    </EncabezadoPagina>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      :buscable="false"
      mensaje-vacio="No hay informes generados"
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

    <q-dialog v-model="dialogo" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Generar informe</div>
          <div class="text-caption texto-suave">
            Requiere que todas las ordenes activas de la muestra esten finalizadas.
          </div>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="muestraSeleccionada"
            :options="muestrasDisponibles"
            option-value="_id"
            option-label="codigo_muestra"
            emit-value
            map-options
            outlined
            label="Muestra *"
            :loading="cargandoMuestras"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.codigo_muestra }}</q-item-label>
                  <q-item-label caption>
                    {{ scope.opt.solicitud?.codigo_solicitud || "" }} ·
                    {{ scope.opt.tipo_muestra?.nombre || "" }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  No hay muestras pendientes de informe
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Generar"
            :loading="guardando"
            :disable="muestrasDisponibles.length === 0"
            @click="generar"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
