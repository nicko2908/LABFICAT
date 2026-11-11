<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import { useConfirmar } from "@/composables/useConfirmar";
import { useNotificar } from "@/composables/useNotificar";
import * as cuponesService from "@/services/cupones.service";
import { LONGITUDES } from "@/utils/contrato";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";

const route = useRoute();
const { confirmar } = useConfirmar();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const cupon = ref(null);
const procesando = ref(false);
const codigo = ref("");

const puedeGenerar = computed(() => cupon.value?.estado === "PENDIENTE");
const puedeUsar = computed(() => cupon.value?.estado === "GENERADO");

const estaVencido = computed(() => {
  if (!cupon.value?.fecha_vencimiento) return false;
  return new Date(cupon.value.fecha_vencimiento).getTime() < Date.now();
});

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await cuponesService.obtener(route.params.id);
    cupon.value = respuesta.datos;
    codigo.value = respuesta.datos?.codigo_cupon || "";
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

async function generar() {
  if (!codigo.value.trim()) {
    notificarError("El codigo del cupon es obligatorio");
    return;
  }

  procesando.value = true;
  try {
    await cuponesService.generar(cupon.value._id, codigo.value.trim());
    notificarOk("Cupon generado. Ya puede ser pagado por el cliente.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}

async function registrarRecordatorio() {
  procesando.value = true;
  try {
    await cuponesService.registrarRecordatorio(cupon.value._id);
    notificarOk("Recordatorio registrado.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}

async function marcarVencido() {
  const confirmado = await confirmar({
    titulo: "Marcar cupon como vencido",
    mensaje: "El cliente ya no podra reportar el pago de este cupon.",
    textoOk: "Marcar vencido",
    color: "negative",
  });
  if (!confirmado) return;

  procesando.value = true;
  try {
    await cuponesService.cambiarEstado(cupon.value._id, "VENCIDO");
    notificarOk("Cupon marcado como vencido.");
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
      titulo="Detalle de cupon"
      :subtitulo="cupon?.codigo_cupon ? `Cupon ${cupon.codigo_cupon}` : 'Cupon de pago'"
      icono="confirmation_number"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'cupones' }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !cupon"
      titulo="No se pudo cargar el cupon"
      detalle="Verifica que el cupon exista."
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
            Datos del cupon
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Codigo</div>
              <div class="data-value">{{ cupon.codigo_cupon || "Sin generar" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado</div>
              <EstadoChip :estado="cupon.estado" />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Valor</div>
              <div class="data-value">{{ formatMoney(cupon.valor) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Solicitado por</div>
              <div class="data-value">
                {{
                  cupon.solicitado_por
                    ? `${cupon.solicitado_por.nombres} ${cupon.solicitado_por.apellidos}`.trim()
                    : "-"
                }}
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de solicitud</div>
              <div class="data-value">{{ formatDate(cupon.fecha_solicitud) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de generacion</div>
              <div class="data-value">{{ formatDate(cupon.fecha_generacion) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de vencimiento</div>
              <div class="data-value" :class="{ 'text-negative': estaVencido }">
                {{ formatDate(cupon.fecha_vencimiento) }}
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Cotizacion</div>
              <q-btn
                v-if="cupon.cotizacion"
                flat
                dense
                no-caps
                color="primary"
                icon="request_quote"
                label="Ver cotizacion"
                :to="{
                  name: 'cotizacion-detalle',
                  params: { id: cupon.cotizacion._id || cupon.cotizacion },
                }"
              />
              <span v-else class="data-value">-</span>
            </div>
            <div v-if="cupon.cotizacion?.valor_total !== undefined" class="col-12 col-sm-6">
              <div class="data-label">Total de la cotizacion</div>
              <div class="data-value">{{ formatMoney(cupon.cotizacion.valor_total) }}</div>
            </div>
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="notifications" size="18px" class="q-mr-sm" />
            Recordatorios
          </div>

          <div class="q-pa-md">
            <q-timeline
              v-if="cupon.recordatorios && cupon.recordatorios.length > 0"
              color="primary"
              class="q-px-sm"
            >
              <q-timeline-entry
                v-for="(recordatorio, indice) in cupon.recordatorios"
                :key="indice"
                title="Recordatorio enviado"
                :subtitle="formatDateTime(recordatorio.fecha_envio)"
                icon="notifications_active"
              />
            </q-timeline>
            <div v-else class="text-caption texto-suave">
              No se han registrado recordatorios.
            </div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card v-if="puedeGenerar" flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="key" size="18px" class="q-mr-sm" />
            Generar cupon
          </div>
          <div class="q-pa-md">
            <p class="texto-suave">
              Ingresa el codigo que entrega Produccion de Centro para habilitar el pago.
            </p>
            <q-input
              v-model="codigo"
              outlined
              label="Codigo del cupon *"
              counter
              :maxlength="LONGITUDES.cupon.codigo_cupon"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="check"
              label="Generar cupon"
              class="full-width q-mt-md"
              :loading="procesando"
              @click="generar"
            />
          </div>
        </q-card>

        <q-card v-else-if="puedeUsar" flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="build" size="18px" class="q-mr-sm" />
            Acciones
          </div>
          <div class="q-pa-md">
            <div v-if="estaVencido" class="text-caption text-negative q-mb-md">
              La fecha de vencimiento ya paso.
            </div>
            <p class="texto-suave q-mb-md">
              Recuerda al cliente el pago o cierra el cupon si ya no aplica.
            </p>
            <q-btn
              outline
              no-caps
              color="primary"
              icon="notifications_active"
              label="Registrar recordatorio"
              class="full-width q-mb-sm"
              :loading="procesando"
              @click="registrarRecordatorio"
            />
            <q-btn
              outline
              no-caps
              color="negative"
              icon="block"
              label="Marcar vencido"
              class="full-width"
              :loading="procesando"
              @click="marcarVencido"
            />
          </div>
        </q-card>

        <q-card v-else flat class="tarjeta">
          <div class="q-pa-md text-body2">
            Este cupon esta en estado {{ cupon.estado }} y no requiere acciones.
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
