/**
 * Enrutador principal de la API.
 * Monta un archivo de rutas por modulo bajo el prefijo versionado.
 */
const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/clientes', require('./clientes.routes'));
router.use('/solicitudes', require('./solicitudes.routes'));
router.use('/cotizaciones', require('./cotizaciones.routes'));
router.use('/cupones', require('./cupones.routes'));
router.use('/pagos', require('./pagos.routes'));
router.use('/muestras', require('./muestras.routes'));
router.use('/ordenes', require('./ordenes.routes'));
router.use('/informes', require('./informes.routes'));
router.use('/encuestas', require('./encuestas.routes'));
router.use('/reclamaciones', require('./reclamaciones.routes'));
router.use('/catalogos', require('./catalogos.routes'));
router.use('/reportes', require('./reportes.routes'));
router.use('/trazabilidad', require('./trazabilidad.routes'));
router.use('/auditoria', require('./auditoria.routes'));

module.exports = router;
