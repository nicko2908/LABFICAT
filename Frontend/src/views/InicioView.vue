<script setup>
import { computed, onMounted, ref } from "vue";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import StatCard from "@/components/Common/StatCard.vue";
import { useNotificar } from "@/composables/useNotificar";
import { useAuthStore } from "@/store/Auth";
import { useGeneralStore } from "@/store/General";
import * as cotizaciones from "@/services/cotizaciones.service";
import * as cupones from "@/services/cupones.service";
import * as encuestas from "@/services/encuestas.service";
import * as informes from "@/services/informes.service";
import * as muestras from "@/services/muestras.service";
import * as ordenes from "@/services/ordenes.service";
import * as pagos from "@/services/pagos.service";
import * as reclamaciones from "@/services/reclamaciones.service";
import * as reportes from "@/services/reportes.service";
import * as solicitudes from "@/services/solicitudes.service";

const auth = useAuthStore();
const general = useGeneralStore();
const { notificarError } = useNotificar();

const cargando = ref(true);
const tarjetas = ref([]);
const accesos = ref([]);

const saludo = computed(() => {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos dias";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
});

const subtitulo = computed(() => {
  if (auth.esCliente) return "Este es el estado de tus servicios con el laboratorio.";
  if (auth.esCoordinador) return "Resumen operativo del laboratorio.";
  return "Tus ordenes y muestras pendientes.";
});

function totalDe(respuesta) {
  return Number(respuesta?.datos?.total ?? 0);
}

function sumaTotales(items = []) {
  return items.reduce((total, item) => total + Number(item?.total ?? 0), 0);
}

async function cargarCliente() {
  const modulos = [
    { etiqueta: "Solicitudes", icono: "description", color: "primary", ruta: "mis-solicitudes", cargar: () => solicitudes.listarMias({ limit: 1 }) },
    { etiqueta: "Cotizaciones", icono: "request_quote", color: "info", ruta: "mis-cotizaciones", cargar: () => cotizaciones.listarMias({ limit: 1 }) },
    { etiqueta: "Cupones", icono: "confirmation_number", color: "warning", ruta: "mis-cupones", cargar: () => cupones.listarMios({ limit: 1 }) },
    { etiqueta: "Pagos", icono: "payments", color: "positive", ruta: "mis-pagos", cargar: () => pagos.listarMios({ limit: 1 }) },
    { etiqueta: "Muestras", icono: "science", color: "info", ruta: "mis-muestras", cargar: () => muestras.listarMias({ limit: 1 }) },
    { etiqueta: "Informes", icono: "summarize", color: "primary", ruta: "mis-informes", cargar: () => informes.listarMios({ limit: 1 }) },
    { etiqueta: "Encuestas", icono: "poll", color: "accent", ruta: "mis-encuestas", cargar: () => encuestas.listarMias({ limit: 1 }) },
    { etiqueta: "Reclamaciones", icono: "report_problem", color: "negative", ruta: "mis-reclamaciones", cargar: () => reclamaciones.listarMias({ limit: 1 }) },
  ];

  const resultados = await Promise.allSettled(modulos.map((modulo) => modulo.cargar()));
  tarjetas.value = modulos.map(({ cargar, ...modulo }, indice) => ({
    ...modulo,
    valor: resultados[indice].status === "fulfilled" ? totalDe(resultados[indice].value) : 0,
  }));

  accesos.value = [
    { titulo: "Nueva solicitud", icono: "add_circle", ruta: "mis-solicitudes-nueva", color: "primary" },
    { titulo: "Ver mis cotizaciones", icono: "request_quote", ruta: "mis-cotizaciones", color: "info" },
    { titulo: "Reportar pago", icono: "upload_file", ruta: "mis-pagos", color: "positive" },
    { titulo: "Responder encuesta", icono: "poll", ruta: "mis-encuestas", color: "accent" },
  ];
}

async function cargarCoordinador() {
  const [solicitudesRes, operacionRes, satisfaccionRes] = await Promise.allSettled([
    reportes.resumenSolicitudes(),
    reportes.resumenOperacion(),
    reportes.resumenSatisfaccion(),
  ]);

  const solicitudesDatos = solicitudesRes.status === "fulfilled" ? solicitudesRes.value.datos : null;
  const operacion = operacionRes.status === "fulfilled" ? operacionRes.value.datos : {};
  const satisfaccion = satisfaccionRes.status === "fulfilled" ? satisfaccionRes.value.datos : null;

  tarjetas.value = [
    { etiqueta: "Solicitudes", valor: Number(solicitudesDatos?.total ?? 0), icono: "description", color: "primary", ruta: "solicitudes" },
    { etiqueta: "Ordenes", valor: sumaTotales(operacion?.ordenes), icono: "biotech", color: "info", ruta: "ordenes" },
    { etiqueta: "Informes generados", valor: Number(operacion?.informesGenerados ?? 0), icono: "summarize", color: "positive", ruta: "informes" },
    { etiqueta: "Reclamaciones", valor: sumaTotales(operacion?.reclamaciones), icono: "report_problem", color: "negative", ruta: "reclamaciones" },
    { etiqueta: "Encuestas", valor: Number(satisfaccion?.total ?? 0), icono: "poll", color: "accent", ruta: "encuestas" },
    {
      etiqueta: "Satisfaccion",
      valor: satisfaccion?.satisfaccion_general ? Number(satisfaccion.satisfaccion_general).toFixed(1) : "-",
      icono: "star",
      color: "warning",
      ruta: "reportes",
      detalle: "Promedio sobre 5",
    },
  ];

  accesos.value = [
    { titulo: "Validar pagos", icono: "fact_check", ruta: "pagos", color: "positive" },
    { titulo: "Recibir muestras", icono: "science", ruta: "muestras", color: "info" },
    { titulo: "Ver reportes", icono: "bar_chart", ruta: "reportes", color: "primary" },
    { titulo: "Gestionar catalogos", icono: "tune", ruta: "catalogos", color: "accent" },
  ];
}

async function cargarAnalista() {
  const [ordenesRes, muestrasRes] = await Promise.allSettled([
    ordenes.listar({ limit: 1 }),
    muestras.listar({ limit: 1 }),
  ]);

  tarjetas.value = [
    { etiqueta: "Ordenes", valor: ordenesRes.status === "fulfilled" ? totalDe(ordenesRes.value) : 0, icono: "biotech", color: "primary", ruta: "ordenes" },
    { etiqueta: "Muestras", valor: muestrasRes.status === "fulfilled" ? totalDe(muestrasRes.value) : 0, icono: "science", color: "info", ruta: "muestras" },
  ];

  accesos.value = [
    { titulo: "Ordenes en proceso", icono: "play_circle", ruta: "ordenes", color: "primary" },
    { titulo: "Muestras recibidas", icono: "science", ruta: "muestras", color: "info" },
  ];
}

async function cargar() {
  cargando.value = true;
  try {
    if (auth.esCliente) await cargarCliente();
    else if (auth.esCoordinador) await cargarCoordinador();
    else await cargarAnalista();

    general.marcarSincronizacion();
  } catch (error) {
    notificarError(error);
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      :titulo="`${saludo}, ${auth.nombreUsuario}`"
      :subtitulo="subtitulo"
      icono="space_dashboard"
    />

    <div v-if="cargando" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="42px" />
    </div>

    <template v-else>
      <div class="row q-col-gutter-md">
        <div
          v-for="tarjeta in tarjetas"
          :key="tarjeta.etiqueta"
          class="col-12 col-sm-6 col-md-4 col-lg-3"
        >
          <StatCard v-bind="tarjeta" />
        </div>
      </div>

      <div class="section-box q-mt-xl">
        <div class="section-box__title">
          <q-icon name="bolt" size="18px" class="q-mr-sm" />
          Accesos rapidos
        </div>
        <div class="q-pa-md row q-col-gutter-md">
          <div
            v-for="acceso in accesos"
            :key="acceso.ruta"
            class="col-12 col-sm-6 col-md-3"
          >
            <q-btn
              unelevated
              no-caps
              class="full-width"
              :color="acceso.color"
              :icon="acceso.icono"
              :label="acceso.titulo"
              :to="{ name: acceso.ruta }"
            />
          </div>
        </div>
      </div>
    </template>
  </q-page>
</template>
