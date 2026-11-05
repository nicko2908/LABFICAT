Plan de integración de plantillas LABFICAT al backend
Backend nuevoLabficat · Plantillas CAT–ST–OC–F–002 v6 (cotización) y CAT–ST–MI–F–002 v2 (recepción de muestras)
Interpretación: "modelos" = las plantillas Excel estrictas; los modelos de Mongoose deben adaptarse a ellas.
1. Lo que entiendo del proyecto
Backend LABFICAT (laboratorio de alimentos del SENA en San Gil): Node + Express + Mongoose (ESM), MongoDB Atlas, Supabase para las firmas y JWT con 3 roles (cliente, analista, coordinador).
• Flujo: solicitud → cotización → pago (solo externos) → recepción de muestra → órdenes de análisis → validación → informe → encuesta → descarga.
• Estado: el README dice que la Fase 2A está cerrada, con máquina de estados, transacciones y 95 pruebas.
• Pendiente: los generadores utils/generadores/{excel,pdf}.js y las carpetas templates/ están vacíos (TODO). Ahí entra este trabajo.
• Supuestos de diseño actuales: 1 solicitud = 1 cotización = 1 muestra aceptada. Los códigos son SOL-AAAA-NNNN y LAB-AAAA-NNNN. El catálogo de ejemplo es de agua y suelo, y hay 12 tipologías.
2. Lo que dicen las plantillas
Cotización (CAT–ST–OC–F–002 v6, 0041-2026V1):
• Código NNNN-AAAA + V#.
• Datos de cliente con dirección, ciudad, departamento, cargo y contacto.
• Ítems de muestra con ensayos (código, unidades, método, técnica, cantidad, valor).
• Catálogo de 35 ensayos y 16 tipologías.
• Bloque de firma de aceptación del cliente.
Recepción de muestras (CAT–ST–MI–F–002 v2, 0015-2026):
• El código de muestra es NNNN-AAAA, no LAB-….
• Campos nuevos: municipio, dirección y lugar de toma, quién recolectó, procedimiento de muestreo, tipo, matriz, fecha y hora de recolección.
• Referencia a la cotización (con versión) y al ítem.
• Observaciones predefinidas del 1 al 7.
3. Qué se rompe (de más a menos grave)
1. Cotización 1:1 con solicitud. Cotizacion.solicitud es unique y crearCotizacion lanza "ya tiene cotización". Las plantillas usan versiones: V1, y la recepción cita 0004-2026V2.
2. Ítems. La recepción referencia "ítem 4" de una cotización, o sea que una cotización tiene varios ítems, cada uno con su muestra. Hoy el detalle es plano y hay un índice único de una muestra aceptada por solicitud. La segunda muestra fallaría porque la solicitud ya estaría En análisis. informe.service también exige todos los análisis de la solicitud en una sola muestra.
3. Códigos. Muestra.js valida ^LAB-\d{4}-\d{4}$ y hay un test que lo asserta (muestra-orden.test.js:268). Los consecutivos se calculan con findOne + 1 dentro del pre('validate'), que no es atómico y puede duplicar bajo concurrencia.
4. Analisis.nombre es único. El catálogo repite nombres: "Fenoles totales°" (#5 y #21, con distinto método), "Azúcares totales" (#11 y #16) y "Humedad" vs "Humedad miel". Además faltan código, unidades, método, técnica y el símbolo ° (Res. 1619).
5. Tipologías. El seed y el test de Fase 1 usan 12 tipologías y la regla NINGUNA. La plantilla trae 16 distintas y no incluye "Ninguna de las anteriores".
6. Tarifa 0. calcularDetalle pone 0 solo si el cliente es INTERNO. En el ejemplo, un cliente con Gmail y tipología "Aprendices SENA" sale en 0, y la lista se titula "Comunidad Beneficiaria". Parece que la gratuidad depende de la tipología, no solo del dominio del correo.
7. Datos que no existen. Faltan dirección, ciudad, departamento, cargo y contacto en Cliente. En Muestra faltan matriz, municipio, dirección y lugar de toma, recolector, procedimiento y fecha y hora de recolección. TipoMuestra tiene Agua/Sangre/Orina, pero la plantilla usa "Pasta", con la matriz "Cacao" aparte.
8. Cantidad mínima. La recepción no pide unidad ni cantidad, pero Muestra exige unidad_medida y cantidad_recibida ≥ 300.
9. PUT /cotizaciones/:id. Edita en el controlador, se salta las reglas del service (tarifa interna) y no contempla cantidad.
10. Seed. sembrarAnalisis se salta todo si la colección ya tiene datos, así que el catálogo nuevo no cargaría en una base existente.
Defectos de las plantillas (confirmar antes de tocarlas)
• I21 =SUM(I20:I20) solo suma la última fila. Con precios reales el "Costo del ítem" saldría mal.
• J29 de la recepción trae #VALUE!, y la fila 24 está oculta.
• La fecha de recepción 05/04/2026 parece mm/dd, porque la recolección fue el 2 de mayo.
• Las columnas J:U de la cotización contienen el catálogo completo con precios.
Seguridad
El zip incluye .env con credenciales reales (Mongo, SMTP, Supabase, JWT). Rotarlas y confirmar que .env y .vs/ estén en .gitignore.
4. Plan para el agente
Instrucción general: Trabaja en una rama nueva. No cambies el comportamiento existente sin actualizar sus pruebas. Al final de cada fase corre npm test y reporta qué cambió. Las plantillas Excel se copian a src/templates/excel/ y nunca se editan a mano; el código solo escribe en las celdas de entrada.
Fase 0: base
• Corre npm test y guarda el resultado como línea base.
• Copia las plantillas a src/templates/excel/.
• Agrega exceljs.
• Crea una colección contadores ({clave, valor} con findOneAndUpdate $inc, dentro de la sesión).
• Listo cuando la línea base está documentada.
Fase 1: catálogos
• Analisis: agrega codigo (Number, único), unidades, metodo, tecnica y acreditado (Boolean, se imprime como °). Quita el unique de nombre y úsalo en codigo.
• Seed y migración 002: carga los 35 ensayos con upsert por codigo, precio 15000. Reemplaza los ejemplos de agua y suelo.
• Tipologías: carga las 16 de la plantilla con upsert. Marca NINGUNA como inactiva o mapéala a "Persona natural" (supuesto 1).
• TipoMuestra: nuevo seed con las presentaciones (Pasta, Polvo, Líquido, Grano, etc.).
• Matriz: agrega matriz a Muestra como texto libre con sugerencias (supuesto 4).
• Observaciones predefinidas: crea la constante OBSERVACIONES_RECEPCION con las 7.
• Listo cuando el seed es idempotente y reconoce los 35 ensayos.
Fase 2: datos del cliente
• Agrega a Cliente (o a un snapshot en Solicitud): direccion, ciudad, departamento, cargo y persona_contacto.
• Congela esos datos en la cotización al emitirla.
• Agrega exento_pago a TipologiaPoblacional, o un override explícito, y úsalo en calcularDetalle. Sin pago si valor_total = 0.
• Listo cuando el cliente Gmail + Aprendices SENA genera cotización en 0 sin pasar por pago.
Fase 3: códigos
• Muestra: NNNN-AAAA, con contador muestra-AAAA. El validador acepta el formato nuevo y también el LAB- para registros viejos.
• Cotización: codigo_cotizacion NNNN-AAAA con contador cotizacion-AAAA, más version. El código completo se muestra como NNNN-AAAAV#.
• Elimina la lógica findOne + 1 de los hooks.
• Actualiza el test de muestra-orden.test.js:268.
• Listo cuando una prueba concurrente de 20 creaciones no duplica códigos.
Fase 4: cotización versionada con ítems
• Modelo:
    ◦ Quita el unique de solicitud.
    ◦ Agrega el índice único (solicitud, version).
    ◦ Agrega items[] con {numero, descripcion_muestra, detalle[{analisis, cantidad, tarifa_aplicada}]}.
    ◦ Agrega observaciones_propuesta, fecha_validez y subtotal.
    ◦ Agrega el estado REEMPLAZADA.
• Servicio:
    ◦ POST /cotizaciones/:id/nueva-version copia la anterior, sube la versión y marca la vieja como REEMPLAZADA.
    ◦ Solo se permite con la solicitud en Cotizada (supuesto 2).
    ◦ Solo se puede decidir la última versión.
    ◦ Mueve PUT al service. Se edita en sitio solo antes de emitir.
• Solicitud: deriva los análisis de los ítems.
• Listo cuando los tests de cotización pasan, más casos nuevos: V2 reemplaza a V1 y no se puede decidir V1.
Fase 5: muestra y recepción
• Modelo Muestra: agrega cotizacion, cotizacion_item, matriz, municipio_recoleccion, direccion_toma, lugar_toma, recolectada_por, procedimiento_muestreo (default "No Reporta"), fecha_hora_recoleccion y observaciones_predefinidas: [1..7].
• Índice único: cambia a (cotizacion, cotizacion_item) donde la recepción es ACEPTADA.
• crearMuestra:
    ◦ Acepta la solicitud en Aceptada, Pago aprobado o En análisis.
    ◦ Pasa a En análisis solo la primera vez.
    ◦ Valida que el ítem exista en la cotización aceptada.
    ◦ Si se rechaza, el motivo sale de las observaciones 1 a 6 o de la 7 con texto.
• Unidad y cantidad: unidad_medida y cantidad_recibida pasan a ser opcionales en el esquema. La validación de 300 solo aplica si vienen. No se imprimen en el acta (supuesto 3).
• informe.service y orden.service: valida análisis por ítem, no por solicitud. La solicitud pasa a Informe listo cuando todas las muestras aceptadas tienen informe.
• Listo cuando una solicitud con 2 ítems recorre el flujo completo hasta Finalizada.
Fase 6: generadores Excel
• generarCotizacionXlsx(cotizacionId):
    ◦ Escribe la fila "Pegue" J2:U2 en este orden: fecha, código, cliente, NIT con puntos, dirección, ciudad, departamento, tipología, contacto, teléfono como texto, correo con trim().
    ◦ Escribe B13 (cargo), B14 (validez), A16 (descripción del ítem) y las filas de ensayos (código, ensayo con °, unidades, método, técnica, cantidad, valor).
    ◦ Incrusta la firma del cliente aceptada (desde Supabase) y el nombre del responsable desde ConfiguracionSistema.
• generarActaRecepcionXlsx(muestraId):
    ◦ Escribe C7:H10.
    ◦ Escribe la fila 14. C14 y E14 son fórmulas que copian al solicitante, así que se sobrescriben solo si difieren.
    ◦ Marca las observaciones.
    ◦ Escribe J27 y J28, con el usuario que recibe tomado de Usuario.
• Filas dinámicas: hay solo 3 filas de ensayo y las imágenes están ancladas. Haz un spike de inserción de filas con exceljs. Si no conserva celdas combinadas ni imágenes, usa una capacidad fija con filas ocultas.
• Endpoints: GET /cotizaciones/:id/excel y GET /muestras/:id/acta-recepcion. Los archivos se nombran con el código.
• Prueba de verificación: genera con datos de ejemplo y compara celdas contra 0041-2026V1.xlsx y 0015-2026.xlsx.
• Listo cuando los dos archivos regenerados coinciden celda a celda con los de ejemplo.
Fase 7: migración y cierre
• Migración 003 (idempotente, con modo dry-run):
    ◦ Cotizaciones existentes: version = 1, un ítem con el detalle actual y codigo_cotizacion por año.
    ◦ Muestras existentes: cotizacion_item = 1.
    ◦ Clientes: campos nuevos en null.
    ◦ Tipologías de clientes actuales: mapeo al catálogo nuevo.
• Actualiza README, .env.example y los tests de Fase 1 y E2E.
• Listo cuando npm test pasa completo.
5. Supuestos tomados (corregir los que estén mal)
1. "Ninguna de las anteriores" se mapea a "Persona natural".
2. Una nueva versión de cotización solo se permite antes de que el cliente acepte.
3. Unidad y cantidad se siguen capturando internamente, pero no se imprimen en el acta.
4. La matriz es texto libre, no un catálogo.
5. La tarifa 0 depende de la tipología (exento_pago), no solo del correo.
6. Las fórmulas de las plantillas (como I21) se corrigen en el código, no a mano en el Excel.
