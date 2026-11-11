<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import EncuestaSatisfaccion from "@/components/Domain/EncuestaSatisfaccion.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import * as encuestasService from "@/services/encuestas.service";
import * as solicitudesService from "@/services/solicitudes.service";
import { formatDate } from "@/utils/formatDate";
import { validarEncuesta } from "@/utils/validaciones";

const router = useRouter();
const { notificarOk, notificarError } = useNotificar();

const { filas, cargando, paginacion, cargar, onRequest } = usePaginacion(
  encuestasService.listarMias,
  { filtros: {} }
);

const pendientes = ref([]);
const dialogo = ref(false);
const guardando = ref(false);
const errorGeneral = ref("");
const erroresEncuesta = ref({});
const solicitudSeleccionada = ref(null);
const formulario = ref(encuestaInicial());

const columnas = [
  {
    name: "solicitud",
    label: "Solicitud",
    field: (fila) => fila.solicitud?.codigo_solicitud || "-",
    align: "left",
  },
  { name: "fecha", label: "Respondida", field: "fecha_respuesta", align: "left" },
  { name: "satisfaccion", label: "Satisfaccion", field: "satisfaccion_general", align: "center" },
  {
    name: "recomienda",
    label: "Recomiendo",
    field: (fila) => (fila.recomendaria_servicio ? "Si" : "No"),
    align: "center",
  },
  { name: "acciones", label: "", align: "right" },
];

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

onMounted(async () => {
  await cargar();
  await cargarPendientes();
});

async function cargarPendientes() {
  try {
    const [respuestaSolicitudes, respuestaEncuestas] = await Promise.all([
      solicitudesService.listarMias({ limit: 100 }),
      encuestasService.listarMias({ limit: 100 }),
    ]);

    const respondidas = new Set(
      (respuestaEncuestas.datos?.items || []).map((encuesta) =>
        String(encuesta.solicitud?._id || encuesta.solicitud)
      )
    );

    pendientes.value = (respuestaSolicitudes.datos?.items || []).filter(
      (solicitud) =>
        ["Informe listo", "Finalizada"].includes(solicitud.estado) &&
        !respondidas.has(String(solicitud._id))
    );
  } catch (err) {
    notificarError(err);
  }
}

function ver(fila) {
  router.push({ name: "mi-encuesta", params: { id: fila._id } });
}

function abrirEncuesta(solicitud) {
  solicitudSeleccionada.value = solicitud;
  formulario.value = { ...encuestaInicial(), solicitud: solicitud._id };
  erroresEncuesta.value = {};
  errorGeneral.value = "";
  dialogo.value = true;
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

async function responder() {
  const errores = validarEncuesta(formulario.value);
  if (errores.length > 0) {
    const mapa = mapearErrores(errores);
    erroresEncuesta.value = mapa;
    errorGeneral.value = mapa.general || "";
    return;
  }

  guardando.value = true;
  try {
    await encuestasService.responder({ ...formulario.value });
    dialogo.value = false;
    notificarOk("Gracias por responder la encuesta.");
    await Promise.all([cargar(), cargarPendientes()]);
  } catch (err) {
    notificarError(err);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis encuestas"
      subtitulo="Encuestas de satisfaccion de tus servicios"
      icono="poll"
    />

    <q-card v-if="pendientes.length > 0" flat class="tarjeta q-mb-lg">
      <div class="section-box__title">
        <q-icon name="pending_actions" size="18px" class="q-mr-sm" />
        Encuestas pendientes
      </div>
      <div class="q-pa-md">
        <q-list separator>
          <q-item v-for="solicitud in pendientes" :key="solicitud._id">
            <q-item-section>
              <q-item-label>{{ solicitud.codigo_solicitud }}</q-item-label>
              <q-item-label caption>{{ solicitud.estado }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                icon="poll"
                label="Responder"
                @click="abrirEncuesta(solicitud)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-card>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      :buscable="false"
      mensaje-vacio="Todavia no has respondido encuestas"
      @request="onRequest"
    >
      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-acciones="{ row }">
        <q-td class="text-right">
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="visibility"
            label="Ver"
            @click="ver(row)"
          />
        </q-td>
      </template>
    </TablaDatos>

    <q-dialog v-model="dialogo" persistent>
      <q-card style="width: 680px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Encuesta de satisfaccion</div>
          <div class="text-caption texto-suave">
            {{ solicitudSeleccionada?.codigo_solicitud || "Solicitud" }}
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
            :loading="guardando"
            @click="responder"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
