/**
 * Pruebas de validacion de archivos y utilidades de nombres.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarArchivo,
  extensionDeMime,
  nombreSeguro,
} from '../src/utils/archivos.js';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

test('validarArchivo acepta un PNG real', async () => {
  const tipo = await validarArchivo(PNG_1X1, { permitidos: ['image/png'] });
  assert.equal(tipo.mime, 'image/png');
  assert.equal(tipo.ext, 'png');
});

test('validarArchivo rechaza contenido que no es imagen', async () => {
  await assert.rejects(
    () => validarArchivo(Buffer.from('hola mundo'), { permitidos: ['image/png'] }),
    (error) => error.status === 400
  );
});

test('validarArchivo respeta el tamano maximo', async () => {
  await assert.rejects(
    () => validarArchivo(PNG_1X1, { maxBytes: 4 }),
    (error) => error.status === 400
  );
});

test('extensionDeMime y nombreSeguro normalizan valores', () => {
  assert.equal(extensionDeMime('image/png'), 'png');
  assert.equal(extensionDeMime('application/pdf'), 'pdf');
  assert.equal(extensionDeMime('text/plain'), null);

  assert.equal(nombreSeguro('firma cliente/2026.png'), 'firma_cliente_2026.png');
  assert.equal(nombreSeguro(''), 'archivo');
});
