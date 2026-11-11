<script setup>
import { computed } from "vue";

import { ENUMS, LIMITES, LONGITUDES } from "@/utils/contrato";
import {
  enteroMinimo,
  fechaRequerida,
  fechaValida,
  maximo,
  numeroNoNegativo,
  requeridoCuando,
  seleccionRequerida,
  unoDe,
} from "@/utils/reglas";
import { OBSERVACIONES_RECEPCION } from "@/utils/estados";

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  tiposMuestra: { type: Array, default: () => [] },
  soloLectura: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

const opcionesObservaciones = computed(() =>
  OBSERVACIONES_RECEPCION.map((texto, indice) => ({
    label: `${indice + 1}. ${texto}`,
    value: indice + 1,
  }))
);

const observacionesSeleccionadas = computed(() =>
  (props.modelValue.observaciones_predefinidas || []).length > 0
);

function motivoRequerido() {
  return props.modelValue.estado_recepcion === "RECHAZADA" && !observacionesSeleccionadas.value;
}

function actualizar(campo, valor) {
  emit("update:modelValue", { ...props.modelValue, [campo]: valor });
}
</script>

<template>
  <div class="column q-gutter-md">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-select
          :model-value="modelValue.tipo_muestra"
          :options="tiposMuestra"
          option-value="_id"
          option-label="nombre"
          emit-value
          map-options
          outlined
          label="Tipo de muestra *"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [seleccionRequerida('el tipo de muestra')]"
          @update:model-value="(valor) => actualizar('tipo_muestra', valor)"
        />
      </div>

      <div class="col-12 col-md-6">
        <q-input
          :model-value="modelValue.fecha_recepcion"
          type="date"
          outlined
          label="Fecha de recepcion *"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [fechaRequerida('La fecha de recepcion'), fechaValida('La fecha de recepcion')]"
          @update:model-value="(valor) => actualizar('fecha_recepcion', valor)"
        />
      </div>

      <div class="col-12 col-md-6">
        <q-select
          :model-value="modelValue.estado_recepcion"
          :options="ENUMS.estadosRecepcion"
          outlined
          label="Estado de recepcion *"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [seleccionRequerida('el estado de recepcion'), unoDe(ENUMS.estadosRecepcion, 'El estado')]"
          @update:model-value="(valor) => actualizar('estado_recepcion', valor)"
        />
      </div>

      <div class="col-6 col-md-3">
        <q-input
          :model-value="modelValue.cantidad_recibida"
          type="number"
          outlined
          label="Cantidad"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [numeroNoNegativo('La cantidad')]"
          @update:model-value="(valor) => actualizar('cantidad_recibida', valor === '' ? '' : Number(valor))"
        />
      </div>

      <div class="col-6 col-md-3">
        <q-select
          :model-value="modelValue.unidad_medida"
          :options="ENUMS.unidadesMedida"
          outlined
          label="Unidad"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [unoDe(ENUMS.unidadesMedida, 'La unidad')]"
          @update:model-value="(valor) => actualizar('unidad_medida', valor)"
        />
      </div>

      <div class="col-6 col-md-3">
        <q-input
          :model-value="modelValue.numero_envases"
          type="number"
          min="1"
          outlined
          label="Numero de envases"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [enteroMinimo(1, 'El numero de envases')]"
          @update:model-value="(valor) => actualizar('numero_envases', valor === '' ? '' : Number(valor))"
        />
      </div>

      <div class="col-12">
        <q-input
          :model-value="modelValue.condiciones_conservacion"
          outlined
          label="Condiciones de conservacion"
          counter
          :maxlength="LONGITUDES.muestra.condiciones_conservacion"
          :readonly="soloLectura"
          :rules="soloLectura ? [] : [maximo(LONGITUDES.muestra.condiciones_conservacion, 'Las condiciones')]"
          @update:model-value="(valor) => actualizar('condiciones_conservacion', valor)"
        />
      </div>
    </div>

    <div>
      <div class="text-body2 text-weight-medium q-mb-xs">
        Observaciones predefinidas
      </div>
      <q-option-group
        :model-value="modelValue.observaciones_predefinidas || []"
        :options="opcionesObservaciones"
        type="checkbox"
        color="primary"
        :disable="soloLectura"
        @update:model-value="(valor) => actualizar('observaciones_predefinidas', valor)"
      />
      <div class="text-caption texto-suave q-mt-xs">
        Selecciona hasta {{ LIMITES.observacionesRecepcion.max }} observaciones.
      </div>
    </div>

    <q-input
      v-if="modelValue.estado_recepcion === 'RECHAZADA'"
      :model-value="modelValue.motivo_rechazo"
      outlined
      type="textarea"
      label="Motivo de rechazo"
      counter
      :maxlength="LONGITUDES.muestra.motivo_rechazo"
      :readonly="soloLectura"
      :rules="soloLectura ? [] : [requeridoCuando(motivoRequerido, 'El motivo de rechazo'), maximo(LONGITUDES.muestra.motivo_rechazo, 'El motivo de rechazo')]"
      @update:model-value="(valor) => actualizar('motivo_rechazo', valor)"
    />
  </div>
</template>
