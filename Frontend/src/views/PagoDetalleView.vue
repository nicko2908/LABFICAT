<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import { useNotificar } from "@/composables/useNotificar";
import { obtener, validar } from "@/services/pagos.service";
import { LONGITUDES } from "@/utils/contrato";
import { formatDateTime } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";
import { maximo } from "@/utils/reglas";
import { validarDecisionPago } from "@/utils/validaciones";

const route = useRoute();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const pago = ref(null);
const procesando = ref(false);

const dialogoDecision = ref(false);
const decision = ref("APROBADO");
const observaciones = ref("");
const errorDecision = ref("");

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await obtener(route.params.id);
    pago.value = respuesta.datos;
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

function abrirDecision(valor) {
  decision.value = valor;
  observaciones.value = pago.value?.observaciones || "";
  errorDecision.value = "";
  dialogoDecision.value = true;
}

async function confirmarDecision() {
  const errores = validarDecisionPago({
    decision: decision.value,
    observaciones: observaciones.value,
  });

  if (errores.length > 0) {
    errorDecision.value = errores[0];
    return;
  }

  procesando.value = true;
  try {
    await validar(pago.value._id, {
      decision: decision.value,
      observaciones: observaciones.value.trim() || null,
    });
    dialogoDecision.value = false;
    notificarOk(
      decision.value === "APROBADO" ? "Pago aprobado." : "Pago rechazado."
    );
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
      titulo="Detalle de pago"
      :subtitulo="pago?.cupon?.codigo_cupon ? `Cupon ${pago.cupon.codigo_cupon}` : 'Soporte de pago reportado'"
      icono="payments"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'pagos' }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !pago"
      titulo="No se pudo cargar el pago"
      detalle="Verifica que el soporte exista."
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
            Datos del pago
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado</div>
              <EstadoChip :estado="pago.estado" />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de carga</div>
              <div class="data-value">{{ formatDateTime(pago.fecha_carga) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Referencia externa</div>
              <div class="data-value">{{ pago.referencia_externa || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Validador</div>
              <div class="data-value">
                {{
                  pago.validador
                    ? `${pago.validador.nombres} ${pago.validador.apellidos}`.trim()
                    : "Sin validar"
                }}
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de validacion</div>
              <div class="data-value">{{ formatDateTime(pago.fecha_validacion) }}</div>
            </div>
            <div class="col-12">
              <div class="data-label">Observaciones</div>
              <div class="data-value">{{ pago.observaciones || "-" }}</div>
            </div>
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="confirmation_number" size="18px" class="q-mr-sm" />
            Cupon
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Codigo</div>
              <div class="data-value">{{ pago.cupon?.codigo_cupon || "Sin codigo" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Valor</div>
              <div class="data-value">{{ formatMoney(pago.cupon?.valor) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado del cupon</div>
              <EstadoChip :estado="pago.cupon?.estado" />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Cotizacion</div>
              <q-btn
                v-if="pago.cupon?.cotizacion"
                flat
                dense
                no-caps
                color="primary"
                icon="request_quote"
                label="Ver cotizacion"
                :to="{
                  name: 'cotizacion-detalle',
                  params: { id: pago.cupon.cotizacion._id || pago.cupon.cotizacion },
                }"
              />
              <span v-else class="data-value">-</span>
            </div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="fact_check" size="18px" class="q-mr-sm" />
            Validacion
          </div>

          <div class="q-pa-md">
            <template v-if="pago.estado === 'PENDIENTE_VERIFICACION'">
              <p class="texto-suave q-mb-md">
                Aprueba o rechaza el pago reportado por el cliente.
              </p>
              <q-btn
                unelevated
                no-caps
                color="positive"
                icon="check_circle"
                label="Aprobar pago"
                class="full-width q-mb-sm"
                :loading="procesando"
                @click="abrirDecision('APROBADO')"
              />
              <q-btn
                outline
                no-caps
                color="negative"
                icon="cancel"
                label="Rechazar pago"
                class="full-width"
                :loading="procesando"
                @click="abrirDecision('RECHAZADO')"
              />
            </template>

            <div v-else class="text-body2">
              Este pago ya fue {{ pago.estado === "APROBADO" ? "aprobado" : "rechazado" }}.
            </div>
          </div>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="dialogoDecision" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">
            {{ decision === "APROBADO" ? "Aprobar pago" : "Rechazar pago" }}
          </div>
          <div class="text-caption texto-suave">
            {{ decision === "APROBADO"
              ? "El cupon se marcara como UTILIZADO y la solicitud pasara a Pago aprobado."
              : "La solicitud pasara a Pago rechazado y el cliente podra reenviar." }}
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="observaciones"
            outlined
            type="textarea"
            label="Observaciones de la validacion"
            counter
            autogrow
            :maxlength="LONGITUDES.pago.observaciones"
            :error="Boolean(errorDecision)"
            :error-message="errorDecision"
            :rules="[maximo(LONGITUDES.pago.observaciones, 'Las observaciones')]"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            :color="decision === 'APROBADO' ? 'positive' : 'negative'"
            :label="decision === 'APROBADO' ? 'Aprobar' : 'Rechazar'"
            :loading="procesando"
            @click="confirmarDecision"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
