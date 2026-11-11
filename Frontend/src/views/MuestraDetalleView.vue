<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import DetalleMuestra from "@/components/Domain/DetalleMuestra.vue";
import TimelineTrazabilidad from "@/components/Domain/TimelineTrazabilidad.vue";
import { useNotificar } from "@/composables/useNotificar";
import * as muestrasService from "@/services/muestras.service";
import * as trazabilidadService from "@/services/trazabilidad.service";
import { useAuthStore } from "@/store/Auth";
import { useCatalogosStore } from "@/store/Catalogos";
import { LONGITUDES } from "@/utils/contrato";
import { PRIORIDADES } from "@/utils/estados";
import { maximo } from "@/utils/reglas";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const catalogos = useCatalogosStore();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const detalle = ref(null);
const generandoRotulo = ref(false);
const linea = ref([]);

const dialogoPrioridad = ref(false);
const nivel = ref(3);
const motivo = ref("");
const errorPrioridad = ref("");
const guardandoPrioridad = ref(false);

const dialogoSeguimiento = ref(false);
const etapa = ref(null);
const observaciones = ref("");
const errorSeguimiento = ref("");
const guardandoSeguimiento = ref(false);

const muestra = computed(() => detalle.value?.muestra || null);
const rotulo = computed(() => detalle.value?.rotulo || null);

const puedeGenerarRotulo = computed(
  () => auth.esCoordinador && muestra.value?.estado_recepcion === "ACEPTADA"
);

onMounted(async () => {
  await cargar();
  try {
    await catalogos.cargarEtapas();
  } catch {
    // El timeline sigue funcionando aunque falle el catalogo de etapas.
  }
});

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const [respuesta, respuestaLinea] = await Promise.all([
      muestrasService.obtener(route.params.id),
      trazabilidadService.lineaTiempo(route.params.id),
    ]);
    detalle.value = respuesta.datos;
    linea.value = respuestaLinea.datos || [];
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

async function generarRotulo() {
  generandoRotulo.value = true;
  try {
    await muestrasService.generarRotulo(muestra.value._id);
    notificarOk("Rotulo generado correctamente.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    generandoRotulo.value = false;
  }
}

function abrirPrioridad() {
  nivel.value = Number(muestra.value?.prioridad) || 3;
  motivo.value = "";
  errorPrioridad.value = "";
  dialogoPrioridad.value = true;
}

async function guardarPrioridad() {
  if (!motivo.value.trim()) {
    errorPrioridad.value = "El motivo es obligatorio";
    return;
  }

  if (motivo.value.trim().length > LONGITUDES.muestra.motivo_prioridad) {
    errorPrioridad.value = `El motivo no puede superar los ${LONGITUDES.muestra.motivo_prioridad} caracteres`;
    return;
  }

  guardandoPrioridad.value = true;
  try {
    await muestrasService.cambiarPrioridad(muestra.value._id, {
      nivel: Number(nivel.value),
      motivo: motivo.value.trim(),
    });
    dialogoPrioridad.value = false;
    notificarOk("Prioridad actualizada.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    guardandoPrioridad.value = false;
  }
}

function verOrdenes() {
  router.push({ name: "ordenes", query: { muestra: muestra.value._id } });
}

function abrirSeguimiento() {
  etapa.value = null;
  observaciones.value = "";
  errorSeguimiento.value = "";
  dialogoSeguimiento.value = true;
}

async function guardarSeguimiento() {
  if (!etapa.value) {
    errorSeguimiento.value = "Selecciona la etapa del proceso";
    return;
  }

  if (observaciones.value.trim().length > LONGITUDES.muestra.observaciones) {
    errorSeguimiento.value = `Las observaciones no pueden superar los ${LONGITUDES.muestra.observaciones} caracteres`;
    return;
  }

  guardandoSeguimiento.value = true;
  try {
    await trazabilidadService.registrarSeguimiento({
      muestra: muestra.value._id,
      etapa: etapa.value,
      observaciones: observaciones.value.trim() || null,
    });
    dialogoSeguimiento.value = false;
    notificarOk("Avance registrado en la trazabilidad.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    guardandoSeguimiento.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Detalle de muestra"
      :subtitulo="muestra?.codigo_muestra || 'Recepcion y seguimiento de la muestra'"
      icono="science"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'muestras' }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !detalle"
      titulo="No se pudo cargar la muestra"
      detalle="Verifica que la muestra exista y que tengas acceso."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <DetalleMuestra v-else :detalle="detalle">
      <template #acciones>
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="build" size="18px" class="q-mr-sm" />
            Acciones
          </div>

          <div class="q-pa-md column q-gutter-sm">
            <BotonDescarga
              :obtener="() => muestrasService.descargarActa(muestra._id)"
              label="Acta de recepcion"
              icono="description"
              color="primary"
              mensaje="Acta descargada"
              outline
            />

            <BotonDescarga
              v-if="rotulo"
              :obtener="() => muestrasService.descargarRotulo(muestra._id)"
              label="Descargar rotulo"
              icono="qr_code"
              color="primary"
              mensaje="Rotulo descargado"
              outline
            />

            <q-btn
              v-if="puedeGenerarRotulo"
              unelevated
              no-caps
              color="primary"
              icon="qr_code"
              :label="rotulo ? 'Regenerar rotulo' : 'Generar rotulo'"
              :loading="generandoRotulo"
              @click="generarRotulo"
            />

            <q-btn
              v-if="auth.esCoordinador"
              flat
              no-caps
              color="primary"
              icon="low_priority"
              label="Cambiar prioridad"
              @click="abrirPrioridad"
            />

            <q-btn
              v-if="auth.esAnalista"
              flat
              no-caps
              color="primary"
              icon="add_task"
              label="Registrar avance"
              @click="abrirSeguimiento"
            />

            <q-btn
              flat
              no-caps
              color="primary"
              icon="biotech"
              label="Ver ordenes de la muestra"
              @click="verOrdenes"
            />
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="timeline" size="18px" class="q-mr-sm" />
            Avance del proceso
          </div>
          <div class="q-pa-md">
            <TimelineTrazabilidad :items="linea" />
          </div>
        </q-card>

        <q-card v-if="rotulo" flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="qr_code" size="18px" class="q-mr-sm" />
            Rotulo
          </div>
          <div class="q-pa-md">
            <div class="data-label">Estado</div>
            <div class="data-value">Generado</div>
            <div class="data-label q-mt-sm">Ensayos incluidos</div>
            <div class="data-value">
              {{ (rotulo.analisis || []).length }}
            </div>
          </div>
        </q-card>
      </template>
    </DetalleMuestra>

    <q-dialog v-model="dialogoPrioridad" persistent>
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Cambiar prioridad</div>
          <div class="text-caption texto-suave">
            La priorizacion es interna y queda registrada en el historial.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select
            v-model="nivel"
            :options="PRIORIDADES"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            outlined
            label="Nivel de prioridad *"
          />

          <q-input
            v-model="motivo"
            outlined
            type="textarea"
            label="Motivo *"
            counter
            autogrow
            :maxlength="LONGITUDES.muestra.motivo_prioridad"
            :error="Boolean(errorPrioridad)"
            :error-message="errorPrioridad"
            :rules="[maximo(LONGITUDES.muestra.motivo_prioridad, 'El motivo')]"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Guardar"
            :loading="guardandoPrioridad"
            @click="guardarPrioridad"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogoSeguimiento" persistent>
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Registrar avance</div>
          <div class="text-caption texto-suave">
            Agrega un hito a la linea de tiempo de la muestra.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select
            v-model="etapa"
            :options="catalogos.etapas"
            option-value="_id"
            option-label="nombre"
            emit-value
            map-options
            outlined
            label="Etapa del proceso *"
            :error="Boolean(errorSeguimiento) && !etapa"
          />

          <q-input
            v-model="observaciones"
            outlined
            type="textarea"
            label="Observaciones"
            counter
            autogrow
            :maxlength="LONGITUDES.muestra.observaciones"
            :error="Boolean(errorSeguimiento)"
            :error-message="errorSeguimiento"
            :rules="[maximo(LONGITUDES.muestra.observaciones, 'Las observaciones')]"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Registrar"
            :loading="guardandoSeguimiento"
            @click="guardarSeguimiento"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
