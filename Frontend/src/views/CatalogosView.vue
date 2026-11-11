<script setup>
import { onMounted, reactive, ref } from "vue";

import EncabezadoPagina from "@/components/Encabezados/EncabezadoPagina.vue";
import LoadingBlock from "@/components/Common/LoadingBlock.vue";
import TablaDatos from "@/components/Tables/TablaDatos.vue";
import { useNotificar } from "@/composables/useNotificar";
import {
  actualizarAnalisis,
  actualizarConfiguracion,
  actualizarEtapa,
  actualizarParametro,
  actualizarTipoMuestra,
  actualizarTipologia,
  cambiarEstadoAnalisis,
  cambiarEstadoEtapa,
  cambiarEstadoParametro,
  cambiarEstadoTipoMuestra,
  cambiarEstadoTipologia,
  crearAnalisis,
  crearEtapa,
  crearParametro,
  crearTipoMuestra,
  crearTipologia,
  listarAnalisis,
  listarConfiguracion,
  listarEtapas,
  listarParametros,
  listarTipologias,
  listarTiposMuestra,
} from "@/services/catalogos.service";
import { LONGITUDES, textoONull } from "@/utils/contrato";
import { formatMoney } from "@/utils/formatMoney";

const { notificarOk, notificarError, notificarAdvertencia } = useNotificar();

const tab = ref("tipologias");
const cargando = ref(true);

const listas = reactive({
  tipologias: [],
  tipos: [],
  parametros: [],
  etapas: [],
  analisis: [],
  configuracion: [],
});

const dialogo = ref(false);
const tipo = ref("tipologia");
const editando = ref(null);
const guardando = ref(false);
const formulario = ref({});

const ESTADOS_FISICOS = ["SOLIDO", "LIQUIDO"];
const UNIDADES_CANTIDAD = ["ml", "gr"];

const columnasTipologias = [
  { name: "nombre", label: "Nombre", field: "nombre", align: "left", sortable: true },
  { name: "codigo", label: "Codigo", field: (f) => f.codigo || "-", align: "left" },
  {
    name: "interno",
    label: "Tipo",
    field: (f) => (f.es_interno ? "Interno" : "Externo"),
    align: "center",
  },
  { name: "activo", label: "Activa", field: "activo", align: "center" },
  { name: "acciones", label: "", align: "right" },
];

const columnasTipos = [
  { name: "nombre", label: "Nombre", field: "nombre", align: "left", sortable: true },
  { name: "estado", label: "Estado fisico", field: "estado_fisico", align: "center" },
  { name: "activo", label: "Activo", field: "activo", align: "center" },
  { name: "acciones", label: "", align: "right" },
];

const columnasParametros = [
  { name: "nombre", label: "Nombre", field: "nombre", align: "left", sortable: true },
  { name: "unidad", label: "Unidad", field: (f) => f.unidad_medida || "-", align: "left" },
  { name: "activo", label: "Activo", field: "activo", align: "center" },
  { name: "acciones", label: "", align: "right" },
];

const columnasEtapas = [
  { name: "orden", label: "Orden", field: "orden", align: "center", sortable: true },
  { name: "nombre", label: "Nombre", field: "nombre", align: "left" },
  { name: "activo", label: "Activa", field: "activo", align: "center" },
  { name: "acciones", label: "", align: "right" },
];

const columnasAnalisis = [
  { name: "codigo", label: "Codigo", field: (f) => f.codigo ?? "-", align: "center" },
  { name: "nombre", label: "Ensayo", field: "nombre", align: "left", sortable: true },
  { name: "unidades", label: "Unidades", field: (f) => f.unidades || "-", align: "left" },
  {
    name: "tarifa",
    label: "Tarifa externa",
    field: (f) => formatMoney(f.tarifa_externo),
    align: "right",
  },
  {
    name: "acreditado",
    label: "Acreditado",
    field: (f) => (f.acreditado ? "Si" : "No"),
    align: "center",
  },
  {
    name: "parametros",
    label: "Parametros",
    field: (f) => (f.parametros || []).length,
    align: "center",
  },
  {
    name: "tipos",
    label: "Tipos muestra",
    field: (f) => (f.tipos_muestra || []).length,
    align: "center",
  },
  { name: "activo", label: "Activo", field: "activo", align: "center" },
  { name: "acciones", label: "", align: "right" },
];

const columnasConfiguracion = [
  { name: "clave", label: "Clave", field: "clave", align: "left" },
  { name: "valor", label: "Valor", field: "valor", align: "left" },
  {
    name: "descripcion",
    label: "Descripcion",
    field: (f) => f.descripcion || "-",
    align: "left",
  },
  { name: "acciones", label: "", align: "right" },
];

function itemsDe(datos) {
  if (Array.isArray(datos)) return datos;
  return datos?.items || [];
}

onMounted(async () => {
  await Promise.allSettled([
    cargarTipologias(),
    cargarTipos(),
    cargarParametros(),
    cargarEtapas(),
    cargarAnalisis(),
    cargarConfiguracion(),
  ]);
  cargando.value = false;
});

async function cargarTipologias() {
  const respuesta = await listarTipologias({ page: 1, limit: 100 });
  listas.tipologias = itemsDe(respuesta.datos);
}

async function cargarTipos() {
  const respuesta = await listarTiposMuestra({});
  listas.tipos = itemsDe(respuesta.datos);
}

async function cargarParametros() {
  const respuesta = await listarParametros({});
  listas.parametros = itemsDe(respuesta.datos);
}

async function cargarEtapas() {
  const respuesta = await listarEtapas();
  listas.etapas = itemsDe(respuesta.datos).sort((a, b) => a.orden - b.orden);
}

async function cargarAnalisis() {
  const respuesta = await listarAnalisis({ limit: 100 });
  listas.analisis = itemsDe(respuesta.datos);
}

async function cargarConfiguracion() {
  const respuesta = await listarConfiguracion();
  listas.configuracion = itemsDe(respuesta.datos);
}

const ACCIONES_ESTADO = {
  tipologia: cambiarEstadoTipologia,
  tipo: cambiarEstadoTipoMuestra,
  parametro: cambiarEstadoParametro,
  etapa: cambiarEstadoEtapa,
  analisis: cambiarEstadoAnalisis,
};

const RECARGAS = {
  tipologia: cargarTipologias,
  tipo: cargarTipos,
  parametro: cargarParametros,
  etapa: cargarEtapas,
  analisis: cargarAnalisis,
};

async function cambiarActivo(clave, fila, activo) {
  try {
    await ACCIONES_ESTADO[clave](fila._id, activo);
    await RECARGAS[clave]();
    notificarOk("Estado actualizado.");
  } catch (err) {
    notificarError(err);
  }
}

function abrirNuevo(clave) {
  tipo.value = clave;
  editando.value = null;

  if (clave === "tipologia") formulario.value = { nombre: "", descripcion: "" };
  if (clave === "tipo") formulario.value = { nombre: "", estado_fisico: "SOLIDO" };
  if (clave === "parametro") formulario.value = { nombre: "", unidad_medida: "" };
  if (clave === "etapa") formulario.value = { nombre: "", orden: 1 };
  if (clave === "analisis") {
    formulario.value = {
      codigo: "",
      nombre: "",
      descripcion: "",
      unidades: "",
      metodo: "",
      tecnica: "",
      acreditado: false,
      tarifa_externo: 0,
      cantidad_minima: 0,
      unidad_cantidad: null,
      parametros: [],
      tipos_muestra: [],
    };
  }

  dialogo.value = true;
}

function abrirEditar(clave, fila) {
  tipo.value = clave;
  editando.value = fila._id;

  if (clave === "tipologia") {
    formulario.value = { nombre: fila.nombre, descripcion: fila.descripcion || "" };
  }
  if (clave === "tipo") {
    formulario.value = { nombre: fila.nombre, estado_fisico: fila.estado_fisico };
  }
  if (clave === "parametro") {
    formulario.value = { nombre: fila.nombre, unidad_medida: fila.unidad_medida || "" };
  }
  if (clave === "etapa") {
    formulario.value = { nombre: fila.nombre, orden: fila.orden };
  }
  if (clave === "analisis") {
    formulario.value = {
      codigo: fila.codigo ?? "",
      nombre: fila.nombre,
      descripcion: fila.descripcion || "",
      unidades: fila.unidades || "",
      metodo: fila.metodo || "",
      tecnica: fila.tecnica || "",
      acreditado: Boolean(fila.acreditado),
      tarifa_externo: Number(fila.tarifa_externo) || 0,
      cantidad_minima: Number(fila.cantidad_minima) || 0,
      unidad_cantidad: fila.unidad_cantidad || null,
      parametros: (fila.parametros || []).map((p) => p._id || p),
      tipos_muestra: (fila.tipos_muestra || []).map((t) => t._id || t),
    };
  }

  dialogo.value = true;
}

function abrirConfiguracion(fila) {
  tipo.value = "configuracion";
  editando.value = fila.clave;
  formulario.value = {
    clave: fila.clave,
    valor: fila.valor,
    descripcion: fila.descripcion || "",
  };
  dialogo.value = true;
}

function validarFormulario() {
  const errores = [];
  const f = formulario.value;

  if (tipo.value === "configuracion") {
    if (!String(f.valor ?? "").trim()) errores.push("El valor es obligatorio");
    if (String(f.valor ?? "").trim().length > LONGITUDES.configuracion.valor) {
      errores.push("El valor no puede superar los 200 caracteres");
    }
    if (String(f.descripcion ?? "").trim().length > LONGITUDES.configuracion.descripcion) {
      errores.push("La descripcion no puede superar los 200 caracteres");
    }
    return errores;
  }

  const nombre = String(f.nombre ?? "").trim();
  if (!nombre) errores.push("El nombre es obligatorio");
  if (nombre.length > 100) errores.push("El nombre no puede superar los 100 caracteres");

  if (tipo.value === "tipologia") {
    if (String(f.descripcion ?? "").trim().length > LONGITUDES.tipologia.descripcion) {
      errores.push("La descripcion no puede superar los 200 caracteres");
    }
  }

  if (tipo.value === "tipo" && !ESTADOS_FISICOS.includes(f.estado_fisico)) {
    errores.push("Selecciona el estado fisico");
  }

  if (tipo.value === "parametro") {
    if (String(f.unidad_medida ?? "").trim().length > LONGITUDES.parametro.unidad_medida) {
      errores.push("La unidad no puede superar los 100 caracteres");
    }
  }

  if (tipo.value === "etapa") {
    const orden = Number(f.orden);
    if (!Number.isInteger(orden) || orden < 1) {
      errores.push("El orden debe ser un entero mayor o igual a 1");
    }
  }

  if (tipo.value === "analisis") {
    const tarifa = Number(f.tarifa_externo);
    if (!Number.isFinite(tarifa) || tarifa < 0) {
      errores.push("La tarifa externa debe ser un numero mayor o igual a 0");
    }

    if (f.codigo !== "" && f.codigo !== null && f.codigo !== undefined) {
      const codigo = Number(f.codigo);
      if (!Number.isInteger(codigo) || codigo < 1) {
        errores.push("El codigo debe ser un entero mayor o igual a 1");
      }
    }

    const cantidadMinima = Number(f.cantidad_minima);
    if (!Number.isFinite(cantidadMinima) || cantidadMinima < 0) {
      errores.push("La cantidad minima debe ser un numero mayor o igual a 0");
    }

    if (
      f.unidad_cantidad !== null &&
      f.unidad_cantidad !== undefined &&
      !UNIDADES_CANTIDAD.includes(f.unidad_cantidad)
    ) {
      errores.push("La unidad de cantidad debe ser ml o gr");
    }

    if (String(f.descripcion ?? "").trim().length > LONGITUDES.analisis.descripcion) {
      errores.push("La descripcion no puede superar los 200 caracteres");
    }
    if (String(f.unidades ?? "").trim().length > LONGITUDES.analisis.unidades) {
      errores.push("Las unidades no pueden superar los 50 caracteres");
    }
    if (String(f.metodo ?? "").trim().length > LONGITUDES.analisis.metodo) {
      errores.push("El metodo no puede superar los 200 caracteres");
    }
    if (String(f.tecnica ?? "").trim().length > LONGITUDES.analisis.tecnica) {
      errores.push("La tecnica no puede superar los 200 caracteres");
    }
  }

  return errores;
}

function construirPayload() {
  const f = formulario.value;

  if (tipo.value === "configuracion") {
    return {
      valor: String(f.valor).trim(),
      descripcion: textoONull(f.descripcion),
    };
  }

  const base = { nombre: String(f.nombre).trim() };

  if (tipo.value === "tipologia") {
    base.descripcion = textoONull(f.descripcion);
  }
  if (tipo.value === "tipo") {
    base.estado_fisico = f.estado_fisico;
  }
  if (tipo.value === "parametro") {
    base.unidad_medida = textoONull(f.unidad_medida);
  }
  if (tipo.value === "etapa") {
    base.orden = Number(f.orden);
  }
  if (tipo.value === "analisis") {
    base.codigo = f.codigo === "" || f.codigo === null ? (editando.value ? null : undefined) : Number(f.codigo);
    base.descripcion = textoONull(f.descripcion);
    base.unidades = textoONull(f.unidades);
    base.metodo = textoONull(f.metodo);
    base.tecnica = textoONull(f.tecnica);
    base.acreditado = Boolean(f.acreditado);
    base.tarifa_externo = Number(f.tarifa_externo);
    base.cantidad_minima = Number(f.cantidad_minima);
    base.unidad_cantidad = f.unidad_cantidad || null;
    base.parametros = f.parametros || [];
    base.tipos_muestra = f.tipos_muestra || [];
  }

  return base;
}

async function guardar() {
  const errores = validarFormulario();
  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }

  const datos = construirPayload();
  guardando.value = true;

  try {
    if (tipo.value === "configuracion") {
      await actualizarConfiguracion(editando.value, datos);
      await cargarConfiguracion();
    } else if (tipo.value === "tipologia") {
      if (editando.value) await actualizarTipologia(editando.value, datos);
      else await crearTipologia(datos);
      await cargarTipologias();
    } else if (tipo.value === "tipo") {
      if (editando.value) await actualizarTipoMuestra(editando.value, datos);
      else await crearTipoMuestra(datos);
      await cargarTipos();
    } else if (tipo.value === "parametro") {
      if (editando.value) await actualizarParametro(editando.value, datos);
      else await crearParametro(datos);
      await cargarParametros();
    } else if (tipo.value === "etapa") {
      if (editando.value) await actualizarEtapa(editando.value, datos);
      else await crearEtapa(datos);
      await cargarEtapas();
    } else if (tipo.value === "analisis") {
      if (editando.value) await actualizarAnalisis(editando.value, datos);
      else await crearAnalisis(datos);
      await cargarAnalisis();
    }

    dialogo.value = false;
    notificarOk("Catalogo actualizado.");
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
      titulo="Catalogos y configuracion"
      subtitulo="Parametrizacion del laboratorio"
      icono="tune"
    />

    <LoadingBlock v-if="cargando" mensaje="Cargando catalogos..." />

    <template v-else>
      <q-tabs
        v-model="tab"
        dense
        align="left"
        class="text-primary q-mb-md"
        outside-arrows
        mobile-arrows
      >
        <q-tab name="tipologias" icon="category" label="Tipologias" />
        <q-tab name="tipos" icon="science" label="Tipos de muestra" />
        <q-tab name="parametros" icon="straighten" label="Parametros" />
        <q-tab name="etapas" icon="route" label="Etapas" />
        <q-tab name="analisis" icon="biotech" label="Analisis" />
        <q-tab name="configuracion" icon="settings" label="Configuracion" />
      </q-tabs>

      <q-tab-panels v-model="tab" animated>
        <q-tab-panel name="tipologias">
          <div class="row justify-end q-mb-md">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Nueva tipologia"
              @click="abrirNuevo('tipologia')"
            />
          </div>

          <TablaDatos
            :filas="listas.tipologias"
            :columnas="columnasTipologias"
            mensaje-vacio="No hay tipologias"
          >
            <template #body-cell-interno="{ value }">
              <q-td class="text-center">
                <q-badge :color="value === 'Interno' ? 'info' : 'primary'" :label="value" />
              </q-td>
            </template>
            <template #body-cell-activo="{ row }">
              <q-td class="text-center">
                <q-toggle
                  :model-value="row.activo !== false"
                  @update:model-value="(v) => cambiarActivo('tipologia', row, v)"
                />
              </q-td>
            </template>
            <template #body-cell-acciones="{ row }">
              <q-td class="text-right">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="edit"
                  label="Editar"
                  @click="abrirEditar('tipologia', row)"
                />
              </q-td>
            </template>
          </TablaDatos>
        </q-tab-panel>

        <q-tab-panel name="tipos">
          <div class="row justify-end q-mb-md">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Nuevo tipo de muestra"
              @click="abrirNuevo('tipo')"
            />
          </div>

          <TablaDatos
            :filas="listas.tipos"
            :columnas="columnasTipos"
            mensaje-vacio="No hay tipos de muestra"
          >
            <template #body-cell-activo="{ row }">
              <q-td class="text-center">
                <q-toggle
                  :model-value="row.activo !== false"
                  @update:model-value="(v) => cambiarActivo('tipo', row, v)"
                />
              </q-td>
            </template>
            <template #body-cell-acciones="{ row }">
              <q-td class="text-right">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="edit"
                  label="Editar"
                  @click="abrirEditar('tipo', row)"
                />
              </q-td>
            </template>
          </TablaDatos>
        </q-tab-panel>

        <q-tab-panel name="parametros">
          <div class="row justify-end q-mb-md">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Nuevo parametro"
              @click="abrirNuevo('parametro')"
            />
          </div>

          <TablaDatos
            :filas="listas.parametros"
            :columnas="columnasParametros"
            mensaje-vacio="No hay parametros"
          >
            <template #body-cell-activo="{ row }">
              <q-td class="text-center">
                <q-toggle
                  :model-value="row.activo !== false"
                  @update:model-value="(v) => cambiarActivo('parametro', row, v)"
                />
              </q-td>
            </template>
            <template #body-cell-acciones="{ row }">
              <q-td class="text-right">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="edit"
                  label="Editar"
                  @click="abrirEditar('parametro', row)"
                />
              </q-td>
            </template>
          </TablaDatos>
        </q-tab-panel>

        <q-tab-panel name="etapas">
          <div class="row justify-end q-mb-md">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Nueva etapa"
              @click="abrirNuevo('etapa')"
            />
          </div>

          <TablaDatos
            :filas="listas.etapas"
            :columnas="columnasEtapas"
            mensaje-vacio="No hay etapas"
          >
            <template #body-cell-activo="{ row }">
              <q-td class="text-center">
                <q-toggle
                  :model-value="row.activo !== false"
                  @update:model-value="(v) => cambiarActivo('etapa', row, v)"
                />
              </q-td>
            </template>
            <template #body-cell-acciones="{ row }">
              <q-td class="text-right">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="edit"
                  label="Editar"
                  @click="abrirEditar('etapa', row)"
                />
              </q-td>
            </template>
          </TablaDatos>
        </q-tab-panel>

        <q-tab-panel name="analisis">
          <div class="row justify-end q-mb-md">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Nuevo analisis"
              @click="abrirNuevo('analisis')"
            />
          </div>

          <TablaDatos
            :filas="listas.analisis"
            :columnas="columnasAnalisis"
            mensaje-vacio="No hay analisis"
          >
            <template #body-cell-codigo="{ value }">
              <q-td class="text-center">{{ value }}</q-td>
            </template>
            <template #body-cell-acreditado="{ value }">
              <q-td class="text-center">
                <q-badge :color="value === 'Si' ? 'positive' : 'grey-6'" :label="value" />
              </q-td>
            </template>
            <template #body-cell-activo="{ row }">
              <q-td class="text-center">
                <q-toggle
                  :model-value="row.activo !== false"
                  @update:model-value="(v) => cambiarActivo('analisis', row, v)"
                />
              </q-td>
            </template>
            <template #body-cell-acciones="{ row }">
              <q-td class="text-right">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="edit"
                  label="Editar"
                  @click="abrirEditar('analisis', row)"
                />
              </q-td>
            </template>
          </TablaDatos>
        </q-tab-panel>

        <q-tab-panel name="configuracion">
          <TablaDatos
            :filas="listas.configuracion"
            :columnas="columnasConfiguracion"
            mensaje-vacio="No hay configuracion"
          >
            <template #body-cell-acciones="{ row }">
              <q-td class="text-right">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="edit"
                  label="Editar"
                  @click="abrirConfiguracion(row)"
                />
              </q-td>
            </template>
          </TablaDatos>
        </q-tab-panel>
      </q-tab-panels>
    </template>

    <q-dialog v-model="dialogo" persistent>
      <q-card style="width: 760px; max-width: 96vw">
        <q-card-section>
          <div class="text-h6">
            {{
              editando
                ? "Editar"
                : "Nuevo"
            }}
            {{
              tipo === "tipologia"
                ? "tipologia"
                : tipo === "tipo"
                  ? "tipo de muestra"
                  : tipo === "parametro"
                    ? "parametro"
                    : tipo === "etapa"
                      ? "etapa"
                      : tipo === "analisis"
                        ? "analisis"
                        : "valor de configuracion"
            }}
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <template v-if="tipo === 'configuracion'">
            <div class="data-label">Clave</div>
            <div class="data-value">{{ formulario.clave }}</div>
            <q-input
              v-model="formulario.valor"
              outlined
              label="Valor *"
              counter
              :maxlength="LONGITUDES.configuracion.valor"
            />
            <q-input
              v-model="formulario.descripcion"
              outlined
              type="textarea"
              label="Descripcion"
              counter
              autogrow
              :maxlength="LONGITUDES.configuracion.descripcion"
            />
          </template>

          <template v-else>
            <q-input
              v-model="formulario.nombre"
              outlined
              label="Nombre *"
              :maxlength="100"
            />

            <template v-if="tipo === 'tipologia'">
              <q-input
                v-model="formulario.descripcion"
                outlined
                type="textarea"
                label="Descripcion"
                counter
                autogrow
                :maxlength="LONGITUDES.tipologia.descripcion"
              />
              <div class="text-caption texto-suave">
                El codigo es un identificador estable y no se edita por API.
              </div>
            </template>

            <template v-if="tipo === 'tipo'">
              <q-select
                v-model="formulario.estado_fisico"
                :options="ESTADOS_FISICOS"
                outlined
                label="Estado fisico *"
              />
            </template>

            <template v-if="tipo === 'parametro'">
              <q-input
                v-model="formulario.unidad_medida"
                outlined
                label="Unidad de medida"
                :maxlength="LONGITUDES.parametro.unidad_medida"
              />
            </template>

            <template v-if="tipo === 'etapa'">
              <q-input
                v-model.number="formulario.orden"
                type="number"
                outlined
                label="Orden *"
                min="1"
              />
            </template>

            <template v-if="tipo === 'analisis'">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-4">
                  <q-input
                    v-model.number="formulario.codigo"
                    type="number"
                    outlined
                    label="Codigo"
                    min="1"
                  />
                </div>
                <div class="col-12 col-md-8">
                  <q-input
                    v-model="formulario.unidades"
                    outlined
                    label="Unidades"
                    :maxlength="LONGITUDES.analisis.unidades"
                  />
                </div>
                <div class="col-12">
                  <q-input
                    v-model="formulario.descripcion"
                    outlined
                    type="textarea"
                    label="Descripcion"
                    counter
                    autogrow
                    :maxlength="LONGITUDES.analisis.descripcion"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <q-input
                    v-model="formulario.metodo"
                    outlined
                    label="Metodo"
                    :maxlength="LONGITUDES.analisis.metodo"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <q-input
                    v-model="formulario.tecnica"
                    outlined
                    label="Tecnica"
                    :maxlength="LONGITUDES.analisis.tecnica"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <q-input
                    v-model.number="formulario.tarifa_externo"
                    type="number"
                    outlined
                    label="Tarifa externa *"
                    min="0"
                    prefix="$"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <q-input
                    v-model.number="formulario.cantidad_minima"
                    type="number"
                    outlined
                    label="Cantidad minima"
                    min="0"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <q-select
                    v-model="formulario.unidad_cantidad"
                    :options="UNIDADES_CANTIDAD"
                    outlined
                    clearable
                    label="Unidad de cantidad"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <q-toggle
                    v-model="formulario.acreditado"
                    label="Acreditado"
                    color="primary"
                  />
                </div>
                <div class="col-12">
                  <q-select
                    v-model="formulario.parametros"
                    :options="listas.parametros"
                    option-value="_id"
                    option-label="nombre"
                    emit-value
                    map-options
                    multiple
                    use-chips
                    outlined
                    label="Parametros"
                  />
                </div>
                <div class="col-12">
                  <q-select
                    v-model="formulario.tipos_muestra"
                    :options="listas.tipos"
                    option-value="_id"
                    option-label="nombre"
                    emit-value
                    map-options
                    multiple
                    use-chips
                    outlined
                    label="Tipos de muestra"
                  />
                </div>
              </div>
            </template>
          </template>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Guardar"
            :loading="guardando"
            @click="guardar"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
