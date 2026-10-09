/**
 * Configuracion de la aplicacion Express.
 * Separado de server.js para poder testear la app sin abrir puerto.
 */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import env from './config/env.js';
import routes from './routes/index.js';
import notFound from './middlewares/notFound.middleware.js';
import errorHandler from './middlewares/error.middleware.js';

const app = express();

// Middlewares globales
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'labficat-backend', entorno: env.nodeEnv });
});

// Rutas de la API (versionadas)
app.use(env.apiPrefix, routes);

// Manejo de rutas no encontradas y errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

export default app;
