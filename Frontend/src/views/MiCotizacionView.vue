<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import DetalleCotizacion from "@/components/Domain/DetalleCotizacion.vue";
import FirmaDigital from "@/components/Domain/FirmaDigital.vue";
import { useNotificar } from "@/composables/useNotificar";
import { decidir, descargarExcel, obtener } from "@/services/cotizaciones.service";
import { LONGITUDES } from "@/utils/contrato";
import { maximo } from "@/utils/reglas";
import { validarDecisionCotizacion } from "@/utils/validaciones";

const route = useRoute();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const cotizacion = ref(null);
const procesando = ref(false);

const dialogoAceptar = ref(false);
const dialogoRechazar = ref(false);
const firma = ref("");
const errorFirma = ref("");
const motivo = ref("");
const errorMotivo = ref("");

const esPendiente = computed(() => cotizacion.value?.estado === "PENDIENTE");

const codigo = computed(() => {
  const c = cotizacion.value;
  if (!c) return "";
  return c.codigo_completo || `${c.codigo_cotizacion || "-"}V${c.version || 1}`;
});

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await obtener(route.params.id);
    cotizacion.value = respuesta.datos;
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

function abrirAceptar() {
  firma.value = "";
  errorFirma.value = "";
  dialogoAceptar.value = true;
}

function abrirRechazar() {
  motivo.value = "";
  errorMotivo.value = "";
  dialogoRechazar.value = true;
}

async function aceptar() {
  const errores = validarDecisionCotizacion({
    decision: "ACEPTADA",
    firma_base64: firma.value,
  });

  if (errores.length > 0) {
    errorFirma.value = errores[0];
    return;
  }

  procesando.value = true;
  try {
    await decidir(cotizacion.value._id, {
      decision: "ACEPTADA",
      firma_base64: firma.value,
    });
    dialogoAceptar.value = false;
    notificarOk("Cotizacion aceptada. El laboratorio continuara con el proceso.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}

async function rechazar() {
  const errores = validarDecisionCotizacion({
    decision: "RECHAZADA",
    motivo_rechazo: motivo.value,
  });

  if (errores.length > 0) {
    errorMotivo.value = errores[0];
    return;
  }

  procesando.value = true;
  try {
    await decidir(cotizacion.value._id, {
      decision: "RECHAZADA",
      motivo_rechazo: motivo.value.trim(),
    });
    dialogoRechazar.value = false;
    notificarOk("Cotizacion rechazada.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Detalle de cotizacion"
      :subtitulo="codigo || 'Revisa los ensayos y el valor propuesto'"
      icono="request_quote"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'mis-cotizaciones' }"
          class="q-mr-sm"
        />
        <BotonDescarga
          v-if="cotizacion"
          :obtener="() => descargarExcel(cotizacion._id)"
          label="Descargar Excel"
          icono="download"
          color="primary"
          mensaje="Cotizacion descargada"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !cotizacion"
      titulo="No se pudo cargar la cotizacion"
      detalle="Verifica que la cotizacion exista y que tengas acceso a ella."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <DetalleCotizacion v-else :cotizacion="cotizacion">
      <template #extra>
        <q-card v-if="esPendiente" flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="edit_document" size="18px" class="q-mr-sm" />
            Decision
          </div>
          <div class="q-pa-md">
            <p class="texto-suave q-mb-md">
              Revisa la oferta. Para aceptarla debes firmar digitalmente.
            </p>
            <q-btn
              unelevated
              no-caps
              color="positive"
              icon="draw"
              label="Firmar y aceptar"
              class="full-width q-mb-sm"
              @click="abrirAceptar"
            />
            <q-btn
              outline
              no-caps
              color="negative"
              icon="cancel"
              label="Rechazar cotizacion"
              class="full-width"
              @click="abrirRechazar"
            />
          </div>
        </q-card>

        <q-card v-else flat class="tarjeta q-mt-lg">
          <div class="q-pa-md text-body2">
            <template v-if="cotizacion.estado === 'ACEPTADA'">
              Cotizacion aceptada. El laboratorio continuara con el proceso.
            </template>
            <template v-else-if="cotizacion.estado === 'RECHAZADA'">
              Cotizacion rechazada.
            </template>
            <template v-else>
              Esta version fue reemplazada por una nueva.
            </template>
          </div>
        </q-card>
      </template>
    </DetalleCotizacion>

    <q-dialog v-model="dialogoAceptar" persistent>
      <q-card style="width: 680px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Firmar y aceptar cotizacion</div>
          <div class="text-caption texto-suave">
            La firma queda registrada como respaldo legal de la aceptacion.
          </div>
        </q-card-section>

        <q-card-section>
          <FirmaDigital v-model="firma" :error="errorFirma" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="positive"
            label="Aceptar cotizacion"
            :loading="procesando"
            @click="aceptar"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogoRechazar" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Rechazar cotizacion</div>
          <div class="text-caption texto-suave">
            Indica el motivo para que el laboratorio pueda ajustar la oferta.
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="motivo"
            outlined
            type="textarea"
            label="Motivo del rechazo *"
            counter
            autogrow
            :maxlength="LONGITUDES.cotizacion.motivo_rechazo"
            :error="Boolean(errorMotivo)"
            :error-message="errorMotivo"
            :rules="[maximo(LONGITUDES.cotizacion.motivo_rechazo, 'El motivo')]"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            label="Rechazar"
            :loading="procesando"
            @click="rechazar"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
