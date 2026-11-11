<script setup>
import { computed, onMounted, ref } from "vue";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import { useNotificar } from "@/composables/useNotificar";
import { cambiarContrasena, obtenerPerfil } from "@/services/auth.service";
import { useAuthStore } from "@/store/Auth";
import { formatDate } from "@/utils/formatDate";
import { LIMITES } from "@/utils/contrato";
import { igualA, minimo, requerido } from "@/utils/reglas";
import { etiquetaRol } from "@/utils/roles";

const auth = useAuthStore();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const guardando = ref(false);
const perfil = ref({ usuario: null, cliente: null });
const formulario = ref({ actual: "", nueva: "", confirmacion: "" });

const rol = computed(() => {
  const valor = perfil.value.usuario?.rol;
  return valor?.nombre || valor || "-";
});

const tipoCliente = computed(() => perfil.value.cliente?.tipo_cliente || "-");

onMounted(cargar);

async function cargar() {
  cargando.value = true;
  try {
    const respuesta = await obtenerPerfil();
    perfil.value = respuesta.datos;
    auth.actualizarPerfil(respuesta.datos);
  } catch (error) {
    notificarError(error);
  } finally {
    cargando.value = false;
  }
}

async function actualizarContrasena() {
  guardando.value = true;
  try {
    await cambiarContrasena({
      actual: formulario.value.actual,
      nueva: formulario.value.nueva,
    });
    notificarOk("Contrasena actualizada correctamente");
    formulario.value = { actual: "", nueva: "", confirmacion: "" };
  } catch (error) {
    notificarError(error);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <q-page class="contenedor-app">
    <EncabezadoPagina
      titulo="Mi perfil"
      subtitulo="Datos de la cuenta y seguridad"
      icono="account_circle"
    />

    <LoadingBlock v-if="cargando" />

    <div v-else class="row q-col-gutter-lg">
      <div class="col-12 col-lg-7">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="badge" size="18px" class="q-mr-sm" />
            Datos de la cuenta
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="data-label">Nombres</div>
              <div class="data-value">{{ perfil.usuario?.nombres || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Apellidos</div>
              <div class="data-value">{{ perfil.usuario?.apellidos || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Correo</div>
              <div class="data-value">{{ perfil.usuario?.correo || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Documento</div>
              <div class="data-value">
                {{ perfil.usuario?.tipo_documento || "-" }}
                {{ perfil.usuario?.numero_documento || "" }}
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Rol</div>
              <div class="data-value">{{ etiquetaRol(rol) || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Ultimo acceso</div>
              <div class="data-value">{{ formatDate(perfil.usuario?.ultimoAcceso) }}</div>
            </div>
          </div>

          <template v-if="perfil.cliente">
            <q-separator />
            <div class="q-pa-md">
              <div class="text-subtitle2 text-weight-bold q-mb-sm">Perfil de cliente</div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-6">
                  <div class="data-label">Tipo de cliente</div>
                  <div class="data-value">{{ tipoCliente }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="data-label">Tipologia</div>
                  <div class="data-value">{{ perfil.cliente?.tipologia?.nombre || "-" }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="data-label">Telefono</div>
                  <div class="data-value">{{ perfil.cliente?.telefono || "-" }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <div class="data-label">Ciudad</div>
                  <div class="data-value">{{ perfil.cliente?.ciudad || "-" }}</div>
                </div>
                <div class="col-12">
                  <div class="data-label">Direccion</div>
                  <div class="data-value">{{ perfil.cliente?.direccion || "-" }}</div>
                </div>
              </div>
            </div>
          </template>
        </q-card>
      </div>

      <div class="col-12 col-lg-5">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="lock_reset" size="18px" class="q-mr-sm" />
            Cambiar contrasena
          </div>

          <q-form greedy class="q-pa-md" @submit.prevent="actualizarContrasena">
            <q-input
              v-model="formulario.actual"
              outlined
              type="password"
              label="Contrasena actual *"
              autocomplete="current-password"
              :rules="[requerido('La contrasena actual')]"
              lazy-rules
            />
            <q-input
              v-model="formulario.nueva"
              outlined
              type="password"
              label="Nueva contrasena *"
              autocomplete="new-password"
              class="q-mt-md"
              :rules="[requerido('La nueva contrasena'), minimo(LIMITES.contrasenaMinima, 'La nueva contrasena')]"
              lazy-rules
            />
            <q-input
              v-model="formulario.confirmacion"
              outlined
              type="password"
              label="Confirmar nueva contrasena *"
              autocomplete="new-password"
              class="q-mt-md"
              :rules="[requerido('La confirmacion'), igualA(() => formulario.nueva)]"
              lazy-rules
            />

            <q-btn
              unelevated
              no-caps
              type="submit"
              color="primary"
              class="full-width q-mt-lg"
              label="Actualizar contrasena"
              :loading="guardando"
            />
          </q-form>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
