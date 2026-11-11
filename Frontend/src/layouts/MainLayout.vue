<script setup>
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

import MarcaLogo from "@/components/Common/MarcaLogo.vue";
import { useNotificar } from "@/composables/useNotificar";
import { obtenerPerfil } from "@/services/auth.service";
import { useAuthStore } from "@/store/Auth";
import { useGeneralStore } from "@/store/General";
import { formatDateTime } from "@/utils/formatDate";
import { colorRol, etiquetaRol } from "@/utils/roles";

const auth = useAuthStore();
const general = useGeneralStore();
const route = useRoute();
const router = useRouter();
const { notificarInfo, notificarAdvertencia } = useNotificar();

const opcionesMenu = [
  { name: "inicio", titulo: "Inicio", icono: "space_dashboard", roles: ["cliente", "coordinador", "analista"] },
  { name: "mis-solicitudes", titulo: "Mis solicitudes", icono: "description", roles: ["cliente"] },
  { name: "mis-cotizaciones", titulo: "Mis cotizaciones", icono: "request_quote", roles: ["cliente"] },
  { name: "mis-cupones", titulo: "Mis cupones", icono: "confirmation_number", roles: ["cliente"] },
  { name: "mis-pagos", titulo: "Mis pagos", icono: "payments", roles: ["cliente"] },
  { name: "mis-muestras", titulo: "Mis muestras", icono: "science", roles: ["cliente"] },
  { name: "mis-informes", titulo: "Mis informes", icono: "summarize", roles: ["cliente"] },
  { name: "mis-encuestas", titulo: "Mis encuestas", icono: "poll", roles: ["cliente"] },
  { name: "mis-reclamaciones", titulo: "Mis reclamaciones", icono: "report_problem", roles: ["cliente"] },
  { name: "reportes", titulo: "Reportes", icono: "bar_chart", roles: ["coordinador"] },
  { name: "clientes", titulo: "Clientes", icono: "groups", roles: ["coordinador"] },
  { name: "catalogos", titulo: "Catalogos", icono: "tune", roles: ["coordinador"] },
  { name: "solicitudes", titulo: "Solicitudes", icono: "description", roles: ["coordinador"] },
  { name: "cotizaciones", titulo: "Cotizaciones", icono: "request_quote", roles: ["coordinador"] },
  { name: "cupones", titulo: "Cupones", icono: "confirmation_number", roles: ["coordinador"] },
  { name: "pagos", titulo: "Pagos", icono: "payments", roles: ["coordinador"] },
  { name: "muestras", titulo: "Muestras", icono: "science", roles: ["coordinador", "analista"] },
  { name: "ordenes", titulo: "Ordenes", icono: "biotech", roles: ["coordinador", "analista"] },
  { name: "informes", titulo: "Informes", icono: "summarize", roles: ["coordinador"] },
  { name: "encuestas", titulo: "Encuestas", icono: "poll", roles: ["coordinador"] },
  { name: "reclamaciones", titulo: "Reclamaciones", icono: "report_problem", roles: ["coordinador"] },
  { name: "auditoria", titulo: "Auditoria", icono: "history", roles: ["coordinador"] },
  { name: "perfil", titulo: "Mi perfil", icono: "account_circle", roles: ["cliente", "coordinador", "analista"] },
];

const menu = computed(() =>
  opcionesMenu.filter((opcion) => opcion.roles.includes(auth.rol))
);

const tituloSeccion = computed(() => route.meta?.titulo || "Panel");
const rolEtiqueta = computed(() => etiquetaRol(auth.rol));
const rolColor = computed(() => colorRol(auth.rol));

/**
 * Revalida el token guardado en localStorage al entrar al panel y refresca el
 * usuario/cliente. Si el token ya no es valido, el interceptor de axios cierra
 * la sesion y redirige al login.
 */
onMounted(async () => {
  if (!auth.estaAutenticado) return;

  try {
    const respuesta = await obtenerPerfil();
    auth.actualizarPerfil(respuesta.datos);
  } catch (error) {
    // 401/403 los maneja el interceptor de axios.
    if (error?.status !== 401 && error?.status !== 403) {
      notificarAdvertencia("No se pudo validar la sesion con el servidor");
    }
  }
});

function salir() {
  auth.cerrarSesion();
  notificarInfo("Sesion cerrada");
  router.push({ name: "login" });
}
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Abrir menu"
          @click="general.alternarMenu()"
        />

        <div class="barra-marca lt-md q-mr-sm">
          <MarcaLogo variante="icono" :alto="24" />
        </div>

        <q-toolbar-title class="text-weight-bold text-subtitle1">
          {{ tituloSeccion }}
        </q-toolbar-title>

        <q-chip
          dense
          square
          :color="rolColor"
          text-color="white"
          class="q-mr-sm gt-xs"
          :label="rolEtiqueta"
        />

        <div class="text-caption q-mr-sm gt-sm">
          {{ auth.nombreUsuario }}
        </div>

        <q-btn flat dense round icon="logout" aria-label="Cerrar sesion" @click="salir">
          <q-tooltip>Cerrar sesion</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="general.menuAbierto"
      show-if-above
      bordered
      :width="264"
      class="bg-white"
    >
      <div class="q-pa-md row items-center no-wrap">
        <MarcaLogo variante="icono" :alto="40" class="q-mr-sm" />
        <div>
          <div class="text-weight-bold leading-tight">{{ general.titulo }}</div>
          <div class="text-caption texto-suave">Gestion de laboratorio</div>
        </div>
      </div>

      <q-separator />

      <q-list padding>
        <q-item-label header class="text-uppercase text-caption text-weight-bold">
          Menu
        </q-item-label>

        <q-item
          v-for="opcion in menu"
          :key="opcion.name"
          v-ripple
          clickable
          class="enlace-menu"
          :to="{ name: opcion.name }"
        >
          <q-item-section avatar>
            <q-icon :name="opcion.icono" />
          </q-item-section>
          <q-item-section>{{ opcion.titulo }}</q-item-section>
        </q-item>
      </q-list>

      <div class="absolute-bottom q-pa-md text-caption texto-suave">
        <div class="row items-center no-wrap">
          <q-icon name="dns" size="14px" class="q-mr-xs" />
          <span class="ellipsis">{{ general.urlApi }}</span>
        </div>
        <div v-if="general.ultimaSincronizacion" class="q-mt-xs">
          <q-icon name="schedule" size="14px" class="q-mr-xs" />
          {{ formatDateTime(general.ultimaSincronizacion) }}
        </div>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.leading-tight {
  line-height: 1.2;
}

.enlace-menu {
  border-radius: 12px;
  margin: 2px 8px;
}

.enlace-menu.router-link-active {
  background: var(--color-accent-strong);
  color: #fff;
  font-weight: 600;
}
</style>
