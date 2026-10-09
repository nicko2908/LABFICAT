/**
 * Rutas del modulo: trazabilidad (capa de enrutado).
 * RF-12 / RF-13 / RF-26.
 *
 * - El analista registra el avance por etapa.
 * - El coordinador valida resultados; coordinador y analista consultan la
 *   linea de tiempo y el historial de validaciones.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/trazabilidad.controller.js';

const router = Router();

router.use(autenticar);

router.post('/seguimiento', permitir('analista'), ctrl.registrarSeguimiento);
router.get('/muestra/:muestraId', permitir('coordinador', 'analista'), ctrl.lineaTiempoMuestra);
router.post('/validaciones', permitir('coordinador'), ctrl.validarResultado);
router.get('/validaciones/orden/:ordenId', permitir('coordinador', 'analista'), ctrl.historialValidaciones);

export default router;
