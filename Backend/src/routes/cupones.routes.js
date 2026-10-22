/**
 * Rutas del modulo: cupones (capa de enrutado).
 * RF-06 / RF-24.
 *
 * - El coordinador gestiona el cupon.
 * - El cliente consulta los suyos.
 * - La generacion/vencimiento automaticos los ejecutan los jobs, no HTTP.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/cupones.controller.js';

const router = Router();

router.use(autenticar);

router.get('/mios', permitir('cliente'), ctrl.listarMios);
router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id', permitir('cliente', 'coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('coordinador'), ctrl.crear);
router.patch('/:id/generar', permitir('coordinador'), ctrl.generar);
router.post('/:id/recordatorios', permitir('coordinador'), ctrl.registrarRecordatorio);
router.patch('/:id/estado', permitir('coordinador'), ctrl.cambiarEstado);

export default router;
