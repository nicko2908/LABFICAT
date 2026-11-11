<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import CotizacionItems from "@/components/Domain/CotizacionItems.vue";
import DetalleCotizacion from "@/components/Domain/DetalleCotizacion.vue";
import { useConfirmar } from "@/composables/useConfirmar";
import { useNotificar } from "@/composables/useNotificar";
import * as cotizaciones from "@/services/cotizaciones.service";
import * as solicitudes from "@/services/solicitudes.service";
import { LONGITUDES } from "@/utils/contrato";
import { maximo } from "@/utils/reglas";
import { validarCotizacion } from "@/utils/validaciones";

const route = useRoute();
const router = useRouter();
const { confirmar } = useConfirmar();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const procesando = ref(false);

const cotizacion = ref(null);
const solicitud = ref(null);
const editando = ref(false);

const items = ref([]);
const propuesta = ref({ observaciones_propuesta: "", fecha_validez: "" });

const codigo = computed(() => {
  const c = cotizacion.value;
  if (!c) return "";
  return c.codigo_completo || `${c.codigo_cotizacion || "-"}V${c.version || 1}`;
});

const esInterno = computed(
  () => cotizacion.value?.cliente_snapshot?.tipo_cliente === "INTERNO"
);

const puedeEditar = computed(() => cotizacion.value?.estado === "PENDIENTE");

const puedeVersionar = computed(
  () =>
    cotizacion.value?.estado === "PENDIENTE" &&
    solicitud.value?.estado === "Cotizada"
);

const tieneFirma = computed(
  () => Boolean(cotizacion.value?.firma?.key || cotizacion.value?.firma_ruta)
);

const clienteSnapshot = computed(() => cotizacion.value?.cliente_snapshot || null);

const analisisDisponibles = computed(() => solicitud.value?.analisis || []);

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await cotizaciones.obtener(route.params.id);
    cotizacion.value = respuesta.datos;

    const idSolicitud = respuesta.datos?.solicitud?._id || respuesta.datos?.solicitud;
    if (idSolicitud) {
      const respuestaSolicitud = await solicitudes.obtener(idSolicitud);
      solicitud.value = respuestaSolicitud.datos;
    }
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

function clonarItems() {
  const c = cotizacion.value;
  const base =
    Array.isArray(c?.items) && c.items.length > 0
      ? c.items
      : [{ numero: 1, descripcion_muestra: null, detalle: c?.detalle || [] }];

  return base.map((item, indice) => ({
    numero: item.numero ?? indice + 1,
    descripcion_muestra: item.descripcion_muestra || "",
    detalle: (item.detalle || []).map((linea) => ({
      analisis: linea.analisis?._id || linea.analisis || null,
      cantidad: Number(linea.cantidad) || 1,
    })),
  }));
}

function activarEdicion() {
  items.value = clonarItems();
  propuesta.value = {
    observaciones_propuesta: cotizacion.value?.observaciones_propuesta || "",
    fecha_validez: cotizacion.value?.fecha_validez
      ? String(cotizacion.value.fecha_validez).slice(0, 10)
      : "",
  };
  editando.value = true;
}

function cancelarEdicion() {
  editando.value = false;
}

async function guardarEdicion() {
  const errores = validarCotizacion({
    items: items.value,
    observaciones_propuesta: propuesta.value.observaciones_propuesta,
    fecha_validez: propuesta.value.fecha_validez,
  });

  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  procesando.value = true;
  try {
    await cotizaciones.actualizar(cotizacion.value._id, {
      items: items.value,
      observaciones_propuesta:
        propuesta.value.observaciones_propuesta.trim() || null,
      fecha_validez: propuesta.value.fecha_validez || null,
    });
    notificarOk("Cotizacion actualizada.");
    editando.value = false;
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}

async function crearNuevaVersion() {
  const confirmado = await confirmar({
    titulo: "Nueva version",
    mensaje:
      "La version actual quedara reemplazada y el cliente debera revisar la nueva oferta.",
    textoOk: "Crear version",
  });
  if (!confirmado) return;

  procesando.value = true;
  try {
    const respuesta = await cotizaciones.nuevaVersion(cotizacion.value._id);
    notificarOk(`Nueva version creada: V${respuesta.datos.version}`);
    router.push({
      name: "cotizacion-detalle",
      params: { id: respuesta.datos._id },
    });
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
      titulo="Detalle de cotizacion"
      :subtitulo="codigo || 'Oferta de servicios emitida al cliente'"
      icono="request_quote"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'cotizaciones' }"
          class="q-mr-sm"
        />

        <template v-if="cotizacion && !editando">
          <BotonDescarga
            :obtener="() => cotizaciones.descargarExcel(cotizacion._id)"
            label="Excel"
            icono="download"
            color="primary"
            mensaje="Cotizacion descargada"
            class="q-mr-sm"
          />
          <BotonDescarga
            v-if="tieneFirma"
            :obtener="() => cotizaciones.descargarFirma(cotizacion._id)"
            label="Firma"
            icono="draw"
            color="primary"
            mensaje="Firma descargada"
            outline
            class="q-mr-sm"
          />
          <q-btn
            v-if="puedeVersionar"
            outline
            no-caps
            color="primary"
            icon="content_copy"
            label="Nueva version"
            class="q-mr-sm"
            :loading="procesando"
            @click="crearNuevaVersion"
          />
          <q-btn
            v-if="puedeEditar"
            unelevated
            no-caps
            color="primary"
            icon="edit"
            label="Editar"
            @click="activarEdicion"
          />
        </template>
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !cotizacion"
      titulo="No se pudo cargar la cotizacion"
      detalle="Verifica que la cotizacion exista."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <template v-else-if="editando">
      <q-card flat class="tarjeta q-pa-lg">
        <div class="section-box__title q-mb-md">Editar cotizacion</div>

        <CotizacionItems
          v-model="items"
          :analisis="analisisDisponibles"
          :es-interno="esInterno"
        />

        <div class="row q-col-gutter-md q-mt-md">
          <div class="col-12 col-md-5">
            <q-input
              v-model="propuesta.fecha_validez"
              type="date"
              outlined
              label="Valida hasta"
            />
          </div>
          <div class="col-12 col-md-7">
            <q-input
              v-model="propuesta.observaciones_propuesta"
              outlined
              type="textarea"
              label="Observaciones de la propuesta"
              counter
              autogrow
              :maxlength="LONGITUDES.cotizacion.observaciones_propuesta"
              :rules="[maximo(LONGITUDES.cotizacion.observaciones_propuesta, 'Las observaciones')]"
            />
          </div>
        </div>

        <div class="row justify-end q-mt-lg">
          <q-btn flat no-caps label="Cancelar" class="q-mr-sm" @click="cancelarEdicion" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="save"
            label="Guardar cambios"
            :loading="procesando"
            @click="guardarEdicion"
          />
        </div>
      </q-card>
    </template>

    <DetalleCotizacion v-else :cotizacion="cotizacion">
      <template #extra>
        <q-card v-if="clienteSnapshot" flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="badge" size="18px" class="q-mr-sm" />
            Cliente
          </div>
          <div class="q-pa-md">
            <div class="data-label">Nombre</div>
            <div class="data-value q-mb-sm">{{ clienteSnapshot.nombre || "-" }}</div>
            <div class="data-label">NIT</div>
            <div class="data-value q-mb-sm">{{ clienteSnapshot.nit || "-" }}</div>
            <div class="data-label">Correo</div>
            <div class="data-value q-mb-sm">{{ clienteSnapshot.correo || "-" }}</div>
            <div class="data-label">Telefono</div>
            <div class="data-value q-mb-sm">{{ clienteSnapshot.telefono || "-" }}</div>
            <div class="data-label">Tipologia</div>
            <div class="data-value">{{ clienteSnapshot.tipologia || "-" }}</div>
          </div>
        </q-card>
      </template>
    </DetalleCotizacion>
  </q-page>
</template>
