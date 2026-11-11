<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import EstadoChip from "@/components/Common/EstadoChip.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import BotonDescarga from "@/components/Domain/BotonDescarga.vue";
import { useConfirmar } from "@/composables/useConfirmar";
import { useNotificar } from "@/composables/useNotificar";
import * as reclamacionesService from "@/services/reclamaciones.service";
import { formatDateTime } from "@/utils/formatDate";

const route = useRoute();
const router = useRouter();
const { confirmar } = useConfirmar();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const reclamacion = ref(null);
const procesando = ref(false);

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await reclamacionesService.obtener(route.params.id);
    reclamacion.value = respuesta.datos;
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

async function cambiarEstado() {
  const resuelta = reclamacion.value?.estado === "RESUELTA";
  const nuevoEstado = resuelta ? "ABIERTA" : "RESUELTA";

  const confirmado = await confirmar({
    titulo: resuelta ? "Reabrir reclamacion" : "Resolver reclamacion",
    mensaje: resuelta
      ? "La reclamacion volvera a estado ABIERTA."
      : "La reclamacion quedara marcada como RESUELTA.",
    textoOk: resuelta ? "Reabrir" : "Resolver",
    color: resuelta ? "primary" : "positive",
  });
  if (!confirmado) return;

  procesando.value = true;
  try {
    await reclamacionesService.cambiarEstado(reclamacion.value._id, {
      estado: nuevoEstado,
    });
    notificarOk(`Reclamacion ${nuevoEstado.toLowerCase()}.`);
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
      titulo="Detalle de reclamacion"
      :subtitulo="reclamacion?.codigo_soporte || 'Reclamacion del cliente'"
      icono="report_problem"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'reclamaciones' }"
          class="q-mr-sm"
        />
        <q-btn
          v-if="reclamacion"
          unelevated
          no-caps
          :color="reclamacion.estado === 'RESUELTA' ? 'primary' : 'positive'"
          :icon="reclamacion.estado === 'RESUELTA' ? 'replay' : 'task_alt'"
          :label="reclamacion.estado === 'RESUELTA' ? 'Reabrir' : 'Marcar resuelta'"
          :loading="procesando"
          @click="cambiarEstado"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !reclamacion"
      titulo="No se pudo cargar la reclamacion"
      detalle="Verifica que la reclamacion exista."
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
            Datos de la reclamacion
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Codigo</div>
              <div class="data-value">{{ reclamacion.codigo_soporte }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado</div>
              <EstadoChip :estado="reclamacion.estado" />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Solicitud</div>
              <q-btn
                v-if="reclamacion.solicitud?._id"
                flat
                dense
                no-caps
                color="primary"
                :label="reclamacion.solicitud.codigo_solicitud || 'Ver solicitud'"
                :to="{
                  name: 'solicitud-detalle',
                  params: { id: reclamacion.solicitud._id },
                }"
              />
              <span v-else class="data-value">-</span>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado de la solicitud</div>
              <div class="data-value">{{ reclamacion.solicitud?.estado || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de registro</div>
              <div class="data-value">{{ formatDateTime(reclamacion.fecha_registro) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Fecha de resolucion</div>
              <div class="data-value">{{ formatDateTime(reclamacion.fecha_resolucion) }}</div>
            </div>
            <div class="col-12">
              <div class="data-label">Motivo</div>
              <div class="data-value">{{ reclamacion.motivo }}</div>
            </div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="attach_file" size="18px" class="q-mr-sm" />
            Evidencias ({{ (reclamacion.evidencias || []).length }})
          </div>

          <div class="q-pa-md">
            <div
              v-if="(reclamacion.evidencias || []).length === 0"
              class="text-caption texto-suave"
            >
              El cliente no adjunto evidencias.
            </div>

            <div v-else class="column q-gutter-sm">
              <BotonDescarga
                v-for="evidencia in reclamacion.evidencias"
                :key="evidencia._id"
                :obtener="() =>
                  reclamacionesService.descargarEvidencia(
                    reclamacion._id,
                    evidencia._id,
                    evidencia.archivo?.nombre_original || 'evidencia'
                  )"
                :label="evidencia.archivo?.nombre_original || 'Descargar evidencia'"
                icono="image"
                color="primary"
                mensaje="Evidencia descargada"
                outline
              />
            </div>
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
