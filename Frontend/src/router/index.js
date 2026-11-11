import { createRouter, createWebHashHistory } from "vue-router";
import { Notify } from "quasar";

import { useAuthStore } from "@/store/Auth";

import MainLayout from "@/layouts/MainLayout.vue";

import LoginView from "@/views/LoginView.vue";
import RegistroView from "@/views/RegistroView.vue";
import RecuperarView from "@/views/RecuperarView.vue";
import RestablecerView from "@/views/RestablecerView.vue";
import InicioView from "@/views/InicioView.vue";
import PerfilView from "@/views/PerfilView.vue";
import EnConstruccionView from "@/views/EnConstruccionView.vue";
import NotFoundView from "@/views/NotFoundView.vue";

const TODOS = ["cliente", "coordinador", "analista"];
const CLIENTE = ["cliente"];
const COORDINADOR = ["coordinador"];
const LABORATORIO = ["coordinador", "analista"];

const vistasPendientes = {
  "mis-solicitudes-nueva": () => import("@/views/NuevaSolicitudView.vue"),
  "mi-solicitud": () => import("@/views/MiSolicitudView.vue"),
  "mis-solicitudes": () => import("@/views/MisSolicitudesView.vue"),
  "mi-cotizacion": () => import("@/views/MiCotizacionView.vue"),
  "mis-cotizaciones": () => import("@/views/MisCotizacionesView.vue"),
  "mis-cupones": () => import("@/views/MisCuponesView.vue"),
  "mis-pagos": () => import("@/views/MisPagosView.vue"),
  trazabilidad: () => import("@/views/TrazabilidadView.vue"),
  "mi-muestra": () => import("@/views/MiMuestraView.vue"),
  "mis-muestras": () => import("@/views/MisMuestrasView.vue"),
  "mi-informe": () => import("@/views/MiInformeView.vue"),
  "mis-informes": () => import("@/views/MisInformesView.vue"),
  "mi-encuesta": () => import("@/views/MiEncuestaView.vue"),
  "mis-encuestas": () => import("@/views/MisEncuestasView.vue"),
  "nueva-reclamacion": () => import("@/views/NuevaReclamacionView.vue"),
  "mis-reclamaciones": () => import("@/views/MisReclamacionesView.vue"),
  "cliente-detalle": () => import("@/views/ClienteDetalleView.vue"),
  clientes: () => import("@/views/ClientesView.vue"),
  catalogos: () => import("@/views/CatalogosView.vue"),
  "solicitud-detalle": () => import("@/views/SolicitudDetalleView.vue"),
  solicitudes: () => import("@/views/SolicitudesView.vue"),
  "cotizacion-detalle": () => import("@/views/CotizacionDetalleView.vue"),
  cotizaciones: () => import("@/views/CotizacionesView.vue"),
  "cupon-detalle": () => import("@/views/CuponDetalleView.vue"),
  cupones: () => import("@/views/CuponesView.vue"),
  "pago-detalle": () => import("@/views/PagoDetalleView.vue"),
  pagos: () => import("@/views/PagosView.vue"),
  "muestra-detalle": () => import("@/views/MuestraDetalleView.vue"),
  muestras: () => import("@/views/MuestrasView.vue"),
  "orden-detalle": () => import("@/views/OrdenDetalleView.vue"),
  ordenes: () => import("@/views/OrdenesView.vue"),
  "informe-detalle": () => import("@/views/InformeDetalleView.vue"),
  informes: () => import("@/views/InformesView.vue"),
  encuestas: () => import("@/views/EncuestasView.vue"),
  "reclamacion-detalle": () => import("@/views/ReclamacionDetalleView.vue"),
  reclamaciones: () => import("@/views/ReclamacionesView.vue"),
  reportes: () => import("@/views/ReportesView.vue"),
  auditoria: () => import("@/views/AuditoriaView.vue"),
};

function vistaPendiente(path, name, titulo, roles, descripcion = "") {
  return {
    path: path.replace(/^\//, ""),
    name,
    component: vistasPendientes[name] || EnConstruccionView,
    meta: {
      titulo,
      roles,
      requiereAuth: true,
      descripcion,
    },
  };
}

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginView,
    meta: { titulo: "Iniciar sesion", soloInvitados: true },
  },
  {
    path: "/registro",
    name: "registro",
    component: RegistroView,
    meta: { titulo: "Registro de cliente", soloInvitados: true },
  },
  {
    path: "/recuperar",
    name: "recuperar",
    component: RecuperarView,
    meta: { titulo: "Recuperar contrasena", soloInvitados: true },
  },
  {
    path: "/restablecer",
    name: "restablecer",
    component: RestablecerView,
    meta: { titulo: "Restablecer contrasena", soloInvitados: true },
  },
  {
    path: "/",
    component: MainLayout,
    children: [
      { path: "", redirect: { name: "inicio" } },
      {
        path: "inicio",
        name: "inicio",
        component: InicioView,
        meta: { titulo: "Inicio", requiereAuth: true, roles: TODOS },
      },
      {
        path: "perfil",
        name: "perfil",
        component: PerfilView,
        meta: { titulo: "Mi perfil", requiereAuth: true, roles: TODOS },
      },

      // --- Portal del cliente ------------------------------------------------
      vistaPendiente("mis-solicitudes/nueva", "mis-solicitudes-nueva", "Nueva solicitud", CLIENTE),
      vistaPendiente("mis-solicitudes/:id", "mi-solicitud", "Detalle de solicitud", CLIENTE),
      vistaPendiente("mis-solicitudes", "mis-solicitudes", "Mis solicitudes", CLIENTE),
      vistaPendiente("mis-cotizaciones/:id", "mi-cotizacion", "Detalle de cotizacion", CLIENTE),
      vistaPendiente("mis-cotizaciones", "mis-cotizaciones", "Mis cotizaciones", CLIENTE),
      vistaPendiente("mis-cupones", "mis-cupones", "Mis cupones", CLIENTE),
      vistaPendiente("mis-pagos", "mis-pagos", "Mis pagos", CLIENTE),
      vistaPendiente("mis-muestras/:id/trazabilidad", "trazabilidad", "Trazabilidad de muestra", CLIENTE),
      vistaPendiente("mis-muestras/:id", "mi-muestra", "Detalle de muestra", CLIENTE),
      vistaPendiente("mis-muestras", "mis-muestras", "Mis muestras", CLIENTE),
      vistaPendiente("mis-informes/:id", "mi-informe", "Detalle de informe", CLIENTE),
      vistaPendiente("mis-informes", "mis-informes", "Mis informes", CLIENTE),
      vistaPendiente("mis-encuestas/:id", "mi-encuesta", "Encuesta de satisfaccion", CLIENTE),
      vistaPendiente("mis-encuestas", "mis-encuestas", "Mis encuestas", CLIENTE),
      vistaPendiente("mis-reclamaciones/nueva", "nueva-reclamacion", "Nueva reclamacion", CLIENTE),
      vistaPendiente("mis-reclamaciones", "mis-reclamaciones", "Mis reclamaciones", CLIENTE),

      // --- Operacion del coordinador ----------------------------------------
      vistaPendiente("clientes/:id", "cliente-detalle", "Detalle de cliente", COORDINADOR),
      vistaPendiente("clientes", "clientes", "Clientes", COORDINADOR),
      vistaPendiente("catalogos", "catalogos", "Catalogos", COORDINADOR),
      vistaPendiente("solicitudes/:id", "solicitud-detalle", "Detalle de solicitud", COORDINADOR),
      vistaPendiente("solicitudes", "solicitudes", "Solicitudes", COORDINADOR),
      vistaPendiente("cotizaciones/:id", "cotizacion-detalle", "Detalle de cotizacion", COORDINADOR),
      vistaPendiente("cotizaciones", "cotizaciones", "Cotizaciones", COORDINADOR),
      vistaPendiente("cupones/:id", "cupon-detalle", "Detalle de cupon", COORDINADOR),
      vistaPendiente("cupones", "cupones", "Cupones", COORDINADOR),
      vistaPendiente("pagos/:id", "pago-detalle", "Detalle de pago", COORDINADOR),
      vistaPendiente("pagos", "pagos", "Pagos", COORDINADOR),

      // --- Laboratorio -------------------------------------------------------
      vistaPendiente("muestras/:id", "muestra-detalle", "Detalle de muestra", LABORATORIO),
      vistaPendiente("muestras", "muestras", "Muestras", LABORATORIO),
      vistaPendiente("ordenes/:id", "orden-detalle", "Detalle de orden", LABORATORIO),
      vistaPendiente("ordenes", "ordenes", "Ordenes de analisis", LABORATORIO),
      vistaPendiente("informes/:id", "informe-detalle", "Detalle de informe", COORDINADOR),
      vistaPendiente("informes", "informes", "Informes", COORDINADOR),
      vistaPendiente("encuestas", "encuestas", "Encuestas", COORDINADOR),
      vistaPendiente("reclamaciones/:id", "reclamacion-detalle", "Detalle de reclamacion", COORDINADOR),
      vistaPendiente("reclamaciones", "reclamaciones", "Reclamaciones", COORDINADOR),
      vistaPendiente("reportes", "reportes", "Reportes", COORDINADOR),
      vistaPendiente("auditoria", "auditoria", "Auditoria", COORDINADOR),

      {
        path: ":pathMatch(.*)*",
        name: "no-encontrado",
        component: NotFoundView,
        meta: { titulo: "Pagina no encontrada" },
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ left: 0, top: 0 }),
});

function protegerRutas(to) {
  const auth = useAuthStore();

  if (to.meta.requiereAuth === true && !auth.estaAutenticado) {
    Notify.create({
      type: "negative",
      message: "Debes iniciar sesion para entrar a esa pagina",
      icon: "lock",
      position: "top-right",
    });
    return { name: "login" };
  }

  if (to.meta.soloInvitados === true && auth.estaAutenticado) {
    return { name: "inicio" };
  }

  if (Array.isArray(to.meta.roles) && !to.meta.roles.includes(auth.rol)) {
    Notify.create({
      type: "warning",
      message: "No tienes permisos para acceder a esa seccion",
      icon: "block",
      position: "top-right",
    });
    return { name: "inicio" };
  }

  return true;
}

router.beforeEach(protegerRutas);

router.afterEach((to) => {
  const base = import.meta.env.VITE_APP_TITULO || "LABFICAT";
  document.title = to.meta.titulo ? `${to.meta.titulo} | ${base}` : base;
});
