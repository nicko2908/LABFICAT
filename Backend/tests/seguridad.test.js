/**
 * Pruebas de headers de seguridad y CORS.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('helmet agrega headers de seguridad y oculta x-powered-by', async () => {
  const res = await fetch(`${base}/health`);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(
    res.headers.get('cross-origin-resource-policy'),
    'cross-origin'
  );
});

test('CORS permite el origen configurado', async () => {
  const res = await fetch(`${base}/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });

  assert.equal(res.status, 200);
  assert.equal(
    res.headers.get('access-control-allow-origin'),
    'http://localhost:5173'
  );
});

test('CORS no permite un origen ajeno', async () => {
  const res = await fetch(`${base}/health`, {
    headers: { Origin: 'http://origen-no-permitido.test' },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});
