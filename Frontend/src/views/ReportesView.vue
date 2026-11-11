<script setup>
import { computed, onMounted, ref } from "vue";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import StatCard from "@/components/Common/StatCard.vue";
import { useNotificar } from "@/composables/useNotificar";
import {
  resumenMuestras,
  resumenOperacion,
  resumenSatisfaccion,
  resumenSolicitudes,
} from "@/services/reportes.service";

const { notificarError } = useNotificar();

const cargando = ref(true);
const filtros = ref({ desde: "", hasta: "" });

const solicitudes = ref({ items: [], total: 0 });
const muestras = ref({ porRecepcion: [], porPrioridad: [] });
const operacion = ref({ ordenes: [], informesGenerados: 0, reclamaciones: [] });
const satisfaccion = ref(null);
const sinEncuestas = ref(false);

const totalOrdenes = computed(() =>
  (operacion.value.ordenes || []).reduce((total, fila) => total + Number(fila.total || 0), 0)
);

const totalReclamaciones = computed(() =>
  (operacion.value.reclamaciones || []).reduce(
    (total, fila) => total + Number(fila.total || 0),
    0
  )
);

const porcentajeRecomienda = computed(() => {
  const datos = satisfaccion.value;
  if (!datos || !Number(datos.total)) return "-";
  return `${Math.round((Number(datos.recomiendan) / Number(datos.total)) * 100)}%`;
});

const promedio = (valor) =>
  Number.isFinite(Number(valor)) && valor !== null && valor !== undefined
    ? Number(valor).toFixed(1)
    : "-";

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  sinEncuestas.value = false;

  const params = {};
  if (filtros.value.desde) params.desde = `${filtros.value.desde}T00:00:00`;
  if (filtros.value.hasta) params.hasta = `${filtros.value.hasta}T23:59:59`;

  const [rSolicitudes, rMuestras, rOperacion, rSatisfaccion] = await Promise.allSettled([
    resumenSolicitudes(params),
    resumenMuestras(params),
    resumenOperacion(),
    resumenSatisfaccion(params),
  ]);

  if (rSolicitudes.status === "fulfilled") {
    solicitudes.value = rSolicitudes.value.datos || { items: [], total: 0 };
  } else {
    notificarError(rSolicitudes.reason);
  }

  if (rMuestras.status === "fulfilled") {
    muestras.value = rMuestras.value.datos || { porRecepcion: [], porPrioridad: [] };
  } else {
    notificarError(rMuestras.reason);
  }

  if (rOperacion.status === "fulfilled") {
    operacion.value = rOperacion.value.datos || {
      ordenes: [],
      informesGenerados: 0,
      reclamaciones: [],
    };
  } else {
    notificarError(rOperacion.reason);
  }

  if (rSatisfaccion.status === "fulfilled") {
    satisfaccion.value = rSatisfaccion.value.datos || null;
  } else if (rSatisfaccion.reason?.status === 404) {
    satisfaccion.value = null;
    sinEncuestas.value = true;
  } else {
    notificarError(rSatisfaccion.reason);
  }

  cargando.value = false;
}

function limpiarFiltros() {
  filtros.value = { desde: "", hasta: "" };
  cargar();
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Reportes"
      subtitulo="Indicadores de operacion y satisfaccion del laboratorio"
      icono="bar_chart"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="refresh"
          label="Actualizar"
          :loading="cargando"
          @click="cargar"
        />
      </template>
    </EncabezadoPagina>

    <q-card flat class="tarjeta q-pa-md q-mb-lg">
      <div class="row q-col-gutter-md items-end">
        <div class="col-12 col-sm-4 col-md-3">
          <q-input v-model="filtros.desde" type="date" outlined dense label="Desde" />
        </div>
        <div class="col-12 col-sm-4 col-md-3">
          <q-input v-model="filtros.hasta" type="date" outlined dense label="Hasta" />
        </div>
        <div class="col-12 col-sm-auto">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="filter_alt"
            label="Aplicar"
            :loading="cargando"
            @click="cargar"
          />
        </div>
        <div class="col-12 col-sm-auto">
          <q-btn flat no-caps color="primary" label="Limpiar" @click="limpiarFiltros" />
        </div>
      </div>
      <div class="text-caption texto-suave q-mt-sm">
        El rango aplica a solicitudes, muestras y encuestas. La operacion se muestra completa.
      </div>
    </q-card>

    <LoadingBlock v-if="cargando" mensaje="Calculando indicadores..." />

    <template v-else>
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-sm-6 col-md-4">
          <StatCard
            etiqueta="Solicitudes"
            :valor="Number(solicitudes.total) || 0"
            icono="description"
            color="primary"
            detalle="En el periodo"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <StatCard
            etiqueta="Ordenes"
            :valor="totalOrdenes"
            icono="biotech"
            color="info"
            detalle="Todas las iteraciones"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <StatCard
            etiqueta="Informes generados"
            :valor="operacion.informesGenerados || 0"
            icono="summarize"
            color="positive"
            detalle="Acumulado"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <StatCard
            etiqueta="Reclamaciones"
            :valor="totalReclamaciones"
            icono="report_problem"
            color="negative"
            detalle="Registradas"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <StatCard
            etiqueta="Satisfaccion"
            :valor="satisfaccion ? promedio(satisfaccion.satisfaccion_general) : '-'"
            icono="sentiment_satisfied"
            color="warning"
            detalle="Promedio sobre 5"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <StatCard
            etiqueta="Recomiendan"
            :valor="porcentajeRecomienda"
            icono="thumb_up"
            color="accent"
            detalle="Del total de encuestas"
          />
        </div>
      </div>

      <div class="row q-col-gutter-lg">
        <div class="col-12 col-lg-6">
          <q-card flat class="tarjeta">
            <div class="section-box__title">
              <q-icon name="description" size="18px" class="q-mr-sm" />
              Solicitudes por estado
            </div>
            <div class="q-pa-md">
              <div v-if="solicitudes.items.length === 0" class="text-caption texto-suave">
                Sin solicitudes en el periodo.
              </div>
              <q-list v-else separator>
                <q-item v-for="fila in solicitudes.items" :key="fila._id">
                  <q-item-section>{{ fila._id }}</q-item-section>
                  <q-item-section side>
                    <strong>{{ fila.total }}</strong>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-card>
        </div>

        <div class="col-12 col-lg-6">
          <q-card flat class="tarjeta">
            <div class="section-box__title">
              <q-icon name="science" size="18px" class="q-mr-sm" />
              Muestras
            </div>
            <div class="q-pa-md">
              <div class="data-label q-mb-xs">Por recepcion</div>
              <q-list v-if="muestras.porRecepcion.length > 0" separator>
                <q-item v-for="fila in muestras.porRecepcion" :key="fila._id">
                  <q-item-section>{{ fila._id }}</q-item-section>
                  <q-item-section side><strong>{{ fila.total }}</strong></q-item-section>
                </q-item>
              </q-list>
              <div v-else class="text-caption texto-suave">Sin muestras en el periodo.</div>

              <div class="data-label q-mt-md q-mb-xs">Por prioridad</div>
              <q-list v-if="muestras.porPrioridad.length > 0" separator>
                <q-item v-for="fila in muestras.porPrioridad" :key="fila._id">
                  <q-item-section>Prioridad {{ fila._id }}</q-item-section>
                  <q-item-section side><strong>{{ fila.total }}</strong></q-item-section>
                </q-item>
              </q-list>
              <div v-else class="text-caption texto-suave">Sin datos de prioridad.</div>
            </div>
          </q-card>
        </div>

        <div class="col-12 col-lg-6">
          <q-card flat class="tarjeta">
            <div class="section-box__title">
              <q-icon name="fact_check" size="18px" class="q-mr-sm" />
              Operacion
            </div>
            <div class="q-pa-md">
              <div class="data-label q-mb-xs">Ordenes por estado</div>
              <q-list v-if="operacion.ordenes.length > 0" separator>
                <q-item v-for="fila in operacion.ordenes" :key="fila._id">
                  <q-item-section>{{ fila._id }}</q-item-section>
                  <q-item-section side><strong>{{ fila.total }}</strong></q-item-section>
                </q-item>
              </q-list>
              <div v-else class="text-caption texto-suave">Sin ordenes registradas.</div>

              <div class="data-label q-mt-md q-mb-xs">Reclamaciones por estado</div>
              <q-list v-if="operacion.reclamaciones.length > 0" separator>
                <q-item v-for="fila in operacion.reclamaciones" :key="fila._id">
                  <q-item-section>{{ fila._id }}</q-item-section>
                  <q-item-section side><strong>{{ fila.total }}</strong></q-item-section>
                </q-item>
              </q-list>
              <div v-else class="text-caption texto-suave">Sin reclamaciones.</div>
            </div>
          </q-card>
        </div>

        <div class="col-12 col-lg-6">
          <q-card flat class="tarjeta">
            <div class="section-box__title">
              <q-icon name="poll" size="18px" class="q-mr-sm" />
              Satisfaccion
            </div>
            <div class="q-pa-md">
              <div v-if="sinEncuestas || !satisfaccion" class="text-caption texto-suave">
                Sin encuestas en el periodo seleccionado.
              </div>
              <template v-else>
                <div class="row justify-between q-mb-sm">
                  <span class="texto-suave">Encuestas</span>
                  <strong>{{ satisfaccion.total }}</strong>
                </div>
                <div class="row justify-between q-mb-sm">
                  <span class="texto-suave">Satisfaccion general</span>
                  <strong>{{ promedio(satisfaccion.satisfaccion_general) }} / 5</strong>
                </div>
                <div class="row justify-between q-mb-sm">
                  <span class="texto-suave">Tiempo de entrega</span>
                  <strong>{{ promedio(satisfaccion.tiempo_entrega) }} / 5</strong>
                </div>
                <div class="row justify-between q-mb-sm">
                  <span class="texto-suave">Atencion del personal</span>
                  <strong>{{ promedio(satisfaccion.atencion_personal) }} / 5</strong>
                </div>
                <div class="row justify-between q-mb-sm">
                  <span class="texto-suave">Claridad del informe</span>
                  <strong>{{ promedio(satisfaccion.claridad_informe) }} / 5</strong>
                </div>
                <div class="row justify-between">
                  <span class="texto-suave">Recomiendan el servicio</span>
                  <strong>{{ porcentajeRecomienda }}</strong>
                </div>
              </template>
            </div>
          </q-card>
        </div>
      </div>
    </template>
  </q-page>
</template>
