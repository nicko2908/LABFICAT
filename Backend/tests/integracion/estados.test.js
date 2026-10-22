/**
 * Pruebas de integracion de la maquina de estados y de
 * transicionarSolicitud (Fase 2A).
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import {
  conTransaccion,
  transicionarSolicitud,
} from '../../src/services/flujo.service.js';
import { ESTADO_SOLICITUD } from '../../src/config/constants.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import HistorialEstadoSolicitud from '../../src/models/servicios/HistorialEstadoSolicitud.js';

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(replSet.getUri('labficat_test_estados'));
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    Solicitud.deleteMany({}),
    HistorialEstadoSolicitud.deleteMany({}),
  ]);
});

async function crearSolicitud(estado = ESTADO_SOLICITUD.REGISTRADA) {
  return Solicitud.create({
    cliente: new mongoose.Types.ObjectId(),
    estado,
  });
}

test('transiciona y registra el historial', async () => {
  const solicitud = await crearSolicitud();
  const usuario = new mongoose.Types.ObjectId();

  const actualizada = await transicionarSolicitud(
    solicitud._id,
    ESTADO_SOLICITUD.COTIZADA,
    {
      usuario,
      observacion: 'Cotizacion creada',
    }
  );

  assert.equal(actualizada.estado, ESTADO_SOLICITUD.COTIZADA);

  const historial = await HistorialEstadoSolicitud.find({
    solicitud: solicitud._id,
  }).sort({ fecha_hora: 1 });

  assert.equal(historial.length, 1);
  assert.equal(historial[0].estado, ESTADO_SOLICITUD.COTIZADA);
  assert.equal(String(historial[0].usuario), String(usuario));
  assert.equal(historial[0].observacion, 'Cotizacion creada');
});

test('rechaza una transicion invalida sin cambiar la solicitud', async () => {
  const solicitud = await crearSolicitud();

  await assert.rejects(
    () =>
      transicionarSolicitud(
        solicitud._id,
        ESTADO_SOLICITUD.EN_ANALISIS
      ),
    (err) => err.status === 409
  );

  const recargada = await Solicitud.findById(solicitud._id);
  assert.equal(recargada.estado, ESTADO_SOLICITUD.REGISTRADA);
  assert.equal(
    await HistorialEstadoSolicitud.countDocuments({ solicitud: solicitud._id }),
    0
  );
});

test('no duplica historial si se repite el mismo estado', async () => {
  const solicitud = await crearSolicitud();

  const actualizada = await transicionarSolicitud(
    solicitud._id,
    ESTADO_SOLICITUD.REGISTRADA
  );

  assert.equal(actualizada.estado, ESTADO_SOLICITUD.REGISTRADA);
  assert.equal(
    await HistorialEstadoSolicitud.countDocuments({ solicitud: solicitud._id }),
    0
  );
});

test('registra motivo y fecha de cierre al desistir', async () => {
  const solicitud = await crearSolicitud(ESTADO_SOLICITUD.COTIZADA);

  const actualizada = await transicionarSolicitud(
    solicitud._id,
    ESTADO_SOLICITUD.DESISTIDA,
    { motivoDesistimiento: 'No acepta el precio' }
  );

  assert.equal(actualizada.estado, ESTADO_SOLICITUD.DESISTIDA);
  assert.equal(actualizada.motivo_desistimiento, 'No acepta el precio');
  assert.ok(actualizada.fecha_cierre instanceof Date);
});

test('registra fecha de cierre al finalizar', async () => {
  const solicitud = await crearSolicitud(ESTADO_SOLICITUD.INFORME_LISTO);

  const actualizada = await transicionarSolicitud(
    solicitud._id,
    ESTADO_SOLICITUD.FINALIZADA
  );

  assert.equal(actualizada.estado, ESTADO_SOLICITUD.FINALIZADA);
  assert.ok(actualizada.fecha_cierre instanceof Date);
});

test('traduce un id invalido a 400', async () => {
  await assert.rejects(
    () =>
      transicionarSolicitud(
        'no-es-un-objectid',
        ESTADO_SOLICITUD.COTIZADA
      ),
    (err) => err.status === 400
  );
});

test('hace rollback del estado y del historial si falla la transaccion', async () => {
  const solicitud = await crearSolicitud();

  await assert.rejects(
    () =>
      conTransaccion(async (session) => {
        await transicionarSolicitud(
          solicitud._id,
          ESTADO_SOLICITUD.COTIZADA,
          { session }
        );
        throw new Error('fallo posterior');
      }),
    /fallo posterior/
  );

  const recargada = await Solicitud.findById(solicitud._id);
  assert.equal(recargada.estado, ESTADO_SOLICITUD.REGISTRADA);
  assert.equal(
    await HistorialEstadoSolicitud.countDocuments({ solicitud: solicitud._id }),
    0
  );
});
