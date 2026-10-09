/**
 * Rutas del modulo: auth.
 * Registro y login son PUBLICOS; perfil y cambio de contrasena exigen sesion.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import ctrl from '../controllers/auth.controller.js';

const router = Router();

// Publicas (RF-01 / RF-02 / RF-27)
router.post('/registro', ctrl.registrar);
router.post('/login', ctrl.login);

// Requieren sesion
router.get('/perfil', autenticar, ctrl.obtenerPerfil);
router.patch('/contrasena', autenticar, ctrl.cambiarContrasena);

export default router;
