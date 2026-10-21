# Informe de implementación — Fase 0 y Fase 1

**Proyecto:** LABFICAT Backend  
**Fecha:** 21 de octubre de 2026  
**Alcance:** cierre de los pendientes de Fase 0 e implementación completa de Fase 1.  
**Rama de trabajo:** `dev` (sin cambios de rama).  
**Resultado:** Fase 0 cerrada (salvo credencial SMTP externa) y Fase 1 implementada, probada y verificada contra MongoDB Atlas.

---

## 1. Resumen ejecutivo

Se completaron los pendientes de la Fase 0 y se implementó la Fase 1 del plan de correcciones:

- Se rotó `JWT_SECRET` a una clave aleatoria de 64 caracteres.
- Se agregó un bootstrap de pruebas para que `npm test` funcione sin `.env` y sin depender del directorio actual.
- Se ejecutó el seed contra Atlas y se verificó el login del coordinador.
- Se agregó `codigo` estable a `TipologiaPoblacional` y la opción `NINGUNA`.
- Se implementó la política híbrida de tipología: autorregistro estricto, registro por tercero con fallback a `NINGUNA`.
- Se impidió desactivar `NINGUNA` y modificar su `codigo`.
- Se reemplazó `Boolean("false")` por `parseBoolean` en todos los endpoints de estado.
- Se escaparon las expresiones regulares de búsqueda en los 8 puntos detectados y se limitó su longitud.
- Se aplicaron listas blancas de campos en catálogos, encuestas y muestras.
- Se unificó la firma de JWT en `utils/jwt.js`.
- Se corrigió el `CastError` no traducido en `auth.controller.js` (causaba 500 con una tipología inválida).
- Se agregó validación de arreglo en `detalle` de cotizaciones.
- Se agregó el filtro `activo` en `GET /clientes`.
- Se creó la migración idempotente `001-tipologia-ninguna.js`.
- Se ejecutó la migración y se verificó que no quedaran clientes sin tipología.

**Estado de pruebas:**

| Prueba | Resultado |
|---|---|
| `npm test` (smoke + regresión Fase 1) | ✅ 14/14 |
| `node --check` sobre `src`, `scripts` y `tests` | ✅ Sin errores |
| Comprobaciones funcionales contra Atlas | ✅ 33/33 |
| Seed contra Atlas | ✅ Ejecutado |
| Migración de tipología contra Atlas | ✅ Ejecutada |
| Limpieza de datos de prueba | ✅ Verificada |

---

## 2. Fase 0 — cierre de pendientes

### 2.1 `JWT_SECRET`

- Se generó una clave aleatoria de 64 caracteres y se reemplazó en `.env`.
- El aviso `JWT_SECRET es un valor de plantilla` desapareció.
- **Efecto:** los tokens emitidos antes del cambio quedan inválidos. Es el comportamiento esperado al rotar el secreto.

### 2.2 Pruebas reproducibles en CI

Antes, `npm test` fallaba fuera de `Backend` o sin `.env` porque `env.js` exige `MONGO_URI` y `JWT_SECRET`.

Solución:

- `Backend/tests/setup.js` carga `.env` si existe y, si faltan variables, define valores de prueba.
- `package.json` ejecuta `node --test --import ./tests/setup.js`.
- Se verificó la suite desde otro directorio: pasa sin `.env`.

### 2.3 Seed contra Atlas

Se ejecutó el seed con conexión directa a los hosts del clúster (el resolver SRV de Node está bloqueado en este entorno). Resultado:

```text
[seed] Roles sembrados: 3
[seed] Configuracion sincronizada: 4
[seed] Tipologias disponibles: 12
[seed] Tipos de muestra: ya existen 5, no se siembran.
[seed] Parametros: ya existen 5, no se siembran.
[seed] Etapas de proceso: ya existen 5, no se siembran.
[seed] Analisis: ya existen 3, no se siembran.
[seed] Usuario de prueba: coordinador@sena.edu.co / Labficat123*
[seed] Completado.
```

Además, el seed ahora:

- Sincroniza las tipologías por nombre, en lugar de sembrarlas solo si la colección está vacía.
- Garantiza `codigo: 'NINGUNA'`.
- No sobrescribe la configuración editada por el coordinador (`$setOnInsert`).
- Asigna contraseña al usuario de prueba si existía como prospecto sin credenciales.

### 2.4 Verificación de login

Se verificó `POST /api/v1/auth/login` con el coordinador sembrado: **200** y token válido.

### 2.5 SMTP

`MAIL_PASS` sigue siendo el placeholder `********`. No se puede cerrar sin credenciales SMTP reales. Se agregó:

- `env.mail.configurado`.
- Un aviso explícito al arrancar cuando el SMTP no está configurado.
- Documentación en `Backend/README.md`.

Esto no afecta el arranque ni la Fase 1; queda pendiente para Fase 3 (notificaciones).

### 2.6 Directorios de trabajo

- Se crearon `Backend/storage/.gitkeep` y `Backend/logs/.gitkeep`.
- Se corrigieron los patrones de `.gitignore` para que los `.gitkeep` sí se versionen.

---

## 3. Fase 1 — implementación detallada

### 3.1 Tipología y opción `NINGUNA`

**Modelo `TipologiaPoblacional`:**

- Nuevo campo `codigo`: `String`, `unique`, `sparse`, `uppercase`, `trim`, máximo 30.
- El índice único se creó en Atlas (`codigo_1`).
- `NINGUNA` se identifica por código, no por nombre visible.

**Constantes:**

- `TIPOLOGIA_CODIGO.NINGUNA = 'NINGUNA'`.
- `TIPOLOGIA_NINGUNA_NOMBRE = 'Ninguna de las anteriores'`.

**Helper `utils/tipologias.js`:**

- `resolverTipologia(valor, { obligatoria })`.
- Si falta y `obligatoria: true` → `400`.
- Si falta y `obligatoria: false` → busca `NINGUNA` activa.
- Valida existencia, estado activo e identificador mal formado.
- Un `CastError` se traduce a `400`, nunca a `500`.

**Autorregistro (`auth.controller.js`):**

- Exige `tipologia`.
- Valida que exista y esté activa.
- Guarda siempre un `ObjectId` real, nunca `null`.
- Rollback completo: si falla el perfil, elimina `Cliente` y `Usuario`.
- Contraseña mínima de 8 caracteres, consistente con cambio y recuperación.

**Registro por tercero (`clientes.controller.js`):**

- Si el operador no envía tipología, asigna `NINGUNA`.
- Si la envía, valida que exista y esté activa.
- Rollback completo si falla la creación del perfil.

**Actualización de cliente:**

- Rechaza `tipologia: null` o vacía con `400`.
- No permite asignar una tipología inactiva.

**Catálogo de tipologías:**

- `NINGUNA` no se puede desactivar (`409`).
- `codigo` no se puede modificar (`400`).
- Se protege también por nombre original como respaldo.

**Datos existentes:**

- Script `scripts/migraciones/001-tipologia-ninguna.js`.
- Crea/verifica `NINGUNA`, crea el índice y migra clientes con `tipologia: null` o ausente.
- Falla si quedan clientes sin tipología.
- Es idempotente.

**Resultado en Atlas:**

```text
[migracion] Tipologia NINGUNA ya existe.
[migracion] Clientes sin tipologia antes: 0
[migracion] Clientes actualizados: 0
[migracion] Clientes sin tipologia despues: 0
[migracion] Completada correctamente.
```

La base no tenía clientes, por eso no hubo filas que migrar.

### 3.2 Booleanos estrictos

Se creó `utils/booleanos.js` con `parseBoolean`:

- Acepta `true`, `false`, `1`, `0`, `"true"`, `"false"`, `"1"`, `"0"`.
- Ignora espacios y mayúsculas.
- Devuelve `null` para valores ambiguos.

Se aplicó en:

- `PATCH /catalogos/tipologias/:id/estado`
- `PATCH /catalogos/tipos-muestra/:id/estado`
- `PATCH /catalogos/parametros/:id/estado`
- `PATCH /catalogos/etapas/:id/estado`
- `PATCH /catalogos/analisis/:id/estado`
- Filtros `?activo=` de tipologías, tipos de muestra, parámetros, análisis y clientes.

Los mensajes de respuesta ahora usan el valor booleano interpretado, no el valor crudo.

### 3.3 Búsquedas con expresiones regulares

Se creó `utils/regex.js`:

- `escaparRegex(texto)`.
- `crearRegexBusqueda(valor, { maxLongitud = 100 })`.
- Devuelve `null` para términos vacíos.
- Responde `400` si el término supera 100 caracteres.

Se aplicó en:

- `clientes.controller.js`
- `solicitudes.controller.js`
- `muestras.controller.js`
- `catalogos.controller.js` (tipologías, parámetros, análisis)
- `auditoria.controller.js`
- `reclamaciones.controller.js`

Resultado: `search=[`, `accion=[` y términos maliciosos ya no producen `500` ni ReDoS.

### 3.4 Listas blancas de campos

Se reemplazó el paso directo de `req.body` por listas blancas:

| Endpoint | Campos permitidos |
|---|---|
| `PUT /catalogos/tipologias/:id` | `nombre`, `descripcion` |
| `PUT /catalogos/tipos-muestra/:id` | `nombre`, `estado_fisico` |
| `PUT /catalogos/parametros/:id` | `nombre`, `unidad_medida` |
| `PUT /catalogos/etapas/:id` | `nombre`, `orden` |
| `POST /catalogos/analisis` | `nombre`, `descripcion`, `tarifa_externo`, `cantidad_minima`, `unidad_cantidad`, `parametros`, `tipos_muestra` |
| `PUT /catalogos/analisis/:id` | mismos campos |
| `POST /encuestas` | `solicitud`, `satisfaccion_general`, `tiempo_entrega`, `atencion_personal`, `claridad_informe`, `recomendaria_servicio`, `comentarios` |
| `POST /muestras` | campos de recepción; `codigo`, `prioridad`, `usuario` y `fecha_asignacion_codigo` quedan fuera |
| `PUT /muestras/:id` | campos de recepción; no permite `codigo`, `prioridad`, `solicitud`, `usuario` ni `fecha_asignacion_codigo` |

También se valida que `parametros`, `tipos_muestra`, `analisis`, `evidencias` y `detalle` sean arreglos cuando se envían.

### 3.5 JWT unificado

- `auth.controller.js` ya no importa `jsonwebtoken` directamente.
- Usa `firmar()` de `utils/jwt.js`.
- Elimina la duplicación de `jwt.sign` y el uso directo de `env` en el controlador.

### 3.6 Corrección de `CastError`

Se verificó que `auditoria.controller.js` y `trazabilidad.controller.js` **ya traducían `CastError`**; el único controlador que no lo hacía era `auth.controller.js`.

- Se agregó `CastError` al traductor de `auth`.
- Una tipología con formato inválido ahora responde `400`, no `500`.
- Se corrigió el hallazgo del informe anterior: la afirmación de que auditoría y trazabilidad carecían de esa traducción era incorrecta. Sí tenían la traducción; el problema real en auditoría era el `new RegExp` sin escapar.

### 3.7 Filtro `activo` en clientes

`GET /clientes` ahora:

- Acepta `?activo=true|false|1|0`.
- Responde `400` para valores ambiguos.
- Filtra por el estado del `Usuario` asociado.
- Conserva la búsqueda por nombre, correo, documento, razón social y NIT.

### 3.8 Correcciones adicionales de bajo riesgo

- `PUT /cotizaciones/:id` valida que `detalle` sea un arreglo no vacío antes de usar `.map`.
- `POST /muestras/:id/rotulo` valida que `analisis` sea arreglo.
- `POST /reclamaciones` valida que `evidencias` sea arreglo.
- `auth.registro` exige contraseña mínima de 8 caracteres.
- Rollback completo en autorregistro y registro por tercero.
- `app.js` normaliza `req.body` nulo y `error.middleware.js` traduce JSON mal formado a `400` (antes era `500`).

---

## 4. Archivos modificados y creados

### 4.1 Modificados

| Archivo | Cambio |
|---|---|
| `Backend/.env` | `JWT_SECRET` rotado (no versionado) |
| `Backend/.env.example` | Instrucción para generar el secreto |
| `Backend/.gitignore` | Patrones para `storage/` y `logs/` |
| `Backend/README.md` | Estado Fase 0/1, migración, pruebas, SMTP y reinicio |
| `Backend/package.json` | Script `migrar:tipologia` y bootstrap de tests |
| `Backend/src/app.js` | Normalización de `req.body` nulo |
| `Backend/src/config/constants.js` | Constantes de tipología |
| `Backend/src/config/env.js` | Estado `mail.configurado` y aviso SMTP |
| `Backend/src/models/clientes/TipologiaPoblacional.js` | Campo `codigo` |
| `Backend/src/controllers/auth.controller.js` | Tipología, JWT, CastError, contraseña, rollback |
| `Backend/src/controllers/clientes.controller.js` | Fallback, validaciones, filtro activo, regex |
| `Backend/src/controllers/catalogos.controller.js` | Booleanos, regex, listas blancas, NINGUNA |
| `Backend/src/controllers/solicitudes.controller.js` | Regex segura |
| `Backend/src/controllers/muestras.controller.js` | Regex segura, listas blancas, arreglos |
| `Backend/src/controllers/reclamaciones.controller.js` | Regex segura, validación de evidencias |
| `Backend/src/controllers/auditoria.controller.js` | Regex segura |
| `Backend/src/controllers/cotizaciones.controller.js` | Validación de `detalle` |
| `Backend/src/controllers/encuestas.controller.js` | Lista blanca |
| `Backend/src/middlewares/error.middleware.js` | Errores de body-parser (JSON mal formado) a 400 |
| `Backend/src/seeds/index.js` | Upsert de tipologías, NINGUNA, configuración y usuario |
| `Backend/tests/smoke.test.js` | Prueba de body JSON `null` |
| `CORRECCIONES_LABFICAT.md` | Estado Fase 0/1 |

### 4.2 Creados

| Archivo | Propósito |
|---|---|
| `Backend/src/utils/booleanos.js` | `parseBoolean` |
| `Backend/src/utils/regex.js` | `escaparRegex` y `crearRegexBusqueda` |
| `Backend/src/utils/tipologias.js` | Resolución y validación de tipologías |
| `Backend/scripts/migraciones/001-tipologia-ninguna.js` | Migración idempotente |
| `Backend/scripts/migraciones/README.md` | Instrucciones de migración |
| `Backend/tests/setup.js` | Bootstrap de entorno para tests |
| `Backend/tests/fase1.test.js` | Pruebas de regresión Fase 1 |
| `Backend/storage/.gitkeep` | Carpeta de archivos |
| `Backend/logs/.gitkeep` | Carpeta de logs |
| `INFORME_FASE0_FASE1.md` | Este informe |

---

## 5. Pruebas y evidencia

### 5.1 Pruebas automatizadas

`npm test` → **14 pruebas, 14 correctas**:

- **11 pruebas de regresión de Fase 1** (`tests/fase1.test.js`):
  - `parseBoolean` con valores válidos e inválidos.
  - `escaparRegex`.
  - `crearRegexBusqueda` con `[`, término vacío y longitud máxima.
  - `Cliente` exige tipología.
  - `TipologiaPoblacional` define `codigo` único, sparse y en mayúsculas.
  - Constantes `NINGUNA`.
  - `resolverTipologia` exige tipología y traduce un id inválido a `400`.
- **3 pruebas de humo** (`tests/smoke.test.js`): `/health`, 404 y body JSON `null` (400, no 500).

### 5.2 Comprobaciones funcionales contra Atlas (33/33)

Se ejecutaron contra la app real y la base real:

1. Login del coordinador: `200`.
2. Listado público de tipologías: `200`.
3. `NINGUNA` existe, activa y con código: OK.
4. Registro sin tipología: `400`, sin usuario creado.
5. Tipología inválida: `400`, no `500`.
6. Registro con `NINGUNA`: `201`.
7. Perfil del cliente: tipología `NINGUNA` poblada.
8. Registro por tercero sin tipología: `201`.
9. Tercero recibe fallback `NINGUNA`.
10. Creación de tipología de prueba: `201`.
11. `PUT` con `_id`, `createdAt` y `activo`: `400`, sin cambios.
12. `PUT` con `codigo`: `400`.
13. `PATCH` estado con `"false"`: desactiva.
14. `PATCH` estado con `"true"`: activa.
15. `PATCH` estado con `"no"`: `400`.
16. `PATCH` estado de `NINGUNA` con `"false"`: `409`.
17. Búsquedas con `[` en clientes, solicitudes, muestras, reclamaciones, auditoría, parámetros, análisis y tipologías: todas `200`.
18. Búsqueda de 101 caracteres: `400`.
19. `?activo=quizas`: `400`.
20. `?activo=false`: `200`.
21. Análisis activo disponible para la prueba.
22. Creación de solicitud de prueba: `201`.
23. Creación de cotización de prueba: `201`.
24. `PUT /cotizaciones/:id` con `detalle: "x"`: `400`, no `500`.

La limpieza eliminó usuarios, clientes, solicitud, cotización, historial y tipología de prueba. Verificación posterior:

```text
NINGUNA: { nombre: 'Ninguna de las anteriores', codigo: 'NINGUNA', activo: true }
tipologias total: 12
tipologias test: 0
usuarios total: 1
usuarios test: 0
clientes total: 0
solicitudes total: 0
cotizaciones total: 0
indices tipologia: _id_, nombre_1, codigo_1
```

### 5.3 Estado de la base

Antes de la implementación:

- 1 usuario.
- 12 tipologías, sin `codigo`.
- 0 clientes.
- 0 solicitudes, cotizaciones, muestras, órdenes, informes, encuestas, reclamaciones.

Después:

- 1 usuario (coordinador).
- 12 tipologías, con `NINGUNA` y `codigo` indexado.
- 0 clientes.
- Sin datos de prueba.

---

## 6. Limitaciones y pendientes

1. **`MAIL_PASS`**: sigue siendo `********`. No hay SMTP real; el backend advierte y no envía correos. Es un pendiente de Fase 3.
2. **Conexión SRV desde este entorno**: Node no resuelve `mongodb+srv` por una restricción de red local. El seed y la migración se ejecutaron con conexión directa a los hosts del clúster. En una red normal, `npm run seed` y `npm run migrar:tipologia` deberían funcionar sin cambios.
3. **Migración en otras bases**: el script está listo y es idempotente. En esta base no había clientes, por eso actualizó 0 filas. En una base con clientes, debe ejecutarse con backup previo.
4. **Fase 2 no implementada**: siguen pendientes la máquina de estados, la sincronización entre modelos, la autorización por propietario y los endpoints `/mias`.
5. **Fase 3 no implementada**: uploads, storage genérico, PDFs, Excel, QR, notificaciones, auditoría automática, jobs, helmet y rate limit.
6. **Rama**: se trabajó sobre `dev`. `dev` sigue 1 commit adelante de `origin/dev`; no se creó rama nueva ni se hizo commit.
7. **Pruebas de integración en CI**: la suite actual es de humo y regresión sin MongoDB. Las pruebas de flujo completo requieren `mongodb-memory-server` o una base de prueba dedicada (Fase 4).

---

## 7. Comandos de reproducción

```bash
cd Backend

# Dependencias
npm ci

# Pruebas (no requieren MongoDB)
npm test

# Seed (requiere MONGO_URI con acceso a Atlas)
npm run seed

# Migración de tipología (idempotente)
npm run migrar:tipologia

# Arranque
npm start

# Health
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"correo\":\"coordinador@sena.edu.co\",\"contrasena\":\"Labficat123*\"}"
```

---

## 8. Conclusión

La Fase 0 quedó cerrada en lo que depende del proyecto: secretos, seed, login, verificación contra Atlas y pruebas reproducibles. La única excepción es `MAIL_PASS`, que requiere credenciales externas.

La Fase 1 quedó implementada de forma completa y verificada: el registro ya no se bloquea por tipología, `NINGUNA` es un valor real y protegido, los booleanos y las búsquedas ya no producen comportamientos erróneos, las actualizaciones tienen listas blancas y los errores de identificador se traducen a `400`.

El siguiente paso natural es la **Fase 2A**: máquina de estados, sincronización entre solicitud/cotización/pago/muestra/orden/informe, autorización por propietario y endpoints `/mias`.
