/**
 * Rutas del modulo: solicitudes (capa de enrutado).
 * RF-01 / RF-03 / RF-04 / RF-05 / RF-26.
 *
 * - El cliente crea su solicitud (POST /).
 * - La gestion (listar, ver, editar, transicionar, historial) es solo del
 *   coordinador, para evitar que un cliente acceda a solicitudes ajenas.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/solicitudes.controller.js';

const router = Router();

router.use(autenticar);

router.post('/', permitir('cliente', 'coordinador'), ctrl.crear);
router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id/historial', permitir('coordinador'), ctrl.obtenerHistorial);
router.get('/:id', permitir('coordinador'), ctrl.obtenerPorId);
router.put('/:id', permitir('coordinador'), ctrl.actualizar);
router.patch('/:id/estado', permitir('coordinador'), ctrl.cambiarEstado);

export default router;
