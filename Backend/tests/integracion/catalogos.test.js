/**
 * Pruebas de caracterizacion: catalogos.
 *
 * Protegen el contrato HTTP del modulo refactorizado en la Fase 2B:
 * tipologias, tipos de muestra, parametros, etapas, analisis y configuracion.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import Rol from '../../src/models/seguridad/Rol.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import TipologiaPoblacional from '../../src/models/clientes/TipologiaPoblacional.js';
import TipoMuestra from '../../src/models/laboratorio/TipoMuestra.js';
import Parametro from '../../src/models/laboratorio/Parametro.js';
import EtapaProceso from '../../src/models/laboratorio/EtapaProceso.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import ConfiguracionSistema from '../../src/models/sistema/ConfiguracionSistema.js';

let replSet;
let server;
let base;
let tokenCoordinador;
let tokenCliente;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('labficat_test_catalogos'));

  await Promise.all([
    Rol.init(),
    Usuario.init(),
    TipologiaPoblacional.init(),
    TipoMuestra.init(),
    Parametro.init(),
    EtapaProceso.init(),
    Analisis.init(),
    ConfiguracionSistema.init(),
  ]);

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
    ConfiguracionSistema.deleteMany({}),
    Analisis.deleteMany({}),
    EtapaProceso.deleteMany({}),
    Parametro.deleteMany({}),
    TipoMuestra.deleteMany({}),
    TipologiaPoblacional.deleteMany({}),
    Usuario.deleteMany({}),
    Rol.deleteMany({}),
  ]);

  const rolCoordinador = await Rol.create({ nombre: 'coordinador' });
  const rolCliente = await Rol.create({ nombre: 'cliente' });

  const coordinador = await Usuario.create({
    rol: rolCoordinador._id,
    nombres: 'Coordinador',
    apellidos: 'Catalogo',
    tipo_documento: 'CC',
    numero_documento: '900000010',
    correo: 'catalogos@test.local',
  });
  const cliente = await Usuario.create({
    rol: rolCliente._id,
    nombres: 'Cliente',
    apellidos: 'Catalogo',
    tipo_documento: 'CC',
    numero_documento: '900000011',
    correo: 'clientecat@test.local',
  });

  tokenCoordinador = firmar({ sub: String(coordinador._id), rol: 'coordinador' });
  tokenCliente = firmar({ sub: String(cliente._id), rol: 'cliente' });
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

test('tipologias: crear, listar, duplicado y proteccion de NINGUNA', async () => {
  const creada = await pedir('/catalogos/tipologias', {
    method: 'POST',
    token: tokenCoordinador,
    body: { nombre: 'Aprendiz SENA', descripcion: 'Interna' },
  });
  assert.equal(creada.status, 201);

  const duplicada = await pedir('/catalogos/tipologias', {
    method: 'POST',
    token: tokenCoordinador,
    body: { nombre: 'aprendiz sena' },
  });
  assert.equal(duplicada.status, 409);

  const listado = await pedir('/catalogos/tipologias?soloActivas=true');
  assert.equal(listado.status, 200);
  assert.ok(Array.isArray(listado.json.datos));
  assert.equal(listado.json.datos.length, 1);

  const paginado = await pedir('/catalogos/tipologias?limit=5');
  assert.equal(paginado.status, 200);
  assert.equal(paginado.json.datos.total, 1);
  assert.equal(paginado.json.datos.page, 1);

  const ninguna = await TipologiaPoblacional.create({
    nombre: 'Ninguna de las anteriores',
    codigo: 'NINGUNA',
    activo: false,
  });
  const reactivar = await pedir(`/catalogos/tipologias/${ninguna._id}/estado`, {
    method: 'PATCH',
    token: tokenCoordinador,
    body: { activo: true },
  });
  assert.equal(reactivar.status, 409);

  const sinPermiso = await pedir('/catalogos/tipologias', {
    method: 'POST',
    token: tokenCliente,
    body: { nombre: 'No permitida' },
  });
  assert.equal(sinPermiso.status, 403);
});

test('tipos de muestra y parametros: CRUD y cambio de estado', async () => {
  const tipo = await pedir('/catalogos/tipos-muestra', {
    method: 'POST',
    token: tokenCoordinador,
    body: { nombre: 'Agua', estado_fisico: 'LIQUIDO' },
  });
  assert.equal(tipo.status, 201);

  const tipos = await pedir('/catalogos/tipos-muestra', { token: tokenCliente });
  assert.equal(tipos.status, 200);
  assert.equal(tipos.json.datos.length, 1);

  const tipoEstado = await pedir(`/catalogos/tipos-muestra/${tipo.json.datos._id}/estado`, {
    method: 'PATCH',
    token: tokenCoordinador,
    body: { activo: false },
  });
  assert.equal(tipoEstado.status, 200);

  const parametro = await pedir('/catalogos/parametros', {
    method: 'POST',
    token: tokenCoordinador,
    body: { nombre: 'pH', unidad_medida: 'unidades' },
  });
  assert.equal(parametro.status, 201);

  const parametroEstado = await pedir(`/catalogos/parametros/${parametro.json.datos._id}/estado`, {
    method: 'PATCH',
    token: tokenCoordinador,
    body: { activo: false },
  });
  assert.equal(parametroEstado.status, 200);
  assert.equal(parametroEstado.json.datos.activo, false);
});

test('etapas: orden oficial y CRUD', async () => {
  const etapa = await pedir('/catalogos/etapas', {
    method: 'POST',
    token: tokenCoordinador,
    body: { nombre: 'Recepcion', orden: 1 },
  });
  assert.equal(etapa.status, 201);

  const oficial = await pedir('/catalogos/etapas', { token: tokenCliente });
  assert.equal(oficial.status, 200);
  assert.equal(oficial.json.mensaje, 'Etapas listadas en orden oficial');

  const todas = await pedir('/catalogos/etapas?todas=true', { token: tokenCliente });
  assert.equal(todas.status, 200);
  assert.equal(todas.json.mensaje, 'Etapas listadas');
});

test('analisis: crea con referencias, valida y cambia estado', async () => {
  const tipo = await TipoMuestra.create({ nombre: 'Suelo', estado_fisico: 'SOLIDO' });
  const parametro = await Parametro.create({ nombre: 'Materia organica' });

  const creado = await pedir('/catalogos/analisis', {
    method: 'POST',
    token: tokenCoordinador,
    body: {
      nombre: 'Analisis de suelo',
      tarifa_externo: 25000,
      parametros: [String(parametro._id)],
      tipos_muestra: [String(tipo._id)],
    },
  });
  assert.equal(creado.status, 201);
  assert.equal(creado.json.datos.parametros.length, 1);

  const detalle = await pedir(`/catalogos/analisis/${creado.json.datos._id}`, {
    token: tokenCliente,
  });
  assert.equal(detalle.status, 200);

  const invalido = await pedir('/catalogos/analisis', {
    method: 'POST',
    token: tokenCoordinador,
    body: {
      nombre: 'Sin referencias validas',
      tarifa_externo: 1000,
      parametros: [String(new mongoose.Types.ObjectId())],
    },
  });
  assert.equal(invalido.status, 400);

  const actualizado = await pedir(`/catalogos/analisis/${creado.json.datos._id}`, {
    method: 'PUT',
    token: tokenCoordinador,
    body: { tarifa_externo: 30000 },
  });
  assert.equal(actualizado.status, 200);
  assert.equal(actualizado.json.datos.tarifa_externo, 30000);

  const estado = await pedir(`/catalogos/analisis/${creado.json.datos._id}/estado`, {
    method: 'PATCH',
    token: tokenCoordinador,
    body: { activo: false },
  });
  assert.equal(estado.status, 200);
  assert.equal(estado.json.datos.activo, false);
});

test('configuracion: upsert, consulta y clave inexistente', async () => {
  const guardada = await pedir('/catalogos/configuracion/CUPON_VIGENCIA_DIAS', {
    method: 'PUT',
    token: tokenCoordinador,
    body: { valor: '7', descripcion: 'Vigencia del cupon' },
  });
  assert.equal(guardada.status, 200);
  assert.equal(guardada.json.datos.valor, '7');

  const consulta = await pedir('/catalogos/configuracion/CUPON_VIGENCIA_DIAS', {
    token: tokenCoordinador,
  });
  assert.equal(consulta.status, 200);

  const inexistente = await pedir('/catalogos/configuracion/NO_EXISTE', {
    token: tokenCoordinador,
  });
  assert.equal(inexistente.status, 404);

  const listado = await pedir('/catalogos/configuracion', { token: tokenCoordinador });
  assert.equal(listado.status, 200);
  assert.equal(listado.json.datos.length, 1);
});
