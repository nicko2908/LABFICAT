<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import { useNotificar } from "@/composables/useNotificar";
import { crear } from "@/services/solicitudes.service";
import { useAuthStore } from "@/store/Auth";
import { useCatalogosStore } from "@/store/Catalogos";
import { LONGITUDES } from "@/utils/contrato";
import { formatMoney } from "@/utils/formatMoney";
import { maximo, seleccionMultipleRequerida } from "@/utils/reglas";
import { validarSolicitud } from "@/utils/validaciones";

const router = useRouter();
const auth = useAuthStore();
const catalogos = useCatalogosStore();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const cargando = ref(true);
const guardando = ref(false);
const formularioRef = ref(null);
const filtro = ref("");

const formulario = ref({
  analisis: [],
  descripcion_inicial: "",
});

const opciones = computed(() =>
  catalogos.analisis.map((analisis) => ({
    label: `${analisis.codigo ? `${analisis.codigo} · ` : ""}${analisis.nombre}`,
    value: analisis._id,
    tarifa: Number(analisis.tarifa_externo) || 0,
  }))
);

const opcionesFiltradas = computed(() => {
  const termino = filtro.value.trim().toLowerCase();
  if (!termino) return opciones.value;
  return opciones.value.filter((opcion) =>
    opcion.label.toLowerCase().includes(termino)
  );
});

const esInterno = computed(() => auth.cliente?.tipo_cliente === "INTERNO");

const totalEstimado = computed(() => {
  if (esInterno.value) return 0;
  return formulario.value.analisis.reduce((total, id) => {
    const opcion = opciones.value.find((item) => item.value === id);
    return total + (opcion?.tarifa || 0);
  }, 0);
});

function filtrar(valor, actualizar) {
  filtro.value = valor;
  actualizar();
}

onMounted(async () => {
  try {
    await catalogos.cargarAnalisis();
  } catch (error) {
    notificarError(error);
  } finally {
    cargando.value = false;
  }
});

async function guardar() {
  const errores = validarSolicitud({
    analisis: formulario.value.analisis,
    descripcion_inicial: formulario.value.descripcion_inicial,
  });

  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await crear({
      analisis: formulario.value.analisis,
      descripcion_inicial: formulario.value.descripcion_inicial.trim() || null,
    });
    notificarOk("Solicitud creada. El laboratorio la revisara y enviara la cotizacion.");
    router.push({ name: "mi-solicitud", params: { id: respuesta.datos._id } });
  } catch (error) {
    notificarError(error);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Nueva solicitud"
      subtitulo="Selecciona los ensayos que necesitas para tu muestra"
      icono="add_circle"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'mis-solicitudes' }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" mensaje="Cargando catalogo de ensayos..." />

    <q-card v-else flat class="tarjeta q-pa-lg">
      <q-form ref="formularioRef" greedy @submit.prevent="guardar">
        <div class="section-box__title q-mb-md">Ensayos</div>

        <q-select
          v-model="formulario.analisis"
          :options="opcionesFiltradas"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          multiple
          use-chips
          use-input
          outlined
          label="Ensayos solicitados *"
          hint="Puedes seleccionar varios ensayos"
          :rules="[seleccionMultipleRequerida('al menos un ensayo')]"
          :loading="cargando"
          lazy-rules
          @filter="filtrar"
        />

        <q-input
          v-model="formulario.descripcion_inicial"
          outlined
          type="textarea"
          label="Descripcion de la solicitud (opcional)"
          counter
          autogrow
          class="q-mt-md"
          :maxlength="LONGITUDES.solicitud.descripcion_inicial"
          :rules="[maximo(LONGITUDES.solicitud.descripcion_inicial, 'La descripcion')]"
          lazy-rules
        />

        <div class="row justify-end q-mt-lg">
          <q-btn
            flat
            no-caps
            label="Cancelar"
            :to="{ name: 'mis-solicitudes' }"
            class="q-mr-sm"
          />
          <q-btn
            unelevated
            no-caps
            type="submit"
            color="primary"
            icon="send"
            label="Crear solicitud"
            :loading="guardando"
          />
        </div>
      </q-form>
    </q-card>

    <q-card v-if="!cargando && formulario.analisis.length > 0" flat class="tarjeta q-mt-lg">
      <div class="section-box__title">Resumen</div>
      <div class="q-pa-md">
        <div class="row justify-between q-mb-sm">
          <span class="texto-suave">Ensayos seleccionados</span>
          <strong>{{ formulario.analisis.length }}</strong>
        </div>
        <div class="row justify-between">
          <span class="texto-suave">Valor estimado</span>
          <strong>{{ esInterno ? "Sin costo (cliente interno)" : formatMoney(totalEstimado) }}</strong>
        </div>
        <div class="text-caption texto-suave q-mt-md">
          El valor definitivo lo confirma el laboratorio en la cotizacion.
        </div>
      </div>
    </q-card>
  </q-page>
</template>
