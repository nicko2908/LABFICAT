<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import { useNotificar } from "@/composables/useNotificar";
import { historial as obtenerHistorial, obtener } from "@/services/solicitudes.service";
import { colorEstado, etiquetaEstado } from "@/utils/estados";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";

const route = useRoute();
const router = useRouter();
const { notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const solicitud = ref(null);
const historial = ref([]);

const esInterno = computed(
  () => solicitud.value?.cliente?.tipo_cliente === "INTERNO"
);

const totalEstimado = computed(() => {
  if (!solicitud.value || esInterno.value) return 0;
  return (solicitud.value.analisis || []).reduce(
    (total, analisis) => total + (Number(analisis.tarifa_externo) || 0),
    0
  );
});

const nombreCliente = computed(() => {
  const cliente = solicitud.value?.cliente;
  return cliente?.razon_social || (cliente ? "Cliente registrado" : "-");
});

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const [respuestaSolicitud, respuestaHistorial] = await Promise.all([
      obtener(route.params.id),
      obtenerHistorial(route.params.id),
    ]);
    solicitud.value = respuestaSolicitud.datos;
    historial.value = respuestaHistorial.datos || [];
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Detalle de solicitud"
      :subtitulo="solicitud?.codigo_solicitud || 'Consulta el estado y los ensayos solicitados'"
      icono="description"
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

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !solicitud"
      titulo="No se pudo cargar la solicitud"
      detalle="Verifica que la solicitud exista y que tengas acceso a ella."
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
            Datos generales
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Codigo</div>
              <div class="data-value">{{ solicitud.codigo_solicitud }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado</div>
              <EstadoChip :estado="solicitud.estado" />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de registro</div>
              <div class="data-value">{{ formatDate(solicitud.createdAt) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Cliente</div>
              <div class="data-value">{{ nombreCliente }}</div>
            </div>
            <div v-if="solicitud.cliente?.nit" class="col-12 col-sm-6">
              <div class="data-label">NIT</div>
              <div class="data-value">{{ solicitud.cliente.nit }}</div>
            </div>
            <div v-if="solicitud.cliente?.telefono" class="col-12 col-sm-6">
              <div class="data-label">Telefono</div>
              <div class="data-value">{{ solicitud.cliente.telefono }}</div>
            </div>
            <div class="col-12">
              <div class="data-label">Descripcion</div>
              <div class="data-value">{{ solicitud.descripcion_inicial || "-" }}</div>
            </div>
            <div v-if="solicitud.motivo_desistimiento" class="col-12">
              <div class="data-label">Motivo de desistimiento</div>
              <div class="data-value text-negative">{{ solicitud.motivo_desistimiento }}</div>
            </div>
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="science" size="18px" class="q-mr-sm" />
            Ensayos solicitados
          </div>

          <div class="q-pa-md">
            <q-list separator>
              <q-item v-for="analisis in solicitud.analisis" :key="analisis._id">
                <q-item-section>
                  <q-item-label>
                    {{ analisis.codigo ? `${analisis.codigo} · ` : "" }}{{ analisis.nombre }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ analisis.unidades || "Sin unidad" }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  {{ esInterno ? "Sin costo" : formatMoney(analisis.tarifa_externo) }}
                </q-item-section>
              </q-item>
            </q-list>

            <div class="row justify-end q-mt-md">
              <div class="text-subtitle2">
                Total estimado: <strong>{{ esInterno ? "Sin costo" : formatMoney(totalEstimado) }}</strong>
              </div>
            </div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="timeline" size="18px" class="q-mr-sm" />
            Seguimiento
          </div>

          <q-timeline v-if="historial.length > 0" color="primary" class="q-px-md">
            <q-timeline-entry
              v-for="item in historial"
              :key="item._id"
              :title="etiquetaEstado(item.estado)"
              :subtitle="formatDateTime(item.fecha_hora)"
              :color="colorEstado(item.estado)"
              icon="flag"
            >
              <div class="text-body2">{{ item.observacion || "Sin observaciones." }}</div>
              <div class="text-caption texto-suave q-mt-xs">
                {{ item.usuario ? `${item.usuario.nombres} ${item.usuario.apellidos}` : "Sistema" }}
              </div>
            </q-timeline-entry>
          </q-timeline>

          <div v-else class="text-caption texto-suave q-pa-md">
            Todavia no hay movimientos registrados.
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="request_quote" size="18px" class="q-mr-sm" />
            Siguiente paso
          </div>
          <div class="q-pa-md">
            <p class="texto-suave q-mb-md">
              {{
                solicitud.estado === "Registrada"
                  ? "El laboratorio esta preparando tu cotizacion."
                  : solicitud.estado === "Cotizada"
                    ? "Tu cotizacion esta lista para revisar y firmar."
                    : "Puedes consultar el avance en el seguimiento."
              }}
            </p>
            <q-btn
              v-if="solicitud.estado === 'Cotizada'"
              unelevated
              no-caps
              color="primary"
              icon="request_quote"
              label="Ver mis cotizaciones"
              class="full-width"
              @click="router.push({ name: 'mis-cotizaciones' })"
            />
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
