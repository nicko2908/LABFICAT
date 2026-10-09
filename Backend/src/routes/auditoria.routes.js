/**
 * Rutas del modulo: auditoria (capa de enrutado).
 * RNF-03 / RF-27.
 *
 * - Publicas (RF-27): solicitud y consumo del token de recuperacion.
 * - Bitacora (RNF-03): solo lectura/registro, solo coordinador.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/auditoria.controller.js';

const router = Router();

// Publicas (RF-27): el usuario que olvido la contrasena no puede autenticarse.
router.post('/recuperacion/solicitar', ctrl.solicitarRecuperacion);
router.post('/recuperacion/consumir', ctrl.consumirRecuperacion);

// Bitacora (RNF-03): solo coordinador.
router.get('/', autenticar, permitir('coordinador'), ctrl.listar);
router.get('/:id', autenticar, permitir('coordinador'), ctrl.obtenerPorId);
router.post('/', autenticar, permitir('coordinador'), ctrl.registrar);

export default router;
