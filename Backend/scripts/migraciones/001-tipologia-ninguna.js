/**
 * Migracion 001 - Tipologia NINGUNA (Fase 1, RF-01).
 *
 * Que hace:
 *  1. Garantiza que exista la tipologia "Ninguna de las anteriores" con
 *     codigo estable NINGUNA.
 *  2. Crea/verifica el indice unico de codigo.
 *  3. Asigna NINGUNA a todos los clientes con tipologia null o inexistente.
 *  4. Verifica que no queden clientes sin tipologia.
 *
 * Es idempotente: se puede ejecutar varias veces.
 *
 * Uso:
 *   cd Backend
 *   npm run migrar:tipologia
 */
import { connectDB, disconnectDB } from '../../src/config/database.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import TipologiaPoblacional from '../../src/models/clientes/TipologiaPoblacional.js';
import {
  TIPOLOGIA_CODIGO,
  TIPOLOGIA_NINGUNA_NOMBRE,
} from '../../src/config/constants.js';

const FILTRO_SIN_TIPOLOGIA = {
  $or: [{ tipologia: null }, { tipologia: { $exists: false } }],
};

async function obtenerNinguna() {
  let ninguna = await TipologiaPoblacional.findOne({
    codigo: TIPOLOGIA_CODIGO.NINGUNA,
  });

  if (!ninguna) {
    ninguna = await TipologiaPoblacional.findOne({
      nombre: TIPOLOGIA_NINGUNA_NOMBRE,
    });
  }

  if (!ninguna) {
    ninguna = await TipologiaPoblacional.create({
      nombre: TIPOLOGIA_NINGUNA_NOMBRE,
      codigo: TIPOLOGIA_CODIGO.NINGUNA,
      activo: true,
    });
    console.log('[migracion] Tipologia NINGUNA creada.');
    return ninguna;
  }

  let cambios = false;
  if (ninguna.codigo !== TIPOLOGIA_CODIGO.NINGUNA) {
    ninguna.codigo = TIPOLOGIA_CODIGO.NINGUNA;
    cambios = true;
  }
  if (ninguna.activo !== true) {
    ninguna.activo = true;
    cambios = true;
  }
  if (cambios) {
    await ninguna.save();
    console.log('[migracion] Tipologia NINGUNA actualizada (codigo/activo).');
  } else {
    console.log('[migracion] Tipologia NINGUNA ya existe.');
  }

  return ninguna;
}

async function main() {
  try {
    await connectDB();
    await TipologiaPoblacional.createIndexes();

    const ninguna = await obtenerNinguna();

    const antes = await Cliente.countDocuments(FILTRO_SIN_TIPOLOGIA);
    const resultado = await Cliente.updateMany(FILTRO_SIN_TIPOLOGIA, {
      $set: { tipologia: ninguna._id },
    });
    const despues = await Cliente.countDocuments(FILTRO_SIN_TIPOLOGIA);

    console.log(`[migracion] Clientes sin tipologia antes: ${antes}`);
    console.log(`[migracion] Clientes actualizados: ${resultado.modifiedCount}`);
    console.log(`[migracion] Clientes sin tipologia despues: ${despues}`);

    if (despues > 0) {
      throw new Error('Quedaron clientes sin tipologia; revise los datos manualmente');
    }

    console.log('[migracion] Completada correctamente.');
  } catch (error) {
    console.error('[migracion] Error:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
