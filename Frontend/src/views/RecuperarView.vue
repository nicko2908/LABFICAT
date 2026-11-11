<script setup>
import { ref } from "vue";

import AuthLayout from "@/layouts/AuthLayout.vue";
import { useNotificar } from "@/composables/useNotificar";
import { solicitarRecuperacion } from "@/services/auth.service";
import { LONGITUDES } from "@/utils/contrato";
import { esEmail, maximo, requerido } from "@/utils/reglas";

const { notificarOk, notificarError } = useNotificar();

const correo = ref("");
const cargando = ref(false);
const enviado = ref(false);

async function solicitar() {
  cargando.value = true;
  try {
    await solicitarRecuperacion(correo.value.trim().toLowerCase());
    enviado.value = true;
    notificarOk("Si el correo existe, se enviaron las instrucciones.");
  } catch (error) {
    notificarError(error);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h2 class="auth-titulo">Recuperar contrasena</h2>
    <p class="texto-suave q-mb-lg">
      Escribe el correo de tu cuenta y te enviaremos un token de recuperacion.
    </p>

    <q-banner v-if="enviado" dense class="bg-green-1 text-green-10 q-mb-lg rounded-borders">
      <template #avatar>
        <q-icon name="mark_email_read" />
      </template>
      Revisa tu correo. El token tiene vigencia limitada.
    </q-banner>

    <q-form greedy @submit.prevent="solicitar">
      <q-input
        v-model="correo"
        outlined
        type="email"
        label="Correo electronico *"
        autocomplete="email"
        :maxlength="LONGITUDES.usuario.correo"
        :rules="[requerido('El correo'), esEmail(), maximo(LONGITUDES.usuario.correo, 'El correo')]"
        lazy-rules
      >
        <template #prepend>
          <q-icon name="mail" />
        </template>
      </q-input>

      <q-btn
        unelevated
        no-caps
        type="submit"
        color="primary"
        class="full-width q-mt-lg"
        label="Enviar instrucciones"
        :loading="cargando"
      />
    </q-form>

    <div class="row justify-between q-mt-md">
      <q-btn flat dense no-caps color="primary" label="Volver al login" :to="{ name: 'login' }" />
      <q-btn flat dense no-caps color="primary" label="Ya tengo token" :to="{ name: 'restablecer' }" />
    </div>
  </AuthLayout>
</template>
