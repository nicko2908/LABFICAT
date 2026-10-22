/**
 * Pruebas de integracion de transacciones (Fase 2A).
 *
 * Usa un replica set en memoria porque MongoDB solo permite transacciones
 * sobre replica sets. No se conecta a MongoDB Atlas.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { conTransaccion } from '../../src/services/flujo.service.js';
import ConfiguracionSistema from '../../src/models/sistema/ConfiguracionSistema.js';

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(replSet.getUri('labficat_test'));
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await ConfiguracionSistema.deleteMany({});
});

test('hace commit de todos los cambios', async () => {
  await conTransaccion(async (session) => {
    await ConfiguracionSistema.create(
      [{ clave: 'TEST_COMMIT_A', valor: '1' }],
      { session }
    );
    await ConfiguracionSistema.create(
      [{ clave: 'TEST_COMMIT_B', valor: '2' }],
      { session }
    );
  });

  const total = await ConfiguracionSistema.countDocuments({
    clave: /^TEST_COMMIT_/,
  });
  assert.equal(total, 2);
});

test('hace rollback si un paso falla', async () => {
  await assert.rejects(
    () =>
      conTransaccion(async (session) => {
        await ConfiguracionSistema.create(
          [{ clave: 'TEST_ROLLBACK', valor: '1' }],
          { session }
        );
        throw new Error('fallo intencional');
      }),
    /fallo intencional/
  );

  const doc = await ConfiguracionSistema.findOne({ clave: 'TEST_ROLLBACK' });
  assert.equal(doc, null);
});

test('devuelve el resultado del callback', async () => {
  const resultado = await conTransaccion(async (session) => {
    const [doc] = await ConfiguracionSistema.create(
      [{ clave: 'TEST_RETORNO', valor: 'ok' }],
      { session }
    );
    return doc.clave;
  });

  assert.equal(resultado, 'TEST_RETORNO');
});
