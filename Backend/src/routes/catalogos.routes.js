/**
 * Rutas del modulo: catalogos (capa de enrutado).
 * Catalogo administrable: tipologias, tipos de muestra, parametros, etapas,
 * analisis y configuracion del sistema.
 *
 * - Lecturas: requieren sesion (cualquier rol).
 *   Excepcion: GET /tipologias es publico para el desplegable del registro (RF-01).
 * - Escrituras (crear/editar/estado) y configuracion: solo coordinador.
 */
import { Router } from 'express';
import autenticar from '../middlewares/auth.middleware.js';
import { permitir } from '../middlewares/role.middleware.js';
import ctrl from '../controllers/catalogos.controller.js';

const router = Router();

// ---------------------------------------------------------------------------
// Tipologias poblacionales — RF-01 / RF-21
// ---------------------------------------------------------------------------
// Publico: el formulario de registro (RF-01) necesita la lista antes de autenticarse.
router.get('/tipologias', ctrl.listarTipologias);
router.post('/tipologias', autenticar, permitir('coordinador'), ctrl.crearTipologia);
router.put('/tipologias/:id', autenticar, permitir('coordinador'), ctrl.actualizarTipologia);
router.patch('/tipologias/:id/estado', autenticar, permitir('coordinador'), ctrl.cambiarEstadoTipologia);

// ---------------------------------------------------------------------------
// Tipos de muestra — laboratorio
// ---------------------------------------------------------------------------
router.get('/tipos-muestra', autenticar, ctrl.listarTiposMuestra);
router.post('/tipos-muestra', autenticar, permitir('coordinador'), ctrl.crearTipoMuestra);
router.put('/tipos-muestra/:id', autenticar, permitir('coordinador'), ctrl.actualizarTipoMuestra);
router.patch('/tipos-muestra/:id/estado', autenticar, permitir('coordinador'), ctrl.cambiarEstadoTipoMuestra);

// ---------------------------------------------------------------------------
// Parametros — laboratorio
// ---------------------------------------------------------------------------
router.get('/parametros', autenticar, ctrl.listarParametros);
router.post('/parametros', autenticar, permitir('coordinador'), ctrl.crearParametro);
router.put('/parametros/:id', autenticar, permitir('coordinador'), ctrl.actualizarParametro);
router.patch('/parametros/:id/estado', autenticar, permitir('coordinador'), ctrl.cambiarEstadoParametro);

// ---------------------------------------------------------------------------
// Etapas de proceso — trazabilidad
// ---------------------------------------------------------------------------
router.get('/etapas', autenticar, ctrl.listarEtapas);
router.post('/etapas', autenticar, permitir('coordinador'), ctrl.crearEtapa);
router.put('/etapas/:id', autenticar, permitir('coordinador'), ctrl.actualizarEtapa);
router.patch('/etapas/:id/estado', autenticar, permitir('coordinador'), ctrl.cambiarEstadoEtapa);

// ---------------------------------------------------------------------------
// Analisis — RF-25
// ---------------------------------------------------------------------------
router.get('/analisis', autenticar, ctrl.listarAnalisis);
router.get('/analisis/:id', autenticar, ctrl.obtenerAnalisisPorId);
router.post('/analisis', autenticar, permitir('coordinador'), ctrl.crearAnalisis);
router.put('/analisis/:id', autenticar, permitir('coordinador'), ctrl.actualizarAnalisis);
router.patch('/analisis/:id/estado', autenticar, permitir('coordinador'), ctrl.cambiarEstadoAnalisis);

// ---------------------------------------------------------------------------
// Configuracion del sistema — RF-24 (solo coordinador)
// ---------------------------------------------------------------------------
router.get('/configuracion', autenticar, permitir('coordinador'), ctrl.listarConfiguracion);
router.get('/configuracion/:clave', autenticar, permitir('coordinador'), ctrl.obtenerConfiguracionPorClave);
router.put('/configuracion/:clave', autenticar, permitir('coordinador'), ctrl.actualizarConfiguracion);

export default router;
