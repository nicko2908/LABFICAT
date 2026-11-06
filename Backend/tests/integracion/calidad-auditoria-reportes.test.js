/**
 * Pruebas de caracterizacion: auditoria, reportes y reclamaciones.
 *
 * Protegen el contrato HTTP de los modulos refactorizados en la Fase 2B.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import Rol from '../../src/models/seguridad/Rol.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Auditoria from '../../src/models/seguridad/Auditoria.js';
import TokenRecuperacion from '../../src/models/seguridad/TokenRecuperacion.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import Muestra from '../../src/models/laboratorio/Muestra.js';
import Encuesta from '../../src/models/calidad/Encuesta.js';
import Reclamacion from '../../src/models/calidad/Reclamacion.js';
import Contador from '../../src/models/sistema/Contador.js';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const s3Mock = mockClient(S3Client);

let replSet;
let server;
let base;
let rolCoordinador;
let rolCliente;
let coordinador;
let usuarioCliente;
let cliente;
let solicitud;

before(async () => {
  s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag"' });
  s3Mock.on(GetObjectCommand).resolves({
    Body: { transformToByteArray: async () => PNG_1X1 },
  });

  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('labficat_test_calidad'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    Contador.deleteMany({}),
    Reclamacion.deleteMany({}),
    Encuesta.deleteMany({}),
    Muestra.deleteMany({}),
    Solicitud.deleteMany({}),
    Auditoria.deleteMany({}),
    TokenRecuperacion.deleteMany({}),
    Cliente.deleteMany({}),
    Usuario.deleteMany({}),
    Rol.deleteMany({}),
  ]);

  rolCoordinador = await Rol.create({ nombre: 'coordinador' });
  rolCliente = await Rol.create({ nombre: 'cliente' });

  coordinador = await Usuario.create({
    rol: rolCoordinador._id,
    nombres: 'Coordinador',
    apellidos: 'Calidad',
    tipo_documento: 'CC',
    numero_documento: '910000001',
    correo: 'calidad@test.local',
  });

  usuarioCliente = new Usuario({
    rol: rolCliente._id,
    nombres: 'Cliente',
    apellidos: 'Calidad',
    tipo_documento: 'CC',
    numero_documento: '910000002',
    correo: 'clientecalidad@test.local',
  });
  await usuarioCliente.establecerContrasena('ClaveInicial123*');
  await usuarioCliente.save();

  cliente = await Cliente.create({
    usuario: usuarioCliente._id,
    tipologia: new mongoose.Types.ObjectId(),
    tipo_cliente: 'EXTERNO',
    acepta_tratamiento_datos: true,
  });

  solicitud = await Solicitud.create({ cliente: cliente._id });
});

function tokenCoordinador() {
  return firmar({ sub: String(coordinador._id), rol: 'coordinador' });
}

function tokenCliente() {
  return firmar({ sub: String(usuarioCliente._id), rol: 'cliente' });
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
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function pedirForm(ruta, { method = 'POST', token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${ruta}`, {
    method,
    headers,
    body: form,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers };
}

test('auditoria: registra, lista y aisla por rol', async () => {
  const registrada = await pedir('/auditoria', {
    method: 'POST',
    token: tokenCoordinador(),
    body: { usuario: String(coordinador._id), accion: 'CREAR_ANALISIS', ip: '10.0.0.1' },
  });
  assert.equal(registrada.status, 201);
  assert.equal(registrada.json.datos.accion, 'CREAR_ANALISIS');

  const listado = await pedir('/auditoria?accion=CREAR', { token: tokenCoordinador() });
  assert.equal(listado.status, 200);
  assert.equal(listado.json.datos.total, 1);

  const detalle = await pedir(`/auditoria/${registrada.json.datos._id}`, {
    token: tokenCoordinador(),
  });
  assert.equal(detalle.status, 200);

  const prohibido = await pedir('/auditoria', { token: tokenCliente() });
  assert.equal(prohibido.status, 403);
});

test('recuperacion de contrasena: token de un solo uso', async () => {
  const solicitar = await pedir('/auditoria/recuperacion/solicitar', {
    method: 'POST',
    body: { correo: 'clientecalidad@test.local' },
  });
  assert.equal(solicitar.status, 200);
  assert.ok(solicitar.json.datos.token);

  const consumir = await pedir('/auditoria/recuperacion/consumir', {
    method: 'POST',
    body: { token: solicitar.json.datos.token, nueva: 'ClaveNueva123*' },
  });
  assert.equal(consumir.status, 200);

  const repetido = await pedir('/auditoria/recuperacion/consumir', {
    method: 'POST',
    body: { token: solicitar.json.datos.token, nueva: 'OtraClave123*' },
  });
  assert.equal(repetido.status, 400);

  const login = await pedir('/auth/login', {
    method: 'POST',
    body: { correo: 'clientecalidad@test.local', contrasena: 'ClaveNueva123*' },
  });
  assert.equal(login.status, 200);

  const desconocido = await pedir('/auditoria/recuperacion/solicitar', {
    method: 'POST',
    body: { correo: 'nadie@test.local' },
  });
  assert.equal(desconocido.status, 200);
  assert.equal(desconocido.json.datos, null);
});

test('reportes: resumenes de lectura y satisfaccion', async () => {
  const solicitudes = await pedir('/reportes/solicitudes', { token: tokenCoordinador() });
  assert.equal(solicitudes.status, 200);
  assert.equal(solicitudes.json.datos.total, 1);

  const muestras = await pedir('/reportes/muestras', { token: tokenCoordinador() });
  assert.equal(muestras.status, 200);
  assert.ok(Array.isArray(muestras.json.datos.porRecepcion));

  const operacion = await pedir('/reportes/operacion', { token: tokenCoordinador() });
  assert.equal(operacion.status, 200);
  assert.equal(operacion.json.datos.informesGenerados, 0);

  const sinEncuestas = await pedir('/reportes/satisfaccion', { token: tokenCoordinador() });
  assert.equal(sinEncuestas.status, 404);

  await Encuesta.create({
    solicitud: solicitud._id,
    satisfaccion_general: 5,
    tiempo_entrega: 4,
    atencion_personal: 5,
    claridad_informe: 4,
    recomendaria_servicio: true,
  });

  const conEncuestas = await pedir('/reportes/satisfaccion', { token: tokenCoordinador() });
  assert.equal(conEncuestas.status, 200);
  assert.equal(conEncuestas.json.datos.total, 1);
  assert.equal(conEncuestas.json.datos.satisfaccion_general, 5);
});

test('reclamaciones: crea, agrega evidencia y resuelve', async () => {
  const creada = await pedir('/reclamaciones', {
    method: 'POST',
    token: tokenCliente(),
    body: { solicitud: String(solicitud._id), motivo: 'Resultado incompleto' },
  });
  assert.equal(creada.status, 201);
  assert.match(creada.json.datos.codigo_soporte, /^REC-\d{4}-\d{4}$/);

  const detalle = await pedir(`/reclamaciones/${creada.json.datos._id}`, {
    token: tokenCliente(),
  });
  assert.equal(detalle.status, 200);

  const misReclamaciones = await pedir('/reclamaciones/mias', {
    token: tokenCliente(),
  });
  assert.equal(misReclamaciones.status, 200);
  assert.equal(misReclamaciones.json.datos.total, 1);

  const form = new FormData();
  form.append('evidencias', new Blob([PNG_1X1], { type: 'image/png' }), 'foto.png');

  const evidencia = await pedirForm(
    `/reclamaciones/${creada.json.datos._id}/evidencias`,
    { token: tokenCliente(), form }
  );
  assert.equal(evidencia.status, 200);
  assert.equal(evidencia.json.datos.evidencias.length, 1);

  const archivo = evidencia.json.datos.evidencias[0].archivo;
  assert.equal(archivo.content_type, 'image/png');
  assert.match(archivo.key, /^evidencias\//);

  const descarga = await fetch(
    `${base}/reclamaciones/${creada.json.datos._id}/evidencias/${evidencia.json.datos.evidencias[0]._id}`,
    { headers: { Authorization: `Bearer ${tokenCoordinador()}` } }
  );
  assert.equal(descarga.status, 200);
  assert.equal(descarga.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await descarga.arrayBuffer()), PNG_1X1);

  const invalida = await pedir(`/reclamaciones/${creada.json.datos._id}/estado`, {
    method: 'PATCH',
    token: tokenCoordinador(),
    body: { estado: 'NO_EXISTE' },
  });
  assert.equal(invalida.status, 400);

  const resuelta = await pedir(`/reclamaciones/${creada.json.datos._id}/estado`, {
    method: 'PATCH',
    token: tokenCoordinador(),
    body: { estado: 'RESUELTA' },
  });
  assert.equal(resuelta.status, 200);
  assert.ok(resuelta.json.datos.fecha_resolucion);

  const listado = await pedir('/reclamaciones', { token: tokenCoordinador() });
  assert.equal(listado.status, 200);
  assert.equal(listado.json.datos.total, 1);
});

test('reclamaciones: rechaza evidencia con contenido que no es imagen', async () => {
  const creada = await pedir('/reclamaciones', {
    method: 'POST',
    token: tokenCliente(),
    body: { solicitud: String(solicitud._id), motivo: 'Evidencia falsa' },
  });
  assert.equal(creada.status, 201);

  const form = new FormData();
  form.append(
    'evidencias',
    new Blob([Buffer.from('no soy una imagen')], { type: 'image/png' }),
    'falsa.png'
  );

  const res = await pedirForm(
    `/reclamaciones/${creada.json.datos._id}/evidencias`,
    { token: tokenCliente(), form }
  );

  assert.equal(res.status, 400);
  assert.match(res.json.mensaje, /formato permitido/i);
});

test('reclamaciones: rechaza mas de cinco evidencias', async () => {
  const creada = await pedir('/reclamaciones', {
    method: 'POST',
    token: tokenCliente(),
    body: { solicitud: String(solicitud._id), motivo: 'Demasiadas evidencias' },
  });
  assert.equal(creada.status, 201);

  const form = new FormData();
  for (let indice = 0; indice < 6; indice += 1) {
    form.append(
      'evidencias',
      new Blob([PNG_1X1], { type: 'image/png' }),
      `foto-${indice}.png`
    );
  }

  const res = await pedirForm(
    `/reclamaciones/${creada.json.datos._id}/evidencias`,
    { token: tokenCliente(), form }
  );

  assert.equal(res.status, 400);
  assert.match(res.json.mensaje, /demasiados archivos/i);
});
