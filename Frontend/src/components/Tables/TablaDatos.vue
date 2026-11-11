<script setup>
import { computed, ref, useSlots, watch } from "vue";

import { LIMITES } from "@/utils/contrato";

const props = defineProps({
  filas: { type: Array, required: true },
  columnas: { type: Array, required: true },
  cargando: { type: Boolean, default: false },
  filaClave: { type: String, default: "_id" },
  mensajeVacio: { type: String, default: "No hay registros para mostrar" },
  servidor: { type: Boolean, default: false },
  paginacion: {
    type: Object,
    default: () => ({ page: 1, rowsPerPage: 20, rowsNumber: 0 }),
  },
  filtro: { type: String, default: "" },
  /** Oculta la caja de busqueda cuando el endpoint no soporta `search`. */
  buscable: { type: Boolean, default: true },
});

const emit = defineEmits(["request", "buscar"]);

const busqueda = ref(props.filtro);
const slots = useSlots();

const slotsPropios = ["default", "top", "no-data", "acciones-tabla"];
const slotsReenviados = computed(() =>
  Object.keys(slots).filter((nombre) => !slotsPropios.includes(nombre))
);

const opcionesFilas = computed(() =>
  props.servidor ? [10, 20, 50, 100] : [10, 25, 50, 0]
);

let temporizador;

watch(busqueda, (valor) => {
  if (!props.servidor || !props.buscable) return;

  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    emit("buscar", String(valor ?? "").trim().slice(0, LIMITES.busqueda));
  }, 350);
});

function alSolicitar(request) {
  emit("request", request);
}
</script>

<template>
  <q-table
    :rows="filas"
    :columns="columnas"
    :row-key="filaClave"
    :loading="cargando"
    :filter="servidor ? undefined : busqueda"
    :pagination="paginacion"
    :rows-per-page-options="opcionesFilas"
    :no-data-label="mensajeVacio"
    no-results-label="Ningun registro coincide con la busqueda"
    loading-label="Consultando al servidor..."
    rows-per-page-label="Registros por pagina"
    flat
    bordered
    class="tabla-datos my-sticky-header-table"
    @request="alSolicitar"
  >
    <template #top>
      <div class="row full-width items-center q-col-gutter-sm">
        <div v-if="buscable" class="col-12 col-sm-5">
          <q-input
            v-model="busqueda"
            dense
            outlined
            clearable
            debounce="300"
            :maxlength="LIMITES.busqueda"
            placeholder="Buscar..."
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>

        <q-space class="gt-xs" />

        <div class="col-12 col-sm-auto">
          <slot name="acciones-tabla" />
        </div>
      </div>
    </template>

    <template
      v-for="nombre in slotsReenviados"
      :key="nombre"
      #[nombre]="datosDelSlot"
    >
      <slot :name="nombre" v-bind="datosDelSlot || {}" />
    </template>

    <template #no-data>
      <div class="full-width column flex-center q-py-xl">
        <q-icon name="inbox" size="64px" color="grey-4" class="q-mb-sm" />
        <span class="empty-title">{{ mensajeVacio }}</span>
      </div>
    </template>
  </q-table>
</template>

<style scoped lang="scss">
.tabla-datos {
  border-radius: 8px;
}
</style>
