/**
 * Rutas del modulo: cotizaciones (capa de enrutado).
 * RF-04 / RF-05.
 *
 * - El coordinador crea y gestiona las cotizaciones.
 * - El cliente consulta las suyas y firma (acepta/rechaza) en PATCH /:id/decision.
 *   La firma digital (PNG) se guarda de forma PRIVADA en Supabase; el cliente
 *   no accede a ella. Solo el coordinador la descarga (GET /:id/firma).
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/cotizaciones.controller.js';

const router = Router();

router.use(autenticar);

router.get('/mias', permitir('cliente'), ctrl.listarMias);
router.get('/', permitir('coordinador'), ctrl.listar);
router.get('/:id/firma', permitir('coordinador'), ctrl.descargarFirma);
router.get('/:id', permitir('cliente', 'coordinador'), ctrl.obtenerPorId);
router.post('/', permitir('coordinador'), ctrl.crear);
router.put('/:id', permitir('coordinador'), ctrl.actualizar);
router.patch('/:id/decision', permitir('cliente'), ctrl.decidir);

export default router;
