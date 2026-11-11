<script setup>
import { LONGITUDES } from "@/utils/contrato";

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      satisfaccion_general: null,
      tiempo_entrega: null,
      atencion_personal: null,
      claridad_informe: null,
      recomendaria_servicio: true,
      comentarios: "",
    }),
  },
  /** Errores por campo: { satisfaccion_general: "mensaje", ... } */
  errores: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:modelValue"]);

const preguntas = [
  { campo: "satisfaccion_general", label: "Satisfaccion general" },
  { campo: "tiempo_entrega", label: "Tiempo de entrega" },
  { campo: "atencion_personal", label: "Atencion del personal" },
  { campo: "claridad_informe", label: "Claridad del informe" },
];

const opciones = [1, 2, 3, 4, 5].map((valor) => ({
  label: String(valor),
  value: valor,
}));

function actualizar(campo, valor) {
  emit("update:modelValue", { ...props.modelValue, [campo]: valor });
}
</script>

<template>
  <div class="column q-gutter-md">
    <div v-for="pregunta in preguntas" :key="pregunta.campo">
      <div class="text-body2 text-weight-medium q-mb-xs">
        {{ pregunta.label }} *
      </div>
      <q-option-group
        :model-value="modelValue[pregunta.campo]"
        :options="opciones"
        color="primary"
        inline
        :error="Boolean(errores[pregunta.campo])"
        :error-message="errores[pregunta.campo]"
        @update:model-value="(valor) => actualizar(pregunta.campo, valor)"
      />
    </div>

    <q-toggle
      :model-value="modelValue.recomendaria_servicio"
      color="primary"
      label="Recomendaria el servicio"
      :error="Boolean(errores.recomendaria_servicio)"
      :error-message="errores.recomendaria_servicio"
      @update:model-value="(valor) => actualizar('recomendaria_servicio', valor)"
    />

    <q-input
      :model-value="modelValue.comentarios"
      outlined
      type="textarea"
      label="Comentarios (opcional)"
      counter
      :maxlength="LONGITUDES.encuesta.comentarios"
      autogrow
      :error="Boolean(errores.comentarios)"
      :error-message="errores.comentarios"
      @update:model-value="(valor) => actualizar('comentarios', valor)"
    />
  </div>
</template>
