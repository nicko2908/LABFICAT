# Correcciones y plan de trabajo — LABFICAT

**Proyecto:** LABFICAT Backend (Node.js + Express + Mongoose)
**Rama actual:** `feature/models`
**Fecha:** 21 de octubre de 2026
**Alcance:** correcciones detectadas en modelos, controladores, rutas, configuración, flujo de negocio, archivos, notificaciones, auditoría, jobs, pruebas y documentación.

**Leyenda de estado:**

- `[x]` hecho y verificado
- `[ ]` pendiente
- `[~]` parcial o requiere decisión

> **Estado de implementación (21/10/2026):** Fase 0 cerrada y Fase 1
> implementada. Ver `INFORME_FASE0_FASE1.md` para el detalle de archivos,
> pruebas y verificación contra Atlas. Los checkboxes de las secciones 3 a 7
> conservan el inventario original del plan; el estado real está en el informe.

---

## 1. Resumen ejecutivo

La Fase 0 (arranque reproducible) quedó completada y verificada. El backend ya:

- instala todas sus dependencias,
- arranca y conecta a MongoDB Atlas,
- responde `/health`,
- ejecuta el seed,
- permite login y consulta de perfil,
- funciona sin Supabase configurado (el storage responde `503` solo cuando se usa),
- tiene una prueba de humo automatizada.

Lo que queda es principalmente **lógica de negocio y consistencia entre módulos**: tipologías, validaciones, transiciones de estado, permisos por propietario, endpoints para el cliente, archivos reales, notificaciones, auditoría, jobs y pruebas de integración.

| Fase | Contenido | Estado | Prioridad |
|---|---|---|---|
| Fase 0 | Arranque, entorno, Supabase perezoso, modelos registrados, smoke test | `[x]` Completada y verificada contra Atlas | P0 |
| Fase 1 | Compatibilidad modelo ↔ controlador ↔ rutas | `[x]` Implementada y probada | P0/P1 |
| Fase 2 | Flujo entre modelos y autorización por propietario | `[ ]` Pendiente | P1 |
| Fase 3 | Archivos, notificaciones, auditoría, jobs y seguridad | `[ ]` Pendiente | P2 |
| Fase 4 | Pruebas de integración, OpenAPI, seeds QA, CI y frontend | `[ ]` Pendiente | P2 |

---

## 2. Fase 0 — Arranque reproducible `[x]`

### 2.1 Dependencias

- `[x]` `npm ci` ejecutado.
- `[x]` `npm ls --depth=0` sin dependencias faltantes.
- Dependencias restauradas: `@supabase/supabase-js`, `node-cron`, `nodemailer`.

### 2.2 Configuración de entorno

- `[x]` `.env` con `SUPABASE_URL` y `API_KEY_SUPABASE`.
- `[x]` `src/config/env.js` valida:
  - `MONGO_URI` obligatoria.
  - `JWT_SECRET` obligatoria.
  - Supabase opcional.
  - `CUPON_VIGENCIA_DIAS` centralizada.
- `[x]` `.env.example` actualizado con `CUPON_VIGENCIA_DIAS`.
- `[x]` `README.md` con variables de entorno y verificación rápida.

### 2.3 Supabase perezoso

- `[x]` `src/config/supabase.js` expone `getSupabase()`.
- `[x]` El cliente no se crea al importar el módulo.
- `[x]` Sin credenciales, la app arranca y `getSupabase()` lanza `503 Storage no configurado`.
- `[x]` `src/services/storage.service.js` obtiene el cliente dentro de cada función.
- `[x]` Validación de firma vacía.

### 2.4 Registro determinista de modelos

- `[x]` `src/app.js` importa `./models/index.js` antes de las rutas.
- `[x]` `populate()` ya no depende de imports colaterales.

### 2.5 Vigencia del cupón

- `[x]` `CUPON_VIGENCIA_DIAS` se lee desde `env.negocio.cuponVigenciaDias`.
- `[x]` `src/models/servicios/CuponPago.js` usa esa configuración.
- `[x]` Se eliminó la constante duplicada de `LIMITES`.

### 2.6 Prueba de humo

- `[x]` `tests/smoke.test.js`:
  - `GET /health` responde `200`.
  - Ruta inexistente responde `404` con formato uniforme.
- `[x]` `npm test` → 2 pruebas, 2 correctas.

### 2.7 Verificación funcional realizada

- `[x]` Servidor arranca y conecta a MongoDB Atlas.
- `[x]` `npm run seed` ejecutado.
- `[x]` Login del coordinador → `200` con token.
- `[x]` `GET /auth/perfil` con token → `200`.
- `[x]` `GET /catalogos/tipologias?soloActivas=true` → 12 tipologías.

**Credenciales de prueba sembradas:**

```text
correo: coordinador@sena.edu.co
contraseña: Labficat123*
```

### 2.8 Advertencias que quedan abiertas

- `[x]` `JWT_SECRET` rotado a una clave aleatoria de 64 caracteres. El aviso de plantilla desapareció.
- `[ ]` `MAIL_PASS` sigue como `********`. No afecta el arranque; el entorno ahora advierte que el SMTP no está configurado.
- `[~]` `JWT_SECRET` listo; `MAIL_PASS` requiere credenciales SMTP reales antes de implementar notificaciones (Fase 3).

---

## 3. Fase 1 — Compatibilidad modelo ↔ controlador ↔ rutas `[x]`

> Implementada el 21/10/2026. El detalle de cambios y pruebas está en
> `INFORME_FASE0_FASE1.md`. Los checkboxes siguientes son el inventario
> original del plan.

### 3.1 Tipología del cliente (prioridad inmediata)

**Problema actual:**

- `models/clientes/Cliente.js` tiene `tipologia` con `required: true` (cambio sin commitear).
- `controllers/auth.controller.js` envía `tipologia: tipologiaDoc ? tipologiaDoc._id : null`.
- `controllers/clientes.controller.js` envía `tipologia: tipologiaDoc ? tipologiaDoc._id : null`.
- Resultado: registrar un cliente sin tipología falla con `ValidationError: Path tipologia is required`.

**Decisión de negocio:** la tipología debe llenarse tanto en autorregistro como en registro por tercero. La opción **“Ninguna de las anteriores”** es un valor válido y debe tratarse como un registro real del catálogo, no como `null`.

**Diseño recomendado:**

- `[ ]` Mantener `tipologia` como `required: true` en `Cliente`.
- `[ ]` Agregar un identificador estable a `TipologiaPoblacional`:

```js
codigo: {
  type: String,
  unique: true,
  sparse: true,
  uppercase: true,
  trim: true,
}
```

- `[ ]` Sembrar la tipología con `codigo: 'NINGUNA'`.
- `[ ]` No identificarla por el nombre visible.
- `[ ]` En `auth.registrar`:
  - exigir `tipologia` en el body, o
  - resolver automáticamente `NINGUNA` si se elige la política de fallback.
- `[ ]` En `clientes.crear`:
  - misma política que en autorregistro, o
  - fallback a `NINGUNA` si el operador no la conoce.
- `[ ]` Validar que la tipología exista y esté activa.
- `[ ]` En `clientes.actualizar`, rechazar `tipologia: null`.
- `[ ]` En `cambiarEstadoTipologia`, impedir desactivar `NINGUNA`.
- `[ ]` En `actualizarTipologia`, impedir cambiar el `codigo` de `NINGUNA`.
- `[ ]` Migrar clientes existentes con `tipologia: null` a `NINGUNA`.
- `[ ]` Verificar que no queden clientes sin tipología.

**Políticas posibles:**

| Política | Comportamiento | Recomendación |
|---|---|---|
| A. Estricta | Si falta `tipologia`, responde `400` | Buena si el frontend siempre envía el campo |
| B. Fallback | Si falta, asigna `NINGUNA` | Útil para terceros o importaciones |
| C. Híbrida | Autorregistro estricto; tercero con fallback | **Recomendada** |

**Criterio de aceptación:**

- Autorregistro sin tipología responde `400` con mensaje claro.
- Registro por tercero sin tipología queda con `NINGUNA` si se elige la política B/C.
- La opción `NINGUNA` no se puede desactivar.
- No quedan clientes con `tipologia: null`.

### 3.2 Booleanos en catálogos

**Problema:** `Boolean("false")` devuelve `true`. Si el body llega como formulario (`activo=false`), el registro se activa en vez de desactivarse.

Afecta a:

- `[ ]` `cambiarEstadoTipologia`
- `[ ]` `cambiarEstadoTipoMuestra`
- `[ ]` `cambiarEstadoParametro`
- `[ ]` `cambiarEstadoEtapa`
- `[ ]` `cambiarEstadoAnalisis`
- `[ ]` Filtros `?activo=` en listados

**Solución:** helper `parseBoolean` que acepte únicamente `true`, `"true"`, `1`, `"1"`, `false`, `"false"`, `0`, `"0"`.

**Criterio de aceptación:** `PATCH .../estado` con `"false"` desactiva correctamente.

### 3.3 Búsquedas con expresiones regulares

**Problema:** `new RegExp(String(search).trim(), 'i')` sin escapar. Un valor como `[` lanza `SyntaxError` y responde `500`; además permite ReDoS.

Afecta a:

- `[ ]` `clientes.controller.js`
- `[ ]` `solicitudes.controller.js`
- `[ ]` `catalogos.controller.js`
- `[ ]` `muestras.controller.js`
- `[ ]` `auditoria.controller.js`
- `[ ]` `reclamaciones.controller.js`

**Solución:** helper `escaparRegex` y límite de longitud para `search`.

**Criterio de aceptación:** `GET /clientes?search=[` responde `400` o una lista vacía, nunca `500`.

### 3.4 Mass assignment

**Problema:** se pasa `req.body` directo a `create` o `findByIdAndUpdate`, permitiendo sobrescribir `_id`, `createdAt`, `updatedAt` o `activo` fuera de su endpoint.

Afecta a:

- `[ ]` `actualizarTipologia`
- `[ ]` `actualizarTipoMuestra`
- `[ ]` `actualizarParametro`
- `[ ]` `actualizarEtapa`
- `[ ]` `crearAnalisis`
- `[ ]` `actualizarAnalisis`
- `[ ]` `Encuesta.create(req.body)`

**Solución:** listas blancas de campos permitidos por endpoint.

**Criterio de aceptación:** un body con `_id`, `createdAt` o `updatedAt` no modifica esos campos.

### 3.5 Firma duplicada de JWT

- `[ ]` `auth.controller.js` usa `jwt.sign` directamente.
- `[ ]` Existe `utils/jwt.firmar` con la misma responsabilidad.
- `[ ]` Unificar en `utils/jwt.firmar` y eliminar la duplicación.

### 3.6 Modelos registrados

- `[x]` `app.js` importa `models/index.js`.
- `[ ]` Agregar la misma importación en scripts o pruebas que importen controladores de forma aislada.

### 3.7 Vigencia del cupón

- `[x]` Fuente única: `env.negocio.cuponVigenciaDias`.
- `[x]` `.env` y `.env.example` en 5 días.
- `[ ]` Documentar que un cambio de vigencia requiere reiniciar el proceso.

---

## 4. Compatibilidad con el modelo SQL `[ ]`

Si la base actual viene de `ModeloCorregidoLABIFCAT.sql`, revisar:

| SQL | Mongoose | Riesgo | Acción |
|---|---|---|---|
| `usuario` no tiene `apellidos` | `Usuario.apellidos` es obligatorio | `save()` falla en login o actualizaciones | Migrar/rellenar `apellidos` o hacerlo opcional |
| `usuario.numero_documento VARCHAR(15)` libre | Regex `^\d{6,15}$` | Documentos alfanuméricos fallan | Ajustar regex o normalizar datos |
| `usuario.nombres VARCHAR(100)` libre | Regex solo letras/espacios/tildes | Nombres con apóstrofo o guion fallan | Ampliar regex |
| `cliente.acepta_tratamiento_datos_terminos_condiciones` | `acepta_tratamiento_datos` | Campo distinto | Mapear en migración |
| `cliente.id_tipologia NULL` | `tipologia required` | Clientes migrados sin tipología fallan | Migrar a `NINGUNA` |
| `rotulo_parametro` (parámetros) | `Rotulo.analisis` (análisis) | Cambia el significado del rótulo | Revisar contrato con frontend |
| `usuario.fecha_creacion` | `createdAt` | Campo distinto | Mapear |
| `solicitud.id_estado` (FK) | `estado` (string enum) | Valores distintos | Mapear tabla `estado_solicitud` |

**Criterio de aceptación:** un script de migración idempotente deja los datos compatibles con los esquemas Mongoose.

---

## 5. Fase 2 — Flujo entre modelos y autorización `[ ]`

### 5.1 Capa de servicios real

Hoy los servicios son stubs (`export default {}`). Implementar:

- `[ ]` `services/solicitud.service.js`
- `[ ]` `services/cotizacion.service.js`
- `[ ]` `services/pago.service.js`
- `[ ]` `services/muestra.service.js`
- `[ ]` `services/orden.service.js`
- `[ ]` `services/informe.service.js`
- `[ ]` Opcional: `services/flujo.service.js` como orquestador

### 5.2 Máquina de estados

- `[ ]` **Solicitud:** `Registrada → Cotizada → Aceptada/Desistida → Pago pendiente → Pago aprobado/rechazado → En análisis → Informe listo → Finalizada/Cerrada`.
- `[ ]` **Cotización:** `PENDIENTE → ACEPTADA/RECHAZADA`.
- `[ ]` **Cupón:** `PENDIENTE → GENERADO → UTILIZADO/VENCIDO`.
- `[ ]` **Orden:** `PENDIENTE → EN_PROCESO → FINALIZADA/INVALIDADA`.

**Problema actual:** los controladores permiten saltos de estado y no actualizan el modelo relacionado.

**Criterio de aceptación:** una transición inválida responde `409` o `400`, nunca deja dos modelos en estados incompatibles.

### 5.3 Validaciones cruzadas

- `[ ]` El detalle de la cotización solo incluye análisis de la solicitud.
- `[ ]` La muestra corresponde al tipo de muestra del análisis.
- `[ ]` La orden solo usa análisis de la solicitud.
- `[ ]` No se genera informe sin órdenes finalizadas/validadas.
- `[ ]` El cupón solo aplica a cliente `EXTERNO`.
- `[ ]` Un solo cupón por cotización.
- `[ ]` Validar pago actualiza cupón y solicitud.
- `[ ]` Generar informe actualiza la solicitud a `Informe listo`.

### 5.4 Autorización por pertenencia

**Problema:** hoy se valida el rol, pero no que el recurso pertenezca al cliente autenticado.

Afecta a:

- `[ ]` `PATCH /cotizaciones/:id/decision`
- `[ ]` `POST /pagos`
- `[ ]` `PUT /pagos/:id/reenviar`
- `[ ]` `PATCH /informes/:id/descarga`
- `[ ]` `POST /encuestas`
- `[ ]` `POST /reclamaciones`
- `[ ]` `POST /reclamaciones/:id/evidencias`

**Solución:** helper `verificarPropietario(recurso, req.usuarioId)` y uso en los controladores/servicios.

**Criterio de aceptación:** un cliente no puede operar sobre recursos de otro (`403`).

### 5.5 Endpoints de lectura para el cliente

Hoy el cliente no puede consultar sus propios recursos. Agregar:

- `[ ]` `GET /solicitudes/mias`
- `[ ]` `GET /cotizaciones/mias`
- `[ ]` `GET /cupones/mios`
- `[ ]` `GET /pagos/mios`
- `[ ]` `GET /informes/mios`
- `[ ]` `GET /trazabilidad/muestra/:id` con filtro por propietario

**Criterio de aceptación:** el frontend puede mostrar todo el flujo del cliente sin usar endpoints de coordinador.

### 5.6 Errores uniformes

- `[ ]` Evitar `500` por `TypeError`, Regex inválida, estado inválido o fechas inválidas.
- `[ ]` Usar `400/401/403/404/409` según corresponda.
- `[ ]` Centralizar la traducción de errores de Mongoose.
- `[ ]` Validar `req.body.detalle` antes de usar `.map`.

---

## 6. Fase 3 — Archivos, notificaciones, auditoría y jobs `[ ]`

### 6.1 Uploads

- `[ ]` Implementar `middlewares/upload.middleware.js` con Multer.
- `[ ]` Límites de `LIMITES`.
- `[ ]` Validar MIME y extensión.
- `[ ]` Reemplazar `ruta_archivo`/`ruta_pdf` enviados por el cliente por archivos reales.
- `[ ]` Validar tamaño y contenido de firmas PNG.

### 6.2 Storage unificado

- `[ ]` Decidir: Supabase para todo, o local para PDFs/soportes y Supabase solo para firmas.
- `[ ]` Implementar `subir`, `descargar` y `eliminar` en `storage.service.js`.
- `[ ]` Evitar rutas inventadas en base de datos.

### 6.3 Generadores

- `[ ]` Implementar `utils/generadores/pdf.js`.
- `[ ]` Implementar `utils/generadores/excel.js`.
- `[ ]` Implementar `utils/generadores/qr.js`.
- `[ ]` Implementar `utils/generadores/codigoMuestra.js`.
- `[ ]` Agregar dependencias: `pdfkit`/equivalente, `exceljs`, `qrcode`.
- `[ ]` Conectar generadores a informes, rótulos y cotizaciones.

### 6.4 Notificaciones

- `[ ]` Implementar `services/notificacion/*`.
- `[ ]` Usar `config/mailer.js`.
- `[ ]` Implementar plantillas de correo.
- `[ ]` La recuperación de contraseña debe enviar correo, no devolver el token en la respuesta.
- `[ ]` Configurar SMTP real (hoy `MAIL_PASS` es placeholder).

### 6.5 Auditoría

- `[ ]` Implementar `middlewares/audit.middleware.js`.
- `[ ]` Registrar login, CRUD y cambios de estado.
- `[ ]` No guardar datos sensibles.
- `[ ]` Verificar que la bitácora sea append-only.

### 6.6 Jobs

- `[ ]` Implementar `jobs/recordatorioCupon.job.js`.
- `[ ]` Implementar `jobs/vencimientoCupon.job.js`.
- `[ ]` Implementar `jobs/limpiezaTokens.job.js`.
- `[ ]` Activarlos en `server.js`.
- `[ ]` Definir zona horaria de ejecución.

### 6.7 Seguridad

- `[ ]` `helmet`.
- `[ ]` Rate limit en login y recuperación.
- `[ ]` CORS por lista blanca.
- `[ ]` Validar que `JWT_SECRET` no sea el valor de plantilla.
- `[ ]` `trust proxy` si se despliega detrás de proxy.
- `[ ]` Revisar `CORS_ORIGIN=*` con `credentials: true`.

---

## 7. Fase 4 — Pruebas, documentación y frontend `[ ]`

### 7.1 Pruebas de integración

- `[ ]` `node:test` + `supertest` + `mongodb-memory-server`.
- `[ ]` Arranque y `/health`.
- `[ ]` Registro, login y perfil.
- `[ ]` Tipología obligatoria y `NINGUNA`.
- `[ ]` CRUD de catálogos.
- `[ ]` Flujo completo: solicitud → cotización → cupón → pago → muestra → orden → informe → encuesta → descarga.
- `[ ]` Matriz de permisos: cliente, analista, coordinador.
- `[ ]` Errores `400/401/403/404/409`.

### 7.2 Documentación

- `[ ]` OpenAPI/Swagger en `src/docs`.
- `[ ]` Documentar el formato de respuesta `{ ok, mensaje, datos }`.
- `[ ]` Documentar variables de entorno y flujo de prueba.
- `[ ]` Actualizar README con el estado real de las fases.

### 7.3 Seeds de QA

- `[ ]` Cliente de prueba.
- `[ ]` Analista de prueba.
- `[ ]` Solicitud de prueba.
- `[ ]` Cotización de prueba.
- `[ ]` Cupón y soporte de pago.
- `[ ]` Muestra, orden e informe.
- `[ ]` Verificar idempotencia.

### 7.4 CI

- `[ ]` `npm ci` + `npm test` en CI.
- `[ ]` Agregar lint (ESLint) si se desea.
- `[ ]` Evitar que CI dependa de MongoDB Atlas real.

### 7.5 Frontend

- `[ ]` La carpeta `Frontend/` está vacía; definir si entra en el alcance.
- `[ ]` Si se implementa: Vite + React (o el stack elegido).
- `[ ]` Cliente HTTP alineado con `{ ok, mensaje, datos }`.
- `[ ]` `VITE_API_URL=http://localhost:3000/api/v1`.
- `[ ]` Pantallas de login, registro, solicitudes, cotizaciones, cupones, pagos, muestras, informes y encuestas.

---

## 8. Matriz de rutas con correcciones pendientes

| Ruta | Problema | Corrección |
|---|---|---|
| `POST /auth/registro` | Tipología opcional pero modelo `required` | Exigir o fallback a `NINGUNA` |
| `POST /clientes` | Tipología opcional pero modelo `required` | Exigir o fallback a `NINGUNA` |
| `PUT /clientes/:id` | Puede recibir `tipologia: null` | Rechazar `null` |
| `PATCH /catalogos/*/estado` | `Boolean("false") === true` | `parseBoolean` |
| `GET /clientes?search=` | Regex sin escapar | `escaparRegex` |
| `GET /solicitudes?search=` | Regex sin escapar | `escaparRegex` |
| `GET /catalogos/*?search=` | Regex sin escapar | `escaparRegex` |
| `GET /muestras?search=` | Regex sin escapar | `escaparRegex` |
| `GET /auditoria?accion=` | Regex sin escapar | `escaparRegex` |
| `GET /reclamaciones?search=` | Regex sin escapar | `escaparRegex` |
| `PUT /catalogos/*/:id` | Mass assignment | Lista blanca |
| `POST /catalogos/analisis` | Mass assignment | Lista blanca |
| `POST /encuestas` | Mass assignment | Lista blanca |
| `PATCH /cotizaciones/:id/decision` | Sin verificación de propietario | `verificarPropietario` |
| `POST /pagos` | Sin verificación de propietario | `verificarPropietario` |
| `PUT /pagos/:id/reenviar` | Sin verificación de propietario | `verificarPropietario` |
| `PATCH /informes/:id/descarga` | Sin verificación de propietario | `verificarPropietario` |
| `POST /encuestas` | Sin verificación de propietario | `verificarPropietario` |
| `POST /reclamaciones` | Sin verificación de propietario | `verificarPropietario` |
| `POST /reclamaciones/:id/evidencias` | Sin verificación de propietario | `verificarPropietario` |
| `POST /solicitudes` | El cliente puede enviar el `cliente` de otro | Derivar el cliente del token |
| `POST /informes` | No genera PDF real | Conectar generador |
| `PATCH /informes/:id/descarga` | Solo registra fecha, no descarga | Devolver archivo |
| `POST /muestras/:id/rotulo` | `ruta_pdf` viene del body | Generar y subir PDF |
| `POST /pagos` | `ruta_archivo` viene del body | Upload real |
| `POST /auditoria/recuperacion/solicitar` | Devuelve el token en la respuesta | Enviar por correo |

---

## 9. Decisiones pendientes

1. **Tipología:** ¿política estricta, fallback automático o híbrida?
   - Recomendada: híbrida (autorregistro estricto, tercero con fallback a `NINGUNA`).
2. **“Ninguna de las anteriores”:** ¿se implementa con `codigo: 'NINGUNA'`?
   - Recomendado: sí, para no depender del nombre visible.
3. **Vigencia del cupón:** ya está en 5 días en `.env` y código.
4. **Storage:** ¿todo en Supabase o local para PDFs/soportes y Supabase solo para firmas?
5. **Frontend:** ¿entra en este alcance? La carpeta está vacía.
6. **Datos existentes:** ¿hay clientes con `tipologia: null` o usuarios sin `apellidos`?
7. **JWT_SECRET y MAIL_PASS:** ¿se cambian ahora o antes del despliegue?

---

## 10. Orden de ejecución recomendado

1. **Tipología + `NINGUNA` + migración.**
2. **`parseBoolean` + `escaparRegex`.**
3. **Listas blancas de campos + unificación de JWT.**
4. **Servicios de flujo + transiciones de estado.**
5. **Autorización por propietario + endpoints del cliente.**
6. **Uploads + storage + generadores.**
7. **Notificaciones + auditoría + jobs.**
8. **Seguridad (helmet, rate limit, CORS, secretos).**
9. **Pruebas de integración + OpenAPI + seeds QA + CI.**
10. **Frontend, si aplica.**

---

## 11. Comandos de verificación

```bash
# Dependencias
cd Backend
npm ci
npm ls --depth=0

# Pruebas de humo
npm test

# Arranque
npm start

# Semilla
npm run seed

# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"correo\":\"coordinador@sena.edu.co\",\"contrasena\":\"Labficat123*\"}"
```

---

## 12. Archivos clave para las siguientes fases

| Área | Archivos |
|---|---|
| Tipología | `src/models/clientes/Cliente.js`, `src/models/clientes/TipologiaPoblacional.js`, `src/controllers/auth.controller.js`, `src/controllers/clientes.controller.js`, `src/controllers/catalogos.controller.js`, `src/seeds/index.js` |
| Booleanos y búsquedas | `src/controllers/catalogos.controller.js`, `src/controllers/clientes.controller.js`, `src/controllers/solicitudes.controller.js`, `src/controllers/muestras.controller.js`, `src/controllers/auditoria.controller.js`, `src/controllers/reclamaciones.controller.js` |
| Flujo y permisos | `src/controllers/*.js`, `src/services/*.service.js`, `src/routes/*.routes.js` |
| Uploads y storage | `src/middlewares/upload.middleware.js`, `src/services/storage.service.js`, `src/config/supabase.js` |
| Generadores | `src/utils/generadores/*.js` |
| Notificaciones | `src/services/notificacion/*.js`, `src/config/mailer.js`, `src/templates/email/` |
| Auditoría y jobs | `src/middlewares/audit.middleware.js`, `src/jobs/*.job.js`, `src/server.js` |
| Pruebas | `tests/*.test.js` |
| Documentación | `README.md`, `src/docs/` |

---

## 13. Notas finales

- La Fase 0 está cerrada técnicamente, pero **no se debe desplegar** con el `JWT_SECRET` de plantilla ni con `MAIL_PASS=********`.
- El seed ya se ejecutó en la base actual: creó roles, configuración, catálogos y el coordinador de prueba.
- El cambio de `Cliente.tipologia` a `required: true` sigue sin commitear; la Fase 1 debe completarlo o revertirlo según la decisión de negocio.
- El backend funciona sin Supabase configurado; solo las operaciones de firma devuelven `503`.
- La carpeta `Frontend/` está vacía; si el trabajo final incluye interfaz, es un proyecto aparte que debe planificarse.
