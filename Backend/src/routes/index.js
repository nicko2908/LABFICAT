/**
 * Enrutador principal de la API.
 * Monta un archivo de rutas por modulo bajo el prefijo versionado.
 */
import { Router } from 'express';

import authRoutes from './auth.routes.js';
import clientesRoutes from './clientes.routes.js';
import solicitudesRoutes from './solicitudes.routes.js';
import cotizacionesRoutes from './cotizaciones.routes.js';
import cuponesRoutes from './cupones.routes.js';
import pagosRoutes from './pagos.routes.js';
import muestrasRoutes from './muestras.routes.js';
import ordenesRoutes from './ordenes.routes.js';
import informesRoutes from './informes.routes.js';
import encuestasRoutes from './encuestas.routes.js';
import reclamacionesRoutes from './reclamaciones.routes.js';
import catalogosRoutes from './catalogos.routes.js';
import reportesRoutes from './reportes.routes.js';
import trazabilidadRoutes from './trazabilidad.routes.js';
import auditoriaRoutes from './auditoria.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/clientes', clientesRoutes);
router.use('/solicitudes', solicitudesRoutes);
router.use('/cotizaciones', cotizacionesRoutes);
router.use('/cupones', cuponesRoutes);
router.use('/pagos', pagosRoutes);
router.use('/muestras', muestrasRoutes);
router.use('/ordenes', ordenesRoutes);
router.use('/informes', informesRoutes);
router.use('/encuestas', encuestasRoutes);
router.use('/reclamaciones', reclamacionesRoutes);
router.use('/catalogos', catalogosRoutes);
router.use('/reportes', reportesRoutes);
router.use('/trazabilidad', trazabilidadRoutes);
router.use('/auditoria', auditoriaRoutes);

export default router;
