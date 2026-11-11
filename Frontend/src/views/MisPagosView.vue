<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import * as cuponesService from "@/services/cupones.service";
import * as pagosService from "@/services/pagos.service";
import { ESTADO_PAGO } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";
import { LONGITUDES } from "@/utils/contrato";
import { maximo } from "@/utils/reglas";
import { validarPago } from "@/utils/validaciones";

const route = useRoute();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  pagosService.listarMios,
  { filtros: { estado: "" } }
);

const cupones = ref([]);
const todosLosPagos = ref([]);

const dialogoReportar = ref(false);
const dialogoReenviar = ref(false);
const guardando = ref(false);
const soporteReenvio = ref(null);

const formReporte = ref({ cupon: null, referencia_externa: "", observaciones: "" });
const formReenvio = ref({ referencia_externa: "", observaciones: "" });
const errorReporte = ref("");
const errorReenvio = ref("");

const columnas = [
  {
    name: "cupon",
    label: "Cupon",
    field: (fila) => fila.cupon?.codigo_cupon || "Sin codigo",
    align: "left",
  },
  {
    name: "valor",
    label: "Valor",
    field: (fila) => fila.cupon?.valor,
    align: "right",
  },
  { name: "referencia", label: "Referencia", field: "referencia_externa", align: "left" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  { name: "fecha", label: "Fecha de carga", field: "fecha_carga", align: "left" },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_PAGO);

const soportePorCupon = computed(() => {
  const mapa = {};
  for (const soporte of todosLosPagos.value) {
    const id = String(soporte.cupon?._id || soporte.cupon);
    mapa[id] = soporte;
  }
  return mapa;
});

const cuponesDisponibles = computed(() =>
  cupones.value.filter(
    (cupon) =>
      cupon.estado === "GENERADO" &&
      !soportePorCupon.value[String(cupon._id)] &&
      (!cupon.fecha_vencimiento ||
        new Date(cupon.fecha_vencimiento).getTime() >= Date.now())
  )
);

const opcionesCupon = computed(() =>
  cuponesDisponibles.value.map((cupon) => ({
    label: `${cupon.codigo_cupon || "Sin codigo"} · ${formatMoney(cupon.valor)}`,
    value: cupon._id,
  }))
);

onMounted(async () => {
  await Promise.all([cargar(), cargarCupones()]);
  abrirDesdeQuery();
});

async function cargarCupones() {
  try {
    const [respuestaCupones, respuestaPagos] = await Promise.all([
      cuponesService.listarMios({ limit: 100 }),
      pagosService.listarMios({ limit: 100 }),
    ]);
    cupones.value = respuestaCupones.datos?.items || [];
    todosLosPagos.value = respuestaPagos.datos?.items || [];
  } catch (err) {
    notificarError(err);
  }
}

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function abrirDesdeQuery() {
  const cuponId = String(route.query.cupon || "");
  if (!cuponId) return;

  const cupon = cuponesDisponibles.value.find((item) => String(item._id) === cuponId);
  if (cupon) abrirReportar(cupon);
  else notificarAdvertencia("Ese cupon ya tiene un pago reportado o no esta vigente");
}

function abrirReportar(cupon = null) {
  formReporte.value = {
    cupon: cupon?._id || null,
    referencia_externa: "",
    observaciones: "",
  };
  errorReporte.value = "";
  dialogoReportar.value = true;
}

async function reportarPago() {
  const errores = validarPago(formReporte.value);
  if (errores.length > 0) {
    errorReporte.value = errores[0];
    return;
  }

  guardando.value = true;
  try {
    await pagosService.cargar({
      cupon: formReporte.value.cupon,
      referencia_externa: formReporte.value.referencia_externa.trim() || null,
      observaciones: formReporte.value.observaciones.trim() || null,
    });
    dialogoReportar.value = false;
    notificarOk("Pago reportado. El laboratorio lo validara.");
    await Promise.all([cargar(), cargarCupones()]);
  } catch (err) {
    errorReporte.value = err?.mensaje || "No se pudo reportar el pago";
    notificarError(err);
  } finally {
    guardando.value = false;
  }
}

function abrirReenviar(fila) {
  soporteReenvio.value = fila;
  formReenvio.value = {
    referencia_externa: fila.referencia_externa || "",
    observaciones: fila.observaciones || "",
  };
  errorReenvio.value = "";
  dialogoReenviar.value = true;
}

async function reenviarPago() {
  const errores = validarPago({
    cupon: soporteReenvio.value?.cupon?._id || soporteReenvio.value?.cupon,
    referencia_externa: formReenvio.value.referencia_externa,
    observaciones: formReenvio.value.observaciones,
  });

  if (errores.length > 0) {
    errorReenvio.value = errores[0];
    return;
  }

  guardando.value = true;
  try {
    await pagosService.reenviar(soporteReenvio.value._id, {
      referencia_externa: formReenvio.value.referencia_externa.trim() || null,
      observaciones: formReenvio.value.observaciones.trim() || null,
    });
    dialogoReenviar.value = false;
    notificarOk("Pago reenviado. El laboratorio lo validara de nuevo.");
    await Promise.all([cargar(), cargarCupones()]);
  } catch (err) {
    errorReenvio.value = err?.mensaje || "No se pudo reenviar el pago";
    notificarError(err);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mis pagos"
      subtitulo="Reporta y consulta los pagos de tus cupones"
      icono="payments"
    >
      <template #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="upload_file"
          label="Reportar pago"
          @click="abrirReportar()"
        />
      </template>
    </EncabezadoPagina>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-5 col-md-4">
        <q-select
          v-model="filtros.estado"
          :options="opcionesEstado"
          outlined
          dense
          clearable
          label="Filtrar por estado"
          @update:model-value="aplicarFiltros"
        />
      </div>
    </div>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      :buscable="false"
      mensaje-vacio="Todavia no has reportado pagos"
      @request="onRequest"
    >
      <template #body-cell-valor="{ value }">
        <q-td class="text-right">{{ formatMoney(value) }}</q-td>
      </template>

      <template #body-cell-estado="{ value }">
        <q-td>
          <EstadoChip :estado="value" />
        </q-td>
      </template>

      <template #body-cell-fecha="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-acciones="{ row }">
        <q-td class="text-right">
          <q-btn
            v-if="row.estado === 'RECHAZADO'"
            flat
            dense
            no-caps
            color="negative"
            icon="replay"
            label="Reenviar"
            @click="abrirReenviar(row)"
          />
          <span v-else class="text-caption texto-suave">-</span>
        </q-td>
      </template>
    </TablaDatos>

    <q-dialog v-model="dialogoReportar" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Reportar pago</div>
          <div class="text-caption texto-suave">
            Selecciona el cupon pagado e indica la referencia del pago.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select
            v-model="formReporte.cupon"
            :options="opcionesCupon"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            outlined
            label="Cupon a pagar *"
            :error="Boolean(errorReporte) && !formReporte.cupon"
            :error-message="Boolean(errorReporte) && !formReporte.cupon ? errorReporte : ''"
          >
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  No tienes cupones pendientes de pago
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-input
            v-model="formReporte.referencia_externa"
            outlined
            label="Referencia del pago"
            counter
            :maxlength="LONGITUDES.pago.referencia_externa"
            :rules="[maximo(LONGITUDES.pago.referencia_externa, 'La referencia')]"
          />

          <q-input
            v-model="formReporte.observaciones"
            outlined
            type="textarea"
            label="Observaciones"
            counter
            autogrow
            :maxlength="LONGITUDES.pago.observaciones"
            :rules="[maximo(LONGITUDES.pago.observaciones, 'Las observaciones')]"
          />

          <div v-if="errorReporte" class="text-caption text-negative">
            {{ errorReporte }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Reportar"
            :loading="guardando"
            :disable="opcionesCupon.length === 0"
            @click="reportarPago"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogoReenviar" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Reenviar pago</div>
          <div class="text-caption texto-suave">
            Actualiza la referencia del pago rechazado.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <div class="text-body2">
            Cupon:
            <strong>{{ soporteReenvio?.cupon?.codigo_cupon || "Sin codigo" }}</strong>
          </div>

          <q-input
            v-model="formReenvio.referencia_externa"
            outlined
            label="Referencia del pago"
            counter
            :maxlength="LONGITUDES.pago.referencia_externa"
            :rules="[maximo(LONGITUDES.pago.referencia_externa, 'La referencia')]"
          />

          <q-input
            v-model="formReenvio.observaciones"
            outlined
            type="textarea"
            label="Observaciones"
            counter
            autogrow
            :maxlength="LONGITUDES.pago.observaciones"
            :rules="[maximo(LONGITUDES.pago.observaciones, 'Las observaciones')]"
          />

          <div v-if="errorReenvio" class="text-caption text-negative">
            {{ errorReenvio }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            label="Reenviar"
            :loading="guardando"
            @click="reenviarPago"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
