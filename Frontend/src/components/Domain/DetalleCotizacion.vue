<script setup>
import { computed } from "vue";

import EstadoChip from "@/components/Common/EstadoChip.vue";
import { formatDate } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";

const props = defineProps({
  cotizacion: { type: Object, required: true },
});

const codigo = computed(() => {
  const c = props.cotizacion;
  return c.codigo_completo || `${c.codigo_cotizacion || "-"}V${c.version || 1}`;
});

/**
 * Las cotizaciones nuevas usan items[]; las legadas solo detalle[] plano.
 */
const items = computed(() => {
  const c = props.cotizacion;
  if (Array.isArray(c.items) && c.items.length > 0) return c.items;
  if (Array.isArray(c.detalle) && c.detalle.length > 0) {
    return [{ numero: 1, descripcion_muestra: null, detalle: c.detalle }];
  }
  return [];
});

const total = computed(() => Number(props.cotizacion.valor_total) || 0);

function subtotalLinea(linea) {
  return (Number(linea.cantidad) || 0) * (Number(linea.tarifa_aplicada) || 0);
}

function subtotalItem(item) {
  return (item.detalle || []).reduce((suma, linea) => suma + subtotalLinea(linea), 0);
}
</script>

<template>
  <div class="row q-col-gutter-lg">
    <div class="col-12 col-lg-8">
      <q-card flat class="tarjeta">
        <div class="section-box__title">
          <q-icon name="info" size="18px" class="q-mr-sm" />
          Informacion general
        </div>

        <div class="q-pa-md row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <div class="data-label">Cotizacion</div>
            <div class="data-value">{{ codigo }}</div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Estado</div>
            <EstadoChip :estado="cotizacion.estado" />
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Solicitud</div>
            <div class="data-value">
              {{ cotizacion.solicitud?.codigo_solicitud || "-" }}
            </div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Fecha de emision</div>
            <div class="data-value">{{ formatDate(cotizacion.fecha_emision) }}</div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Valida hasta</div>
            <div class="data-value">{{ formatDate(cotizacion.fecha_validez) }}</div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Version</div>
            <div class="data-value">V{{ cotizacion.version || 1 }}</div>
          </div>
          <div v-if="cotizacion.observaciones_propuesta" class="col-12">
            <div class="data-label">Observaciones</div>
            <div class="data-value">{{ cotizacion.observaciones_propuesta }}</div>
          </div>
          <div v-if="cotizacion.motivo_rechazo" class="col-12">
            <div class="data-label">Motivo de rechazo</div>
            <div class="data-value text-negative">{{ cotizacion.motivo_rechazo }}</div>
          </div>
        </div>
      </q-card>

      <q-card v-for="item in items" :key="item.numero" flat class="tarjeta q-mt-lg">
        <div class="section-box__title">
          <q-icon name="science" size="18px" class="q-mr-sm" />
          Item {{ item.numero }}
          <span v-if="item.descripcion_muestra" class="text-caption texto-suave q-ml-sm">
            · {{ item.descripcion_muestra }}
          </span>
        </div>

        <div class="q-pa-md">
          <div
            v-for="(linea, indice) in item.detalle"
            :key="indice"
            class="row items-center q-col-gutter-sm q-py-sm"
          >
            <div class="col-12 col-md-6">
              <div class="text-body2 text-weight-medium">
                {{ linea.analisis?.codigo ? `${linea.analisis.codigo} · ` : "" }}
                {{ linea.analisis?.nombre || "Ensayo" }}
              </div>
              <div class="text-caption texto-suave">
                {{ linea.analisis?.unidades || "Sin unidad" }}
              </div>
            </div>
            <div class="col-4 col-md-2 text-center">
              <div class="data-label">Cantidad</div>
              <div>{{ linea.cantidad }}</div>
            </div>
            <div class="col-4 col-md-2 text-right">
              <div class="data-label">Tarifa</div>
              <div>{{ formatMoney(linea.tarifa_aplicada) }}</div>
            </div>
            <div class="col-4 col-md-2 text-right">
              <div class="data-label">Subtotal</div>
              <div>{{ formatMoney(subtotalLinea(linea)) }}</div>
            </div>
          </div>

          <div class="row justify-end q-mt-sm">
            <div class="text-subtitle2">
              Subtotal item: <strong>{{ formatMoney(subtotalItem(item)) }}</strong>
            </div>
          </div>
        </div>
      </q-card>
    </div>

    <div class="col-12 col-lg-4">
      <q-card flat class="tarjeta">
        <div class="section-box__title">
          <q-icon name="payments" size="18px" class="q-mr-sm" />
          Resumen
        </div>
        <div class="q-pa-md">
          <div class="row justify-between q-mb-sm">
            <span class="texto-suave">Subtotal</span>
            <strong>{{ formatMoney(cotizacion.subtotal) }}</strong>
          </div>
          <div class="row justify-between">
            <span class="texto-suave">Total</span>
            <strong class="text-h6">{{ formatMoney(total) }}</strong>
          </div>
        </div>
      </q-card>

      <slot name="extra" />
    </div>
  </div>
</template>
