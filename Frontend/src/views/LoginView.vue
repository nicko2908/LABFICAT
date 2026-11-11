<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

import AuthLayout from "@/layouts/AuthLayout.vue";
import { useNotificar } from "@/composables/useNotificar";
import { login } from "@/services/auth.service";
import { useAuthStore } from "@/store/Auth";
import { LONGITUDES } from "@/utils/contrato";
import { esEmail, maximo, requerido } from "@/utils/reglas";

const router = useRouter();
const auth = useAuthStore();
const { notificarOk, notificarError } = useNotificar();

const formulario = ref({ correo: "", contrasena: "" });
const mostrarContrasena = ref(false);
const cargando = ref(false);
const esDesarrollo = import.meta.env.DEV;

async function entrar() {
  cargando.value = true;
  try {
    const respuesta = await login({
      correo: formulario.value.correo.trim().toLowerCase(),
      contrasena: formulario.value.contrasena,
    });
    auth.guardarSesion(respuesta.datos);
    notificarOk(`Bienvenido, ${auth.nombreUsuario}`);
    router.push({ name: "inicio" });
  } catch (error) {
    notificarError(error);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h2 class="auth-titulo">Iniciar sesion</h2>
    <p class="texto-suave q-mb-lg">
      Ingresa con el correo registrado en LABFICAT.
    </p>

    <q-form greedy @submit.prevent="entrar">
      <q-input
        v-model="formulario.correo"
        outlined
        label="Correo electronico *"
        type="email"
        autocomplete="email"
        autofocus
        :maxlength="LONGITUDES.usuario.correo"
        :rules="[requerido('El correo'), esEmail(), maximo(LONGITUDES.usuario.correo, 'El correo')]"
        lazy-rules
      >
        <template #prepend>
          <q-icon name="mail" />
        </template>
      </q-input>

      <q-input
        v-model="formulario.contrasena"
        outlined
        label="Contrasena *"
        class="q-mt-md"
        autocomplete="current-password"
        :type="mostrarContrasena ? 'text' : 'password'"
        :rules="[requerido('La contrasena')]"
        lazy-rules
      >
        <template #prepend>
          <q-icon name="lock" />
        </template>
        <template #append>
          <q-icon
            :name="mostrarContrasena ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="mostrarContrasena = !mostrarContrasena"
          />
        </template>
      </q-input>

      <div class="row items-center justify-between q-mt-sm">
        <q-btn flat dense no-caps color="primary" label="Olvide mi contrasena" :to="{ name: 'recuperar' }" />
        <q-btn flat dense no-caps color="primary" label="Crear cuenta" :to="{ name: 'registro' }" />
      </div>

      <q-btn
        unelevated
        no-caps
        type="submit"
        color="primary"
        class="full-width q-mt-lg"
        size="md"
        label="Entrar"
        :loading="cargando"
      />
    </q-form>

    <q-banner v-if="esDesarrollo" dense class="bg-green-1 text-green-10 q-mt-lg rounded-borders">
      <template #avatar>
        <q-icon name="info" />
      </template>
      <div class="text-caption">
        Usuario seed: <strong>coordinador@sena.edu.co</strong> / contrasena
        <strong>Labficat123*</strong>
      </div>
    </q-banner>
  </AuthLayout>
</template>
