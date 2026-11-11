<script setup>
import { computed } from "vue";

import { numeroRequerido } from "@/utils/reglas";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  parametros: { type: Array, default: () => [] },
  soloLectura: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

function valorDe(parametroId) {
  return props.modelValue.find((item) => item.parametro === parametroId)?.valor ?? "";
}

function actualizar(parametroId, valor) {
  const existente = props.modelValue.filter((item) => item.parametro !== parametroId);
  const numeroValor = valor === "" || valor === null ? null : Number(valor);
  const nuevoValor = Number.isFinite(numeroValor) ? numeroValor : null;
  emit("update:modelValue", [...existente, { parametro: parametroId, valor: nuevoValor }]);
}

const parametrosConValor = computed(() => props.parametros || []);
</script>

<template>
  <div class="column q-gutter-md">
    <div
      v-for="parametro in parametrosConValor"
      :key="parametro._id"
      class="row q-col-gutter-sm items-center"
    >
      <div class="col-12 col-sm-7">
        <div class="text-body2 text-weight-medium">{{ parametro.nombre }}</div>
        <div class="text-caption texto-suave">
          {{ parametro.unidad_medida || "Sin unidad" }}
        </div>
      </div>

      <div class="col-12 col-sm-5">
        <q-input
          :model-value="valorDe(parametro._id)"
          type="number"
          outlined
          dense
          label="Valor"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [numeroRequerido('El valor')]"
          @update:model-value="(valor) => actualizar(parametro._id, valor)"
        />
      </div>
    </div>

    <div v-if="parametrosConValor.length === 0" class="text-caption texto-suave">
      El analisis no tiene parametros configurados.
    </div>
  </div>
</template>
