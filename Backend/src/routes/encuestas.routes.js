/**
 * Rutas del modulo: encuestas (capa de enrutado).
 * RF-17 / RF-20.
 *
 * - El cliente responde y consulta las suyas.
 * - El coordinador consulta listado, detalle y resumen global.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/encuestas.controller.js';

const router = Router();

router.use(autenticar);

router.get('/resumen/global', permitir('coordinador'), ctrl.resumen);
router.get('/mias', permitir('cliente'), ctrl.listarMias);
router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id', permitir('cliente', 'coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('cliente'), ctrl.responder);

export default router;
