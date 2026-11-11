<script setup>
import { computed } from "vue";

import EstadoChip from "@/components/Common/EstadoChip.vue";
import { OBSERVACIONES_RECEPCION } from "@/utils/estados";
import { formatDate, formatDateTime } from "@/utils/formatDate";

const props = defineProps({
  detalle: { type: Object, required: true },
  mostrarPrioridad: { type: Boolean, default: true },
});

const muestra = computed(() => props.detalle?.muestra || {});
const historial = computed(() => props.detalle?.historialPrioridad || []);

const observaciones = computed(() =>
  (muestra.value.observaciones_predefinidas || [])
    .map((numero) => {
      const texto = OBSERVACIONES_RECEPCION[Number(numero) - 1];
      return texto ? `${numero}. ${texto}` : null;
    })
    .filter(Boolean)
);

const recolectada = computed(
  () =>
    muestra.value.recolectada_por ||
    muestra.value.municipio_recoleccion ||
    muestra.value.lugar_toma
);
</script>

<template>
  <div class="row q-col-gutter-lg">
    <div class="col-12 col-lg-8">
      <q-card flat class="tarjeta">
        <div class="section-box__title">
          <q-icon name="science" size="18px" class="q-mr-sm" />
          Datos de la muestra
        </div>

        <div class="q-pa-md row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <div class="data-label">Codigo</div>
            <div class="data-value">{{ muestra.codigo_muestra || "-" }}</div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Recepcion</div>
            <EstadoChip :estado="muestra.estado_recepcion" />
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Tipo de muestra</div>
            <div class="data-value">{{ muestra.tipo_muestra?.nombre || "-" }}</div>
          </div>
          <div v-if="mostrarPrioridad" class="col-12 col-sm-6">
            <div class="data-label">Prioridad</div>
            <div class="data-value">{{ muestra.prioridad ?? 3 }}</div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Solicitud</div>
            <div class="data-value">{{ muestra.solicitud?.codigo_solicitud || "-" }}</div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Fecha de recepcion</div>
            <div class="data-value">{{ formatDate(muestra.fecha_recepcion) }}</div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Cantidad recibida</div>
            <div class="data-value">
              {{ muestra.cantidad_recibida ?? "-" }} {{ muestra.unidad_medida || "" }}
            </div>
          </div>
          <div class="col-12 col-sm-6">
            <div class="data-label">Numero de envases</div>
            <div class="data-value">{{ muestra.numero_envases ?? "-" }}</div>
          </div>
          <div v-if="muestra.nombre" class="col-12">
            <div class="data-label">Nombre</div>
            <div class="data-value">{{ muestra.nombre }}</div>
          </div>
          <div v-if="muestra.descripcion" class="col-12">
            <div class="data-label">Descripcion</div>
            <div class="data-value">{{ muestra.descripcion }}</div>
          </div>
          <div v-if="muestra.condiciones_conservacion" class="col-12">
            <div class="data-label">Condiciones de conservacion</div>
            <div class="data-value">{{ muestra.condiciones_conservacion }}</div>
          </div>
          <div v-if="muestra.motivo_rechazo" class="col-12">
            <div class="data-label">Motivo de rechazo</div>
            <div class="data-value text-negative">{{ muestra.motivo_rechazo }}</div>
          </div>
          <div v-if="observaciones.length > 0" class="col-12">
            <div class="data-label">Observaciones de recepcion</div>
            <ul class="q-mt-xs q-pl-md">
              <li v-for="(texto, indice) in observaciones" :key="indice" class="text-body2">
                {{ texto }}
              </li>
            </ul>
          </div>
        </div>
      </q-card>

      <q-card v-if="recolectada || muestra.procedimiento_muestreo" flat class="tarjeta q-mt-lg">
        <div class="section-box__title">
          <q-icon name="place" size="18px" class="q-mr-sm" />
          Recoleccion
        </div>

        <div class="q-pa-md row q-col-gutter-md">
          <div v-if="muestra.matriz" class="col-12 col-sm-6">
            <div class="data-label">Matriz</div>
            <div class="data-value">{{ muestra.matriz }}</div>
          </div>
          <div v-if="muestra.municipio_recoleccion" class="col-12 col-sm-6">
            <div class="data-label">Municipio</div>
            <div class="data-value">{{ muestra.municipio_recoleccion }}</div>
          </div>
          <div v-if="muestra.lugar_toma" class="col-12 col-sm-6">
            <div class="data-label">Lugar de toma</div>
            <div class="data-value">{{ muestra.lugar_toma }}</div>
          </div>
          <div v-if="muestra.direccion_toma" class="col-12 col-sm-6">
            <div class="data-label">Direccion de toma</div>
            <div class="data-value">{{ muestra.direccion_toma }}</div>
          </div>
          <div v-if="muestra.recolectada_por" class="col-12 col-sm-6">
            <div class="data-label">Recolectada por</div>
            <div class="data-value">{{ muestra.recolectada_por }}</div>
          </div>
          <div v-if="muestra.fecha_hora_recoleccion" class="col-12 col-sm-6">
            <div class="data-label">Fecha de recoleccion</div>
            <div class="data-value">{{ formatDateTime(muestra.fecha_hora_recoleccion) }}</div>
          </div>
          <div v-if="muestra.procedimiento_muestreo" class="col-12">
            <div class="data-label">Procedimiento de muestreo</div>
            <div class="data-value">{{ muestra.procedimiento_muestreo }}</div>
          </div>
        </div>
      </q-card>
    </div>

    <div class="col-12 col-lg-4">
      <slot name="acciones" />

      <q-card v-if="mostrarPrioridad && historial.length > 0" flat class="tarjeta q-mt-lg">
        <div class="section-box__title">
          <q-icon name="flag" size="18px" class="q-mr-sm" />
          Historial de prioridad
        </div>

        <q-timeline color="primary" class="q-px-md">
          <q-timeline-entry
            v-for="item in historial"
            :key="item._id"
            :title="`Prioridad ${item.nivel}`"
            :subtitle="formatDateTime(item.fecha_hora)"
            icon="flag"
          >
            <div class="text-body2">{{ item.motivo || "Sin motivo registrado." }}</div>
            <div class="text-caption texto-suave q-mt-xs">
              {{ item.usuario ? `${item.usuario.nombres} ${item.usuario.apellidos}` : "Sistema" }}
            </div>
          </q-timeline-entry>
        </q-timeline>
      </q-card>
    </div>
  </div>
</template>
