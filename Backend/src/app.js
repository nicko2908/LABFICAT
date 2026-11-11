/**
 * Configuracion de la aplicacion Express.
 * Separado de server.js para poder testear la app sin abrir puerto.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import env from './config/env.js';
import openapi from './docs/openapi.js';
// Registra todos los modelos antes de montar las rutas. Sin esto, populate()
// depende de que otro modulo haya importado el modelo por casualidad.
import './models/index.js';
import routes from './routes/index.js';
import notFound from './middlewares/notFound.middleware.js';
import errorHandler from './middlewares/error.middleware.js';
import auditar from './middlewares/audit.middleware.js';

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Build de Vite (frontend) generado en Backend/public por `npm run build`.
const DIST_FRONTEND = path.resolve(__dirname, '..', 'public');
const INDEX_FRONTEND = path.join(DIST_FRONTEND, 'index.html');
const HAY_FRONTEND = fs.existsSync(INDEX_FRONTEND);

// Render (y la mayoria de PaaS) termina TLS en un proxy: confiar en el primer
// salto para que req.ip sea la IP real del cliente y no la del proxy.
if (env.nodeEnv === 'production') app.set('trust proxy', 1);

const origenesPermitidos = String(env.corsOrigin || '*')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

// Middlewares globales
app.use(
  helmet({
    // La API y los PDFs se consumen desde el frontend en otro origen.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Swagger UI necesita estilos y scripts inline.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        origenesPermitidos.includes('*') ||
        origenesPermitidos.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Un body JSON "null" deja req.body en null; normalizarlo evita TypeError en
// controladores que leen req.body.campo despues de las validaciones basicas.
app.use((req, res, next) => {
  if (req.body === null || req.body === undefined) req.body = {};
  next();
});
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'labficat-backend', entorno: env.nodeEnv });
});

// Documentacion OpenAPI
app.get('/api/docs.json', (req, res) => res.json(openapi));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapi, { customSiteTitle: 'LABFICAT API' })
);

// Rutas de la API (versionadas)
// La auditoria escucha el evento `finish`, cuando req.usuario ya fue adjuntado
// por el middleware de autenticacion del modulo correspondiente.
app.use(auditar);
app.use(env.apiPrefix, routes);

// Frontend compilado (Vite -> Backend/public) servido por el mismo backend.
// En desarrollo, si no existe el build, se ignora y se usa Vite en :5173.
if (HAY_FRONTEND) {
  app.use(
    express.static(DIST_FRONTEND, {
      index: false,
      maxAge: '1h',
    })
  );

  // Fallback de la SPA. Con createWebHashHistory casi todo pasa por `/`, pero
  // esto cubre rutas directas sin tocar la API ni los assets.
  app.get(/.*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path === '/health' || req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/assets/')) return next();
    // Solo devolver la SPA si el navegador espera HTML; un asset o una imagen
    // faltante debe seguir al 404 JSON, no recibir index.html.
    if (!req.accepts('html')) return next();

    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(INDEX_FRONTEND, (error) => {
      if (error) next(error);
    });
  });
}

// Manejo de rutas no encontradas y errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

export default app;
