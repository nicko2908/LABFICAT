/**
 * Rutas del modulo: reclamaciones (capa de enrutado).
 * RF-18.
 *
 * - El cliente registra la reclamacion y agrega evidencias.
 * - El coordinador consulta y gestiona el estado.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/reclamaciones.controller.js';

const router = Router();

router.use(autenticar);

router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id', permitir('coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('cliente'), ctrl.crear);
router.post('/:id/evidencias', permitir('cliente'), ctrl.agregarEvidencia);
router.patch('/:id/estado', permitir('coordinador'), ctrl.cambiarEstado);

export default router;
