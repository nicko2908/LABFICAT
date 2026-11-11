<script setup>
import { computed } from "vue";

import { useNotificar } from "@/composables/useNotificar";
import { archivoMime, archivoPesoMax, archivosMaximo } from "@/utils/reglas";

const props = defineProps({
  modelValue: { type: [File, Array], default: null },
  label: { type: String, default: "Archivo" },
  accept: { type: String, default: "image/png,image/jpeg,application/pdf" },
  multiple: { type: Boolean, default: false },
  maxFileSize: { type: Number, default: 5 * 1024 * 1024 },
  /** 0 = sin limite de cantidad */
  maxFiles: { type: Number, default: 0 },
  hint: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue"]);

const { notificarAdvertencia } = useNotificar();

const mimes = computed(() =>
  String(props.accept || "")
    .split(",")
    .map((tipo) => tipo.trim())
    .filter(Boolean)
);

const maxMB = computed(
  () => Math.round((props.maxFileSize / (1024 * 1024)) * 100) / 100
);

const reglas = computed(() => {
  const lista = [archivoPesoMax(maxMB.value, "El archivo")];

  if (mimes.value.length > 0) {
    lista.unshift(archivoMime(mimes.value, `Formato no permitido. Usa: ${mimes.value.join(", ")}`));
  }

  if (props.maxFiles > 0) {
    lista.push(archivosMaximo(props.maxFiles, "La seleccion"));
  }

  return lista;
});

function alRechazar(rechazados = []) {
  const motivo =
    rechazados?.[0]?.reason?.message || "el archivo no cumple las restricciones";
  notificarAdvertencia(`Archivo rechazado: ${motivo}`);
}
</script>

<template>
  <q-file
    :model-value="modelValue"
    :label="label"
    :accept="accept"
    :multiple="multiple"
    :max-file-size="maxFileSize"
    :max-files="maxFiles > 0 ? maxFiles : undefined"
    :rules="reglas"
    :hint="hint"
    outlined
    counter
    clearable
    @update:model-value="(valor) => emit('update:modelValue', valor)"
    @rejected="alRechazar"
  >
    <template #prepend>
      <q-icon name="attach_file" />
    </template>
  </q-file>
</template>
