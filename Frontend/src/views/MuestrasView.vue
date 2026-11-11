<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import RecepcionMuestra from "@/components/Domain/RecepcionMuestra.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import * as cotizacionesService from "@/services/cotizaciones.service";
import * as muestrasService from "@/services/muestras.service";
import * as solicitudesService from "@/services/solicitudes.service";
import { useAuthStore } from "@/store/Auth";
import { useCatalogosStore } from "@/store/Catalogos";
import { PRIORIDADES } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";
import { validarRecepcionMuestra } from "@/utils/validaciones";

const router = useRouter();
const auth = useAuthStore();
const catalogos = useCatalogosStore();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  muestrasService.listar,
  { filtros: { estado_recepcion: "", search: "" } }
);

const prioridad = ref(null);

const dialogo = ref(false);
const guardando = ref(false);
const cargandoSolicitudes = ref(false);
const cargandoCotizaciones = ref(false);

const solicitudesDisponibles = ref([]);
const cotizacionActual = ref(null);
const formulario = ref(recepcionInicial());

const columnas = [
  { name: "codigo", label: "Muestra", field: "codigo_muestra", align: "left", sortable: true },
  {
    name: "solicitud",
    label: "Solicitud",
    field: (fila) => fila.solicitud?.codigo_solicitud || "-",
    align: "left",
  },
  {
    name: "tipo",
    label: "Tipo",
    field: (fila) => fila.tipo_muestra?.nombre || "-",
    align: "left",
  },
  { name: "fecha", label: "Recepcion", field: "fecha_recepcion", align: "left" },
  { name: "prioridad", label: "Prioridad", field: "prioridad", align: "center" },
  { name: "estado", label: "Estado", field: "estado_recepcion", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = ["ACEPTADA", "RECHAZADA"];

const itemsCotizacion = computed(() => {
  const cotizacion = cotizacionActual.value;
  if (!cotizacion) return [];
  if (Array.isArray(cotizacion.items) && cotizacion.items.length > 0) {
    return cotizacion.items;
  }
  return [{ numero: 1, descripcion_muestra: null, detalle: cotizacion.detalle || [] }];
});

const opcionesItem = computed(() =>
  itemsCotizacion.value.map((item) => ({
    label: `Item ${item.numero}${item.descripcion_muestra ? ` · ${item.descripcion_muestra}` : ""}`,
    value: item.numero,
  }))
);

const itemSeleccionado = computed(() =>
  itemsCotizacion.value.find(
    (item) => Number(item.numero) === Number(formulario.value.cotizacion_item)
  )
);

const analisisDelItem = computed(() =>
  (itemSeleccionado.value?.detalle || [])
    .map((linea) => linea.analisis)
    .filter((analisis) => analisis && typeof analisis === "object")
);

function recepcionInicial() {
  return {
    solicitud: null,
    cotizacion_item: 1,
    tipo_muestra: null,
    fecha_recepcion: new Date().toISOString().slice(0, 10),
    estado_recepcion: "ACEPTADA",
    cantidad_recibida: "",
    unidad_medida: null,
    numero_envases: 1,
    condiciones_conservacion: "",
    observaciones_predefinidas: [],
    motivo_rechazo: "",
    nombre: "",
    descripcion: "",
    matriz: "",
    municipio_recoleccion: "",
    direccion_toma: "",
    lugar_toma: "",
    recolectada_por: "",
    procedimiento_muestreo: "",
  };
}

onMounted(async () => {
  await cargar();
  try {
    await catalogos.cargarTiposMuestra();
  } catch (err) {
    notificarError(err);
  }
});

function aplicarFiltros() {
  paginacion.page = 1;
  const extra = {};
  if (prioridad.value) extra.prioridad = prioridad.value;
  cargar(extra).catch(notificarError);
}

function ver(fila) {
  router.push({ name: "muestra-detalle", params: { id: fila._id } });
}

async function abrirRecepcion() {
  formulario.value = recepcionInicial();
  cotizacionActual.value = null;
  dialogo.value = true;
  cargandoSolicitudes.value = true;
  try {
    const respuesta = await solicitudesService.listar({ limit: 100 });
    const estados = ["Aceptada", "Pago aprobado", "En analisis"];
    solicitudesDisponibles.value = (respuesta.datos?.items || []).filter((solicitud) =>
      estados.includes(solicitud.estado)
    );
  } catch (err) {
    notificarError(err);
  } finally {
    cargandoSolicitudes.value = false;
  }
}

async function alElegirSolicitud(idSolicitud) {
  formulario.value.cotizacion_item = 1;
  cotizacionActual.value = null;

  if (!idSolicitud) return;

  cargandoCotizaciones.value = true;
  try {
    const respuesta = await cotizacionesService.listar({
      solicitud: idSolicitud,
      estado: "ACEPTADA",
      limit: 10,
    });
    cotizacionActual.value = respuesta.datos?.items?.[0] || null;
  } catch (err) {
    notificarError(err);
  } finally {
    cargandoCotizaciones.value = false;
  }
}

async function guardar() {
  const errores = validarRecepcionMuestra({
    ...formulario.value,
    solicitud: formulario.value.solicitud,
  });

  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  if (!cotizacionActual.value) {
    notificarAdvertencia("La solicitud no tiene una cotizacion aceptada");
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await muestrasService.crear({
      solicitud: formulario.value.solicitud,
      cotizacion: cotizacionActual.value._id,
      cotizacion_item: Number(formulario.value.cotizacion_item) || 1,
      tipo_muestra: formulario.value.tipo_muestra,
      unidad_medida: formulario.value.unidad_medida || null,
      fecha_recepcion: formulario.value.fecha_recepcion,
      estado_recepcion: formulario.value.estado_recepcion,
      cantidad_recibida:
        formulario.value.cantidad_recibida === ""
          ? null
          : Number(formulario.value.cantidad_recibida),
      numero_envases: Number(formulario.value.numero_envases) || 1,
      condiciones_conservacion: formulario.value.condiciones_conservacion || null,
      observaciones_predefinidas: formulario.value.observaciones_predefinidas,
      motivo_rechazo: formulario.value.motivo_rechazo || null,
      nombre: formulario.value.nombre || null,
      descripcion: formulario.value.descripcion || null,
      matriz: formulario.value.matriz || null,
      municipio_recoleccion: formulario.value.municipio_recoleccion || null,
      direccion_toma: formulario.value.direccion_toma || null,
      lugar_toma: formulario.value.lugar_toma || null,
      recolectada_por: formulario.value.recolectada_por || null,
      procedimiento_muestreo: formulario.value.procedimiento_muestreo || null,
    });

    dialogo.value = false;
    notificarOk("Muestra recibida correctamente.");
    await cargar();
    router.push({ name: "muestra-detalle", params: { id: respuesta.datos._id } });
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
      titulo="Muestras"
      subtitulo="Recepcion y seguimiento de muestras del laboratorio"
      icono="science"
    >
      <template v-if="auth.esCoordinador" #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Recibir muestra"
          @click="abrirRecepcion"
        />
      </template>
    </EncabezadoPagina>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-4 col-md-3">
        <q-select
          v-model="filtros.estado_recepcion"
          :options="opcionesEstado"
          outlined
          dense
          clearable
          label="Estado de recepcion"
          @update:model-value="aplicarFiltros"
        />
      </div>
      <div class="col-12 col-sm-4 col-md-3">
        <q-select
          v-model="prioridad"
          :options="PRIORIDADES"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          outlined
          dense
          clearable
          label="Prioridad"
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
      mensaje-vacio="No hay muestras registradas"
      @request="onRequest"
      @buscar="(texto) => { filtros.search = texto; aplicarFiltros(); }"
    >
      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
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

    <q-dialog v-model="dialogo" persistent>
      <q-card style="width: 860px; max-width: 96vw">
        <q-card-section>
          <div class="text-h6">Recepcion de muestra</div>
          <div class="text-caption texto-suave">
            Registra el ingreso de una muestra para una solicitud con cotizacion aceptada.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-7">
              <q-select
                v-model="formulario.solicitud"
                :options="solicitudesDisponibles"
                option-value="_id"
                option-label="codigo_solicitud"
                emit-value
                map-options
                outlined
                label="Solicitud *"
                :loading="cargandoSolicitudes"
                @update:model-value="alElegirSolicitud"
              >
                <template #option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.codigo_solicitud }}</q-item-label>
                      <q-item-label caption>
                        {{ scope.opt.estado }} · {{ scope.opt.cliente?.tipo_cliente || "" }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <div class="col-12 col-md-5">
              <q-select
                v-model="formulario.cotizacion_item"
                :options="opcionesItem"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                outlined
                label="Item de la cotizacion *"
                :disable="itemsCotizacion.length === 0"
                :loading="cargandoCotizaciones"
              />
            </div>
          </div>

          <div v-if="cotizacionActual" class="text-caption texto-suave">
            Ensayos del item:
            <span v-if="analisisDelItem.length === 0">sin ensayos</span>
            <q-chip
              v-for="analisis in analisisDelItem"
              :key="analisis._id"
              dense
              square
              color="grey-3"
              text-color="black"
              class="q-ml-xs"
            >
              {{ analisis.codigo ? `${analisis.codigo} · ` : "" }}{{ analisis.nombre }}
            </q-chip>
          </div>
          <div v-else-if="formulario.solicitud" class="text-caption text-negative">
            Esta solicitud no tiene una cotizacion aceptada; no se puede recibir la muestra.
          </div>

          <RecepcionMuestra
            v-model="formulario"
            :tipos-muestra="catalogos.tiposMuestra"
          />

          <q-expansion-item
            icon="place"
            label="Datos de recoleccion (opcional)"
            caption="Matriz, municipio, lugar de toma, recolector y procedimiento"
            class="tarjeta"
          >
            <div class="q-pa-md row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <q-input v-model="formulario.matriz" outlined label="Matriz" />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model="formulario.municipio_recoleccion"
                  outlined
                  label="Municipio de recoleccion"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-input v-model="formulario.lugar_toma" outlined label="Lugar de toma" />
              </div>
              <div class="col-12 col-md-6">
                <q-input v-model="formulario.direccion_toma" outlined label="Direccion de toma" />
              </div>
              <div class="col-12 col-md-6">
                <q-input v-model="formulario.recolectada_por" outlined label="Recolectada por" />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model="formulario.procedimiento_muestreo"
                  outlined
                  label="Procedimiento de muestreo"
                />
              </div>
            </div>
          </q-expansion-item>

          <q-expansion-item
            icon="notes"
            label="Observaciones adicionales"
            class="tarjeta"
          >
            <div class="q-pa-md row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <q-input v-model="formulario.nombre" outlined label="Nombre de la muestra" />
              </div>
              <div class="col-12 col-md-6">
                <q-input v-model="formulario.descripcion" outlined label="Descripcion" />
              </div>
            </div>
          </q-expansion-item>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Registrar muestra"
            :loading="guardando"
            @click="guardar"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
