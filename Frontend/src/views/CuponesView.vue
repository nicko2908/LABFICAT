<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import * as cotizacionesService from "@/services/cotizaciones.service";
import * as cuponesService from "@/services/cupones.service";
import { ESTADO_CUPON } from "@/utils/estados";
import { formatDate } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";

const router = useRouter();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  cuponesService.listar,
  { filtros: { estado: "" } }
);

const dialogoNuevo = ref(false);
const cargandoCotizaciones = ref(false);
const cotizacionesAceptadas = ref([]);
const formNuevo = ref({ cotizacion: null, valor: null });
const errorNuevo = ref("");
const guardando = ref(false);

const columnas = [
  {
    name: "codigo",
    label: "Cupon",
    field: (fila) => fila.codigo_cupon || "Sin codigo",
    align: "left",
  },
  { name: "valor", label: "Valor", field: "valor", align: "right" },
  { name: "estado", label: "Estado", field: "estado", align: "left" },
  { name: "solicitud", label: "Solicitado", field: "fecha_solicitud", align: "left" },
  {
    name: "vencimiento",
    label: "Vence",
    field: "fecha_vencimiento",
    align: "left",
  },
  { name: "acciones", label: "", align: "right" },
];

const opcionesEstado = Object.values(ESTADO_CUPON);

const opcionesCotizacion = computed(() =>
  cotizacionesAceptadas.value.map((cotizacion) => ({
    label: `${cotizacion.codigo_completo || `${cotizacion.codigo_cotizacion}V${cotizacion.version}`} · ${formatMoney(cotizacion.valor_total)}`,
    value: cotizacion._id,
    valor: Number(cotizacion.valor_total) || 0,
  }))
);

onMounted(cargar);

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function ver(fila) {
  router.push({ name: "cupon-detalle", params: { id: fila._id } });
}

async function abrirNuevo() {
  dialogoNuevo.value = true;
  errorNuevo.value = "";
  formNuevo.value = { cotizacion: null, valor: null };

  cargandoCotizaciones.value = true;
  try {
    const [respuestaCotizaciones, respuestaCupones] = await Promise.all([
      cotizacionesService.listar({ estado: "ACEPTADA", limit: 100 }),
      cuponesService.listar({ limit: 100 }),
    ]);

    const conCupon = new Set(
      (respuestaCupones.datos?.items || []).map((cupon) =>
        String(cupon.cotizacion?._id || cupon.cotizacion)
      )
    );

    cotizacionesAceptadas.value = (respuestaCotizaciones.datos?.items || []).filter(
      (cotizacion) =>
        Number(cotizacion.valor_total) > 0 && !conCupon.has(String(cotizacion._id))
    );
  } catch (err) {
    notificarError(err);
  } finally {
    cargandoCotizaciones.value = false;
  }
}

function alElegirCotizacion(valor) {
  const opcion = opcionesCotizacion.value.find((item) => item.value === valor);
  formNuevo.value.valor = opcion ? opcion.valor : null;
}

async function crearCupon() {
  if (!formNuevo.value.cotizacion) {
    errorNuevo.value = "Selecciona la cotizacion";
    return;
  }

  const valor = Number(formNuevo.value.valor);
  const opcion = opcionesCotizacion.value.find(
    (item) => item.value === formNuevo.value.cotizacion
  );

  if (!Number.isFinite(valor) || valor <= 0) {
    errorNuevo.value = "El valor del cupon debe ser mayor a 0";
    return;
  }

  if (opcion && Math.abs(valor - opcion.valor) > 0.01) {
    errorNuevo.value = "El valor del cupon debe coincidir con el total de la cotizacion";
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await cuponesService.crear({
      cotizacion: formNuevo.value.cotizacion,
      valor,
    });
    dialogoNuevo.value = false;
    notificarOk("Cupon solicitado. Genera el codigo para enviarlo al cliente.");
    router.push({ name: "cupon-detalle", params: { id: respuesta.datos._id } });
  } catch (err) {
    errorNuevo.value = err?.mensaje || "No se pudo crear el cupon";
    notificarAdvertencia(errorNuevo.value);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Cupones"
      subtitulo="Cupones de pago de clientes externos"
      icono="confirmation_number"
    >
      <template #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          label="Nuevo cupon"
          @click="abrirNuevo"
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
      mensaje-vacio="No hay cupones registrados"
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

      <template #body-cell-solicitud="{ value }">
        <q-td>{{ formatDate(value) }}</q-td>
      </template>

      <template #body-cell-vencimiento="{ value }">
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

    <q-dialog v-model="dialogoNuevo" persistent>
      <q-card style="width: 620px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Nuevo cupon</div>
          <div class="text-caption texto-suave">
            Solo aplica a cotizaciones aceptadas de clientes externos con valor mayor a 0.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select
            v-model="formNuevo.cotizacion"
            :options="opcionesCotizacion"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            outlined
            label="Cotizacion aceptada *"
            :loading="cargandoCotizaciones"
            @update:model-value="alElegirCotizacion"
          >
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  No hay cotizaciones aceptadas pendientes de cupon
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-input
            v-model.number="formNuevo.valor"
            type="number"
            outlined
            label="Valor del cupon *"
            min="0"
            prefix="$"
          />

          <div v-if="errorNuevo" class="text-caption text-negative">
            {{ errorNuevo }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Crear cupon"
            :loading="guardando"
            :disable="opcionesCotizacion.length === 0"
            @click="crearCupon"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
