/**
 * Pruebas unitarias de la capa de storage R2.
 * El SDK de AWS se mockea: no se hacen llamadas reales a Cloudflare.
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  subirArchivo,
  descargarArchivo,
  eliminarArchivo,
  urlFirmada,
  subirFirma,
} from '../src/services/storage.service.js';
import { getR2 } from '../src/config/r2.js';

const s3Mock = mockClient(S3Client);

// PNG 1x1 valido.
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

beforeEach(() => {
  s3Mock.reset();
});

test('getR2 devuelve un cliente S3 configurado', async () => {
  const client = getR2();
  assert.ok(client instanceof S3Client);
  assert.equal(await client.config.region(), 'auto');
});

test('subirArchivo envia PutObject con bucket, key, tipo y metadata', async () => {
  s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag"' });

  const resultado = await subirArchivo({
    buffer: Buffer.from('hola'),
    key: 'pruebas/a.txt',
    contentType: 'text/plain',
    metadata: { sha256: 'abc', numero: 1 },
  });

  const llamadas = s3Mock.commandCalls(PutObjectCommand);
  assert.equal(llamadas.length, 1);

  const input = llamadas[0].args[0].input;
  assert.equal(input.Bucket, 'labficat-test');
  assert.equal(input.Key, 'pruebas/a.txt');
  assert.equal(input.ContentType, 'text/plain');
  assert.deepEqual(input.Metadata, { sha256: 'abc', numero: '1' });

  assert.deepEqual(resultado, {
    proveedor: 'r2',
    bucket: 'labficat-test',
    key: 'pruebas/a.txt',
    content_type: 'text/plain',
    bytes: 4,
  });
});

test('descargarArchivo devuelve el Buffer del objeto', async () => {
  s3Mock.on(GetObjectCommand).resolves({
    Body: {
      transformToByteArray: async () => Buffer.from('contenido'),
    },
  });

  const buffer = await descargarArchivo('pruebas/a.txt');
  assert.equal(buffer.toString(), 'contenido');
});

test('descargarArchivo traduce NoSuchKey a 404', async () => {
  s3Mock.on(GetObjectCommand).rejects(
    Object.assign(new Error('NoSuchKey'), {
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 },
    })
  );

  await assert.rejects(
    () => descargarArchivo('no-existe.txt'),
    (error) => error.status === 404
  );
});

test('eliminarArchivo envia DeleteObject', async () => {
  s3Mock.on(DeleteObjectCommand).resolves({});

  const resultado = await eliminarArchivo('pruebas/a.txt');

  const llamadas = s3Mock.commandCalls(DeleteObjectCommand);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].args[0].input.Bucket, 'labficat-test');
  assert.equal(llamadas[0].args[0].input.Key, 'pruebas/a.txt');
  assert.deepEqual(resultado, { key: 'pruebas/a.txt', eliminado: true });
});

test('urlFirmada genera una URL con firma para el objeto', async () => {
  const url = await urlFirmada('pruebas/a.png', {
    expiresIn: 60,
    contentType: 'image/png',
  });

  assert.match(url, /pruebas\/a\.png/);
  assert.match(url, /X-Amz-Signature=/);
  assert.match(url, /X-Amz-Expires=60/);
});

test('subirFirma valida PNG, calcula hash y usa la carpeta firmas', async () => {
  s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag"' });

  const resultado = await subirFirma({
    base64: `data:image/png;base64,${PNG_1X1}`,
    nombre: 'firma_test.png',
  });

  assert.equal(resultado.ruta, 'firmas/firma_test.png');
  assert.equal(resultado.key, 'firmas/firma_test.png');
  assert.match(resultado.hash, /^[a-f0-9]{64}$/);

  const input = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
  assert.equal(input.ContentType, 'image/png');
  assert.deepEqual(input.Metadata, { sha256: resultado.hash });
});

test('subirFirma rechaza firmas mayores a 2 MB', async () => {
  const grande = Buffer.alloc(2 * 1024 * 1024 + 1);

  await assert.rejects(
    () => subirFirma({ base64: grande.toString('base64'), nombre: 'grande.png' }),
    (error) => error.status === 400 && /2 MB/.test(error.message)
  );
});

test('subirFirma rechaza contenido vacio o que no sea PNG', async () => {
  await assert.rejects(
    () => subirFirma({ base64: '', nombre: 'vacia.png' }),
    (error) => error.status === 400
  );

  await assert.rejects(
    () =>
      subirFirma({
        base64: Buffer.from('no soy un png').toString('base64'),
        nombre: 'falsa.png',
      }),
    (error) => error.status === 400
  );
});
