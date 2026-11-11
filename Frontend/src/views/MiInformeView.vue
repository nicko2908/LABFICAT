<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import EncuestaSatisfaccion from "@/components/Domain/EncuestaSatisfaccion.vue";
import { useNotificar } from "@/composables/useNotificar";
import * as encuestasService from "@/services/encuestas.service";
import * as informesService from "@/services/informes.service";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import { validarEncuesta } from "@/utils/validaciones";

const route = useRoute();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const informe = ref(null);
const encuesta = ref(null);

const dialogoEncuesta = ref(false);
const enviandoEncuesta = ref(false);
const erroresEncuesta = ref({});
const formulario = ref(encuestaInicial());

const muestra = computed(() => informe.value?.muestra || null);
const solicitudId = computed(
  () => muestra.value?.solicitud?._id || muestra.value?.solicitud || null
);
const puedeDescargar = computed(() => Boolean(encuesta.value));
const errorGeneral = computed(() => erroresEncuesta.value.general || "");

function encuestaInicial() {
  return {
    solicitud: null,
    satisfaccion_general: null,
    tiempo_entrega: null,
    atencion_personal: null,
    claridad_informe: null,
    recomendaria_servicio: true,
    comentarios: "",
  };
}

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
      const respuestaEncuestas = await encuestasService.listarMias({ limit: 100 });
      encuesta.value =
        (respuestaEncuestas.datos?.items || []).find(
          (item) => String(item.solicitud?._id || item.solicitud) === String(idSolicitud)
        ) || null;
    }
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

function abrirEncuesta() {
  formulario.value = { ...encuestaInicial(), solicitud: solicitudId.value };
  erroresEncuesta.value = {};
  dialogoEncuesta.value = true;
}

function mapearErrores(lista) {
  const campos = [
    "satisfaccion_general",
    "tiempo_entrega",
    "atencion_personal",
    "claridad_informe",
    "comentarios",
  ];
  const mapa = {};

  for (const mensaje of lista) {
    const [posible, ...resto] = mensaje.split(":");
    if (resto.length > 0 && campos.includes(posible)) {
      mapa[posible] = resto.join(":").trim();
    } else {
      mapa.general = mapa.general ? `${mapa.general} · ${mensaje}` : mensaje;
    }
  }

  return mapa;
}

async function responderEncuesta() {
  const errores = validarEncuesta(formulario.value);
  if (errores.length > 0) {
    erroresEncuesta.value = mapearErrores(errores);
    return;
  }

  enviandoEncuesta.value = true;
  try {
    await encuestasService.responder({ ...formulario.value });
    dialogoEncuesta.value = false;
    notificarOk("Gracias por responder la encuesta.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    enviandoEncuesta.value = false;
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
          :to="{ name: 'mis-informes' }"
          class="q-mr-sm"
        />
        <BotonDescarga
          v-if="informe && puedeDescargar"
          :obtener="() => informesService.descargarPdf(informe._id)"
          label="Descargar PDF"
          icono="download"
          color="primary"
          mensaje="Informe descargado"
        />
        <q-btn
          v-else-if="informe"
          unelevated
          no-caps
          color="grey-6"
          icon="lock"
          label="Descargar PDF"
          disable
        >
          <q-tooltip>Responde la encuesta para habilitar la descarga</q-tooltip>
        </q-btn>
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !informe"
      titulo="No se pudo cargar el informe"
      detalle="Verifica que el informe exista y que tengas acceso."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <template v-else>
      <q-banner
        v-if="!puedeDescargar"
        dense
        class="bg-orange-1 text-orange-10 q-mb-lg rounded-borders"
      >
        <template #avatar>
          <q-icon name="poll" />
        </template>
        Debes responder la encuesta de satisfaccion antes de descargar el informe (RF-17).
        <template #action>
          <q-btn flat no-caps color="orange-10" label="Responder encuesta" @click="abrirEncuesta" />
        </template>
      </q-banner>

      <q-banner v-else dense class="bg-green-1 text-green-10 q-mb-lg rounded-borders">
        <template #avatar>
          <q-icon name="check_circle" />
        </template>
        Encuesta respondida el {{ formatDate(encuesta.fecha_respuesta) }}. Ya puedes descargar el informe.
      </q-banner>

      <div class="row q-col-gutter-lg">
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
                  :to="{ name: 'mi-muestra', params: { id: muestra?._id || muestra } }"
                />
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
            </div>
          </q-card>
        </div>

        <div class="col-12 col-lg-4">
          <q-card flat class="tarjeta">
            <div class="section-box__title">
              <q-icon name="poll" size="18px" class="q-mr-sm" />
              Encuesta de satisfaccion
            </div>
            <div class="q-pa-md">
              <div v-if="puedeDescargar" class="text-body2">
                Gracias por calificar el servicio.
              </div>
              <template v-else>
                <p class="texto-suave q-mb-md">
                  Tu opinion nos ayuda a mejorar. La encuesta es obligatoria antes de la descarga.
                </p>
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  icon="poll"
                  label="Responder encuesta"
                  class="full-width"
                  @click="abrirEncuesta"
                />
              </template>
            </div>
          </q-card>
        </div>
      </div>
    </template>

    <q-dialog v-model="dialogoEncuesta" persistent>
      <q-card style="width: 680px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Encuesta de satisfaccion</div>
          <div class="text-caption texto-suave">
            Califica de 1 a 5 cada aspecto del servicio.
          </div>
        </q-card-section>

        <q-card-section>
          <q-banner v-if="errorGeneral" dense class="bg-red-1 text-negative q-mb-md rounded-borders">
            {{ errorGeneral }}
          </q-banner>

          <EncuestaSatisfaccion v-model="formulario" :errores="erroresEncuesta" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Enviar encuesta"
            :loading="enviandoEncuesta"
            @click="responderEncuesta"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
