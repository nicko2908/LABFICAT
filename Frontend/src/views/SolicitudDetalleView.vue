<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import CotizacionItems from "@/components/Domain/CotizacionItems.vue";
import { useNotificar } from "@/composables/useNotificar";
import * as clientes from "@/services/clientes.service";
import * as cotizaciones from "@/services/cotizaciones.service";
import * as solicitudes from "@/services/solicitudes.service";
import { LONGITUDES } from "@/utils/contrato";
import { colorEstado, etiquetaEstado, transicionesSolicitud } from "@/utils/estados";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import { formatMoney } from "@/utils/formatMoney";
import { maximo } from "@/utils/reglas";
import { validarCotizacion } from "@/utils/validaciones";

const route = useRoute();
const router = useRouter();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const guardando = ref(false);
const procesandoEstado = ref(false);

const solicitud = ref(null);
const cliente = ref(null);
const historial = ref([]);
const listaCotizaciones = ref([]);

const items = ref(nuevaCotizacionInicial());
const propuesta = ref({ observaciones_propuesta: "", fecha_validez: "" });

const dialogoDesistir = ref(false);
const motivoDesistir = ref("");
const errorMotivo = ref("");

const esInterno = computed(() => cliente.value?.tipo_cliente === "INTERNO");

const nombreCliente = computed(() => {
  const c = cliente.value;
  if (!c) return "-";
  const usuario = c.usuario || {};
  return (
    c.razon_social ||
    [usuario.nombres, usuario.apellidos].filter(Boolean).join(" ").trim() ||
    "-"
  );
});

const puedeCotizar = computed(
  () => solicitud.value?.estado === "Registrada" && listaCotizaciones.value.length === 0
);

const puedeDesistir = computed(() =>
  transicionesSolicitud(solicitud.value?.estado).includes("Desistida")
);

const puedeCerrar = computed(() =>
  transicionesSolicitud(solicitud.value?.estado).includes("Cerrada")
);

function nuevaCotizacionInicial() {
  return [
    {
      numero: 1,
      descripcion_muestra: "",
      detalle: [{ analisis: null, cantidad: 1 }],
    },
  ];
}

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await solicitudes.obtener(route.params.id);
    solicitud.value = respuesta.datos;

    const idCliente = respuesta.datos?.cliente?._id;
    const [respuestaHistorial, respuestaCliente, respuestaCotizaciones] =
      await Promise.all([
        solicitudes.historial(route.params.id),
        idCliente ? clientes.obtener(idCliente) : Promise.resolve({ datos: null }),
        cotizaciones.listar({ solicitud: route.params.id, limit: 50 }),
      ]);

    historial.value = respuestaHistorial.datos || [];
    cliente.value = respuestaCliente.datos;
    listaCotizaciones.value = respuestaCotizaciones.datos?.items || [];
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

async function crearCotizacion() {
  const errores = validarCotizacion({
    items: items.value,
    observaciones_propuesta: propuesta.value.observaciones_propuesta,
    fecha_validez: propuesta.value.fecha_validez,
  });

  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await cotizaciones.crear({
      solicitud: solicitud.value._id,
      items: items.value,
      observaciones_propuesta:
        propuesta.value.observaciones_propuesta.trim() || null,
      fecha_validez: propuesta.value.fecha_validez || null,
    });
    notificarOk("Cotizacion creada y enviada al cliente.");
    router.push({
      name: "cotizacion-detalle",
      params: { id: respuesta.datos._id },
    });
  } catch (err) {
    notificarError(err);
  } finally {
    guardando.value = false;
  }
}

function abrirDesistir() {
  motivoDesistir.value = "";
  errorMotivo.value = "";
  dialogoDesistir.value = true;
}

async function desistir() {
  if (motivoDesistir.value.trim().length > LONGITUDES.solicitud.motivo_desistimiento) {
    errorMotivo.value = `El motivo no puede superar los ${LONGITUDES.solicitud.motivo_desistimiento} caracteres`;
    return;
  }

  procesandoEstado.value = true;
  try {
    await solicitudes.cambiarEstado(solicitud.value._id, {
      estado: "Desistida",
      motivo_desistimiento: motivoDesistir.value.trim() || null,
    });
    dialogoDesistir.value = false;
    notificarOk("Solicitud marcada como desistida.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesandoEstado.value = false;
  }
}

async function cerrarSolicitud() {
  procesandoEstado.value = true;
  try {
    await solicitudes.cambiarEstado(solicitud.value._id, { estado: "Cerrada" });
    notificarOk("Solicitud cerrada.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesandoEstado.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Detalle de solicitud"
      :subtitulo="solicitud?.codigo_solicitud || 'Gestiona la solicitud y su cotizacion'"
      icono="description"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'solicitudes' }"
          class="q-mr-sm"
        />
        <q-btn
          v-if="puedeDesistir"
          outline
          no-caps
          color="negative"
          icon="cancel"
          label="Desistir"
          class="q-mr-sm"
          :loading="procesandoEstado"
          @click="abrirDesistir"
        />
        <q-btn
          v-if="puedeCerrar"
          unelevated
          no-caps
          color="primary"
          icon="lock"
          label="Cerrar solicitud"
          :loading="procesandoEstado"
          @click="cerrarSolicitud"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !solicitud"
      titulo="No se pudo cargar la solicitud"
      detalle="Verifica que la solicitud exista."
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
            <div v-if="cliente?.usuario?.correo" class="col-12 col-sm-6">
              <div class="data-label">Correo</div>
              <div class="data-value">{{ cliente.usuario.correo }}</div>
            </div>
            <div v-if="cliente?.usuario?.numero_documento" class="col-12 col-sm-6">
              <div class="data-label">Documento</div>
              <div class="data-value">
                {{ cliente.usuario.tipo_documento }} {{ cliente.usuario.numero_documento }}
              </div>
            </div>
            <div v-if="cliente?.tipologia?.nombre" class="col-12 col-sm-6">
              <div class="data-label">Tipologia</div>
              <div class="data-value">{{ cliente.tipologia.nombre }}</div>
            </div>
            <div v-if="cliente?.telefono" class="col-12 col-sm-6">
              <div class="data-label">Telefono</div>
              <div class="data-value">{{ cliente.telefono }}</div>
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
                  <q-item-label caption>{{ analisis.unidades || "Sin unidad" }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  {{ esInterno ? "Sin costo" : formatMoney(analisis.tarifa_externo) }}
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="request_quote" size="18px" class="q-mr-sm" />
            Cotizaciones
          </div>

          <div class="q-pa-md">
            <q-list v-if="listaCotizaciones.length > 0" separator>
              <q-item
                v-for="cotizacion in listaCotizaciones"
                :key="cotizacion._id"
                clickable
                @click="router.push({ name: 'cotizacion-detalle', params: { id: cotizacion._id } })"
              >
                <q-item-section>
                  <q-item-label>
                    {{ cotizacion.codigo_completo || `${cotizacion.codigo_cotizacion}V${cotizacion.version}` }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ formatDate(cotizacion.fecha_emision) }} · {{ formatMoney(cotizacion.valor_total) }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <EstadoChip :estado="cotizacion.estado" />
                </q-item-section>
              </q-item>
            </q-list>

            <div v-else-if="puedeCotizar">
              <p class="texto-suave">
                La solicitud no tiene cotizacion. Define los items y los ensayos
                para enviarla al cliente.
              </p>

              <CotizacionItems
                v-model="items"
                :analisis="solicitud.analisis"
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

              <div class="row justify-end q-mt-md">
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  icon="send"
                  label="Crear y enviar cotizacion"
                  :loading="guardando"
                  @click="crearCotizacion"
                />
              </div>
            </div>

            <div v-else class="text-caption texto-suave">
              No hay cotizaciones para esta solicitud.
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
      </div>
    </div>

    <q-dialog v-model="dialogoDesistir" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Marcar solicitud como desistida</div>
          <div class="text-caption texto-suave">
            La solicitud quedara cerrada y no podra reactivarse.
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="motivoDesistir"
            outlined
            type="textarea"
            label="Motivo (opcional)"
            counter
            autogrow
            :maxlength="LONGITUDES.solicitud.motivo_desistimiento"
            :error="Boolean(errorMotivo)"
            :error-message="errorMotivo"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            label="Desistir"
            :loading="procesandoEstado"
            @click="desistir"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
