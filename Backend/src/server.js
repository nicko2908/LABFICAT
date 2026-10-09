/**
 * Punto de arranque del backend.
 * Conecta a MongoDB Atlas y levanta el servidor HTTP.
 */
import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';

async function iniciar() {
  try {
    await connectDB();

    // Tareas programadas (node-cron). Se implementan en src/jobs.
    // import { start as startRecordatorioCupon } from './jobs/recordatorioCupon.job.js';
    // import { start as startVencimientoCupon } from './jobs/vencimientoCupon.job.js';
    // import { start as startLimpiezaTokens } from './jobs/limpiezaTokens.job.js';

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
