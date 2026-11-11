<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import ResultadosOrden from "@/components/Domain/ResultadosOrden.vue";
import { useConfirmar } from "@/composables/useConfirmar";
import { useNotificar } from "@/composables/useNotificar";
import * as catalogosService from "@/services/catalogos.service";
import * as ordenesService from "@/services/ordenes.service";
import * as trazabilidadService from "@/services/trazabilidad.service";
import { useAuthStore } from "@/store/Auth";
import { LONGITUDES } from "@/utils/contrato";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import { validarResultados } from "@/utils/validaciones";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { confirmar } = useConfirmar();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const orden = ref(null);
const analisisDetalle = ref(null);
const resultados = ref([]);
const procesando = ref(false);

const dialogoRepetir = ref(false);
const observacionesRepeticion = ref("");

const validaciones = ref([]);
const dialogoValidacion = ref(false);
const decisionValidacion = ref("APROBADO");
const motivoValidacion = ref("");
const errorValidacion = ref("");

const validacion = computed(() => validaciones.value[0] || null);

const puedeValidar = computed(
  () =>
    auth.esCoordinador &&
    orden.value?.estado === "FINALIZADA" &&
    !validacion.value
);

const parametros = computed(() => analisisDetalle.value?.parametros || []);

const puedeIniciar = computed(
  () => orden.value?.estado === "PENDIENTE" && (auth.esAnalista || auth.esCoordinador)
);

const puedeFinalizar = computed(
  () => orden.value?.estado === "EN_PROCESO" && (auth.esAnalista || auth.esCoordinador)
);

const puedeInvalidar = computed(
  () => orden.value?.estado === "FINALIZADA" && auth.esCoordinador
);

const puedeRepetir = computed(
  () => orden.value?.estado === "INVALIDADA" && auth.esCoordinador
);

const puedeGuardarResultados = computed(
  () => orden.value?.estado === "EN_PROCESO" && auth.esAnalista
);

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await ordenesService.obtener(route.params.id);
    orden.value = respuesta.datos;

    const idAnalisis = respuesta.datos?.analisis?._id || respuesta.datos?.analisis;
    if (idAnalisis) {
      const respuestaAnalisis = await catalogosService.obtenerAnalisis(idAnalisis);
      analisisDetalle.value = respuestaAnalisis.datos;
    }

    resultados.value = (respuesta.datos?.resultados || []).map((resultado) => ({
      parametro: resultado.parametro?._id || resultado.parametro,
      valor: resultado.valor,
    }));

    if (auth.esCoordinador || auth.esAnalista) {
      const respuestaValidaciones = await trazabilidadService.historialValidaciones(
        route.params.id
      );
      validaciones.value = respuestaValidaciones.datos || [];
    }
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

async function avanzar(estado) {
  procesando.value = true;
  try {
    await ordenesService.avanzarEstado(orden.value._id, estado);
    notificarOk(`Orden en estado ${estado}.`);
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}

async function guardarResultados() {
  const errores = validarResultados(resultados.value, parametros.value);
  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  procesando.value = true;
  try {
    await ordenesService.registrarResultados(orden.value._id, resultados.value);
    notificarOk("Resultados registrados.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}

async function invalidar() {
  const confirmado = await confirmar({
    titulo: "Invalidar orden",
    mensaje: "La orden quedara invalidada y el coordinador podra repetir el analisis.",
    textoOk: "Invalidar",
    color: "negative",
  });
  if (!confirmado) return;
  await avanzar("INVALIDADA");
}

function abrirRepetir() {
  observacionesRepeticion.value = "";
  dialogoRepetir.value = true;
}

async function repetir() {
  procesando.value = true;
  try {
    const respuesta = await ordenesService.repetir(
      orden.value._id,
      observacionesRepeticion.value.trim() || null
    );
    dialogoRepetir.value = false;
    notificarOk("Repeticion creada.");
    router.push({ name: "orden-detalle", params: { id: respuesta.datos._id } });
  } catch (err) {
    notificarError(err);
  } finally {
    procesando.value = false;
  }
}

function abrirValidacion(decision = "APROBADO") {
  decisionValidacion.value = decision;
  motivoValidacion.value = "";
  errorValidacion.value = "";
  dialogoValidacion.value = true;
}

async function confirmarValidacion() {
  const motivo = motivoValidacion.value.trim();

  if (decisionValidacion.value === "RECHAZADO" && !motivo) {
    errorValidacion.value = "El motivo es obligatorio para rechazar";
    return;
  }

  if (motivo.length > LONGITUDES.validacion.motivo) {
    errorValidacion.value = `El motivo no puede superar los ${LONGITUDES.validacion.motivo} caracteres`;
    return;
  }

  procesando.value = true;
  try {
    await trazabilidadService.validarResultado({
      orden: orden.value._id,
      decision: decisionValidacion.value,
      motivo: motivo || null,
    });
    dialogoValidacion.value = false;
    notificarOk(
      decisionValidacion.value === "APROBADO"
        ? "Resultados aprobados."
        : "Resultados rechazados; la orden quedo invalidada."
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
      titulo="Detalle de orden"
      :subtitulo="orden?.analisis?.nombre || 'Orden de analisis'"
      icono="biotech"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'ordenes' }"
          class="q-mr-sm"
        />

        <q-btn
          v-if="puedeIniciar"
          unelevated
          no-caps
          color="primary"
          icon="play_arrow"
          label="Iniciar analisis"
          :loading="procesando"
          @click="avanzar('EN_PROCESO')"
        />
        <q-btn
          v-if="puedeValidar"
          unelevated
          no-caps
          color="positive"
          icon="fact_check"
          label="Validar resultados"
          :loading="procesando"
          @click="abrirValidacion()"
        />
        <q-btn
          v-if="puedeInvalidar"
          outline
          no-caps
          color="negative"
          icon="block"
          label="Invalidar"
          :loading="procesando"
          @click="invalidar"
        />
        <q-btn
          v-if="puedeRepetir"
          unelevated
          no-caps
          color="primary"
          icon="replay"
          label="Repetir analisis"
          @click="abrirRepetir"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !orden"
      titulo="No se pudo cargar la orden"
      detalle="Verifica que la orden exista."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

    <div v-else class="row q-col-gutter-lg">
      <div class="col-12 col-lg-5">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="info" size="18px" class="q-mr-sm" />
            Datos de la orden
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Muestra</div>
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                :label="orden.muestra?.codigo_muestra || 'Ver muestra'"
                :to="{
                  name: auth.esCoordinador || auth.esAnalista ? 'muestra-detalle' : 'mi-muestra',
                  params: { id: orden.muestra?._id || orden.muestra },
                }"
              />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado</div>
              <EstadoChip :estado="orden.estado" />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Ensayo</div>
              <div class="data-value">{{ orden.analisis?.nombre || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Iteracion</div>
              <div class="data-value">{{ orden.numero_iteracion || 1 }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Responsable</div>
              <div class="data-value">
                {{
                  orden.usuario
                    ? `${orden.usuario.nombres} ${orden.usuario.apellidos}`.trim()
                    : "-"
                }}
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Creada</div>
              <div class="data-value">{{ formatDate(orden.createdAt) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Inicio</div>
              <div class="data-value">{{ formatDateTime(orden.fecha_inicio) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fin</div>
              <div class="data-value">{{ formatDateTime(orden.fecha_fin) }}</div>
            </div>
            <div v-if="orden.proceso" class="col-12">
              <div class="data-label">Proceso</div>
              <div class="data-value">{{ orden.proceso }}</div>
            </div>
            <div v-if="orden.observaciones" class="col-12">
              <div class="data-label">Observaciones</div>
              <div class="data-value">{{ orden.observaciones }}</div>
            </div>
            <div v-if="orden.orden_anterior" class="col-12">
              <div class="data-label">Orden anterior</div>
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                :label="`Iteracion ${orden.orden_anterior.numero_iteracion} (${orden.orden_anterior.estado})`"
                :to="{ name: 'orden-detalle', params: { id: orden.orden_anterior._id } }"
              />
            </div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-7">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="fact_check" size="18px" class="q-mr-sm" />
            Resultados
          </div>

          <div class="q-pa-md">
            <div v-if="parametros.length === 0" class="text-caption texto-suave">
              El ensayo no tiene parametros configurados.
            </div>

            <template v-else>
              <ResultadosOrden
                v-model="resultados"
                :parametros="parametros"
                :solo-lectura="!puedeGuardarResultados"
              />

              <div v-if="puedeGuardarResultados" class="row justify-end q-mt-md">
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  icon="save"
                  label="Guardar resultados"
                  :loading="procesando"
                  @click="guardarResultados"
                />
              </div>

              <div v-if="puedeFinalizar" class="row justify-end q-mt-md">
                <q-btn
                  unelevated
                  no-caps
                  color="positive"
                  icon="check"
                  label="Finalizar orden"
                  :loading="procesando"
                  @click="avanzar('FINALIZADA')"
                />
              </div>

              <div v-if="orden.estado === 'PENDIENTE'" class="text-caption texto-suave q-mt-md">
                Inicia el analisis para poder registrar resultados.
              </div>
            </template>
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="verified" size="18px" class="q-mr-sm" />
            Validacion de resultados
          </div>

          <div class="q-pa-md">
            <template v-if="validacion">
              <div class="row items-center justify-between">
                <span class="texto-suave">Decision</span>
                <EstadoChip :estado="validacion.decision" />
              </div>
              <div class="data-label q-mt-sm">Motivo</div>
              <div class="data-value">{{ validacion.motivo || "-" }}</div>
              <div class="data-label q-mt-sm">Validador</div>
              <div class="data-value">
                {{
                  validacion.usuario
                    ? `${validacion.usuario.nombres} ${validacion.usuario.apellidos}`.trim()
                    : "-"
                }}
              </div>
              <div class="data-label q-mt-sm">Fecha</div>
              <div class="data-value">{{ formatDateTime(validacion.fecha_hora) }}</div>
            </template>

            <template v-else-if="puedeValidar">
              <p class="texto-suave q-mb-md">
                Revisa los resultados y aprueba o rechaza la orden.
              </p>
              <q-btn
                unelevated
                no-caps
                color="positive"
                icon="verified"
                label="Validar resultados"
                class="full-width"
                :loading="procesando"
                @click="abrirValidacion()"
              />
            </template>

            <div v-else class="text-caption texto-suave">
              La orden debe estar FINALIZADA y sin validacion previa.
            </div>
          </div>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="dialogoRepetir" persistent>
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Repetir analisis</div>
          <div class="text-caption texto-suave">
            Se creara una nueva iteracion de la orden.
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="observacionesRepeticion"
            outlined
            type="textarea"
            label="Observaciones"
            counter
            autogrow
            maxlength="200"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Crear repeticion"
            :loading="procesando"
            @click="repetir"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogoValidacion" persistent>
      <q-card style="width: 540px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Validar resultados</div>
          <div class="text-caption texto-suave">
            Al rechazar, la orden pasa a INVALIDADA y puede repetirse.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select
            v-model="decisionValidacion"
            :options="['APROBADO', 'RECHAZADO']"
            outlined
            label="Decision *"
          />

          <q-input
            v-model="motivoValidacion"
            outlined
            type="textarea"
            label="Motivo"
            counter
            autogrow
            :maxlength="LONGITUDES.validacion.motivo"
            :error="Boolean(errorValidacion)"
            :error-message="errorValidacion"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            :color="decisionValidacion === 'APROBADO' ? 'positive' : 'negative'"
            :label="decisionValidacion === 'APROBADO' ? 'Aprobar' : 'Rechazar'"
            :loading="procesando"
            @click="confirmarValidacion"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
