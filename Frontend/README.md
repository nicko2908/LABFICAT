# LABFICAT — Frontend

Aplicación Vue 3 + Quasar + Vue Router + Pinia para consumir la API de LABFICAT.

## Puesta en marcha

```bash
# 1. Backend (otra terminal)
cd ../Backend
npm install
npm run seed
npm run dev          # http://localhost:3000/api/v1

# 2. Frontend
cd ../Frontend
npm install
npm run dev          # http://localhost:5173
```

El archivo `.env` debe contener:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_APP_TITULO=LABFICAT
```

El backend solo permite CORS desde `http://localhost:5173` (ver `CORS_ORIGIN`).

## Compilación para producción

```bash
cd Frontend
npm run build
```

El build se genera directamente en **`Backend/dist`** (configurado en
`vite.config.js`). El backend lo sirve en el mismo origen que la API:

```text
http://localhost:3000/          -> Backend/dist/index.html
http://localhost:3000/assets/   -> JS/CSS del frontend
http://localhost:3000/api/v1/   -> API
```

- `.env.production` define `VITE_API_URL=/api/v1`, así que el frontend llama a la
  API en el mismo dominio (no queda `localhost` en el bundle).
- El backend solo sirve el frontend si `Backend/dist/index.html` existe.
- Después de compilar, reinicia el backend o vuelve a desplegarlo.
- Para desarrollo sigue usando `npm run dev` en el frontend (`http://localhost:5173`).

## Estructura

```text
src/
├── assets/         logos e imagenes
├── components/     componentes reutilizables por responsabilidad
├── composables/    logica reutilizable con Composition API
├── layouts/        marcos de pantalla (auth y aplicacion)
├── plugins/        axios y Quasar configurados una sola vez
├── router/         rutas, guards y menu por rol
├── services/       consumo de la API por modulo
├── store/          estado global con Pinia
├── styles/         tokens, variables de Quasar y estilos globales
├── utils/          funciones puras y catalogos de estados/roles
├── views/          una pantalla por ruta
├── App.vue
└── main.js
```

## Roles

- `cliente`: crea solicitudes, acepta cotizaciones, reporta pagos, consulta muestras/informes y responde encuestas.
- `analista`: consulta muestras, crea órdenes, registra resultados y trazabilidad.
- `coordinador`: gestiona clientes, cotizaciones, cupones, pagos, muestras, órdenes, informes, catálogos y reportes.

## Convenciones

- Ninguna vista llama a `axios` directamente: usa `src/services`.
- Las respuestas exitosas del backend tienen la forma `{ ok, mensaje, datos }`.
- Los errores tienen la forma `{ ok:false, mensaje, detalles? }`.
- Las descargas (Excel, PDF, evidencias) se hacen con `descargar()` y `responseType: "blob"`.
- El token se envía como `Authorization: Bearer <token>`.

## Validación de formularios

El contrato de validación está centralizado en tres archivos:

| Archivo | Responsabilidad |
|---|---|
| `src/utils/contrato.js` | Longitudes máximas, enums, límites de archivos y normalización de payloads. Es el espejo de `Backend/src/config/constants.js` y de los modelos Mongoose. |
| `src/utils/reglas.js` | Reglas reutilizables para el atributo `:rules` de Quasar (`requerido`, `maximo`, `numeroMayorA`, `archivoMime`, etc.). |
| `src/utils/validaciones.js` | Funciones puras por endpoint (`validarCotizacion`, `validarRecepcionMuestra`, `validarEncuesta`, ...) que devuelven un arreglo de mensajes de error. |

Reglas de uso:

1. Los límites **no se escriben a mano** en las vistas: se importan de `contrato.js`.
2. Las reglas por campo son para feedback inmediato; al enviar el formulario se
   ejecuta la función de `validaciones.js` correspondiente.
3. El backend sigue siendo la autoridad final. Si cambia un modelo o un service,
   se actualiza `contrato.js` y, si aplica, la función pura.

Ejemplo:

```js
import { validarEncuesta } from "@/utils/validaciones";
import { useNotificar } from "@/composables/useNotificar";

const { notificarAdvertencia } = useNotificar();

function enviar() {
  const errores = validarEncuesta(formulario.value);
  if (errores.length > 0) {
    notificarAdvertencia(errores[0]);
    return;
  }
  // ...llamar al service
}
```


## Estado de esta entrega

Ya estan implementados:

- Configuracion de Vite, Quasar, Pinia persistente, router y Axios.
- Tema LABFICAT a partir de `desing.md`.
- Stores `Auth`, `General` y `Catalogos`.
- Servicios de todos los modulos del backend.
- Composables, utilidades, layouts y componentes base.
- Contrato de validacion centralizado (`contrato.js`, `reglas.js`, `validaciones.js`).
- Vistas funcionales de todos los modulos:
  - Autenticacion: login, registro, recuperacion, restablecimiento y perfil.
  - Cliente: solicitudes, cotizaciones con firma digital, cupones, pagos,
    muestras, trazabilidad, informes, encuestas y reclamaciones.
  - Coordinador: clientes, catalogos y configuracion, solicitudes, cotizaciones,
    cupones, pagos, muestras, informes, encuestas, reclamaciones, reportes y
    auditoria.
  - Analista: muestras, trazabilidad, ordenes y registro de resultados.
- `EnConstruccionView.vue` queda solo como respaldo del router para rutas nuevas
  sin componente asignado.


