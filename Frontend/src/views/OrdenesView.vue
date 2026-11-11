<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import * as cotizacionesService from "@/services/cotizaciones.service";
import * as muestrasService from "@/services/muestras.service";
import * as ordenesService from "@/services/ordenes.service";
import { useAuthStore } from "@/store/Auth";
import { ESTADO_ORDEN } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";
import { validarOrden } from "@/utils/validaciones";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  ordenesService.listar,
  { filtros: { estado: "", muestra: "" } }
);

const dialogo = ref(false);
const guardando = ref(false);
const cargandoMuestras = ref(false);
const cargandoCotizacion = ref(false);

const muestrasDisponibles = ref([]);
const formulario = ref(ordenInicial());
const muestraSeleccionada = ref(null);
const cotizacionMuestra = ref(null);

const columnas = [
  {
    name: "muestra",
    label: "Muestra",
    field: (fila) => fila.muestra?.codigo_muestra || "-",
    align: "left",
  },
  {
    name: "analisis",
    label: "Ensayo",
    field: (fila) => fila.analisis?.nombre || "-",
    align: "left",
  },
  { name: "iteracion", label: "Iteracion", field: "numero_iteracion", align: "center" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  {
    name: "usuario",
    label: "Responsable",
    field: (fila) =>
      fila.usuario ? `${fila.usuario.nombres} ${fila.usuario.apellidos}`.trim() : "-",
    align: "left",
  },
  { name: "fecha", label: "Creada", field: "createdAt", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_ORDEN);

const itemsCotizacion = computed(() => {
  const cotizacion = cotizacionMuestra.value;
  if (!cotizacion) return [];
  if (Array.isArray(cotizacion.items) && cotizacion.items.length > 0) {
    return cotizacion.items;
  }
  return [{ numero: 1, detalle: cotizacion.detalle || [] }];
});

const analisisDisponibles = computed(() => {
  const numeroItem = Number(muestraSeleccionada.value?.cotizacion_item || 1);
  const item = itemsCotizacion.value.find(
    (linea) => Number(linea.numero) === numeroItem
  );
  return (item?.detalle || [])
    .map((linea) => linea.analisis)
    .filter((analisis) => analisis && typeof analisis === "object");
});

function ordenInicial() {
  return { muestra: null, analisis: null, proceso: "", observaciones: "" };
}

onMounted(async () => {
  await cargar();

  const muestraQuery = String(route.query.muestra || "");
  if (!muestraQuery) return;

  filtros.muestra = muestraQuery;
  paginacion.page = 1;
  await cargar();

  if (auth.esCoordinador) await abrirNueva(muestraQuery);
});

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function limpiarMuestra() {
  filtros.muestra = "";
  aplicarFiltros();
}

function ver(fila) {
  router.push({ name: "orden-detalle", params: { id: fila._id } });
}

async function abrirNueva(muestraId = null) {
  formulario.value = ordenInicial();
  muestraSeleccionada.value = null;
  cotizacionMuestra.value = null;
  dialogo.value = true;
  cargandoMuestras.value = true;

  try {
    const respuesta = await muestrasService.listar({
      estado_recepcion: "ACEPTADA",
      limit: 100,
    });
    muestrasDisponibles.value = (respuesta.datos?.items || []).filter(
      (muestra) => muestra.solicitud?.estado === "En analisis"
    );

    if (muestraId) {
      const muestra =
        muestrasDisponibles.value.find((item) => String(item._id) === String(muestraId)) ||
        null;
      if (muestra) {
        formulario.value.muestra = muestra._id;
        await alElegirMuestra(muestra._id);
      }
    }
  } catch (err) {
    notificarError(err);
  } finally {
    cargandoMuestras.value = false;
  }
}

async function alElegirMuestra(idMuestra) {
  formulario.value.analisis = null;
  cotizacionMuestra.value = null;
  muestraSeleccionada.value =
    muestrasDisponibles.value.find((item) => item._id === idMuestra) || null;

  const idCotizacion = muestraSeleccionada.value?.cotizacion;
  if (!idCotizacion) return;

  cargandoCotizacion.value = true;
  try {
    const respuesta = await cotizacionesService.obtener(idCotizacion);
    cotizacionMuestra.value = respuesta.datos;
  } catch (err) {
    notificarError(err);
  } finally {
    cargandoCotizacion.value = false;
  }
}

async function guardar() {
  const errores = validarOrden({
    muestra: formulario.value.muestra,
    analisis: formulario.value.analisis,
  });

  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await ordenesService.crear({
      muestra: formulario.value.muestra,
      analisis: formulario.value.analisis,
      proceso: formulario.value.proceso || null,
      observaciones: formulario.value.observaciones || null,
    });
    dialogo.value = false;
    notificarOk("Orden creada correctamente.");
    router.push({ name: "orden-detalle", params: { id: respuesta.datos._id } });
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
      titulo="Ordenes de analisis"
      subtitulo="Trabajo del laboratorio por muestra y ensayo"
      icono="biotech"
    >
      <template v-if="auth.esCoordinador" #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Nueva orden"
          @click="abrirNueva()"
        />
      </template>
    </EncabezadoPagina>

    <div class="row q-col-gutter-md q-mb-md items-center">
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

      <div v-if="filtros.muestra" class="col-12 col-sm-auto">
        <q-chip removable color="primary" text-color="white" @remove="limpiarMuestra">
          Filtrada por una muestra
        </q-chip>
      </div>
    </div>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      :buscable="false"
      mensaje-vacio="No hay ordenes registradas"
      @request="onRequest"
    >
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

    <q-dialog v-model="dialogo" persistent>
      <q-card style="width: 620px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Nueva orden de analisis</div>
          <div class="text-caption texto-suave">
            Solo sobre muestras aceptadas de solicitudes En analisis.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select
            v-model="formulario.muestra"
            :options="muestrasDisponibles"
            option-value="_id"
            option-label="codigo_muestra"
            emit-value
            map-options
            outlined
            label="Muestra *"
            :loading="cargandoMuestras"
            @update:model-value="alElegirMuestra"
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
          </q-select>

          <q-select
            v-model="formulario.analisis"
            :options="analisisDisponibles"
            option-value="_id"
            option-label="nombre"
            emit-value
            map-options
            outlined
            label="Ensayo *"
            :loading="cargandoCotizacion"
            :disable="analisisDisponibles.length === 0"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.nombre }}</q-item-label>
                  <q-item-label caption>
                    {{ scope.opt.codigo ? `Codigo ${scope.opt.codigo}` : "" }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <div
            v-if="formulario.muestra && analisisDisponibles.length === 0 && !cargandoCotizacion"
            class="text-caption text-negative"
          >
            La muestra no tiene ensayos disponibles o su cotizacion ya no esta aceptada.
          </div>

          <q-input
            v-model="formulario.proceso"
            outlined
            label="Proceso"
            counter
            maxlength="250"
          />

          <q-input
            v-model="formulario.observaciones"
            outlined
            type="textarea"
            label="Observaciones"
            counter
            autogrow
            maxlength="200"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Crear orden"
            :loading="guardando"
            @click="guardar"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
