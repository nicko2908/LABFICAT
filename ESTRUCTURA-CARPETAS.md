# Estructura de carpetas — Frontend LABFICAT

```text
Frontend/
├── .env
├── .env.example
├── .gitignore
├── index.html
├── jsconfig.json
├── package.json
├── vite.config.js
├── public/
│   ├── apple-touch-icon.png
│   └── favicon.png
└── src/
    ├── assets/
    │   ├── logo-completo.png
    │   └── logo-icono.png
    ├── components/
    │   ├── Encabezados/
    │   │   └── EncabezadoPagina.vue
    │   ├── Tables/
    │   │   └── TablaDatos.vue
    │   ├── Common/
    │   │   ├── EmptyState.vue
    │   │   ├── EstadoChip.vue
    │   │   ├── LoadingBlock.vue
    │   │   ├── MarcaLogo.vue
    │   │   └── StatCard.vue
    │   ├── Forms/
    │   │   └── CampoArchivo.vue
    │   └── Domain/
    │       ├── BotonDescarga.vue
    │       ├── CotizacionItems.vue
    │       ├── EncuestaSatisfaccion.vue
    │       ├── EvidenciasUpload.vue
    │       ├── FirmaDigital.vue
    │       ├── RecepcionMuestra.vue
    │       ├── ResultadosOrden.vue
    │       └── TimelineTrazabilidad.vue
    ├── composables/
    │   ├── useConfirmar.js
    │   ├── useDescargarArchivo.js
    │   ├── useFiltros.js
    │   ├── useNotificar.js
    │   └── usePaginacion.js
    ├── layouts/
    │   ├── AuthLayout.vue
    │   └── MainLayout.vue
    ├── plugins/
    │   ├── axios.js
    │   └── quasar.js
    ├── router/
    │   └── index.js
    ├── services/
    │   ├── api.service.js
    │   ├── auth.service.js
    │   ├── catalogos.service.js
    │   ├── clientes.service.js
    │   ├── solicitudes.service.js
    │   ├── cotizaciones.service.js
    │   ├── cupones.service.js
    │   ├── pagos.service.js
    │   ├── muestras.service.js
    │   ├── ordenes.service.js
    │   ├── informes.service.js
    │   ├── encuestas.service.js
    │   ├── reclamaciones.service.js
    │   ├── reportes.service.js
    │   ├── trazabilidad.service.js
    │   └── auditoria.service.js
    ├── store/
    │   ├── Auth.js
    │   ├── Catalogos.js
    │   └── General.js
    ├── styles/
    │   ├── main.scss
    │   └── variables.scss
    ├── utils/
    │   ├── descargas.js
    │   ├── errores.js
    │   ├── estados.js
    │   ├── formatDate.js
    │   ├── formatMoney.js
    │   ├── reglas.js
    │   ├── roles.js
    │   └── validateEmail.js
    ├── views/
    │   ├── AuditoriaView.vue
    │   ├── CatalogosView.vue
    │   ├── ClienteDetalleView.vue
    │   ├── ClientesView.vue
    │   ├── CotizacionDetalleView.vue
    │   ├── CotizacionesView.vue
    │   ├── CuponDetalleView.vue
    │   ├── CuponesView.vue
    │   ├── EnConstruccionView.vue
    │   ├── EncuestasView.vue
    │   ├── InformeDetalleView.vue
    │   ├── InformesView.vue
    │   ├── InicioView.vue
    │   ├── LoginView.vue
    │   ├── MiCotizacionView.vue
    │   ├── MiEncuestaView.vue
    │   ├── MiInformeView.vue
    │   ├── MiMuestraView.vue
    │   ├── MisCotizacionesView.vue
    │   ├── MisCuponesView.vue
    │   ├── MisEncuestasView.vue
    │   ├── MisInformesView.vue
    │   ├── MisMuestrasView.vue
    │   ├── MiSolicitudView.vue
    │   ├── MisPagosView.vue
    │   ├── MisReclamacionesView.vue
    │   ├── MisSolicitudesView.vue
    │   ├── MuestraDetalleView.vue
    │   ├── MuestrasView.vue
    │   ├── NotFoundView.vue
    │   ├── NuevaReclamacionView.vue
    │   ├── NuevaSolicitudView.vue
    │   ├── OrdenDetalleView.vue
    │   ├── OrdenesView.vue
    │   ├── PagoDetalleView.vue
    │   ├── PagosView.vue
    │   ├── PerfilView.vue
    │   ├── ReclamacionDetalleView.vue
    │   ├── ReclamacionesView.vue
    │   ├── RecuperarView.vue
    │   ├── RegistroView.vue
    │   ├── ReportesView.vue
    │   ├── RestablecerView.vue
    │   ├── SolicitudDetalleView.vue
    │   ├── SolicitudesView.vue
    │   └── TrazabilidadView.vue
    ├── App.vue
    └── main.js
```

Las rutas de los modulos de cliente, coordinador y analista ya estan declaradas en
`src/router/index.js` y usan `EnConstruccionView.vue` como marcador. La estructura,
los servicios, los guards, el layout y el sistema de diseno ya estan listos para
reemplazar esos marcadores por las vistas definitivas.
