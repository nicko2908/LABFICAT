/**
 * Configuracion de la aplicacion Express.
 * Separado de server.js para poder testear la app sin abrir puerto.
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

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

module.exports = app;
