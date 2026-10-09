/**
 * Rutas del modulo: ordenes (capa de enrutado).
 * RF-12 / RF-13 / RF-14.
 *
 * - El analista crea la orden, avanza el estado y registra resultados.
 * - El coordinador gestiona, valida y repite analisis.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/ordenes.controller.js';

const router = Router();

router.use(autenticar);

router.get('/', permitir('coordinador', 'analista'), ctrl.listar);
router.get('/:id', permitir('coordinador', 'analista'), ctrl.obtenerPorId);
router.post('/', permitir('analista', 'coordinador'), ctrl.crear);
router.patch('/:id/estado', permitir('analista', 'coordinador'), ctrl.avanzarEstado);
router.put('/:id/resultados', permitir('analista'), ctrl.registrarResultados);
router.post('/:id/repetir', permitir('coordinador'), ctrl.repetir);

export default router;
