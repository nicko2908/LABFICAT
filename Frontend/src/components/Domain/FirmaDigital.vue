<script setup>
import { computed, onMounted, ref } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  alto: { type: Number, default: 200 },
  /** Mensaje de error a mostrar bajo el lienzo (validacion del formulario). */
  error: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue"]);

const canvas = ref(null);
let ctx = null;
let dibujando = false;

const estaVacia = computed(() => !props.modelValue);

onMounted(() => {
  const elemento = canvas.value;
  elemento.width = 600;
  elemento.height = props.alto;
  ctx = elemento.getContext("2d");
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#00304D";
});

function punto(evento) {
  const rect = canvas.value.getBoundingClientRect();
  return {
    x: ((evento.clientX - rect.left) / rect.width) * canvas.value.width,
    y: ((evento.clientY - rect.top) / rect.height) * canvas.value.height,
  };
}

function iniciar(evento) {
  dibujando = true;
  const p = punto(evento);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  canvas.value.setPointerCapture?.(evento.pointerId);
}

function mover(evento) {
  if (!dibujando) return;
  const p = punto(evento);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  emit("update:modelValue", canvas.value.toDataURL("image/png"));
}

function terminar() {
  if (!dibujando) return;
  dibujando = false;
  ctx.closePath();
  emit("update:modelValue", canvas.value.toDataURL("image/png"));
}

function limpiar() {
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  emit("update:modelValue", "");
}

defineExpose({ limpiar, estaVacia });
</script>

<template>
  <div class="firma-digital">
    <canvas
      ref="canvas"
      class="firma-digital__lienzo"
      @pointerdown.prevent="iniciar"
      @pointermove.prevent="mover"
      @pointerup.prevent="terminar"
      @pointerleave="terminar"
    />

    <div class="row items-center justify-between q-mt-sm">
      <span class="text-caption texto-suave">
        Dibuja tu firma dentro del recuadro.
      </span>
      <q-btn flat dense no-caps color="grey-8" icon="restart_alt" label="Limpiar" @click="limpiar" />
    </div>

    <div v-if="error" class="text-caption text-negative q-mt-xs">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.firma-digital__lienzo {
  width: 100%;
  height: auto;
  display: block;
  border: 1.5px dashed var(--color-mist);
  border-radius: 8px;
  background: #fff;
  touch-action: none;
  cursor: crosshair;
}
</style>
