/**
 * Pruebas de integracion del slice cupon -> pago (Fase 2A).
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import { ROLES, ESTADO_SOLICITUD } from '../../src/config/constants.js';
import { crearSolicitud } from '../../src/services/solicitud.service.js';
import { crearCotizacion, decidirCotizacion } from '../../src/services/cotizacion.service.js';
import {
  crearCupon,
  generarCupon,
} from '../../src/services/cupon.service.js';
import {
  cargarSoportePago,
  validarSoportePago,
  reenviarSoportePago,
} from '../../src/services/pago.service.js';
import {
  verificarPropietarioCupon,
  verificarPropietarioSoportePago,
} from '../../src/utils/propietario.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import Cotizacion from '../../src/models/servicios/Cotizacion.js';
import CuponPago from '../../src/models/servicios/CuponPago.js';
import SoportePago from '../../src/models/servicios/SoportePago.js';
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
    correo: `pago${n}@test.local`,
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

function tokenPara(usuario, rol) {
  return firmar({ sub: String(usuario._id), rol });
}

async function crearAnalisis(tarifa) {
  return Analisis.create({
    nombre: `Analisis Pago ${siguiente()}`,
    tarifa_externo: tarifa,
    activo: true,
  });
}

async function crearCotizacionAceptada({
  tipoCliente = 'EXTERNO',
  tarifa = 1000,
} = {}) {
  const { usuario, cliente } = await crearCliente({ tipoCliente });
  const analisis = await crearAnalisis(tarifa);

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
    decision: 'ACEPTADA',
    firma: { ruta: 'firmas/test.png', hash: 'hash-test' },
    usuarioId: usuario._id,
  });

  const aceptada = await Cotizacion.findById(cotizacion._id);
  return { usuario, cliente, analisis, solicitud, cotizacion: aceptada };
}

async function crearCuponGenerado(escenario) {
  const coordinador = await crearUsuario();
  const cupon = await crearCupon({
    cotizacionId: escenario.cotizacion._id,
    usuarioId: coordinador._id,
  });
  const generado = await generarCupon({
    cuponId: cupon._id,
    codigoCupon: `CUP-${siguiente()}`,
  });
  return { coordinador, cupon: generado };
}

async function crearSoporteCargado(escenario) {
  const { coordinador, cupon } = await crearCuponGenerado(escenario);
  const soporte = await cargarSoportePago({
    cuponId: cupon._id,
    rutaArchivo: 'pagos/soporte.pdf',
    formato: 'pdf',
    usuarioId: escenario.usuario._id,
  });
  return { coordinador, cupon, soporte };
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
  await mongoose.connect(replSet.getUri('labficat_test_pagos'));

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
    CuponPago.deleteMany({}),
    SoportePago.deleteMany({}),
    HistorialEstadoSolicitud.deleteMany({}),
  ]);
});

test('crearCupon externo crea un cupon PENDIENTE por el total', async () => {
  const escenario = await crearCotizacionAceptada();
  const coordinador = await crearUsuario();

  const cupon = await crearCupon({
    cotizacionId: escenario.cotizacion._id,
    usuarioId: coordinador._id,
  });

  assert.equal(cupon.estado, 'PENDIENTE');
  assert.equal(cupon.valor, 1000);
  assert.equal(String(cupon.solicitado_por), String(coordinador._id));
});

test('crearCupon rechaza cliente interno', async () => {
  const escenario = await crearCotizacionAceptada({ tipoCliente: 'INTERNO' });
  const coordinador = await crearUsuario();

  await assert.rejects(
    () =>
      crearCupon({
        cotizacionId: escenario.cotizacion._id,
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('crearCupon rechaza cotizacion no aceptada', async () => {
  const { usuario, cliente } = await crearCliente();
  const analisis = await crearAnalisis(1000);
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
  const coordinador = await crearUsuario();

  await assert.rejects(
    () =>
      crearCupon({
        cotizacionId: cotizacion._id,
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('crearCupon rechaza un valor distinto al total', async () => {
  const escenario = await crearCotizacionAceptada();
  const coordinador = await crearUsuario();

  await assert.rejects(
    () =>
      crearCupon({
        cotizacionId: escenario.cotizacion._id,
        valor: 999,
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 400
  );
});

test('crearCupon rechaza un segundo cupon para la misma cotizacion', async () => {
  const escenario = await crearCotizacionAceptada();
  const coordinador = await crearUsuario();

  await crearCupon({
    cotizacionId: escenario.cotizacion._id,
    usuarioId: coordinador._id,
  });

  await assert.rejects(
    () =>
      crearCupon({
        cotizacionId: escenario.cotizacion._id,
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('generarCupon fija codigo, estado y vencimiento', async () => {
  const escenario = await crearCotizacionAceptada();
  const coordinador = await crearUsuario();
  const cupon = await crearCupon({
    cotizacionId: escenario.cotizacion._id,
    usuarioId: coordinador._id,
  });

  const generado = await generarCupon({
    cuponId: cupon._id,
    codigoCupon: 'CUP-TEST-1',
  });

  assert.equal(generado.estado, 'GENERADO');
  assert.equal(generado.codigo_cupon, 'CUP-TEST-1');
  assert.ok(generado.fecha_generacion instanceof Date);
  assert.ok(generado.fecha_vencimiento > generado.fecha_generacion);
});

test('cargarSoportePago transiciona la solicitud a pago pendiente', async () => {
  const escenario = await crearCotizacionAceptada();
  const { cupon, soporte } = await crearSoporteCargado(escenario);

  assert.equal(soporte.estado, 'PENDIENTE_VERIFICACION');
  assert.equal(soporte.formato, 'PDF');

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION);

  const cuponRecargado = await CuponPago.findById(cupon._id);
  assert.equal(cuponRecargado.estado, 'GENERADO');
});

test('validarSoportePago aprobado marca cupon UTILIZADO y solicitud Pago aprobado', async () => {
  const escenario = await crearCotizacionAceptada();
  const { coordinador, cupon, soporte } = await crearSoporteCargado(escenario);

  const aprobado = await validarSoportePago({
    soporteId: soporte._id,
    decision: 'APROBADO',
    usuarioId: coordinador._id,
  });

  assert.equal(aprobado.estado, 'APROBADO');

  const cuponRecargado = await CuponPago.findById(cupon._id);
  assert.equal(cuponRecargado.estado, 'UTILIZADO');

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.PAGO_APROBADO);
});

test('validarSoportePago rechazado deja cupon GENERADO y permite reenviar', async () => {
  const escenario = await crearCotizacionAceptada();
  const { coordinador, cupon, soporte } = await crearSoporteCargado(escenario);

  await validarSoportePago({
    soporteId: soporte._id,
    decision: 'RECHAZADO',
    observaciones: 'Comprobante ilegible',
    usuarioId: coordinador._id,
  });

  const cuponRechazado = await CuponPago.findById(cupon._id);
  assert.equal(cuponRechazado.estado, 'GENERADO');

  const solicitudRechazada = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitudRechazada.estado, ESTADO_SOLICITUD.PAGO_RECHAZADO);

  const reenviado = await reenviarSoportePago({
    soporteId: soporte._id,
    rutaArchivo: 'pagos/soporte-2.pdf',
    formato: 'PDF',
    usuarioId: escenario.usuario._id,
  });

  assert.equal(reenviado.estado, 'PENDIENTE_VERIFICACION');

  const solicitudReenviada = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(
    solicitudReenviada.estado,
    ESTADO_SOLICITUD.PAGO_PENDIENTE_VERIFICACION
  );
});

test('validarSoportePago no permite validar dos veces', async () => {
  const escenario = await crearCotizacionAceptada();
  const { coordinador, soporte } = await crearSoporteCargado(escenario);

  await validarSoportePago({
    soporteId: soporte._id,
    decision: 'APROBADO',
    usuarioId: coordinador._id,
  });

  await assert.rejects(
    () =>
      validarSoportePago({
        soporteId: soporte._id,
        decision: 'RECHAZADO',
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('cargarSoportePago rechaza un segundo soporte para el mismo cupon', async () => {
  const escenario = await crearCotizacionAceptada();
  const { cupon } = await crearSoporteCargado(escenario);

  await assert.rejects(
    () =>
      cargarSoportePago({
        cuponId: cupon._id,
        rutaArchivo: 'pagos/otro.pdf',
        formato: 'PDF',
        usuarioId: escenario.usuario._id,
      }),
    (err) => err.status === 409
  );
});

test('verificarPropietarioCupon distingue cliente ajeno y coordinador', async () => {
  const escenario = await crearCotizacionAceptada();
  const otro = await crearCliente();
  const { cupon } = await crearCuponGenerado(escenario);

  await verificarPropietarioCupon(cupon, {
    id: String(escenario.usuario._id),
    rol: ROLES.CLIENTE,
  });
  await verificarPropietarioCupon(cupon, {
    id: String(otro.usuario._id),
    rol: ROLES.COORDINADOR,
  });

  await assert.rejects(
    () =>
      verificarPropietarioCupon(cupon, {
        id: String(otro.usuario._id),
        rol: ROLES.CLIENTE,
      }),
    (err) => err.status === 403
  );
});

test('verificarPropietarioSoportePago distingue cliente ajeno', async () => {
  const escenario = await crearCotizacionAceptada();
  const otro = await crearCliente();
  const { soporte } = await crearSoporteCargado(escenario);

  await verificarPropietarioSoportePago(soporte, {
    id: String(escenario.usuario._id),
    rol: ROLES.CLIENTE,
  });

  await assert.rejects(
    () =>
      verificarPropietarioSoportePago(soporte, {
        id: String(otro.usuario._id),
        rol: ROLES.CLIENTE,
      }),
    (err) => err.status === 403
  );
});

test('GET /cupones/mios y /pagos/mios devuelven solo lo propio', async () => {
  const escenario = await crearCotizacionAceptada();
  const { cupon, soporte } = await crearSoporteCargado(escenario);
  const token = tokenPara(escenario.usuario, ROLES.CLIENTE);

  const cupones = await pedir('/api/v1/cupones/mios', { token });
  assert.equal(cupones.status, 200);
  assert.equal(cupones.body.datos.total, 1);
  assert.equal(String(cupones.body.datos.items[0]._id), String(cupon._id));

  const pagos = await pedir('/api/v1/pagos/mios', { token });
  assert.equal(pagos.status, 200);
  assert.equal(pagos.body.datos.total, 1);
  assert.equal(String(pagos.body.datos.items[0]._id), String(soporte._id));
});

test('un cliente no puede ver cupon ni soporte de otro', async () => {
  const escenario = await crearCotizacionAceptada();
  const otro = await crearCliente();
  const { cupon, soporte } = await crearSoporteCargado(escenario);
  const tokenOtro = tokenPara(otro.usuario, ROLES.CLIENTE);

  const cuponAjeno = await pedir(`/api/v1/cupones/${cupon._id}`, {
    token: tokenOtro,
  });
  assert.equal(cuponAjeno.status, 403);

  const pagoAjeno = await pedir(`/api/v1/pagos/${soporte._id}`, {
    token: tokenOtro,
  });
  assert.equal(pagoAjeno.status, 403);
});

test('flujo HTTP: crear cupon, cargar soporte y aprobar pago', async () => {
  const escenario = await crearCotizacionAceptada();
  const coordinador = await crearUsuario();

  const tokenCoord = tokenPara(coordinador, ROLES.COORDINADOR);
  const tokenCliente = tokenPara(escenario.usuario, ROLES.CLIENTE);

  const cuponRes = await pedir('/api/v1/cupones', {
    method: 'POST',
    token: tokenCoord,
    body: { cotizacion: String(escenario.cotizacion._id) },
  });
  assert.equal(cuponRes.status, 201);
  assert.equal(cuponRes.body.datos.estado, 'PENDIENTE');

  const generado = await generarCupon({
    cuponId: cuponRes.body.datos._id,
    codigoCupon: `CUP-HTTP-${siguiente()}`,
  });

  const soporteRes = await pedir('/api/v1/pagos', {
    method: 'POST',
    token: tokenCliente,
    body: {
      cupon: String(generado._id),
      ruta_archivo: 'pagos/http.pdf',
      formato: 'pdf',
    },
  });
  assert.equal(soporteRes.status, 201);

  const validado = await pedir(
    `/api/v1/pagos/${soporteRes.body.datos._id}/validar`,
    {
      method: 'PATCH',
      token: tokenCoord,
      body: { decision: 'APROBADO' },
    }
  );
  assert.equal(validado.status, 200);
  assert.equal(validado.body.datos.estado, 'APROBADO');

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.PAGO_APROBADO);
});

test('un cliente no puede cargar soporte de un cupon ajeno', async () => {
  const escenario = await crearCotizacionAceptada();
  const otro = await crearCliente();
  const { cupon } = await crearCuponGenerado(escenario);
  const tokenOtro = tokenPara(otro.usuario, ROLES.CLIENTE);

  const res = await pedir('/api/v1/pagos', {
    method: 'POST',
    token: tokenOtro,
    body: {
      cupon: String(cupon._id),
      ruta_archivo: 'pagos/ajeno.pdf',
      formato: 'PDF',
    },
  });

  assert.equal(res.status, 403);
  assert.equal(await SoportePago.countDocuments({ cupon: cupon._id }), 0);
});

test('un cliente no puede reenviar un soporte ajeno', async () => {
  const escenario = await crearCotizacionAceptada();
  const otro = await crearCliente();
  const { coordinador, soporte } = await crearSoporteCargado(escenario);

  await validarSoportePago({
    soporteId: soporte._id,
    decision: 'RECHAZADO',
    usuarioId: coordinador._id,
  });

  const tokenOtro = tokenPara(otro.usuario, ROLES.CLIENTE);
  const res = await pedir(`/api/v1/pagos/${soporte._id}/reenviar`, {
    method: 'PUT',
    token: tokenOtro,
    body: {
      ruta_archivo: 'pagos/ajeno.pdf',
      formato: 'PDF',
    },
  });

  assert.equal(res.status, 403);

  const recargado = await SoportePago.findById(soporte._id);
  assert.equal(recargado.estado, 'RECHAZADO');
});
