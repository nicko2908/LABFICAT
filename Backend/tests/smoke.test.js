/**
 * Prueba de humo de la Fase 0: la app debe importarse y responder sin
 * conectarse a MongoDB ni tener Supabase configurado.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

async function conServidor(fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

test('GET /health responde 200', async () => {
  await conServidor(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.servicio, 'labficat-backend');
  });
});

test('una ruta inexistente responde 404 con el formato de error', async () => {
  await conServidor(async (base) => {
    const res = await fetch(`${base}/api/v1/no-existe`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.mensaje, /Ruta no encontrada/);
  });
});

test('un body JSON null responde 400 y no 500', async () => {
  await conServidor(async (base) => {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(typeof body.mensaje, 'string');
  });
});
