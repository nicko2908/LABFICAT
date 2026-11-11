/**
 * Configuracion de la aplicacion Express.
 * Separado de server.js para poder testear la app sin abrir puerto.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

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
        styleSrc: ["'self'", "'unsafe-inline'"],
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

// Manejo de rutas no encontradas y errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

export default app;
