/**
 * Rutas del modulo: clientes (capa de enrutado).
 * Gestion de clientes, solo coordinador (RF-01 / RF-02 / RF-23).
 * El cliente consulta su propio perfil via GET /auth/perfil.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/clientes.controller.js';

const router = Router();

router.use(autenticar);

router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id', permitir('coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('coordinador'), ctrl.crear);
router.put('/:id', permitir('coordinador'), ctrl.actualizar);
router.patch('/:id/desactivar', permitir('coordinador'), ctrl.desactivar);
router.patch('/:id/reactivar', permitir('coordinador'), ctrl.reactivar);

export default router;
