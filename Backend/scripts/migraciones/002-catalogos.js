/**
 * Migracion 002 - Catalogos de la Oferta de servicios y Recepcion.
 *
 * Carga/actualiza:
 *  - 16 tipologias comerciales (4 internas con es_interno=true).
 *  - Presentaciones de muestra (Pasta, Polvo, Liquido, ...).
 *  - Parametro generico "Resultado".
 *  - 35 ensayos con codigo, unidades, metodo, tecnica y acreditacion.
 *  - Desactiva (no borra) las 12 tipologias del RF-01 anterior y los 3
 *    analisis de ejemplo.
 *
 * Es idempotente. Uso:
 *   node scripts/migraciones/002-catalogos.js
 *   node scripts/migraciones/002-catalogos.js --dry-run
 */
import 'dotenv/config';

import { connectDB, disconnectDB } from '../../src/config/database.js';
import TipologiaPoblacional from '../../src/models/clientes/TipologiaPoblacional.js';
import TipoMuestra from '../../src/models/laboratorio/TipoMuestra.js';
import Parametro from '../../src/models/laboratorio/Parametro.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import {
  TIPOLOGIAS_SEMILLA,
  TIPOLOGIAS_LEGADO,
  TIPOS_MUESTRA_SEMILLA,
  PARAMETRO_RESULTADO,
  ANALISIS_SEMILLA,
  PRECIO_ANALISIS,
} from '../../src/seeds/catalogos.js';

const dryRun = process.argv.includes('--dry-run');

const ANALISIS_LEGADO = [
  'Analisis fisicoquimico de agua',
  'Analisis microbiologico de agua',
  'Analisis de suelo',
];

async function migrarTipologias() {
  if (dryRun) {
    const existentes = await TipologiaPoblacional.countDocuments();
    console.log(`[002] Tipologias actuales: ${existentes}. Se sincronizarian ${TIPOLOGIAS_SEMILLA.length}.`);
    return;
  }

  await TipologiaPoblacional.bulkWrite(
    TIPOLOGIAS_SEMILLA.map((tipologia) => ({
      updateOne: {
        filter: { nombre: tipologia.nombre },
        update: {
          $set: {
            codigo: tipologia.codigo,
            es_interno: Boolean(tipologia.es_interno),
            activo: tipologia.activo !== false,
            descripcion: tipologia.descripcion || null,
          },
        },
        upsert: true,
      },
    }))
  );

  await TipologiaPoblacional.updateMany(
    { nombre: { $in: TIPOLOGIAS_LEGADO } },
    { $set: { activo: false } }
  );

  console.log(`[002] Tipologias sincronizadas: ${TIPOLOGIAS_SEMILLA.length}`);
}

async function migrarTiposMuestra() {
  if (dryRun) {
    console.log(`[002] Tipos de muestra a sincronizar: ${TIPOS_MUESTRA_SEMILLA.length}`);
    return;
  }

  await TipoMuestra.bulkWrite(
    TIPOS_MUESTRA_SEMILLA.map((tipo) => ({
      updateOne: {
        filter: { nombre: tipo.nombre },
        update: { $set: tipo },
        upsert: true,
      },
    }))
  );

  await TipoMuestra.updateMany(
    { nombre: { $in: ['Agua', 'Sangre', 'Orina', 'Suelo', 'Alimento'] } },
    { $set: { activo: false } }
  );

  console.log(`[002] Tipos de muestra sincronizados: ${TIPOS_MUESTRA_SEMILLA.length}`);
}

async function migrarParametros() {
  if (dryRun) {
    console.log('[002] Parametro "Resultado" seria creado/verificado.');
    return;
  }

  await Parametro.updateOne(
    { nombre: PARAMETRO_RESULTADO.nombre },
    { $set: PARAMETRO_RESULTADO },
    { upsert: true }
  );

  console.log('[002] Parametro "Resultado" verificado.');
}

async function migrarAnalisis() {
  const resultado = dryRun
    ? await Parametro.findOne({ nombre: PARAMETRO_RESULTADO.nombre }).lean()
    : await Parametro.findOne({ nombre: PARAMETRO_RESULTADO.nombre });

  if (!resultado) {
    if (dryRun) {
      console.log('[002] El parametro "Resultado" no existe; se crearia al ejecutar sin --dry-run.');
      return;
    }
    throw new Error('Falta el parametro "Resultado"; ejecute sin --dry-run primero');
  }

  if (dryRun) {
    const conCodigo = await Analisis.countDocuments({ codigo: { $ne: null } });
    console.log(`[002] Analisis con codigo actuales: ${conCodigo}. Se sincronizarian ${ANALISIS_SEMILLA.length}.`);
    return;
  }

  await Analisis.bulkWrite(
    ANALISIS_SEMILLA.map((analisis) => {
      const descripcion = `${analisis.nombre}${analisis.acreditado ? '°' : ''} - ${analisis.tecnica || ''}`
        .trim()
        .slice(0, 200);

      return {
        updateOne: {
          filter: { codigo: analisis.codigo },
          update: {
            $set: {
              codigo: analisis.codigo,
              nombre: analisis.nombre,
              descripcion,
              unidades: analisis.unidades,
              metodo: analisis.metodo,
              tecnica: analisis.tecnica,
              acreditado: Boolean(analisis.acreditado),
              tarifa_externo: PRECIO_ANALISIS,
              cantidad_minima: 0,
              unidad_cantidad: null,
              parametros: [resultado._id],
              tipos_muestra: [],
              activo: true,
            },
          },
          upsert: true,
        },
      };
    })
  );

  await Analisis.updateMany(
    { nombre: { $in: ANALISIS_LEGADO } },
    { $set: { activo: false } }
  );

  console.log(`[002] Analisis sincronizados: ${ANALISIS_SEMILLA.length}`);
}

async function sincronizarIndices() {
  if (dryRun) {
    console.log('[002] Indices: se ejecutaria syncIndexes() de los catalogos.');
    return;
  }

  await Promise.all([
    TipologiaPoblacional.syncIndexes(),
    TipoMuestra.syncIndexes(),
    Parametro.syncIndexes(),
    Analisis.syncIndexes(),
  ]);

  console.log('[002] Indices de catalogos sincronizados.');
}

async function main() {
  try {
    await connectDB();
    if (dryRun) console.log('[002] Modo dry-run: no se escribira nada.');

    await migrarTipologias();
    await migrarTiposMuestra();
    await migrarParametros();
    await migrarAnalisis();
    await sincronizarIndices();

    console.log('[002] Completado.');
  } catch (error) {
    console.error('[002] Error:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
