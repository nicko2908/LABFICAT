<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EvidenciasUpload from "@/components/Domain/EvidenciasUpload.vue";
import { useNotificar } from "@/composables/useNotificar";
import * as reclamacionesService from "@/services/reclamaciones.service";
import { listarMias } from "@/services/solicitudes.service";
import { LONGITUDES } from "@/utils/contrato";
import { maximo, seleccionRequerida } from "@/utils/reglas";
import { validarEvidencias, validarReclamacion } from "@/utils/validaciones";

const router = useRouter();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const cargando = ref(true);
const guardando = ref(false);
const solicitudes = ref([]);
const formulario = ref({ solicitud: null, motivo: "", evidencias: [] });

onMounted(async () => {
  try {
    const respuesta = await listarMias({ limit: 100 });
    solicitudes.value = respuesta.datos?.items || [];
  } catch (err) {
    notificarError(err);
  } finally {
    cargando.value = false;
  }
});

async function guardar() {
  const errores = validarReclamacion({
    solicitud: formulario.value.solicitud,
    motivo: formulario.value.motivo,
  });

  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  const erroresEvidencias = validarEvidencias(formulario.value.evidencias);
  if (formulario.value.evidencias.length > 0 && erroresEvidencias.length > 0) {
    notificarAdvertencia(erroresEvidencias[0]);
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await reclamacionesService.crear({
      solicitud: formulario.value.solicitud,
      motivo: formulario.value.motivo.trim(),
    });

    if (formulario.value.evidencias.length > 0) {
      try {
        await reclamacionesService.agregarEvidencias(
          respuesta.datos._id,
          formulario.value.evidencias
        );
      } catch (errEvidencias) {
        notificarError(errEvidencias);
      }
    }

    notificarOk("Reclamacion registrada.");
    router.push({ name: "mis-reclamaciones" });
  } catch (err) {
    notificarError(err);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Nueva reclamacion"
      subtitulo="Registra una reclamacion sobre un servicio del laboratorio"
      icono="report_problem"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'mis-reclamaciones' }"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" mensaje="Cargando tus solicitudes..." />

    <q-card v-else flat class="tarjeta q-pa-lg">
      <div class="section-box__title q-mb-md">Datos de la reclamacion</div>

      <q-form greedy @submit.prevent="guardar">
        <q-select
          v-model="formulario.solicitud"
          :options="solicitudes"
          option-value="_id"
          option-label="codigo_solicitud"
          emit-value
          map-options
          outlined
          label="Solicitud *"
          :rules="[seleccionRequerida('la solicitud')]"
          lazy-rules
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.codigo_solicitud }}</q-item-label>
                <q-item-label caption>{{ scope.opt.estado }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template #no-option>
            <q-item>
              <q-item-section class="text-grey">
                No tienes solicitudes registradas
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-input
          v-model="formulario.motivo"
          outlined
          type="textarea"
          label="Motivo de la reclamacion *"
          counter
          autogrow
          class="q-mt-md"
          :maxlength="LONGITUDES.reclamacion.motivo"
          :rules="[maximo(LONGITUDES.reclamacion.motivo, 'El motivo')]"
          lazy-rules
        />

        <div class="section-box__title q-mt-lg q-mb-md">Evidencias (opcional)</div>
        <EvidenciasUpload v-model="formulario.evidencias" />

        <div class="row justify-end q-gutter-sm q-mt-lg">
          <q-btn flat no-caps label="Cancelar" :to="{ name: 'mis-reclamaciones' }" />
          <q-btn
            unelevated
            no-caps
            type="submit"
            color="primary"
            icon="send"
            label="Registrar reclamacion"
            :loading="guardando"
          />
        </div>
      </q-form>
    </q-card>
  </q-page>
</template>
