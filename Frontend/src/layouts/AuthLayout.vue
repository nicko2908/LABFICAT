<script setup>
import MarcaLogo from "@/components/Common/MarcaLogo.vue";
import { useGeneralStore } from "@/store/General";

const general = useGeneralStore();
</script>

<template>
  <div class="auth-page">
    <aside class="auth-marca">
      <div class="auth-marca__contenido">
        <MarcaLogo variante="icono" :alto="64" class="q-mb-lg" />
        <p class="eyebrow auth-marca__eyebrow">Gestion de laboratorio</p>
        <h1 class="auth-marca__titulo">{{ general.titulo }}</h1>
        <p class="auth-marca__texto">
          Solicita analisis, sigue tus muestras y descarga tus informes desde un
          solo lugar.
        </p>
        <div class="auth-marca__puntos">
          <div class="row items-center no-wrap">
            <q-icon name="check_circle" size="18px" class="q-mr-xs" />
            <span>Solicitudes y cotizaciones en linea</span>
          </div>
          <div class="row items-center no-wrap">
            <q-icon name="check_circle" size="18px" class="q-mr-xs" />
            <span>Seguimiento por etapas</span>
          </div>
          <div class="row items-center no-wrap">
            <q-icon name="check_circle" size="18px" class="q-mr-xs" />
            <span>Informes y encuestas de satisfaccion</span>
          </div>
        </div>
      </div>
    </aside>

    <main class="auth-formulario">
      <div class="auth-formulario__caja">
        <div class="auth-formulario__marca q-mb-lg">
          <MarcaLogo variante="completo" :alto="96" />
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>
