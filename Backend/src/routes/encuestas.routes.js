/**
 * Rutas del modulo: encuestas (capa de enrutado).
 * RF-17 / RF-20.
 *
 * - El cliente responde la encuesta de satisfaccion (POST /).
 * - El coordinador consulta el listado, el detalle y el resumen global.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/encuestas.controller.js';

const router = Router();

router.use(autenticar);

router.get('/resumen/global', permitir('coordinador'), ctrl.resumen);
router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id', permitir('coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('cliente'), ctrl.responder);

export default router;
