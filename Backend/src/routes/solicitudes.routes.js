/**
 * Rutas del modulo: solicitudes (capa de enrutado).
 * RF-01 / RF-03 / RF-04 / RF-05 / RF-26.
 *
 * - El cliente crea y consulta sus propias solicitudes.
 * - El coordinador gestiona todas las solicitudes.
 * - La autorizacion por propietario se valida en el controlador.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/solicitudes.controller.js';

const router = Router();

router.use(autenticar);

router.post('/', permitir('cliente', 'coordinador'), ctrl.crear);
router.get('/mias', permitir('cliente'), ctrl.listarMias);
router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id/historial', permitir('cliente', 'coordinador'), ctrl.obtenerHistorial);
router.get('/:id', permitir('cliente', 'coordinador'), ctrl.obtenerPorId);
router.put('/:id', permitir('coordinador'), ctrl.actualizar);
router.patch('/:id/estado', permitir('coordinador'), ctrl.cambiarEstado);

export default router;
