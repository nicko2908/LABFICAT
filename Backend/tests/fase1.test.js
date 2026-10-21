/**
 * Pruebas de regresion de la Fase 1 (sin base de datos).
 *
 * Cubre los helpers introducidos y las restricciones de modelo que
 * desbloquean el registro de clientes (tipologia NINGUNA).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { parseBoolean } from '../src/utils/booleanos.js';
import {
  escaparRegex,
  crearRegexBusqueda,
  MAX_LONGITUD_BUSQUEDA,
} from '../src/utils/regex.js';
import {
  TIPOLOGIA_CODIGO,
  TIPOLOGIA_NINGUNA_NOMBRE,
} from '../src/config/constants.js';
import Cliente from '../src/models/clientes/Cliente.js';
import TipologiaPoblacional from '../src/models/clientes/TipologiaPoblacional.js';
import { resolverTipologia } from '../src/utils/tipologias.js';

test('parseBoolean acepta solo valores booleanos conocidos', () => {
  assert.equal(parseBoolean(true), true);
  assert.equal(parseBoolean(false), false);
  assert.equal(parseBoolean(1), true);
  assert.equal(parseBoolean(0), false);
  assert.equal(parseBoolean('true'), true);
  assert.equal(parseBoolean('false'), false);
  assert.equal(parseBoolean(' TRUE '), true);
  assert.equal(parseBoolean('FALSE'), false);
  assert.equal(parseBoolean('1'), true);
  assert.equal(parseBoolean('0'), false);
});

test('parseBoolean rechaza valores ambiguos', () => {
  assert.equal(parseBoolean('si'), null);
  assert.equal(parseBoolean('no'), null);
  assert.equal(parseBoolean('2'), null);
  assert.equal(parseBoolean(''), null);
  assert.equal(parseBoolean(null), null);
  assert.equal(parseBoolean(undefined), null);
  assert.equal(parseBoolean({}), null);
});

test('escaparRegex neutraliza metacaracteres', () => {
  const patron = escaparRegex('[a-z]+');
  assert.equal(patron, '\\[a-z\\]\\+');
  assert.doesNotThrow(() => new RegExp(patron, 'i'));
});

test('crearRegexBusqueda no lanza con un corchete suelto', () => {
  const rx = crearRegexBusqueda('[');
  assert.ok(rx instanceof RegExp);
  assert.equal(rx.test('codigo[1]'), true);
});

test('crearRegexBusqueda devuelve null para terminos vacios', () => {
  assert.equal(crearRegexBusqueda(''), null);
  assert.equal(crearRegexBusqueda('   '), null);
  assert.equal(crearRegexBusqueda(undefined), null);
});

test('crearRegexBusqueda limita la longitud del termino', () => {
  assert.throws(
    () => crearRegexBusqueda('a'.repeat(MAX_LONGITUD_BUSQUEDA + 1)),
    (err) => err.status === 400
  );
});

test('Cliente exige tipologia', () => {
  const cliente = new Cliente({
    usuario: new mongoose.Types.ObjectId(),
    tipologia: null,
    tipo_cliente: 'EXTERNO',
    acepta_tratamiento_datos: false,
  });
  const error = cliente.validateSync();
  assert.ok(error);
  assert.equal(error.errors.tipologia.kind, 'required');
});

test('TipologiaPoblacional define codigo unico, sparse y en mayusculas', () => {
  const path = TipologiaPoblacional.schema.path('codigo');
  assert.ok(path);
  assert.equal(path.options.unique, true);
  assert.equal(path.options.sparse, true);
  assert.equal(path.options.uppercase, true);

  const doc = new TipologiaPoblacional({ nombre: 'Prueba', codigo: ' ninguna ' });
  assert.equal(doc.codigo, 'NINGUNA');
});

test('La constante NINGUNA es estable', () => {
  assert.equal(TIPOLOGIA_CODIGO.NINGUNA, 'NINGUNA');
  assert.equal(TIPOLOGIA_NINGUNA_NOMBRE, 'Ninguna de las anteriores');
});

test('resolverTipologia exige tipologia en autorregistro', async () => {
  await assert.rejects(
    () => resolverTipologia(undefined),
    (err) => err.status === 400
  );
});

test('resolverTipologia traduce un id invalido a 400 (no 500)', async () => {
  await assert.rejects(
    () => resolverTipologia('no-es-un-objectid'),
    (err) => err.status === 400
  );
});
