/**
 * Pruebas de integracion del slice solicitud -> cotizacion (Fase 2A).
 *
 * Cubre servicios, transacciones, historial, autorizacion por propietario
 * y los endpoints HTTP /mias.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import { ROLES, ESTADO_SOLICITUD } from '../../src/config/constants.js';
import {
  crearSolicitud,
} from '../../src/services/solicitud.service.js';
import {
  crearCotizacion,
  decidirCotizacion,
} from '../../src/services/cotizacion.service.js';
import {
  verificarPropietarioSolicitud,
  verificarPropietarioCotizacion,
} from '../../src/utils/propietario.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import Cotizacion from '../../src/models/servicios/Cotizacion.js';
import HistorialEstadoSolicitud from '../../src/models/servicios/HistorialEstadoSolicitud.js';

let replSet;
let server;
let base;
let secuencia = 0;

function siguiente() {
  secuencia += 1;
  return secuencia;
}

async function crearUsuario() {
  const n = siguiente();
  return Usuario.create({
    rol: new mongoose.Types.ObjectId(),
    nombres: 'Cliente',
    apellidos: 'Prueba',
    tipo_documento: 'CC',
    numero_documento: String(100000000 + n),
    correo: `cliente${n}@test.local`,
  });
}

async function crearCliente({ tipoCliente = 'EXTERNO' } = {}) {
  const usuario = await crearUsuario();
  const cliente = await Cliente.create({
    usuario: usuario._id,
    tipologia: new mongoose.Types.ObjectId(),
    tipo_cliente: tipoCliente,
    acepta_tratamiento_datos: true,
  });
  return { usuario, cliente };
}

async function crearCoordinador() {
  return crearUsuario();
}

function tokenPara(usuario, rol) {
  return firmar({ sub: String(usuario._id), rol });
}

async function crearAnalisis(nombre, tarifa) {
  return Analisis.create({
    nombre,
    tarifa_externo: tarifa,
    activo: true,
  });
}

async function pedir(ruta, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}${ruta}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const texto = await res.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }

  return { status: res.status, body: json };
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(replSet.getUri('labficat_test_slice'));

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    Usuario.deleteMany({}),
    Cliente.deleteMany({}),
    Analisis.deleteMany({}),
    Solicitud.deleteMany({}),
    Cotizacion.deleteMany({}),
    HistorialEstadoSolicitud.deleteMany({}),
  ]);
});

test('crearSolicitud registra la solicitud y su historial', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis('Analisis A', 1000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });

  assert.equal(solicitud.estado, ESTADO_SOLICITUD.REGISTRADA);

  const historial = await HistorialEstadoSolicitud.find({
    solicitud: solicitud._id,
  });
  assert.equal(historial.length, 1);
  assert.equal(historial[0].estado, ESTADO_SOLICITUD.REGISTRADA);
});

test('crearCotizacion externa calcula tarifas y transiciona la solicitud', async () => {
  const { usuario, cliente } = await crearCliente();
  const a1 = await crearAnalisis('Analisis B1', 1000);
  const a2 = await crearAnalisis('Analisis B2', 2000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [a1._id, a2._id],
    usuarioId: usuario._id,
  });

  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [
      { analisis: a1._id },
      { analisis: a2._id, tarifa_aplicada: 500 },
    ],
    usuarioId: usuario._id,
  });

  assert.equal(cotizacion.estado, 'PENDIENTE');
  assert.equal(cotizacion.valor_total, 1500);

  const recargada = await Solicitud.findById(solicitud._id);
  assert.equal(recargada.estado, ESTADO_SOLICITUD.COTIZADA);

  const historial = await HistorialEstadoSolicitud.find({
    solicitud: solicitud._id,
  }).sort({ fecha_hora: 1 });
  assert.equal(historial.length, 2);
  assert.equal(historial[1].estado, ESTADO_SOLICITUD.COTIZADA);
});

test('crearCotizacion interna aplica tarifa 0', async () => {
  const { usuario, cliente } = await crearCliente({ tipoCliente: 'INTERNO' });
  const analisis = await crearAnalisis('Analisis C', 5000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });

  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  assert.equal(cotizacion.valor_total, 0);
  assert.equal(cotizacion.detalle[0].tarifa_aplicada, 0);
});

test('crearCotizacion rechaza un analisis ajeno a la solicitud', async () => {
  const { usuario, cliente } = await crearCliente();
  const propio = await crearAnalisis('Analisis D1', 1000);
  const ajeno = await crearAnalisis('Analisis D2', 1000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [propio._id],
    usuarioId: usuario._id,
  });

  await assert.rejects(
    () =>
      crearCotizacion({
        solicitudId: solicitud._id,
        detalle: [{ analisis: ajeno._id }],
        usuarioId: usuario._id,
      }),
    (err) => err.status === 400
  );

  const recargada = await Solicitud.findById(solicitud._id);
  assert.equal(recargada.estado, ESTADO_SOLICITUD.REGISTRADA);
  assert.equal(await Cotizacion.countDocuments({ solicitud: solicitud._id }), 0);
});

test('crearCotizacion rechaza analisis duplicados', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis('Analisis E', 1000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });

  await assert.rejects(
    () =>
      crearCotizacion({
        solicitudId: solicitud._id,
        detalle: [
          { analisis: analisis._id },
          { analisis: analisis._id },
        ],
        usuarioId: usuario._id,
      }),
    (err) => err.status === 400
  );
});

test('decidirCotizacion acepta y sincroniza la solicitud', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis('Analisis F', 1000);
  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  const actualizada = await decidirCotizacion({
    cotizacionId: cotizacion._id,
    decision: 'ACEPTADA',
    firma: { ruta: 'firmas/test.png', hash: 'hash-test' },
    usuarioId: usuario._id,
  });

  assert.equal(actualizada.estado, 'ACEPTADA');
  assert.equal(actualizada.firma_ruta, 'firmas/test.png');

  const recargada = await Solicitud.findById(solicitud._id);
  assert.equal(recargada.estado, ESTADO_SOLICITUD.ACEPTADA);
});

test('decidirCotizacion rechaza y desiste la solicitud', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis('Analisis G', 1000);
  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  const actualizada = await decidirCotizacion({
    cotizacionId: cotizacion._id,
    decision: 'RECHAZADA',
    motivoRechazo: 'Precio alto',
    usuarioId: usuario._id,
  });

  assert.equal(actualizada.estado, 'RECHAZADA');
  assert.equal(actualizada.motivo_rechazo, 'Precio alto');

  const recargada = await Solicitud.findById(solicitud._id);
  assert.equal(recargada.estado, ESTADO_SOLICITUD.DESISTIDA);
  assert.equal(recargada.motivo_desistimiento, 'Precio alto');
});

test('decidirCotizacion no permite decidir dos veces', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis('Analisis H', 1000);
  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  await decidirCotizacion({
    cotizacionId: cotizacion._id,
    decision: 'RECHAZADA',
    motivoRechazo: 'No',
    usuarioId: usuario._id,
  });

  await assert.rejects(
    () =>
      decidirCotizacion({
        cotizacionId: cotizacion._id,
        decision: 'ACEPTADA',
        firma: { ruta: 'firmas/otra.png', hash: 'otra' },
        usuarioId: usuario._id,
      }),
    (err) => err.status === 409
  );
});

test('verificarPropietarioSolicitud distingue cliente ajeno y coordinador', async () => {
  const a = await crearCliente();
  const b = await crearCliente();
  const analisis = await crearAnalisis('Analisis I', 1000);
  const solicitud = await crearSolicitud({
    clienteId: a.cliente._id,
    analisis: [analisis._id],
    usuarioId: a.usuario._id,
  });

  const usuarioA = { id: String(a.usuario._id), rol: ROLES.CLIENTE };
  const usuarioB = { id: String(b.usuario._id), rol: ROLES.CLIENTE };
  const coordinador = { id: String(b.usuario._id), rol: ROLES.COORDINADOR };

  await verificarPropietarioSolicitud(solicitud, usuarioA);
  await verificarPropietarioSolicitud(solicitud, coordinador);

  await assert.rejects(
    () => verificarPropietarioSolicitud(solicitud, usuarioB),
    (err) => err.status === 403
  );
});

test('verificarPropietarioCotizacion usa la solicitud de la cotizacion', async () => {
  const a = await crearCliente();
  const b = await crearCliente();
  const analisis = await crearAnalisis('Analisis J', 1000);
  const solicitud = await crearSolicitud({
    clienteId: a.cliente._id,
    analisis: [analisis._id],
    usuarioId: a.usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: a.usuario._id,
  });

  await verificarPropietarioCotizacion(cotizacion, {
    id: String(a.usuario._id),
    rol: ROLES.CLIENTE,
  });

  await assert.rejects(
    () =>
      verificarPropietarioCotizacion(cotizacion, {
        id: String(b.usuario._id),
        rol: ROLES.CLIENTE,
      }),
    (err) => err.status === 403
  );
});

test('POST /solicitudes deriva el cliente desde el token e ignora el body', async () => {
  const { usuario, cliente } = await crearCliente();
  const otro = await crearCliente();
  const analisis = await crearAnalisis('Analisis HTTP 1', 1000);
  const token = tokenPara(usuario, ROLES.CLIENTE);

  const res = await pedir('/api/v1/solicitudes', {
    method: 'POST',
    token,
    body: {
      cliente: String(otro.cliente._id),
      analisis: [String(analisis._id)],
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.datos.estado, ESTADO_SOLICITUD.REGISTRADA);
  assert.equal(String(res.body.datos.cliente._id), String(cliente._id));
});

test('GET /solicitudes/mias solo devuelve las solicitudes propias', async () => {
  const a = await crearCliente();
  const b = await crearCliente();
  const analisis = await crearAnalisis('Analisis HTTP 2', 1000);

  const solA = await crearSolicitud({
    clienteId: a.cliente._id,
    analisis: [analisis._id],
    usuarioId: a.usuario._id,
  });
  const solB = await crearSolicitud({
    clienteId: b.cliente._id,
    analisis: [analisis._id],
    usuarioId: b.usuario._id,
  });

  const tokenA = tokenPara(a.usuario, ROLES.CLIENTE);
  const tokenB = tokenPara(b.usuario, ROLES.CLIENTE);

  const mias = await pedir('/api/v1/solicitudes/mias', { token: tokenA });
  assert.equal(mias.status, 200);
  assert.equal(mias.body.datos.total, 1);
  assert.equal(String(mias.body.datos.items[0]._id), String(solA._id));

  const ajena = await pedir(`/api/v1/solicitudes/${solB._id}`, { token: tokenA });
  assert.equal(ajena.status, 403);
});

test('POST /cotizaciones (coordinador) transiciona la solicitud', async () => {
  const { usuario, cliente } = await crearCliente();
  const coordinador = await crearCoordinador();
  const analisis = await crearAnalisis('Analisis HTTP 3', 1000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });

  const tokenCoord = tokenPara(coordinador, ROLES.COORDINADOR);
  const res = await pedir('/api/v1/cotizaciones', {
    method: 'POST',
    token: tokenCoord,
    body: {
      solicitud: String(solicitud._id),
      detalle: [{ analisis: String(analisis._id) }],
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.datos.estado, 'PENDIENTE');
  assert.equal(res.body.datos.solicitud.estado, ESTADO_SOLICITUD.COTIZADA);
});

test('PATCH decision y GET /cotizaciones/mias funcionan para el cliente', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis('Analisis HTTP 4', 1000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  const token = tokenPara(usuario, ROLES.CLIENTE);
  const decision = await pedir(
    `/api/v1/cotizaciones/${cotizacion._id}/decision`,
    {
      method: 'PATCH',
      token,
      body: { decision: 'RECHAZADA', motivo_rechazo: 'Muy caro' },
    }
  );

  assert.equal(decision.status, 200);
  assert.equal(decision.body.datos.estado, 'RECHAZADA');

  const mias = await pedir('/api/v1/cotizaciones/mias', { token });
  assert.equal(mias.status, 200);
  assert.equal(mias.body.datos.total, 1);
  assert.equal(String(mias.body.datos.items[0]._id), String(cotizacion._id));
});

test('PUT /solicitudes/:id rechaza editar una solicitud ya cotizada', async () => {
  const { usuario, cliente } = await crearCliente();
  const coordinador = await crearCoordinador();
  const analisis = await crearAnalisis('Analisis HTTP 5', 1000);

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  const tokenCoord = tokenPara(coordinador, ROLES.COORDINADOR);
  const res = await pedir(`/api/v1/solicitudes/${solicitud._id}`, {
    method: 'PUT',
    token: tokenCoord,
    body: { descripcion_inicial: 'Cambio tardio' },
  });

  assert.equal(res.status, 409);
});

test('decidirCotizacion rechaza un motivo vacio', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis('Analisis HTTP 6', 1000);
  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  await assert.rejects(
    () =>
      decidirCotizacion({
        cotizacionId: cotizacion._id,
        decision: 'RECHAZADA',
        motivoRechazo: '   ',
        usuarioId: usuario._id,
      }),
    (err) => err.status === 400
  );

  const recargada = await Solicitud.findById(solicitud._id);
  assert.equal(recargada.estado, ESTADO_SOLICITUD.COTIZADA);
});
