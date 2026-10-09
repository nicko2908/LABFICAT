/**
 * Rutas del modulo: muestras (capa de enrutado).
 * RF-09 / RF-10 / RF-11 / RF-22.
 *
 * - Lectura: coordinador y analista.
 * - Recepcion, edicion, priorizacion y rotulo: solo coordinador.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/muestras.controller.js';

const router = Router();

router.use(autenticar);

router.get('/', permitir('coordinador', 'analista'), ctrl.listar);
router.get('/:id', permitir('coordinador', 'analista'), ctrl.obtenerPorId);
router.post('/', permitir('coordinador'), ctrl.crear);
router.put('/:id', permitir('coordinador'), ctrl.actualizar);
router.patch('/:id/prioridad', permitir('coordinador'), ctrl.cambiarPrioridad);
router.post('/:id/rotulo', permitir('coordinador'), ctrl.generarRotulo);

export default router;
