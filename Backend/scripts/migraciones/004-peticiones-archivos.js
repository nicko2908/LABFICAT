/**
 * Migracion 004 - Peticiones sin archivos en pagos.
 *
 * El soporte de pago ya no se almacena. Esta migracion elimina los campos
 * legados ruta_archivo/formato de SoportePago e inicializa referencia_externa.
 *
 * Es idempotente. Uso:
 *   node scripts/migraciones/004-peticiones-archivos.js
 *   node scripts/migraciones/004-peticiones-archivos.js --dry-run
 */
import 'dotenv/config';

import { connectDB, disconnectDB } from '../../src/config/database.js';
import SoportePago from '../../src/models/servicios/SoportePago.js';
import Reclamacion from '../../src/models/calidad/Reclamacion.js';

const dryRun = process.argv.includes('--dry-run');

async function migrarSoportesPago() {
  const coleccion = SoportePago.collection;

  const conCamposViejos = await coleccion.countDocuments({
    $or: [
      { ruta_archivo: { $exists: true } },
      { formato: { $exists: true } },
    ],
  });

  const sinReferencia = await coleccion.countDocuments({
    referencia_externa: { $exists: false },
  });

  console.log(
    `[004] Soportes con ruta_archivo/formato: ${conCamposViejos}. Sin referencia_externa: ${sinReferencia}.`
  );

  if (dryRun) {
    console.log('[004] Modo dry-run: no se escribira nada.');
    return;
  }

  if (conCamposViejos > 0) {
    await coleccion.updateMany(
      {},
      { $unset: { ruta_archivo: '', formato: '' } }
    );
    console.log('[004] Campos ruta_archivo y formato eliminados.');
  }

  if (sinReferencia > 0) {
    await coleccion.updateMany(
      { referencia_externa: { $exists: false } },
      { $set: { referencia_externa: null } }
    );
    console.log('[004] referencia_externa inicializada.');
  }
}

async function revisarEvidenciasLegadas() {
  const conEvidenciasViejas = await Reclamacion.collection.countDocuments({
    'evidencias.ruta_archivo': { $exists: true },
  });

  console.log(`[004] Reclamaciones con evidencias legadas: ${conEvidenciasViejas}.`);

  if (conEvidenciasViejas > 0) {
    console.warn(
      '[004] Las evidencias legadas no tienen archivo en R2. ' +
        'Hay que revisarlas manualmente antes de eliminarlas.'
    );
  }
}

async function main() {
  try {
    await connectDB();
    await migrarSoportesPago();
    await revisarEvidenciasLegadas();
    console.log('[004] Completado.');
  } catch (error) {
    console.error('[004] Error:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
