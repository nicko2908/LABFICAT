/**
 * Punto de arranque del backend.
 * Conecta a MongoDB Atlas y levanta el servidor HTTP.
 */
const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');

async function iniciar() {
  try {
    await connectDB();

    // Tareas programadas (node-cron). Se implementan en src/jobs.
    // require('./jobs/recordatorioCupon.job').start();
    // require('./jobs/vencimientoCupon.job').start();
    // require('./jobs/limpiezaTokens.job').start();

    const server = app.listen(env.port, () => {
      console.log(`[http] LABFICAT backend escuchando en http://localhost:${env.port}${env.apiPrefix}`);
    });

    // Cierre ordenado
    const cerrar = async (signal) => {
      console.log(`\n[app] Recibida senal ${signal}, cerrando...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => cerrar('SIGINT'));
    process.on('SIGTERM', () => cerrar('SIGTERM'));
  } catch (error) {
    console.error('[app] Error al iniciar:', error.message);
    process.exit(1);
  }
}

iniciar();
