/**
 * Rutas del modulo: pagos (capa de enrutado).
 * RF-07 / RF-08.
 *
 * - El cliente carga y reenvia su comprobante de pago.
 * - La gestion (listar, ver) y la validacion son del coordinador.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/pagos.controller.js';

const router = Router();

router.use(autenticar);

router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id', permitir('coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('cliente'), ctrl.cargar);
router.put('/:id/reenviar', permitir('cliente'), ctrl.reenviar);
router.patch('/:id/validar', permitir('coordinador'), ctrl.validar);

export default router;
