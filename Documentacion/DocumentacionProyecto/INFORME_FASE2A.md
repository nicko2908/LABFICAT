# Informe de cierre — Fase 2A

**Proyecto:** LABFICAT Backend
**Rama:** `feature/fase-2a`
**Base:** `origin/dev` (`3c332df`)
**Fecha:** 22 de octubre de 2026
**Estado:** Fase 2A cerrada funcionalmente y probada

---

## 1. Resumen

La Fase 2A queda implementada de punta a punta:

```text
solicitud -> cotizacion -> cupon -> pago -> muestra -> orden ->
resultados -> validacion -> informe -> encuesta -> descarga -> envio
```

Incluye:

- transacciones de MongoDB en operaciones multi-documento,
- máquina de estados,
- sincronización entre modelos,
- autorización por propietario,
- endpoints `/mias` y `/mios` para el cliente,
- pruebas unitarias, de integración y E2E.

**Resultado de pruebas:** 95 pruebas, 95 correctas, 0 fallos.

---

## 2. Commits de la Fase 2A

| Commit | Contenido |
|---|---|
| `6080358` | Base de transacciones y arnés de pruebas |
| `de880d5` | Máquina de estados |
| `92a26d1` | Slice solicitud → cotización |
| `641c379` | Slice cupón → pago |
| `07b8a76` | Slice muestra → orden → validación |
| `6930e2a` | Slice informe → encuesta → descarga |
| `cierre` | Prueba E2E y documentación de cierre |

La rama quedó publicada en `origin/feature/fase-2a`.

---

## 3. Flujo funcional

### 3.1 Solicitud y cotización

- El cliente crea su solicitud; el `cliente` se deriva del token.
- El coordinador crea una cotización solo para solicitudes `Registrada`.
- Se validan análisis, duplicados y tarifas.
- Cliente interno: tarifa 0.
- Cliente externo: tarifa enviada o `tarifa_externo`.
- Aceptar o rechazar la cotización transiciona la solicitud.
- Todo ocurre en una transacción con historial.

### 3.2 Cupón y pago

- Solo clientes externos requieren cupón.
- Un cupón por cotización aceptada.
- El valor coincide con el total de la cotización.
- Generar el cupón calcula su vencimiento.
- El cliente carga el soporte de pago.
- El coordinador aprueba o rechaza.
- Aprobar marca el cupón `UTILIZADO` y la solicitud `Pago aprobado`.
- Rechazar permite reenviar el soporte.

### 3.3 Muestra y orden

- Cliente externo: muestra solo después de `Pago aprobado`.
- Cliente interno: muestra después de `Aceptada`.
- Se valida tipo de muestra, unidad y cantidad mínima.
- Aceptar la muestra pasa la solicitud a `En analisis`.
- Una muestra rechazada permite reintentar.
- La orden solo se crea sobre muestra aceptada.
- El análisis debe pertenecer a la solicitud.
- No se permiten órdenes activas duplicadas.
- Estados: `PENDIENTE -> EN_PROCESO -> FINALIZADA` o `INVALIDADA`.
- Para finalizar se requieren todos los resultados.
- Una orden invalidada puede repetirse.

### 3.4 Informe y calidad

- El informe solo se genera con órdenes activas finalizadas.
- Debe existir una orden finalizada por cada análisis de la solicitud.
- Generar el informe pasa la solicitud a `Informe listo`.
- Registrar el envío pasa la solicitud a `Finalizada`.
- La encuesta es única por solicitud.
- La descarga se bloquea sin encuesta.
- La descarga registra `fecha_descarga`.

---

## 4. Endpoints principales

### Solicitudes y cotizaciones

- `POST /api/v1/solicitudes`
- `GET /api/v1/solicitudes/mias`
- `GET /api/v1/solicitudes/:id`
- `GET /api/v1/solicitudes/:id/historial`
- `PATCH /api/v1/solicitudes/:id/estado`
- `POST /api/v1/cotizaciones`
- `GET /api/v1/cotizaciones/mias`
- `GET /api/v1/cotizaciones/:id`
- `PATCH /api/v1/cotizaciones/:id/decision`

### Cupones y pagos

- `POST /api/v1/cupones`
- `PATCH /api/v1/cupones/:id/generar`
- `GET /api/v1/cupones/mios`
- `GET /api/v1/cupones/:id`
- `POST /api/v1/pagos`
- `PUT /api/v1/pagos/:id/reenviar`
- `PATCH /api/v1/pagos/:id/validar`
- `GET /api/v1/pagos/mios`
- `GET /api/v1/pagos/:id`

### Muestras, órdenes y trazabilidad

- `POST /api/v1/muestras`
- `GET /api/v1/muestras/mias`
- `GET /api/v1/muestras/:id`
- `POST /api/v1/ordenes`
- `GET /api/v1/ordenes/mias`
- `GET /api/v1/ordenes/:id`
- `PATCH /api/v1/ordenes/:id/estado`
- `PUT /api/v1/ordenes/:id/resultados`
- `POST /api/v1/ordenes/:id/repetir`
- `POST /api/v1/trazabilidad/seguimiento`
- `GET /api/v1/trazabilidad/muestra/:muestraId`
- `POST /api/v1/trazabilidad/validaciones`

### Informes y encuestas

- `POST /api/v1/informes`
- `PATCH /api/v1/informes/:id/envio`
- `PATCH /api/v1/informes/:id/descarga`
- `GET /api/v1/informes/mios`
- `GET /api/v1/informes/:id`
- `POST /api/v1/encuestas`
- `GET /api/v1/encuestas/mias`
- `GET /api/v1/encuestas/:id`
- `GET /api/v1/encuestas/resumen/global`

---

## 5. Transacciones y estados

- `conTransaccion` centraliza `withTransaction`.
- Operaciones multi-documento usan sesión:
  - cotización + solicitud + historial,
  - soporte + cupón + solicitud + historial,
  - muestra + prioridad + solicitud + historial,
  - validación + orden,
  - informe + solicitud + historial,
  - envío + solicitud + historial.
- Actualizaciones condicionales para evitar dobles transiciones.
- Rollback probado en transacciones y en el flujo de solicitud.

---

## 6. Autorización

- `verificarPropietarioSolicitud`
- `verificarPropietarioCotizacion`
- `verificarPropietarioCupon`
- `verificarPropietarioSoportePago`
- `verificarPropietarioMuestra`
- `verificarPropietarioOrden`
- `verificarPropietarioInforme`
- `verificarPropietarioEncuesta`

Reglas:

- El coordinador accede a todo.
- El analista accede a muestras, órdenes y trazabilidad.
- El cliente solo accede a sus propios recursos.
- Acceso ajeno: `403`.

---

## 7. Pruebas

| Archivo | Cobertura |
|---|---|
| `tests/smoke.test.js` | Arranque y rutas básicas |
| `tests/fase1.test.js` | Tipología, booleanos y regex |
| `tests/estados.test.js` | Transiciones |
| `tests/integracion/transacciones.test.js` | Commit y rollback |
| `tests/integracion/estados.test.js` | Transiciones con base |
| `tests/integracion/solicitud-cotizacion.test.js` | Slice 1 |
| `tests/integracion/cupon-pago.test.js` | Slice 2 |
| `tests/integracion/muestra-orden.test.js` | Slice 3 |
| `tests/integracion/informe-encuesta.test.js` | Slice 4 |
| `tests/integracion/e2e-fase2a.test.js` | Flujo completo |

Resultado:

```text
tests 95
pass 95
fail 0
```

### Ejecución local

```powershell
cd Backend
$env:MONGOMS_SYSTEM_BINARY="C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
npm test
```

Si no se define `MONGOMS_SYSTEM_BINARY`, la primera ejecución descarga el
binario de MongoDB para `mongodb-memory-server`.

---

## 8. Pendientes fuera de la Fase 2A

Estos puntos corresponden a Fase 3 / Fase 4:

- uploads reales con Multer,
- storage unificado para soportes, evidencias, informes y rótulos,
- generación real de PDF, Excel y QR,
- plantillas de correo y notificaciones,
- auditoría automática,
- jobs de cupón, recordatorio y limpieza de tokens,
- helmet, rate limit y CORS por lista blanca,
- recuperación de contraseña por correo,
- OpenAPI,
- CI,
- frontend.

---

## 9. Estado Git

- Rama: `feature/fase-2a`
- Base: `origin/dev`
- `dev` no ha sido modificada.
- Siguiente paso: abrir PR `feature/fase-2a -> dev`, revisar y hacer merge.

---

## 10. Conclusión

La Fase 2A está cerrada funcionalmente. El backend ya cubre el flujo completo del
negocio con transacciones, estados, permisos y pruebas E2E. Lo que queda es la
capa de producción: archivos, notificaciones, auditoría, jobs, seguridad,
documentación y despliegue.
