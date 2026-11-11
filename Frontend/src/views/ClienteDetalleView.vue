<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import EmptyState from "@/components/Common/EmptyState.vue";
import { useConfirmar } from "@/composables/useConfirmar";
import { useNotificar } from "@/composables/useNotificar";
import * as clientesService from "@/services/clientes.service";
import { useCatalogosStore } from "@/store/Catalogos";
import { LONGITUDES, textoONull } from "@/utils/contrato";
import { formatDate } from "@/utils/formatDate";
import { maximo, telefono } from "@/utils/reglas";

const route = useRoute();
const catalogos = useCatalogosStore();
const { confirmar } = useConfirmar();
const { notificarOk, notificarError } = useNotificar();

const cargando = ref(true);
const error = ref(false);
const guardando = ref(false);
const procesando = ref(false);
const cliente = ref(null);
const formulario = ref(formularioInicial());

const usuario = computed(() => cliente.value?.usuario || null);
const activo = computed(() => Boolean(usuario.value?.activo));

const nombre = computed(
  () =>
    [usuario.value?.nombres, usuario.value?.apellidos].filter(Boolean).join(" ").trim() ||
    "-"
);

function formularioInicial() {
  return {
    telefono: "",
    razon_social: "",
    nit: "",
    direccion: "",
    ciudad: "",
    departamento: "",
    cargo: "",
    persona_contacto: "",
    tipologia: null,
  };
}

onMounted(async () => {
  await cargar();
  try {
    await catalogos.cargarTipologias();
  } catch {
    // El formulario sigue mostrando el resto de campos.
  }
});

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    const respuesta = await clientesService.obtener(route.params.id);
    cliente.value = respuesta.datos;
    formulario.value = {
      telefono: respuesta.datos.telefono || "",
      razon_social: respuesta.datos.razon_social || "",
      nit: respuesta.datos.nit || "",
      direccion: respuesta.datos.direccion || "",
      ciudad: respuesta.datos.ciudad || "",
      departamento: respuesta.datos.departamento || "",
      cargo: respuesta.datos.cargo || "",
      persona_contacto: respuesta.datos.persona_contacto || "",
      tipologia: respuesta.datos.tipologia?._id || respuesta.datos.tipologia || null,
    };
  } catch (err) {
    error.value = true;
    notificarError(err);
  } finally {
    cargando.value = false;
  }
}

async function guardar() {
  guardando.value = true;
  try {
    await clientesService.actualizar(cliente.value._id, {
      telefono: textoONull(formulario.value.telefono),
      razon_social: textoONull(formulario.value.razon_social),
      nit: textoONull(formulario.value.nit),
      direccion: textoONull(formulario.value.direccion),
      ciudad: textoONull(formulario.value.ciudad),
      departamento: textoONull(formulario.value.departamento),
      cargo: textoONull(formulario.value.cargo),
      persona_contacto: textoONull(formulario.value.persona_contacto),
      tipologia: formulario.value.tipologia || undefined,
    });
    notificarOk("Datos del cliente actualizados.");
    await cargar();
  } catch (err) {
    notificarError(err);
  } finally {
    guardando.value = false;
  }
}

async function cambiarEstado() {
  const desactivar = activo.value;
  const confirmado = await confirmar({
    titulo: desactivar ? "Desactivar cliente" : "Reactivar cliente",
    mensaje: desactivar
      ? "El cliente no podra iniciar sesion mientras este inactivo."
      : "El cliente podra volver a iniciar sesion.",
    textoOk: desactivar ? "Desactivar" : "Reactivar",
    color: desactivar ? "negative" : "positive",
  });
  if (!confirmado) return;

  procesando.value = true;
  try {
    if (desactivar) await clientesService.desactivar(cliente.value._id);
    else await clientesService.reactivar(cliente.value._id);
    notificarOk(desactivar ? "Cliente desactivado." : "Cliente reactivado.");
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
      titulo="Detalle de cliente"
      :subtitulo="nombre"
      icono="person"
    >
      <template #acciones>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          :to="{ name: 'clientes' }"
          class="q-mr-sm"
        />
        <q-btn
          v-if="cliente"
          :outline="activo"
          :unelevated="!activo"
          no-caps
          :color="activo ? 'negative' : 'positive'"
          :icon="activo ? 'person_off' : 'person_add'"
          :label="activo ? 'Desactivar' : 'Reactivar'"
          :loading="procesando"
          @click="cambiarEstado"
        />
      </template>
    </EncabezadoPagina>

    <LoadingBlock v-if="cargando" />

    <EmptyState
      v-else-if="error || !cliente"
      titulo="No se pudo cargar el cliente"
      detalle="Verifica que el cliente exista."
      icono="error_outline"
    >
      <template #acciones>
        <q-btn flat no-caps color="primary" label="Reintentar" @click="cargar" />
      </template>
    </EmptyState>

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
              <div class="data-value">{{ usuario?.nombres || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Apellidos</div>
              <div class="data-value">{{ usuario?.apellidos || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Documento</div>
              <div class="data-value">
                {{ usuario?.tipo_documento || "-" }} {{ usuario?.numero_documento || "" }}
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Correo</div>
              <div class="data-value">{{ usuario?.correo || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Estado</div>
              <q-badge :color="activo ? 'positive' : 'grey-6'" :label="activo ? 'Activo' : 'Inactivo'" />
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Tipo de cliente</div>
              <div class="data-value">{{ cliente.tipo_cliente || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Tipologia</div>
              <div class="data-value">{{ cliente.tipologia?.nombre || "-" }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="data-label">Registrado</div>
              <div class="data-value">{{ formatDate(cliente.createdAt) }}</div>
            </div>
          </div>
        </q-card>

        <q-card flat class="tarjeta q-mt-lg">
          <div class="section-box__title">
            <q-icon name="edit" size="18px" class="q-mr-sm" />
            Datos editables del cliente
          </div>

          <div class="q-pa-md row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.telefono"
                outlined
                label="Telefono"
                mask="##########"
                :rules="[telefono()]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="formulario.tipologia"
                :options="catalogos.tipologiasActivas"
                option-value="_id"
                option-label="nombre"
                emit-value
                map-options
                outlined
                label="Tipologia"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.razon_social"
                outlined
                label="Razon social"
                :maxlength="LONGITUDES.cliente.razon_social"
                :rules="[maximo(LONGITUDES.cliente.razon_social, 'La razon social')]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.nit"
                outlined
                label="NIT"
                :maxlength="LONGITUDES.cliente.nit"
                :rules="[maximo(LONGITUDES.cliente.nit, 'El NIT')]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.direccion"
                outlined
                label="Direccion"
                :maxlength="LONGITUDES.cliente.direccion"
                :rules="[maximo(LONGITUDES.cliente.direccion, 'La direccion')]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.ciudad"
                outlined
                label="Ciudad"
                :maxlength="LONGITUDES.cliente.ciudad"
                :rules="[maximo(LONGITUDES.cliente.ciudad, 'La ciudad')]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.departamento"
                outlined
                label="Departamento"
                :maxlength="LONGITUDES.cliente.departamento"
                :rules="[maximo(LONGITUDES.cliente.departamento, 'El departamento')]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.cargo"
                outlined
                label="Cargo"
                :maxlength="LONGITUDES.cliente.cargo"
                :rules="[maximo(LONGITUDES.cliente.cargo, 'El cargo')]"
              />
            </div>
            <div class="col-12">
              <q-input
                v-model="formulario.persona_contacto"
                outlined
                label="Persona de contacto"
                :maxlength="LONGITUDES.cliente.persona_contacto"
                :rules="[maximo(LONGITUDES.cliente.persona_contacto, 'La persona de contacto')]"
              />
            </div>
          </div>

          <div class="row justify-end q-pa-md">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="save"
              label="Guardar cambios"
              :loading="guardando"
              @click="guardar"
            />
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-5">
        <q-card flat class="tarjeta">
          <div class="section-box__title">
            <q-icon name="info" size="18px" class="q-mr-sm" />
            Notas
          </div>
          <div class="q-pa-md text-body2 texto-suave">
            Los datos de identidad (nombres, documento y correo) no se editan desde
            esta pantalla. El cliente creado como prospecto no tiene contrasena
            hasta que se registre o restablezca su acceso.
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
