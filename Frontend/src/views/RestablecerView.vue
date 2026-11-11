<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import AuthLayout from "@/layouts/AuthLayout.vue";
import { useNotificar } from "@/composables/useNotificar";
import { consumirRecuperacion } from "@/services/auth.service";
import { LIMITES } from "@/utils/contrato";
import { igualA, minimo, requerido } from "@/utils/reglas";

const route = useRoute();
const router = useRouter();
const { notificarOk, notificarError } = useNotificar();

const formulario = ref({
  token: String(route.query.token || ""),
  nueva: "",
  confirmacion: "",
});
const cargando = ref(false);

async function restablecer() {
  cargando.value = true;
  try {
    await consumirRecuperacion({
      token: formulario.value.token.trim(),
      nueva: formulario.value.nueva,
    });
    notificarOk("Contrasena restablecida. Ya puedes iniciar sesion.");
    router.push({ name: "login" });
  } catch (error) {
    notificarError(error);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h2 class="auth-titulo">Restablecer contrasena</h2>
    <p class="texto-suave q-mb-lg">
      Pega el token que recibiste por correo y define una nueva contrasena.
    </p>

    <q-form greedy @submit.prevent="restablecer">
      <q-input
        v-model="formulario.token"
        outlined
        label="Token de recuperacion *"
        :rules="[requerido('El token')]"
        lazy-rules
      >
        <template #prepend>
          <q-icon name="key" />
        </template>
      </q-input>

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
        label="Restablecer contrasena"
        :loading="cargando"
      />
    </q-form>

    <div class="text-center q-mt-md">
      <q-btn flat dense no-caps color="primary" label="Volver al login" :to="{ name: 'login' }" />
    </div>
  </AuthLayout>
</template>
