/**
 * Rutas del modulo: reportes (capa de enrutado).
 * RF-20 / RF-24.
 *
 * Agregaciones de lectura (sin modelo propio): solo coordinador.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/reportes.controller.js';

const router = Router();

router.use(autenticar);

router.get('/solicitudes', permitir('coordinador'), ctrl.resumenSolicitudes);
router.get('/muestras', permitir('coordinador'), ctrl.resumenMuestras);
router.get('/operacion', permitir('coordinador'), ctrl.resumenOperacion);
router.get('/satisfaccion', permitir('coordinador'), ctrl.resumenSatisfaccion);

export default router;
