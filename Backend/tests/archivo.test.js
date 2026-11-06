/**
 * Pruebas del subdocumento de metadatos de archivos en R2.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import archivoSchema from '../src/models/comunes/archivo.js';

const Archivo =
  mongoose.models.ArchivoTest || mongoose.model('ArchivoTest', archivoSchema);

test('archivoSchema aplica defaults y exige bucket, key y content_type', () => {
  const valido = new Archivo({
    bucket: 'labficat',
    key: 'firmas/firma.png',
    content_type: 'image/png',
  });

  assert.equal(valido.proveedor, 'r2');
  assert.equal(valido.validateSync(), undefined);

  const invalido = new Archivo({});
  const error = invalido.validateSync();

  assert.ok(error?.errors?.bucket);
  assert.ok(error?.errors?.key);
  assert.ok(error?.errors?.content_type);
});
