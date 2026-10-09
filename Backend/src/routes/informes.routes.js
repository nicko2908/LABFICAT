/**
 * Rutas del modulo: informes (capa de enrutado).
 * RF-15 / RF-16 / RF-17.
 *
 * - El coordinador genera, lista y registra el envio de informes.
 * - El cliente descarga el informe final (RF-17, bloqueado sin encuesta).
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/informes.controller.js';

const router = Router();

router.use(autenticar);

router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id', permitir('coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('coordinador'), ctrl.generar);
router.patch('/:id/envio', permitir('coordinador'), ctrl.registrarEnvio);
router.patch('/:id/descarga', permitir('cliente'), ctrl.registrarDescarga);

export default router;
