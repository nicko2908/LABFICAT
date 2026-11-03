# LABFICAT - Backend

API REST del sistema de gestion del laboratorio **LABFICAT** (Produccion de Centro - SENA).

- **Stack:** Node.js + Express + Mongoose (MongoDB Atlas), modulos **ESM** (`"type": "module"`)
- **Arquitectura:** MVC + capa de servicios y validators
- **Modulo:** Trabajo Final

## Requisitos

- Node.js 18+
- Cuenta/cluster en MongoDB Atlas

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de variables de entorno
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/Mac

# 3. Completar MONGO_URI, JWT_SECRET y credenciales SMTP en .env

# 4. Levantar en desarrollo
npm run dev

# 5. Levantar en produccion
npm start
```

## Variables de entorno

- **Obligatorias:** `MONGO_URI` y `JWT_SECRET`. Si faltan, el backend no arranca.
- **Supabase (opcional en local):** `SUPABASE_URL` y `API_KEY_SUPABASE`.
  Si no estan configuradas, la API funciona igual y solo los endpoints de
  firma digital responden `503 Storage no configurado`.
- **Negocio:** `CUPON_VIGENCIA_DIAS` (por defecto 5), `CUPON_UMBRAL_RECORDATORIO_DIAS`,
  `TOKEN_RECUPERACION_MINUTOS` y `RESPONSABLE_LABORATORIO` (nombre que firma la
  Oferta de servicios en Excel).
  La vigencia del cupon se lee al arrancar: **un cambio requiere reiniciar el proceso**.
- **Correo (opcional hasta Fase 3):** `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`.
  Si falta configuracion real, el backend arranca y solo advierte; las
  notificaciones por correo no se envian.

## Estado de implementacion

- **Fase 0:** cerrada en codigo y verificada contra Atlas (seed, login, `/health`).
- **Fase 1:** implementada (booleanos estrictos, regex escapadas, listas
  blancas, JWT unificado, migracion y pruebas de regresion).
- **Fase 2A:** cerrada. Incluye transacciones, maquina de estados, flujo
  completo solicitud -> cotizacion -> pago -> muestra -> orden -> informe ->
  encuesta -> descarga, permisos por propietario y endpoints `/mias`/`/mios`.
- **Fase 2B:** cerrada. Toda la logica de negocio vive en `services/`; los
  controladores solo traducen HTTP -> service -> respuesta. Se eliminaron los
  servicios stub y se centralizaron paginacion, traduccion de errores de
  Mongoose y lectura del actor autenticado.
  **119 pruebas automatizadas.**
- **Plantillas (Fase 3 parcial):** cotizacion versionada con items, catalogo de
  35 ensayos, 16 tipologias comerciales, codigos atomicos y generadores Excel
  de Oferta de servicios y Acta de recepcion.
- **Regla de negocio:** las 4 tipologias internas son **Aprendices SENA,
  CampeSENA, Comunidad SENA y Cooperativas de Aprendices**; liquidan al 0 %.
  Las otras 12 son externas y pagan la tarifa del catalogo. El tipo de cliente
  se deriva de la tipologia, **no del dominio del correo**.
- **Pendiente Fase 3/4:** uploads reales, PDF/QR, notificaciones, auditoria
  automatica, jobs, helmet/rate limit, OpenAPI, CI y frontend.

## Verificacion rapida

```bash
# 1. La app responde (no requiere Mongo)
curl http://localhost:3000/health

# 2. Login con el usuario sembrado (requiere npm run seed)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"correo\":\"coordinador@sena.edu.co\",\"contrasena\":\"Labficat123*\"}"

# 3. Pruebas automatizadas
npm test
```

Las pruebas cargan `tests/setup.js`, que usa `.env` si existe y, si no,
define valores de prueba. Por eso `npm test` funciona en CI sin `.env`.

Las pruebas de integracion usan `mongodb-memory-server`. Si ya tienes un
`mongod` local, evita la descarga del binario (aproximadamente 780 MB)
indicando su ruta:

```powershell
# Windows / PowerShell
$env:MONGOMS_SYSTEM_BINARY="C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe"
npm test
```

```bash
# Linux / macOS
export MONGOMS_SYSTEM_BINARY=/usr/bin/mongod
npm test
```

Sin esa variable, la primera ejecucion descarga el binario automaticamente.
Las pruebas de integracion necesitan un replica set porque MongoDB solo
permite transacciones sobre replica sets.

## Semilla y migraciones

```bash
# Crea/actualiza roles, configuracion, catalogos y usuario de prueba
npm run seed

# Migraciones sobre bases existentes (idempotentes)
npm run migrar:catalogos   # 16 tipologias, tipos de muestra, parametro Resultado y 35 ensayos
npm run migrar:plan        # version/items/codigos/snapshot, muestras, clientes e indices
npm run migrar:tipologia   # legado: solo si aun no existe el catalogo nuevo
```

`npm run seed` sincroniza las **16 tipologias comerciales** (4 internas), las
presentaciones de muestra, el parametro generico `Resultado` y los **35
ensayos** por `codigo`. Las 12 tipologias del RF-01 anterior se desactivan, no
se borran. Las plantillas Excel sanitizadas viven en `src/templates/excel/`;
se regeneran con `npm run plantillas:preparar`.

### Generadores Excel

- `GET /api/v1/cotizaciones/:id/excel` — Oferta de servicios (`NNNN-AAAAV#`).
- `GET /api/v1/muestras/:id/acta-recepcion` — Acta de recepcion (`NNNN-AAAA`).

La plantilla de cotizacion imprime un solo bloque de item (hasta 3 ensayos),
igual que el formato oficial. Si la cotizacion tiene varios items, el endpoint
devuelve el primero y agrega el header `X-Advertencia`.

## Estructura

```
src/
├─ server.js        Arranque (conecta Mongo y levanta HTTP)
├─ app.js           Configuracion de Express (middlewares, rutas, errores)
├─ config/          Infraestructura: BD, entorno, constantes, mailer
├─ models/          M (Modelo): schemas de Mongoose agrupados por dominio
├─ controllers/     C (Controlador): reciben req, llaman services, responden
├─ routes/          Mapeo URL -> controlador (un archivo por modulo)
├─ services/        Logica de negocio (no conoce req/res)
├─ middlewares/     Auth, roles, validacion, upload, auditoria, errores
├─ validators/      Reglas de entrada (formatos, longitudes, tamanos)
├─ jobs/            Tareas programadas (node-cron)
├─ templates/       Plantillas de PDF, Excel y correo
├─ utils/           Helpers puros y generadores (PDF, Excel, QR, codigo)
├─ seeds/           Datos iniciales (roles, configuracion) -> npm run seed
└─ docs/            Documentacion de la API (Swagger/OpenAPI)
scripts/            Migraciones de datos (no se ejecutan al arrancar)
storage/            Archivos subidos y generados (no versionado)
tests/              Pruebas automatizadas + bootstrap de entorno
logs/               Salida de auditoria/errores
```

## Convenciones

- Un archivo por **coleccion** en `models/`, agrupados por dominio.
- Un archivo por **modulo** en `controllers/`, `services/` y `routes/`.
- Las rutas solo orquestan; la logica vive en `services/`.
- Los archivos binarios se guardan en `storage/`; en BD solo la ruta.
