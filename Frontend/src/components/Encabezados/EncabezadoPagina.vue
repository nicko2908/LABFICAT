<script setup>
defineProps({
  titulo: { type: String, required: true },
  subtitulo: { type: String, default: "" },
  icono: { type: String, default: "" },
});
</script>

<template>
  <header class="encabezado-pagina">
    <div class="row items-center justify-between q-col-gutter-md">
      <div class="col-12 col-sm">
        <div class="row items-center no-wrap">
          <q-avatar
            v-if="icono"
            square
            size="44px"
            color="primary"
            text-color="white"
            class="q-mr-md encabezado-pagina__icono"
          >
            <q-icon :name="icono" size="24px" />
          </q-avatar>

          <div>
            <h1 class="titulo-vista">{{ titulo }}</h1>
            <p v-if="subtitulo" class="encabezado-pagina__subtitulo">
              {{ subtitulo }}
            </p>
          </div>
        </div>
      </div>

      <div class="col-12 col-sm-auto">
        <slot name="acciones" />
      </div>
    </div>

    <hr class="linea-titulo" />
  </header>
</template>

<style scoped lang="scss">
.encabezado-pagina {
  margin-bottom: 24px;

  &__icono {
    border-radius: 10px;
  }

  &__subtitulo {
    font-size: 14px;
    color: #616161;
    margin: 4px 0 0;
  }
}
</style>
