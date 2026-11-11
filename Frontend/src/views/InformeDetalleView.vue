<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import { useConfirmar } from "@/composables/useConfirmar";
import { useNotificar } from "@/composables/useNotificar";
import * as informesService from "@/services/informes.service";
import * as solicitudesService from "@/services/solicitudes.service";
import { formatDate, formatDateTime } from "@/utils/formatDate";

const route = useRoute();
const { confirmar } = useConfirmar();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const informe = ref(null);
const solicitud = ref(null);
const procesando = ref(false);

const muestra = computed(() => informe.value?.muestra || null);
const yaEnviado = computed(() => Boolean(informe.value?.fecha_envio));

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await informesService.obtener(route.params.id);
    informe.value = respuesta.datos;

    const idSolicitud =
      respuesta.datos?.muestra?.solicitud?._id || respuesta.datos?.muestra?.solicitud;
    if (idSolicitud) {
      try {
        const respuestaSolicitud = await solicitudesService.obtener(idSolicitud);
        solicitud.value = respuestaSolicitud.datos;
      } catch {
        solicitud.value = null;
      }
    }
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

async function registrarEnvio() {
  const confirmado = await confirmar({
    titulo: "Registrar envio",
    mensaje:
      "Se marcara el informe como enviado al cliente. Si todos los informes estan enviados, la solicitud pasara a Finalizada.",
    textoOk: "Registrar envio",
    color: "primary",
  });
  if (!confirmado) return;

  procesando.value = true;
  try {
    await informesService.registrarEnvio(informe.value._id);
    notificarOk("Envio registrado.");
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
      titulo="Detalle de informe"
      :subtitulo="muestra?.codigo_muestra ? `Muestra ${muestra.codigo_muestra}` : 'Informe de resultados'"
      icono="summarize"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'informes' }"
          class="q-mr-sm"
        />
        <BotonDescarga
          v-if="informe"
          :obtener="() => informesService.descargarPdf(informe._id)"
          label="Descargar PDF"
          icono="download"
          color="primary"
          mensaje="Informe descargado"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !informe"
      titulo="No se pudo cargar el informe"
      detalle="Verifica que el informe exista."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <div v-else class="row q-col-gutter-lg">
      <div class="col-12 col-lg-8">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="info" size="18px" class="q-mr-sm" />
            Datos del informe
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Muestra</div>
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                :label="muestra?.codigo_muestra || 'Ver muestra'"
                :to="{ name: 'muestra-detalle', params: { id: muestra?._id || muestra } }"
              />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Solicitud</div>
              <div class="data-value">{{ solicitud?.codigo_solicitud || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado de la solicitud</div>
              <div class="data-value">{{ solicitud?.estado || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Generado</div>
              <div class="data-value">{{ formatDateTime(informe.fecha_generacion) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Enviado</div>
              <div class="data-value">{{ formatDateTime(informe.fecha_envio) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Descargado</div>
              <div class="data-value">{{ formatDateTime(informe.fecha_descarga) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Generado por</div>
              <div class="data-value">
                {{
                  informe.usuario
                    ? `${informe.usuario.nombres} ${informe.usuario.apellidos}`.trim()
                    : "-"
                }}
              </div>
            </div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="send" size="18px" class="q-mr-sm" />
            Envio al cliente
          </div>
          <div class="q-pa-md">
            <template v-if="!yaEnviado">
              <p class="texto-suave q-mb-md">
                Registra el envio cuando el informe haya sido entregado al cliente.
              </p>
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="send"
                label="Registrar envio"
                class="full-width"
                :loading="procesando"
                @click="registrarEnvio"
              />
            </template>
            <div v-else class="text-body2">
              Informe enviado el {{ formatDate(informe.fecha_envio) }}.
            </div>
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
