Informe de revisión — LABFICAT Backend
Fecha: 21 de octubre de 2026  
Alcance: backend completo (Backend/src, rutas, controladores, modelos, servicios, middlewares, jobs, seeds, pruebas, configuración), documento CORRECCIONES_LABFICAT.md, modelo SQL y estado del repositorio.  
Modo: revisión de solo lectura; no se modificó ningún archivo.
1. Veredicto ejecutivo
El backend arranca, importa correctamente y pasa la prueba de humo (npm test: 2/2). La base arquitectónica está bien encaminada: modelos completos, rutas coherentes, controladores con manejo de errores y respuestas uniformes.
Sin embargo, no está listo para un flujo funcional completo:
- El registro de clientes está bloqueado por la regla tipologia required.
- El flujo solicitud → cotización → pago → muestra → orden → informe no se sincroniza entre modelos; los estados quedan desalineados.
- Varias operaciones del cliente no verifican propiedad del recurso (IDOR).
- Archivos, PDFs, notificaciones, auditoría, jobs y validadores son stubs.
- Hay errores de ejecución reproducibles que devuelven 500 en lugar de 400.
- La prueba automatizada depende de .env y del directorio actual, por lo que fallará en CI tal como está planteada.
La propuesta de corrección es técnicamente correcta en su mayoría, pero está desactualizada en algunos puntos y sobredimensionada en las fases 2 y 3. Es viable aplicarla, pero no como un “big bang”: conviene reordenarla, dividir fases y añadir una fase de validación/migración que hoy no existe.
Fase propuesta	Viabilidad	Esfuerzo aproximado*	Veredicto
Fase 0 — Arranque	90 %	0,5–1 día	Cerrada en código; verificación contra Atlas pendiente
Fase 1 — Compatibilidad	90 %	3–5 días	Muy viable. Hacer primero.
Compatibilidad SQL	Condicional	2–4 días	Solo si hay datos legados reales
Fase 2 — Flujo y permisos	65 %	10–15 días	Viable si se divide en 2A y 2B
Fase 3 — Archivos, correo, auditoría, jobs	55 %	10–15 días	Viable con decisiones previas; dividir
Fase 4 — Pruebas, OpenAPI, CI, frontend	70 %	5–10 días (+ frontend aparte)	Viable después de fases 1–2
\* Estimación gruesa para un desarrollador con conocimiento del código; no incluye frontend.
Conclusión: el plan es viable con ajustes. Aprobaría ya la Fase 1, añadiría una Fase 1.5 de validadores/errores, dividiría la Fase 2 en comportamiento y refactor, y sacaría el frontend del alcance del backend.
2. Alcance y método
2.1 Qué se revisó
- Todos los archivos JS de Backend/src y Backend/tests.
- package.json, package-lock.json, .env.example y claves de .env (sin exponer secretos).
- CORRECCIONES_LABFICAT.md, Backend/README.md y README.md.
- ModeloCorregidoLABFICAT.sql en las tablas relevantes.
- Estado de Git: ramas, commits y diferencias.
2.2 Verificaciones ejecutadas
Verificación	Resultado
npm test desde Backend	✅ 2 pruebas, 2 correctas
node --check sobre todos los JS de src	✅ Sin errores de sintaxis
npm ls --depth=0	✅ 10 dependencias, sin faltantes
Importación de app.js sin MongoDB	✅ Funciona
new RegExp('[')	✅ Lanza SyntaxError
Boolean('false')	✅ Devuelve true
Cliente.validateSync() con tipologia: null	✅ Path tipologia is required
Tipologia.findById('abc')	✅ Lanza CastError
node --test desde otro directorio	❌ Falla por falta de JWT_SECRET/MONGO_URI
2.3 Limitación importante
No fue posible verificar la base de datos Atlas desde este entorno:
- Node resolvió querySrv con ECONNREFUSED.
- PowerShell sí resolvió el SRV del clúster.
- Por tanto, no pude comprobar el seed, los índices ni el estado real de los datos.
Esto parece una restricción de red del sandbox, no un fallo del proyecto. Queda pendiente re-ejecutar npm run seed, login y consultas en una máquina con acceso a Atlas. Tampoco se pudo verificar el bucket firmas de Supabase.
3. Estado real del backend por módulo
Módulo	Controlador	Rutas	Servicios	Estado real
Auth	Login, registro, perfil, cambio de contraseña	✅	Stub	Funciona, con brechas de validación y rol
Clientes	CRUD, activar/desactivar	✅	Stub	Funciona, pero bloqueado por tipología
Catálogos	Tipologías, tipos de muestra, parámetros, etapas, análisis, configuración	✅	Stub	CRUD funcional; mass assignment y booleanos
Solicitudes	Crear, listar, editar, cambiar estado, historial	✅	Stub	Sin máquina de estados ni propiedad
Cotizaciones	Crear, editar, decidir, descargar firma	✅	Stub	Firma depende de Supabase; sin propiedad
Cupones	Crear, generar, recordatorios, estado	✅	Stub	Sin vencimiento automático ni unicidad por cotización
Pagos	Cargar, reenviar, validar	✅	Stub	Ruta de archivo viene del body; no sincroniza estados
Muestras	Crear, editar, priorizar, rotular	✅	Stub	Mass assignment; no genera PDF real
Órdenes	Crear, estado, resultados, repetir	✅	Stub	Sin reglas de transición ni validación de parámetros
Informes	Generar, enviar, descargar	✅	Stub	No genera ni entrega PDF; no actualiza solicitud
Encuestas	Crear, listar, resumen	✅	Stub	Sin verificación de propiedad; mass assignment
Reclamaciones	Crear, evidencias, estado	✅	Stub	Sin propiedad, sin límite de evidencias ni plazo
Trazabilidad	Seguimiento, línea de tiempo, validaciones	✅	Stub	Sin reglas; CastError no traducido
Auditoría	Listar, registrar, recuperación	✅	Stub	Token de recuperación en la respuesta; sin middleware
Reportes	Agregaciones	✅	Stub	Fechas inválidas producen resultados silenciosamente erróneos
Uploads	—	—	Stub	No implementado
Generadores PDF/Excel/QR	—	—	Stub	No implementados; dependencias ausentes
Notificaciones	—	—	Stub	No implementadas
Jobs	—	—	Stub	No activados
Validadores	—	—	Stub	Sin capa de validación de entrada
4. Errores de ejecución confirmados
4.1 Errores que devuelven 500
#	Endpoint / área	Causa	Evidencia	Corrección
1	POST /auth/registro con tipologia inválida	TipologiaPoblacional.findById() lanza CastError; traducirErrorMongoose de auth no traduce CastError	Código auth.controller.js + prueba local de Mongoose	Añadir CastError al traductor o centralizarlo
2	GET /clientes?search=[	new RegExp('[', 'i') lanza SyntaxError	Reproducido localmente	Helper escaparRegex + límite de longitud
3	GET /solicitudes?search=[	Igual	Código	Igual
4	GET /muestras?search=[	Igual	Código	Igual
5	GET /auditoria?accion=[	Igual	Código	Igual
6	GET /reclamaciones?search=[	Igual	Código	Igual
7	GET /catalogos/tipologias?search=[	Igual; además es público	Código	Igual
8	GET /catalogos/parametros?search=[	Igual	Código	Igual
9	GET /catalogos/analisis?search=[	Igual	Código	Igual
10	PUT /cotizaciones/:id con detalle no arreglo	req.body.detalle.map lanza TypeError	Código cotizaciones.controller.js	Validar Array.isArray(detalle)
11	GET /auditoria/:id con id inválido	CastError no traducido	Código auditoria.controller.js	Centralizar traducción
12	POST /auditoria con usuario inválido	CastError no traducido	Código	Igual
13	GET /auditoria?desde=... con fecha inválida	CastError no traducido	Código	Validar fecha
14	POST /trazabilidad/seguimiento con muestra/etapa inválida	CastError no traducido	Código trazabilidad.controller.js	Igual
15	GET /trazabilidad/muestra/:id inválido	CastError no traducido	Código	Igual
16	POST /trazabilidad/validaciones con orden inválida	CastError no traducido	Código	Igual
Los controladores de auth, auditoria y trazabilidad son los únicos que no traducen CastError. Los demás sí lo hacen, lo que demuestra que el patrón existe pero se aplicó de forma inconsistente.
4.2 Errores lógicos confirmados
#	Área	Comportamiento actual	Impacto
1	Cliente.tipologia	required: true, pero auth.registrar y clientes.crear envían null si no llega tipología	Registro sin tipología falla con 400 y rollback
2	PATCH /catalogos/*/estado	Boolean('false') === true	Si el frontend envía formulario o string, “desactivar” activa
3	Filtros ?activo=	Solo 'true' se interpreta como verdadero; '1' no	Comportamiento inconsistente
4	GET /clientes	El comentario documenta filtro activo, pero no se implementa	El coordinador no puede filtrar activos/inactivos
5	POST /auth/registro	No exige mínimo de contraseña; cambio y recuperación sí exigen 8	Inconsistencia de seguridad
6	GET /reportes/* con fechas inválidas	new Date('x') se serializa como epoch	Reportes vacíos o incorrectos sin error
7	GET /auditoria con fechas inválidas	CastError → 500	Error de ejecución
8	Roles en JWT	auth.middleware usa payload.rol y no verifica el rol actual en BD	Un usuario degradado conserva permisos hasta 8 h
9	Recuperación de contraseña	Si el correo existe devuelve token; si no, mensaje genérico	Enumera cuentas y expone el token
10	solicitarRecuperacion	No invalida tokens anteriores ni tiene rate limit	Acumulación de tokens y abuso
4.3 Errores de integridad de datos
#	Área	Problema
1	Flujo de cotización	Aceptar/rechazar no actualiza Solicitud.estado
2	Flujo de pago	Validar soporte no actualiza cupón a UTILIZADO ni solicitud a Pago aprobado/rechazado
3	Flujo de muestra	Crear muestra no valida pago aprobado ni tipo de muestra del análisis
4	Flujo de orden	No valida que el análisis pertenezca a la solicitud; no valida parámetros del análisis
5	Flujo de informe	Genera informe sin exigir órdenes finalizadas/validadas; no actualiza solicitud a Informe listo
6	Flujo de encuesta	Permite responder antes de tiempo y sobre solicitudes ajenas
7	Cupón	No hay índice único por cotizacion; se pueden crear varios cupones
8	Orden	No hay unicidad por muestra/análisis/iteración; repetir no invalida la orden original
9	Validación	Se puede aprobar una orden PENDIENTE sin resultados
10	Rollback de registro	Si falla después de crear Cliente, se borra el Usuario pero queda el Cliente huérfano
11	Códigos consecutivos	Solicitud, Muestra y Reclamacion generan el consecutivo con consulta + inserción; dos peticiones concurrentes pueden chocar
12	Transacciones	Las operaciones multi-documento no usan sesión/transacción
5. Brechas funcionales y de seguridad
5.1 Flujo de negocio
Hoy los controladores permiten saltos de estado arbitrarios:
- PATCH /solicitudes/:id/estado acepta cualquier estado del enum, sin matriz de transición.
- PATCH /ordenes/:id/estado permite volver de FINALIZADA a PENDIENTE.
- PATCH /reclamaciones/:id/estado permite reabrir una reclamación resuelta.
- POST /cupones/:id no impone “un cupón por cotización”.
- No se exige que el cupón sea solo para cliente EXTERNO.
- No se compara el valor del cupón con el total de la cotización.
- No se aplica tarifa 0 a clientes internos.
- No se valida que los análisis estén activos.
- No se valida el mínimo de muestra (cantidad_minima) ni el tipo de muestra del análisis.
5.2 Autorización por propietario (IDOR)
Estos endpoints validan el rol, pero no que el recurso pertenezca al cliente autenticado:
Endpoint	Riesgo
PATCH /cotizaciones/:id/decision	Un cliente puede aceptar/rechazar la cotización de otro
POST /pagos	Un cliente puede cargar soporte para el cupón de otro
PUT /pagos/:id/reenviar	Un cliente puede reenviar el soporte de otro
PATCH /informes/:id/descarga	Un cliente puede registrar descarga de un informe ajeno
POST /encuestas	Un cliente puede responder la encuesta de otra solicitud
POST /reclamaciones	Un cliente puede reclamar sobre una solicitud ajena
POST /reclamaciones/:id/evidencias	Un cliente puede agregar evidencias a una reclamación ajena
POST /solicitudes	Un cliente puede enviar el cliente de otro en el body
Además, no existe un helper verificarPropietario ni una resolución centralizada Usuario → Cliente.
5.3 Endpoints de lectura para el cliente
No existen:
- GET /solicitudes/mias
- GET /cotizaciones/mias
- GET /cupones/mios
- GET /pagos/mios
- GET /informes/mios
- GET /trazabilidad/muestra/:id con filtro por propietario
El cliente no puede consultar su propio flujo sin usar endpoints de coordinador. Esto bloquea cualquier frontend funcional.
5.4 Archivos y generadores
- upload.middleware.js es un stub.
- storage.service.js solo implementa firma (subirFirma/descargarFirma); no hay subir, descargar, eliminar genéricos.
- ruta_archivo, ruta_pdf y firma_base64 se aceptan desde el body sin validar contenido real.
- No se valida la firma PNG (solo que el buffer no esté vacío).
- utils/generadores/pdf.js, excel.js, qr.js y codigoMuestra.js son stubs.
- No están instaladas las dependencias pdfkit, exceljs, qrcode ni multer.
- No existe carpeta storage/ ni estrategia de servicio de archivos.
- PATCH /informes/:id/descarga solo registra la fecha; no devuelve el PDF.
- POST /muestras/:id/rotulo guarda una ruta enviada por el cliente; no genera el rótulo.
5.5 Notificaciones, auditoría y jobs
- services/notificacion/* son stubs.
- mailer.js crea el transporte, pero MAIL_HOST es smtp.ejemplo.com y MAIL_PASS es ********.
- La recuperación de contraseña devuelve el token en la respuesta en lugar de enviarlo por correo.
- audit.middleware.js es un stub y no está montado en ninguna ruta.
- POST /auditoria permite a un coordinador registrar acciones de cualquier usuario; no es una bitácora automática.
- Los tres jobs (recordatorioCupon, vencimientoCupon, limpiezaTokens) están vacíos y comentados en server.js.
- No hay TTL index en TokenRecuperacion; los tokens se acumulan.
5.6 Seguridad
Control	Estado
JWT_SECRET	Sigue siendo el valor de plantilla (cambiar_por_una_clave_larga_y_aleatoria); el backend solo advierte en desarrollo
helmet	No instalado ni usado
Rate limit	No existe
CORS	Origen único http://localhost:5173; si se deja por defecto, * con credentials: true es inválido
trust proxy	No configurado
Validación de entrada	validators/* y validate.middleware.js son stubs
Límite de body	10 MB global, sin control específico para firmas
Roles	Se confía en el rol del token, no en el rol actual de BD
Recuperación	Token en respuesta + enumeración de correo
Auditoría	No automática
Secretos	JWT_SECRET y MAIL_PASS pendientes de rotar
5.7 Datos, migración y seeds
- Cliente.tipologia ya es required: true y está commiteado; el documento dice que sigue sin commitear, lo cual está desactualizado.
- El seed siembra tipologías solo si la colección está vacía. Si la base ya tiene 12 tipologías, no agregará NINGUNA. Esto invalida el paso “sembrar NINGUNA” del plan tal como está escrito.
- El seed de configuración hace $set en cada ejecución; puede sobrescribir cambios hechos por el coordinador.
- sembrarAnalisis se salta todo si existe al menos un análisis; no es convergente.
- autoIndex está activo en desarrollo. Si la base existente tiene datos que violan un índice único (por ejemplo, NIT duplicados o tipologías que difieren solo en mayúsculas), la creación del índice puede fallar.
- La compatibilidad con el modelo SQL es condicional: si la base actual se sembró desde Mongoose, no aplica; si se importó del SQL, hay que migrar apellidos, tipo_documento, acepta_tratamiento_datos_terminos_condiciones, id_tipologia NULL, id_estado y fecha_creacion.
5.8 Pruebas, CI y documentación
- Solo existen 2 pruebas de humo.
- tests/smoke.test.js importa app.js, que a su vez importa env.js; env.js exige MONGO_URI y JWT_SECRET. Si se ejecuta fuera de Backend o sin .env, falla.
- No hay .github/workflows, lint, ni script de integración.
- No hay OpenAPI/Swagger.
- Backend/README.md describe servicios, uploads y generadores que en realidad son stubs.
- No existe carpeta Frontend/; el documento dice que está vacía.
6. Revisión de la propuesta de corrección
6.1 Lo que está bien
- El inventario de problemas es amplio y, en su mayoría, correcto.
- La priorización por fases es razonable: primero compatibilidad, luego flujo, luego archivos/notificaciones, al final pruebas.
- La solución de tipología con codigo: 'NINGUNA' es acertada: evita depender del nombre visible.
- Los helpers parseBoolean y escaparRegex son necesarios y de bajo riesgo.
- La autorización por propietario y los endpoints /mias son imprescindibles.
- La lista de compatibilidad SQL es útil si hay datos legados.
- La idea de servicios reales es correcta arquitectónicamente.
6.2 Puntos desactualizados o inexactos
Afirmación del documento	Estado real
“Rama actual: feature/models”	La rama local actual es dev; dev está 1 commit adelante de origin/dev; el HEAD solo está en origin/feature/models
“El cambio de Cliente.tipologia sigue sin commitear”	Ya está commiteado en dev
“Frontend/ está vacía”	La carpeta no existe
“storage.service.js debe implementar subir/descargar/eliminar”	subirFirma y descargarFirma ya existen; faltan los genéricos
“.env con Supabase”	Correcto: SUPABASE_URL y API_KEY_SUPABASE están presentes
“Fase 0 verificada”	El smoke test pasa, pero la conexión a Atlas no se pudo reproducir desde este entorno
6.3 Hallazgos que el documento no cubre
 1. CI roto por dependencia de .env: npm test no funciona en un entorno limpio sin .env.
 2. CastError sin traducir en auth, auditoria y trazabilidad → 500.
 3. PUT /cotizaciones/:id con detalle no arreglo → TypeError → 500.
 4. Mass assignment en muestras.crear y muestras.actualizar; el documento solo menciona catálogos y encuesta.
 5. GET /clientes ignora el filtro activo que documenta su propio comentario.
 6. Contraseña mínima inconsistente entre registro, cambio y recuperación.
 7. Enumeración de cuentas en recuperación: respuesta distinta si el correo existe.
 8. Rol obsoleto en JWT: no se consulta el rol actual ni su estado.
 9. Rollback incompleto en registro: puede dejar Cliente huérfano.
10. Falta de transacciones en operaciones multi-documento.
11. Cupón sin unicidad por cotización.
12. Parámetros de orden no restringidos al análisis.
13. Validación de orden pendiente antes de aprobar.
14. Seed no convergente y NINGUNA no se agrega a bases existentes.
15. Riesgo de índices por autoIndex y collation.
16. Fechas inválidas en reportes producen resultados silenciosamente erróneos.
17. Claves de configuración en BD no usadas (CUPON_VIGENCIA_DIAS, etc.); el código lee env.
18. No hay verificación de salud de MongoDB en /health.
19. CORS por defecto * con credenciales.
20. Jobs no se detienen en el apagado ordenado.
6.4 Revisión de las soluciones propuestas
Propuesta	Viabilidad	Observación
codigo único y sparse en TipologiaPoblacional	Alta	Correcto; añadir migración/upsert, no solo seed
Política híbrida (autorregistro estricto, tercero con fallback)	Alta	Requiere decisión de negocio; recomiendo registrar si fue fallback para medir calidad
parseBoolean	Alta	Aplicar también a filtros ?activo=
escaparRegex	Alta	Añadir longitud máxima y usar en los 8 sitios detectados
Listas blancas	Alta	Incluir muestras.crear/actualizar, no solo catálogos
Unificar JWT	Alta	Trivial; usar utils/jwt.firmar
Servicios reales	Media	No es necesario reescribir todo; un flujo.service.js orquestador resuelve el 80 %
Verificación de propietario	Alta	Requiere helper Usuario → Cliente y pruebas por rol
Endpoints /mias	Alta	Cuidar orden de rutas frente a /:id
Uploads con Multer	Media	Añadir dependencia, validar MIME real, no confiar en extensión
Storage unificado	Media	Decisión pendiente: local vs Supabase
Generadores PDF/Excel/QR	Media-baja	Dependencias y plantillas vacías; es la parte con más incertidumbre
Notificaciones	Media	Bloqueado por SMTP real; sin él, RF-27 no se cierra
Auditoría	Alta	Sencillo; decidir si un fallo de auditoría bloquea la petición
Jobs	Alta	Sencillo; cuidado con múltiples instancias y zona horaria
Seguridad	Alta	Hacerla antes de la Fase 3, no después
Pruebas de integración	Media	mongodb-memory-server descarga binario; puede fallar en CI restringido
OpenAPI/CI	Alta	Añadir después de estabilizar el flujo
Frontend	Baja dentro de este plan	Es un proyecto aparte; no debería bloquear el backend
7. Viabilidad detallada por fase
Fase 0 — Arranque reproducible
Veredicto: cerrada en código, no reproducible en este entorno. Viabilidad 90 %.
Lo que está bien:
- env.js valida MONGO_URI y JWT_SECRET.
- Supabase es perezoso y devuelve 503 solo al usarse.
- app.js importa models/index.js.
- La vigencia del cupón está centralizada en env.
- El smoke test pasa.
Pendiente:
- Re-ejecutar npm run seed, login y /health contra Atlas en una máquina con acceso.
- Confirmar que el bucket firmas existe y que la key tiene permisos.
- Rotar JWT_SECRET y MAIL_PASS.
- Definir rama de integración: hoy dev está adelante de origin/dev y el HEAD vive en origin/feature/models.
Riesgo: dar por cerrada la fase sin haber verificado la base real.
Fase 1 — Compatibilidad modelo ↔ controlador ↔ rutas
Veredicto: muy viable. Viabilidad 90 %. Es la fase con mejor relación valor/esfuerzo.
Cambios localizados:
- Tipología + NINGUNA + migración.
- parseBoolean.
- escaparRegex.
- Listas blancas.
- Unificación de JWT.
- Traducción centralizada de errores.
Condiciones para que sea viable:
1. Migración explícita, no solo seed: scripts/migraciones/001-tipologia-ninguna.js con upsert de NINGUNA y updateMany de clientes con tipologia: null.
2. Cambiar el seed de tipologías a upsert, porque hoy no agrega NINGUNA si ya existen 12.
3. Backup previo de la base.
4. Incluir los hallazgos extra: CastError en auth/auditoría/trazabilidad, .map en cotizaciones, mass assignment en muestras, validación de arrays.
5. Añadir pruebas de regresión por cada corrección.
Esfuerzo: 3–5 días.  
Riesgo principal: migración de datos e índices, no el código.
Compatibilidad con el modelo SQL
Veredicto: condicional. No bloqueante.
Solo aplica si la base actual se importó desde ModeloCorregidoLABFICAT.sql. Si el seed de Mongoose creó los datos, se puede omitir.
Si aplica, hay que migrar:
- usuario.apellidos (no existe en SQL).
- usuario.tipo_documento (VARCHAR libre vs enum).
- usuario.numero_documento (regex 6–15 dígitos).
- cliente.acepta_tratamiento_datos_terminos_condiciones.
- cliente.id_tipologia NULL.
- solicitud.id_estado (FK) → enum de Mongoose.
- usuario.fecha_creacion → createdAt.
- Posibles duplicados que rompan índices únicos.
Esfuerzo: 2–4 días, incluyendo auditoría de datos.  
Recomendación: confirmar primero si hay datos legados; si no, sacarlo del alcance.
Fase 2 — Flujo entre modelos y autorización
Veredicto: viable con recorte. Viabilidad 65 %. Es la fase más grande y riesgosa.
Dividiría en dos:
2A — Comportamiento (5–7 días):
- Máquina de estados de Solicitud, Cotizacion, CuponPago, OrdenAnalisis.
- Sincronización entre modelos en cada transición.
- Validaciones cruzadas (análisis de la solicitud, tipo de muestra, cupón externo, un cupón por cotización, pago actualiza cupón/solicitud, informe actualiza solicitud).
- Autorización por propietario.
- Endpoints /mias.
- Errores 400/403/409 uniformes.
- Transacciones en operaciones multi-documento.
2B — Refactor de servicios (5–8 días, opcional):
- Extraer lógica de controladores a services/*.
- flujo.service.js como orquestador.
Recomendación: no hacer 2B antes de 2A. El comportamiento se puede centralizar en un orquestador sin reescribir todos los servicios. El refactor completo es arquitectónicamente deseable, pero no es lo que desbloquea el producto.
Bloqueo principal: varias reglas de negocio no están definidas (qué pasa si se rechaza una cotización, si se rechaza una muestra, si se reenvía un pago, etc.). Sin esas decisiones, la máquina de estados no se puede cerrar.
Esfuerzo: 10–15 días si se incluye 2B; 5–7 días si solo 2A.
Fase 3 — Archivos, notificaciones, auditoría, jobs y seguridad
Veredicto: parcialmente viable. Viabilidad 55 %. Hay que dividirla.
3.1 Seguridad primero (1–2 días):
- helmet.
- Rate limit en login y recuperación.
- CORS por lista blanca.
- trust proxy si aplica.
- Rotar secretos.
- Validar JWT_SECRET en producción.
Es barato y de alto impacto; no tiene sentido dejarlo para el final.
3.2 Uploads y storage (3–4 días):
- Añadir multer y file-type.
- Definir storage local vs Supabase.
- Validar MIME real, tamaño y extensión.
- Servir archivos con endpoint autenticado, no express.static.
- Reemplazar rutas enviadas por el cliente.
3.3 Generadores (3–4 días):
- Añadir pdfkit, exceljs, qrcode.
- Diseñar plantillas PDF/Excel/rótulo.
- Conectar a informes, rótulos y cotizaciones.
Es la parte con más incertidumbre porque las plantillas están vacías y no hay especificación visual.
3.4 Notificaciones (2–3 días):
- Implementar services/notificacion/*.
- Configurar SMTP real o Ethereal para desarrollo.
- Enviar recuperación por correo, no devolver token.
- Plantillas.
3.5 Auditoría y jobs (2–3 días):
- Middleware de auditoría.
- Jobs de cupón, recordatorio y limpieza de tokens.
- Zona horaria America/Bogota.
- Guardia para una sola instancia.
- stop() en apagado ordenado.
Esfuerzo total: 10–15 días.  
Decisión previa obligatoria: storage, SMTP y plantillas.
Fase 4 — Pruebas, documentación, seeds QA, CI y frontend
Veredicto: viable después de fases 1–2. Viabilidad 70 %.
- Pruebas de integración: añadir mongodb-memory-server; supertest es opcional porque Node fetch ya funciona.
- Corregir el arranque de pruebas: hoy npm test depende de .env y del cwd.
- Flujo completo: solo se puede probar cuando 2A esté implementado.
- OpenAPI: swagger-ui-express + YAML/JSON.
- Seeds QA: idempotentes, con correos/códigos fijos y limpieza.
- CI: GitHub Actions, npm ci, npm test, lint; cache del binario de Mongo.
- Frontend: fuera del alcance del backend; si se incluye, son 15–20 días adicionales.
Esfuerzo: 5–10 días sin frontend.
8. Plan de trabajo recomendado
Sprint	Contenido	Duración	Entregable
0. Preparación	Backup, rama de integración, rotación de secretos, .env.test, script de migraciones, confirmar datos legados y decisiones de storage/SMTP	1–2 días	Base segura y reproducible
1. Fase 1 + 1.5	Tipología/NINGUNA/migración, parseBoolean, escaparRegex, listas blancas, CastError, arrays, JWT, validadores de auth/cliente/solicitud, pruebas de regresión	5–7 días	Registro y catálogos estables
2. Fase 2A	Máquina de estados, sincronización, validaciones cruzadas, propiedad, /mias, transacciones	5–7 días	Flujo end-to-end funcional
3. Seguridad + auditoría	Helmet, rate limit, CORS, auditoría, recuperación por correo	2–3 días	RNF-01/RNF-03/RF-27
4. Archivos	Uploads, storage local/Supabase, PDF/QR/Excel, descarga real	4–6 días	RF-11/RF-15/RF-17
5. Notificaciones + jobs	Plantillas, SMTP, cupón/recordatorio/tokens	3–5 días	RF-06/RF-24/RF-27
6. Fase 4	Integración, OpenAPI, seeds QA, CI, documentación	5–7 días	Calidad y despliegue
7. Fase 2B (opcional)	Extracción de servicios	5–8 días	Deuda técnica
Frontend	Proyecto aparte	15–20 días	Interfaz
Total backend sin 2B ni frontend: ~25–37 días.  
Con 2B: ~30–45 días.
Ruta MVP recomendada
Si el objetivo es una demo funcional:
1. Fase 1 + 1.5.
2. Fase 2A.
3. Seguridad básica.
4. Uploads locales + PDF de informe/rótulo.
5. Dejar notificaciones, jobs, auditoría automática, OpenAPI y frontend para después.
Esto entrega un flujo demostrable en aproximadamente 3–4 semanas.
9. Criterios de aceptación sugeridos
Caso	Resultado esperado
POST /auth/registro sin tipología	400 con mensaje claro
POST /auth/registro con NINGUNA	201
POST /auth/registro con tipología inválida	400, nunca 500
POST /clientes sin tipología	NINGUNA si se elige política híbrida
PATCH /catalogos/tipologias/:id/estado con "false"	activo: false
GET /clientes?search=[	400 o lista vacía, nunca 500
PUT /catalogos/... con _id/createdAt	Campos ignorados
PUT /cotizaciones/:id con detalle: "x"	400
GET /auditoria/:id con id inválido	400
Cliente A decide cotización de B	403
Transición inválida de solicitud	409
Pago aprobado	Cupón UTILIZADO + solicitud Pago aprobado
Informe sin órdenes finalizadas	409
Descarga sin encuesta	403
Descarga con encuesta	Archivo PDF
Upload >5 MB o MIME falso	400
Recuperación de contraseña	202 genérico, sin token en respuesta
npm ci && npm test en CI limpio	Pasa sin .env
10. Decisiones pendientes
 1. Tipología: ¿estricta, fallback o híbrida?  
Recomendación: híbrida, con marca de “asignada por sistema” para medir calidad.
 2. NINGUNA con codigo: sí.
 3. Storage: ¿local para PDFs/soportes y Supabase solo firmas, o todo Supabase?  
Recomendación: local para documentos, Supabase para firmas.
 4. SMTP: ¿credenciales reales o Ethereal en desarrollo? Sin SMTP no se puede cerrar RF-27.
 5. Datos legados SQL: ¿hay importación real o la base se sembró desde Mongoose? Si no hay, omitir la fase SQL.
 6. Frontend: fuera del alcance del backend o proyecto separado.
 7. Servicios: ¿refactor completo o solo orquestador?  
Recomendación: orquestador ahora, refactor después.
 8. Transacciones: usar sesiones de MongoDB Atlas en las transiciones críticas.
 9. Reglas de cupón: un cupón por cotización, solo externos, valor = total de cotización.
10. Descarga de informes: stream desde backend o URL firmada de Supabase.
11. Conclusión
El backend tiene una base sólida y un buen punto de partida, pero hoy es un esqueleto funcional parcial, no un sistema completo. La propuesta de corrección acierta en el diagnóstico y en la dirección, pero:
- está desactualizada en varios datos del repositorio;
- no incluye la migración ni el arranque de pruebas en CI;
- subestima la complejidad de la Fase 2 y 3;
- no separa comportamiento de arquitectura;
- no define criterios de aceptación ni dependencias.
Recomendación final: aplicar la Fase 1 ya, con las correcciones adicionales y la migración; después 2A; después seguridad y archivos; dejar 2B, notificaciones avanzadas, jobs y frontend para una segunda etapa. Con ese orden, el plan es viable y de bajo riesgo. Tal como está escrito, es viable pero con alta probabilidad de desbordarse en las fases 2 y 3.
Si quieres, puedo convertir este informe en un documento Markdown dentro de C:\Users\USUARIO\.opencode\plan\ o preparar el detalle de implementación de la Fase 1 (archivos, parches y pruebas) para cuando cambies a modo de ejecución.
Plan · DeepSeek V4.1 Flash 1017 · 5m 27s · 188.8 tok/s
Plan·DeepSeek V4.1 Flash 1017
~/Desktop/LABFICAT/LABFICAT:dev