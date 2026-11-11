<script setup>
import { computed } from "vue";

import { LONGITUDES } from "@/utils/contrato";
import { formatMoney } from "@/utils/formatMoney";
import { maximo, numeroMayorA, seleccionRequerida } from "@/utils/reglas";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  analisis: { type: Array, default: () => [] },
  esInterno: { type: Boolean, default: false },
  soloLectura: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

const opcionesAnalisis = computed(() =>
  props.analisis.map((item) => ({
    label: `${item.codigo ? `${item.codigo} · ` : ""}${item.nombre}`,
    value: item._id,
    tarifa: Number(item.tarifa_externo) || 0,
  }))
);

function clonar(items) {
  return JSON.parse(JSON.stringify(items || []));
}

function emitir(items) {
  emit("update:modelValue", items);
}

function agregarItem() {
  const items = clonar(props.modelValue);
  items.push({
    numero: items.length + 1,
    descripcion_muestra: "",
    detalle: [{ analisis: null, cantidad: 1 }],
  });
  emitir(items);
}

function quitarItem(indice) {
  const items = clonar(props.modelValue).filter((_, i) => i !== indice);
  items.forEach((item, i) => {
    item.numero = i + 1;
  });
  emitir(items);
}

function agregarLinea(indice) {
  const items = clonar(props.modelValue);
  items[indice].detalle.push({ analisis: null, cantidad: 1 });
  emitir(items);
}

function quitarLinea(indiceItem, indiceLinea) {
  const items = clonar(props.modelValue);
  items[indiceItem].detalle.splice(indiceLinea, 1);
  emitir(items);
}

function actualizarItem(indice, campo, valor) {
  const items = clonar(props.modelValue);
  items[indice][campo] = valor;
  emitir(items);
}

function actualizarLinea(indiceItem, indiceLinea, campo, valor) {
  const items = clonar(props.modelValue);
  items[indiceItem].detalle[indiceLinea][campo] = valor;
  emitir(items);
}

function tarifaDe(analisisId) {
  return opcionesAnalisis.value.find((opcion) => opcion.value === analisisId)?.tarifa || 0;
}

function totalLinea(linea) {
  const tarifa = props.esInterno ? 0 : tarifaDe(linea.analisis);
  return (Number(linea.cantidad) || 0) * tarifa;
}

const total = computed(() =>
  props.modelValue.reduce(
    (acumulado, item) =>
      acumulado +
      (item.detalle || []).reduce((suma, linea) => suma + totalLinea(linea), 0),
    0
  )
);
</script>

<template>
  <div class="column q-gutter-md">
    <q-card
      v-for="(item, indiceItem) in modelValue"
      :key="indiceItem"
      flat
      class="tarjeta q-pa-md"
    >
      <div class="row items-center justify-between q-mb-sm">
        <div class="text-subtitle2 text-weight-bold">Item {{ item.numero }}</div>
        <q-btn
          v-if="!soloLectura"
          flat
          dense
          round
          color="negative"
          icon="delete"
          aria-label="Quitar item"
          @click="quitarItem(indiceItem)"
        />
      </div>

      <q-input
        :model-value="item.descripcion_muestra"
        label="Descripcion de la muestra"
        outlined
        dense
        counter
        :maxlength="LONGITUDES.cotizacion.descripcion_muestra"
        :readonly="soloLectura"
        :rules="soloLectura ? [] : [maximo(LONGITUDES.cotizacion.descripcion_muestra, 'La descripcion')]"
        @update:model-value="(valor) => actualizarItem(indiceItem, 'descripcion_muestra', valor)"
      />

      <div class="q-mt-md column q-gutter-sm">
        <div
          v-for="(linea, indiceLinea) in item.detalle"
          :key="indiceLinea"
          class="row q-col-gutter-sm items-center"
        >
          <div class="col-12 col-md-7">
            <q-select
              :model-value="linea.analisis"
              :options="opcionesAnalisis"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              outlined
              dense
              label="Ensayo"
              :readonly="soloLectura"
              :rules="soloLectura ? [] : [seleccionRequerida('el ensayo')]"
              @update:model-value="(valor) => actualizarLinea(indiceItem, indiceLinea, 'analisis', valor)"
            />
          </div>

          <div class="col-6 col-md-2">
            <q-input
              :model-value="linea.cantidad"
              type="number"
              min="1"
              outlined
              dense
              label="Cantidad"
              :readonly="soloLectura"
              :rules="soloLectura ? [] : [numeroMayorA(0, 'La cantidad')]"
              @update:model-value="(valor) => actualizarLinea(indiceItem, indiceLinea, 'cantidad', valor === '' ? '' : Number(valor))"
            />
          </div>

          <div class="col-6 col-md-2 text-right text-caption">
            {{ formatMoney(totalLinea(linea)) }}
          </div>

          <div class="col-12 col-md-1 text-right">
            <q-btn
              v-if="!soloLectura && item.detalle.length > 1"
              flat
              dense
              round
              color="negative"
              icon="remove_circle_outline"
              aria-label="Quitar ensayo"
              @click="quitarLinea(indiceItem, indiceLinea)"
            />
          </div>
        </div>
      </div>

      <div v-if="!soloLectura" class="q-mt-sm">
        <q-btn flat dense no-caps color="primary" icon="add" label="Agregar ensayo" @click="agregarLinea(indiceItem)" />
      </div>
    </q-card>

    <q-btn
      v-if="!soloLectura"
      outline
      no-caps
      color="primary"
      icon="add"
      label="Agregar item"
      @click="agregarItem"
    />

    <div class="row justify-end">
      <div class="text-subtitle2">
        Total estimado: <strong>{{ formatMoney(total) }}</strong>
      </div>
    </div>
  </div>
</template>
