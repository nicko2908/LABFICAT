<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import { usePaginacion } from "@/composables/usePaginacion";
import { crear, listar } from "@/services/clientes.service";
import { useCatalogosStore } from "@/store/Catalogos";
import {
  CAMPOS_TEXTO,
  LONGITUDES,
  normalizarCampos,
  normalizarCorreo,
} from "@/utils/contrato";
import { TIPOS_DOCUMENTO } from "@/utils/estados";
import {
  documento,
  esEmail,
  maximo,
  requerido,
  seleccionRequerida,
  soloLetras,
  telefono,
} from "@/utils/reglas";
import { validarCliente } from "@/utils/validaciones";

const router = useRouter();
const catalogos = useCatalogosStore();
const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const { filas, cargando, paginacion, filtros, cargar, onRequest } = usePaginacion(
  listar,
  { filtros: { search: "", tipo_cliente: "", activo: undefined } }
);

const dialogo = ref(false);
const guardando = ref(false);
const formulario = ref(clienteInicial());

const columnas = [
  {
    name: "nombre",
    label: "Cliente",
    field: (fila) =>
      [fila.usuario?.nombres, fila.usuario?.apellidos].filter(Boolean).join(" ").trim() ||
      "-",
    align: "left",
  },
  {
    name: "documento",
    label: "Documento",
    field: (fila) => fila.usuario?.numero_documento || "-",
    align: "left",
  },
  {
    name: "correo",
    label: "Correo",
    field: (fila) => fila.usuario?.correo || "-",
    align: "left",
  },
  { name: "tipo", label: "Tipo", field: "tipo_cliente", align: "left" },
  {
    name: "tipologia",
    label: "Tipologia",
    field: (fila) => fila.tipologia?.nombre || "-",
    align: "left",
  },
  {
    name: "activo",
    label: "Estado",
    field: (fila) => (fila.usuario?.activo ? "Activo" : "Inactivo"),
    align: "center",
  },
  { name: "acciones", label: "", align: "right" },
];

const opcionesTipoCliente = ["INTERNO", "EXTERNO"];
const opcionesActivo = [
  { label: "Activos", value: true },
  { label: "Inactivos", value: false },
];

function clienteInicial() {
  return {
    nombres: "",
    apellidos: "",
    tipo_documento: "CC",
    numero_documento: "",
    correo: "",
    tipologia: null,
    telefono: "",
    razon_social: "",
    nit: "",
    direccion: "",
    ciudad: "",
    departamento: "",
    cargo: "",
    persona_contacto: "",
  };
}

onMounted(async () => {
  await cargar();
  try {
    await catalogos.cargarTipologias();
  } catch (err) {
    notificarError(err);
  }
});

function aplicarFiltros() {
  paginacion.page = 1;
  cargar().catch(notificarError);
}

function alCambiarActivo(valor) {
  filtros.activo = valor === null || valor === undefined ? undefined : valor;
  aplicarFiltros();
}

function ver(fila) {
  router.push({ name: "cliente-detalle", params: { id: fila._id } });
}

function abrirNuevo() {
  formulario.value = clienteInicial();
  dialogo.value = true;
}

async function guardar() {
  const datos = normalizarCampos(formulario.value, CAMPOS_TEXTO.cliente);
  datos.correo = normalizarCorreo(datos.correo);

  const errores = validarCliente(datos);
  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  guardando.value = true;
  try {
    const respuesta = await crear(datos);
    dialogo.value = false;
    notificarOk("Cliente creado. El cliente debera registrarse para obtener acceso.");
    router.push({ name: "cliente-detalle", params: { id: respuesta.datos._id } });
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
      titulo="Clientes"
      subtitulo="Clientes internos y externos del laboratorio"
      icono="groups"
    >
      <template #acciones>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="person_add"
          label="Nuevo cliente"
          @click="abrirNuevo"
        />
      </template>
    </EncabezadoPagina>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-4 col-md-3">
        <q-select
          v-model="filtros.tipo_cliente"
          :options="opcionesTipoCliente"
          outlined
          dense
          clearable
          label="Tipo de cliente"
          @update:model-value="aplicarFiltros"
        />
      </div>
      <div class="col-12 col-sm-4 col-md-3">
        <q-select
          v-model="filtros.activo"
          :options="opcionesActivo"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          outlined
          dense
          clearable
          label="Estado"
          @update:model-value="alCambiarActivo"
        />
      </div>
    </div>

    <TablaDatos
      :filas="filas"
      :columnas="columnas"
      :cargando="cargando"
      :paginacion="paginacion"
      servidor
      mensaje-vacio="No hay clientes registrados"
      @request="onRequest"
      @buscar="(texto) => { filtros.search = texto; aplicarFiltros(); }"
    >
      <template #body-cell-tipo="{ value }">
        <q-td>
          <q-badge :color="value === 'INTERNO' ? 'info' : 'primary'" :label="value || '-'" />
        </q-td>
      </template>

      <template #body-cell-activo="{ value }">
        <q-td class="text-center">
          <q-badge :color="value === 'Activo' ? 'positive' : 'grey-6'" :label="value" />
        </q-td>
      </template>

      <template #body-cell-acciones="{ row }">
        <q-td class="text-right">
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="visibility"
            label="Ver"
            @click="ver(row)"
          />
        </q-td>
      </template>
    </TablaDatos>

    <q-dialog v-model="dialogo" persistent>
      <q-card style="width: 820px; max-width: 96vw">
        <q-card-section>
          <div class="text-h6">Nuevo cliente</div>
          <div class="text-caption texto-suave">
            Se crea como prospecto sin contrasena; el cliente debera registrarse para acceder.
          </div>
        </q-card-section>

        <q-card-section>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.nombres"
                outlined
                label="Nombres *"
                :maxlength="LONGITUDES.usuario.nombres"
                :rules="[requerido('Los nombres'), maximo(LONGITUDES.usuario.nombres, 'Los nombres'), soloLetras('Los nombres')]"
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.apellidos"
                outlined
                label="Apellidos *"
                :maxlength="LONGITUDES.usuario.apellidos"
                :rules="[requerido('Los apellidos'), maximo(LONGITUDES.usuario.apellidos, 'Los apellidos'), soloLetras('Los apellidos')]"
              />
            </div>
            <div class="col-12 col-md-4">
              <q-select
                v-model="formulario.tipo_documento"
                :options="TIPOS_DOCUMENTO"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                outlined
                label="Tipo de documento *"
                :rules="[seleccionRequerida('el tipo de documento')]"
              />
            </div>
            <div class="col-12 col-md-4">
              <q-input
                v-model="formulario.numero_documento"
                outlined
                label="Numero de documento *"
                :maxlength="LONGITUDES.usuario.documentoMax"
                :rules="[requerido('El documento'), documento()]"
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
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="formulario.correo"
                outlined
                type="email"
                label="Correo electronico *"
                :maxlength="LONGITUDES.usuario.correo"
                :rules="[requerido('El correo'), esEmail(), maximo(LONGITUDES.usuario.correo, 'El correo')]"
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
                clearable
                label="Tipologia"
                hint="Si no se conoce, se asigna Persona natural"
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
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Crear cliente"
            :loading="guardando"
            @click="guardar"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
