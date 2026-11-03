/**
 * Pruebas de caracterizacion: auth y clientes.
 *
 * Protegen el contrato HTTP de los modulos refactorizados en la Fase 2B:
 * registro, login, perfil, cambio de contrasena y CRUD de clientes.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import Rol from '../../src/models/seguridad/Rol.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import TipologiaPoblacional from '../../src/models/clientes/TipologiaPoblacional.js';
import TokenRecuperacion from '../../src/models/seguridad/TokenRecuperacion.js';

let replSet;
let server;
let base;
let rolCliente;
let rolCoordinador;
let tipologiaExterna;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('labficat_test_auth_clientes'));

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
    TokenRecuperacion.deleteMany({}),
    Cliente.deleteMany({}),
    Usuario.deleteMany({}),
    Rol.deleteMany({}),
    TipologiaPoblacional.deleteMany({}),
  ]);

  rolCliente = await Rol.create({ nombre: 'cliente' });
  rolCoordinador = await Rol.create({ nombre: 'coordinador' });
  tipologiaExterna = await TipologiaPoblacional.create({
    nombre: 'Persona natural',
    codigo: 'PERSONA_NATURAL',
    es_interno: false,
  });
});

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

async function crearCoordinador() {
  const usuario = await Usuario.create({
    rol: rolCoordinador._id,
    nombres: 'Coordinador',
    apellidos: 'Prueba',
    tipo_documento: 'CC',
    numero_documento: '900000001',
    correo: 'coordinador@test.local',
  });
  return { usuario, token: firmar({ sub: String(usuario._id), rol: 'coordinador' }) };
}

function datosRegistro(extra = {}) {
  return {
    nombres: 'Ana',
    apellidos: 'Perez',
    tipo_documento: 'CC',
    numero_documento: '100000001',
    correo: 'ana@test.local',
    contrasena: 'Labficat123*',
    tipologia: String(tipologiaExterna._id),
    telefono: '3001234567',
    direccion: 'Calle 1 #2-3',
    ciudad: 'Bogota',
    departamento: 'Cundinamarca',
    cargo: 'Analista',
    persona_contacto: 'Ana Perez',
    acepta_tratamiento_datos: true,
    ...extra,
  };
}

test('registro crea usuario + cliente y deriva tipo_cliente de la tipologia', async () => {
  const { status, json } = await pedir('/auth/registro', {
    method: 'POST',
    body: datosRegistro(),
  });

  assert.equal(status, 201);
  assert.equal(json.ok, true);
  assert.ok(json.datos.token);
  assert.equal(json.datos.cliente.tipo_cliente, 'EXTERNO');
  assert.equal(json.datos.cliente.direccion, 'Calle 1 #2-3');
  assert.equal(json.datos.usuario.correo, 'ana@test.local');
  assert.equal(json.datos.usuario.contrasena_hash, undefined);
});

test('registro rechaza datos de tratamiento y correos duplicados', async () => {
  const sinAceptar = await pedir('/auth/registro', {
    method: 'POST',
    body: datosRegistro({ acepta_tratamiento_datos: false }),
  });
  assert.equal(sinAceptar.status, 400);

  const primero = await pedir('/auth/registro', { method: 'POST', body: datosRegistro() });
  assert.equal(primero.status, 201);

  const duplicado = await pedir('/auth/registro', {
    method: 'POST',
    body: datosRegistro({ numero_documento: '100000002' }),
  });
  assert.equal(duplicado.status, 409);
});

test('login, perfil y cambio de contrasena funcionan de punta a punta', async () => {
  await pedir('/auth/registro', { method: 'POST', body: datosRegistro() });

  const login = await pedir('/auth/login', {
    method: 'POST',
    body: { correo: 'ana@test.local', contrasena: 'Labficat123*' },
  });
  assert.equal(login.status, 200);
  const token = login.json.datos.token;

  const perfil = await pedir('/auth/perfil', { token });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.json.datos.usuario.correo, 'ana@test.local');
  assert.equal(perfil.json.datos.cliente.acepta_tratamiento_datos, true);

  const cambio = await pedir('/auth/contrasena', {
    method: 'PATCH',
    token,
    body: { actual: 'Labficat123*', nueva: 'NuevaClave123*' },
  });
  assert.equal(cambio.status, 200);

  const anterior = await pedir('/auth/login', {
    method: 'POST',
    body: { correo: 'ana@test.local', contrasena: 'Labficat123*' },
  });
  assert.equal(anterior.status, 401);

  const nuevo = await pedir('/auth/login', {
    method: 'POST',
    body: { correo: 'ana@test.local', contrasena: 'NuevaClave123*' },
  });
  assert.equal(nuevo.status, 200);
});

test('login rechaza credenciales invalidas y usuarios desactivados', async () => {
  await pedir('/auth/registro', { method: 'POST', body: datosRegistro() });

  const invalido = await pedir('/auth/login', {
    method: 'POST',
    body: { correo: 'ana@test.local', contrasena: 'incorrecta' },
  });
  assert.equal(invalido.status, 401);

  await Usuario.updateOne({ correo: 'ana@test.local' }, { $set: { activo: false } });
  const desactivado = await pedir('/auth/login', {
    method: 'POST',
    body: { correo: 'ana@test.local', contrasena: 'Labficat123*' },
  });
  assert.equal(desactivado.status, 403);
});

test('clientes: CRUD de coordinador, filtros y permisos', async () => {
  const { token: tokenCoordinador } = await crearCoordinador();

  const creado = await pedir('/clientes', {
    method: 'POST',
    token: tokenCoordinador,
    body: {
      nombres: 'Carlos',
      apellidos: 'Gomez',
      tipo_documento: 'CC',
      numero_documento: '200000001',
      correo: 'carlos@test.local',
      tipologia: String(tipologiaExterna._id),
      telefono: '3100000000',
    },
  });
  assert.equal(creado.status, 201);
  assert.equal(creado.json.datos.tipo_cliente, 'EXTERNO');

  const duplicado = await pedir('/clientes', {
    method: 'POST',
    token: tokenCoordinador,
    body: {
      nombres: 'Otro',
      apellidos: 'Cliente',
      tipo_documento: 'CC',
      numero_documento: '200000001',
      correo: 'otro@test.local',
      tipologia: String(tipologiaExterna._id),
    },
  });
  assert.equal(duplicado.status, 409);

  const listado = await pedir('/clientes?search=Carlos&limit=5', { token: tokenCoordinador });
  assert.equal(listado.status, 200);
  assert.equal(listado.json.datos.items.length, 1);
  assert.equal(listado.json.datos.total, 1);

  const actualizado = await pedir(`/clientes/${creado.json.datos._id}`, {
    method: 'PUT',
    token: tokenCoordinador,
    body: { telefono: '3200000000', ciudad: 'Medellin' },
  });
  assert.equal(actualizado.status, 200);
  assert.equal(actualizado.json.datos.telefono, '3200000000');
  assert.equal(actualizado.json.datos.ciudad, 'Medellin');

  const desactivado = await pedir(`/clientes/${creado.json.datos._id}/desactivar`, {
    method: 'PATCH',
    token: tokenCoordinador,
  });
  assert.equal(desactivado.status, 200);
  assert.equal(desactivado.json.datos.usuario.activo, false);

  const reactivado = await pedir(`/clientes/${creado.json.datos._id}/reactivar`, {
    method: 'PATCH',
    token: tokenCoordinador,
  });
  assert.equal(reactivado.status, 200);
  assert.equal(reactivado.json.datos.usuario.activo, true);

  const cliente = await Usuario.create({
    rol: rolCliente._id,
    nombres: 'Cliente',
    apellidos: 'Sin Permiso',
    tipo_documento: 'CC',
    numero_documento: '300000001',
    correo: 'sinpermiso@test.local',
  });
  const tokenCliente = firmar({ sub: String(cliente._id), rol: 'cliente' });
  const prohibido = await pedir('/clientes', { token: tokenCliente });
  assert.equal(prohibido.status, 403);
});
