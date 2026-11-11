<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import MarcaLogo from "@/components/Common/MarcaLogo.vue";
import { useNotificar } from "@/composables/useNotificar";
import { registrar } from "@/services/auth.service";
import { useAuthStore } from "@/store/Auth";
import { useCatalogosStore } from "@/store/Catalogos";
import {
  CAMPOS_TEXTO,
  LIMITES,
  LONGITUDES,
  normalizarCampos,
  normalizarCorreo,
} from "@/utils/contrato";
import { TIPOS_DOCUMENTO } from "@/utils/estados";
import {
  documento,
  esEmail,
  igualA,
  maximo,
  minimo,
  requerido,
  seleccionRequerida,
  soloLetras,
  telefono,
} from "@/utils/reglas";

const router = useRouter();
const auth = useAuthStore();
const catalogos = useCatalogosStore();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const formulario = ref({
  nombres: "",
  apellidos: "",
  tipo_documento: "CC",
  numero_documento: "",
  correo: "",
  contrasena: "",
  confirmacion: "",
  tipologia: null,
  telefono: "",
  razon_social: "",
  nit: "",
  direccion: "",
  ciudad: "",
  departamento: "",
  cargo: "",
  persona_contacto: "",
  acepta_tratamiento_datos: false,
});

const cargando = ref(false);
const formularioRef = ref(null);

onMounted(async () => {
  try {
    await catalogos.cargarTipologias();
  } catch (error) {
    notificarError(error);
  }
});

async function crearCuenta() {
  if (!formulario.value.acepta_tratamiento_datos) {
    notificarAdvertencia("Debes aceptar el tratamiento de datos (Ley 1581)");
    return;
  }

  cargando.value = true;
  try {
    const { confirmacion, ...resto } = formulario.value;
    const datos = normalizarCampos(resto, CAMPOS_TEXTO.registro);
    datos.correo = normalizarCorreo(datos.correo);
    const respuesta = await registrar(datos);

    auth.guardarSesion(respuesta.datos);
    notificarOk("Registro exitoso. Bienvenido a LABFICAT.");
    router.push({ name: "inicio" });
  } catch (error) {
    notificarError(error);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="registro-page">
    <div class="registro-caja">
      <div class="marca-encabezado q-mb-md">
        <MarcaLogo variante="icono" :alto="40" />
        <div class="marca-encabezado__texto">
          <div class="marca-encabezado__nombre">LABFICAT</div>
          <div class="marca-encabezado__detalle">Gestion de laboratorio</div>
        </div>
      </div>

      <div class="row items-center no-wrap q-mb-lg">
        <q-btn flat round dense icon="arrow_back" :to="{ name: 'login' }" class="q-mr-sm" />
        <div>
          <h1 class="auth-titulo">Crear cuenta de cliente</h1>
          <p class="texto-suave q-mb-none">
            Registra tus datos para solicitar analisis al laboratorio.
          </p>
        </div>
      </div>

      <q-card flat class="tarjeta q-pa-lg">
        <q-form ref="formularioRef" greedy @submit.prevent="crearCuenta">
          <div class="section-box__title q-mb-md">Datos de la persona</div>

          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.nombres"
                outlined
                label="Nombres *"
                :maxlength="LONGITUDES.usuario.nombres"
                :rules="[requerido('Los nombres'), minimo(2, 'Los nombres'), maximo(LONGITUDES.usuario.nombres, 'Los nombres'), soloLetras('Los nombres')]"
                lazy-rules
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.apellidos"
                outlined
                label="Apellidos *"
                :maxlength="LONGITUDES.usuario.apellidos"
                :rules="[requerido('Los apellidos'), minimo(2, 'Los apellidos'), maximo(LONGITUDES.usuario.apellidos, 'Los apellidos'), soloLetras('Los apellidos')]"
                lazy-rules
              />
            </div>
            <div class="col-12 col-md-4">
              <q-select
                v-model="formulario.tipo_documento"
                :options="TIPOS_DOCUMENTO"
                outlined
                label="Tipo de documento *"
                emit-value
                map-options
                :rules="[seleccionRequerida('el tipo de documento')]"
                lazy-rules
              />
            </div>
            <div class="col-12 col-md-4">
              <q-input
                v-model="formulario.numero_documento"
                outlined
                label="Numero de documento *"
                :maxlength="LONGITUDES.usuario.documentoMax"
                :rules="[requerido('El documento'), documento()]"
                lazy-rules
              />
            </div>
            <div class="col-12 col-md-4">
              <q-input
                v-model="formulario.telefono"
                outlined
                label="Telefono"
                mask="##########"
                hint="10 digitos"
                :rules="[telefono()]"
                lazy-rules
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.correo"
                outlined
                type="email"
                label="Correo electronico *"
                autocomplete="email"
                :maxlength="LONGITUDES.usuario.correo"
                :rules="[requerido('El correo'), esEmail(), maximo(LONGITUDES.usuario.correo, 'El correo')]"
                lazy-rules
              />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="formulario.tipologia"
                :options="catalogos.tipologiasActivas"
                outlined
                label="Tipologia *"
                option-value="_id"
                option-label="nombre"
                emit-value
                map-options
                :rules="[seleccionRequerida('la tipologia')]"
                lazy-rules
              >
                <template #hint>
                  Las tipologias internas liquidan al 0 %.
                </template>
              </q-select>
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.razon_social"
                outlined
                label="Razon social (opcional)"
                :maxlength="LONGITUDES.cliente.razon_social"
                :rules="[maximo(LONGITUDES.cliente.razon_social, 'La razon social')]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.nit"
                outlined
                label="NIT (opcional)"
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
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.persona_contacto"
                outlined
                label="Persona de contacto"
                :maxlength="LONGITUDES.cliente.persona_contacto"
                :rules="[maximo(LONGITUDES.cliente.persona_contacto, 'La persona de contacto')]"
              />
            </div>
          </div>

          <div class="section-box__title q-mt-lg q-mb-md">Seguridad</div>

          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.contrasena"
                outlined
                type="password"
                label="Contrasena *"
                autocomplete="new-password"
                :rules="[requerido('La contrasena'), minimo(LIMITES.contrasenaMinima, 'La contrasena')]"
                lazy-rules
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.confirmacion"
                outlined
                type="password"
                label="Confirmar contrasena *"
                autocomplete="new-password"
                :rules="[requerido('La confirmacion'), igualA(() => formulario.contrasena)]"
                lazy-rules
              />
            </div>
          </div>

          <q-checkbox
            v-model="formulario.acepta_tratamiento_datos"
            color="primary"
            class="q-mt-lg"
            label="Acepto el tratamiento de mis datos personales (Ley 1581)"
          />

          <div class="row justify-end q-gutter-sm q-mt-lg">
            <q-btn flat no-caps label="Cancelar" :to="{ name: 'login' }" />
            <q-btn
              unelevated
              no-caps
              type="submit"
              color="primary"
              label="Crear cuenta"
              :loading="cargando"
            />
          </div>
        </q-form>
      </q-card>
    </div>
  </div>
</template>
