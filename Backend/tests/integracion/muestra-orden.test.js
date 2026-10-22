/**
 * Pruebas de integracion del slice muestra -> orden -> validacion (Fase 2A).
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import {
  ROLES,
  ESTADO_SOLICITUD,
  ESTADO_RECEPCION_MUESTRA,
} from '../../src/config/constants.js';
import { crearSolicitud } from '../../src/services/solicitud.service.js';
import { crearCotizacion, decidirCotizacion } from '../../src/services/cotizacion.service.js';
import { crearCupon, generarCupon } from '../../src/services/cupon.service.js';
import { cargarSoportePago, validarSoportePago } from '../../src/services/pago.service.js';
import { crearMuestra } from '../../src/services/muestra.service.js';
import {
  crearOrden,
  avanzarEstadoOrden,
  registrarResultadosOrden,
  repetirOrden,
} from '../../src/services/orden.service.js';
import { validarOrden } from '../../src/services/validacion.service.js';
import {
  verificarPropietarioMuestra,
  verificarPropietarioOrden,
} from '../../src/utils/propietario.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Parametro from '../../src/models/laboratorio/Parametro.js';
import TipoMuestra from '../../src/models/laboratorio/TipoMuestra.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import Muestra from '../../src/models/laboratorio/Muestra.js';
import OrdenAnalisis from '../../src/models/laboratorio/OrdenAnalisis.js';
import ValidacionResultado from '../../src/models/laboratorio/ValidacionResultado.js';
import HistorialPrioridad from '../../src/models/laboratorio/HistorialPrioridad.js';
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
    correo: `lab${n}@test.local`,
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

async function crearEscenario({ tipoCliente = 'EXTERNO', pagar = true } = {}) {
  const { usuario, cliente } = await crearCliente({ tipoCliente });

  const parametro = await Parametro.create({
    nombre: `Parametro ${siguiente()}`,
    unidad_medida: 'mg/L',
  });
  const tipoMuestra = await TipoMuestra.create({
    nombre: `Tipo ${siguiente()}`,
    estado_fisico: 'LIQUIDO',
  });
  const analisis = await Analisis.create({
    nombre: `Analisis ${siguiente()}`,
    tarifa_externo: 1000,
    cantidad_minima: 300,
    unidad_cantidad: 'ml',
    parametros: [parametro._id],
    tipos_muestra: [tipoMuestra._id],
    activo: true,
  });

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
    firma: { ruta: 'firmas/test.png', hash: 'hash' },
    usuarioId: usuario._id,
  });

  let coordinador = null;
  if (tipoCliente === 'EXTERNO' && pagar) {
    coordinador = await crearUsuario();
    const cupon = await crearCupon({
      cotizacionId: cotizacion._id,
      usuarioId: coordinador._id,
    });
    const generado = await generarCupon({
      cuponId: cupon._id,
      codigoCupon: `CUP-M${siguiente()}`,
    });
    const soporte = await cargarSoportePago({
      cuponId: generado._id,
      rutaArchivo: 'pagos/soporte.pdf',
      formato: 'PDF',
      usuarioId: usuario._id,
    });
    await validarSoportePago({
      soporteId: soporte._id,
      decision: 'APROBADO',
      usuarioId: coordinador._id,
    });
  }

  const solicitudFinal = await Solicitud.findById(solicitud._id);
  return {
    usuario,
    cliente,
    parametro,
    tipoMuestra,
    analisis,
    solicitud: solicitudFinal,
    cotizacion,
    coordinador,
  };
}

async function crearMuestraAceptada(escenario) {
  return crearMuestra({
    solicitudId: escenario.solicitud._id,
    tipoMuestraId: escenario.tipoMuestra._id,
    usuarioId: escenario.usuario._id,
    unidadMedida: 'ml',
    fechaRecepcion: new Date(),
    estadoRecepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
    cantidadRecibida: 300,
  });
}

async function crearOrdenPendiente(escenario) {
  const muestra = await crearMuestraAceptada(escenario);
  const orden = await crearOrden({
    muestraId: muestra._id,
    analisisId: escenario.analisis._id,
    usuarioId: escenario.usuario._id,
  });
  return { muestra, orden };
}

async function finalizarOrden(escenario, orden) {
  await avanzarEstadoOrden({
    ordenId: orden._id,
    estadoNuevo: 'EN_PROCESO',
  });
  await registrarResultadosOrden({
    ordenId: orden._id,
    resultados: [{ parametro: escenario.parametro._id, valor: 7.5 }],
  });
  return avanzarEstadoOrden({
    ordenId: orden._id,
    estadoNuevo: 'FINALIZADA',
  });
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
  await mongoose.connect(replSet.getUri('labficat_test_muestras'));

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
    Parametro.deleteMany({}),
    TipoMuestra.deleteMany({}),
    Analisis.deleteMany({}),
    Muestra.deleteMany({}),
    OrdenAnalisis.deleteMany({}),
    ValidacionResultado.deleteMany({}),
    HistorialPrioridad.deleteMany({}),
    Solicitud.deleteMany({}),
    Cotizacion.deleteMany({}),
    CuponPago.deleteMany({}),
    SoportePago.deleteMany({}),
    HistorialEstadoSolicitud.deleteMany({}),
  ]);
});

test('recibe una muestra externa despues del pago aprobado', async () => {
  const escenario = await crearEscenario();
  const muestra = await crearMuestraAceptada(escenario);

  assert.equal(muestra.estado_recepcion, ESTADO_RECEPCION_MUESTRA.ACEPTADA);
  assert.match(muestra.codigo_muestra, /^LAB-\d{4}-\d{4}$/);

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.EN_ANALISIS);

  const prioridad = await HistorialPrioridad.find({ muestra: muestra._id });
  assert.equal(prioridad.length, 1);
});

test('recibe una muestra interna sin pago', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  assert.equal(escenario.solicitud.estado, ESTADO_SOLICITUD.ACEPTADA);

  const muestra = await crearMuestraAceptada(escenario);
  assert.equal(muestra.estado_recepcion, ESTADO_RECEPCION_MUESTRA.ACEPTADA);

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.EN_ANALISIS);
});

test('rechaza una muestra con tipo distinto al del analisis', async () => {
  const escenario = await crearEscenario();
  const otroTipo = await TipoMuestra.create({
    nombre: `Otro tipo ${siguiente()}`,
    estado_fisico: 'SOLIDO',
  });

  await assert.rejects(
    () =>
      crearMuestra({
        solicitudId: escenario.solicitud._id,
        tipoMuestraId: otroTipo._id,
        usuarioId: escenario.usuario._id,
        unidadMedida: 'ml',
        fechaRecepcion: new Date(),
        estadoRecepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
        cantidadRecibida: 300,
      }),
    (err) => err.status === 400
  );
});

test('rechaza una muestra externa antes de aprobar el pago', async () => {
  const escenario = await crearEscenario({ pagar: false });
  assert.equal(escenario.solicitud.estado, ESTADO_SOLICITUD.ACEPTADA);

  await assert.rejects(
    () => crearMuestraAceptada(escenario),
    (err) => err.status === 409
  );
});

test('permite reintentar con otra muestra despues de un rechazo', async () => {
  const escenario = await crearEscenario();

  const rechazada = await crearMuestra({
    solicitudId: escenario.solicitud._id,
    tipoMuestraId: escenario.tipoMuestra._id,
    usuarioId: escenario.usuario._id,
    unidadMedida: 'ml',
    fechaRecepcion: new Date(),
    estadoRecepcion: ESTADO_RECEPCION_MUESTRA.RECHAZADA,
    cantidadRecibida: 300,
    motivoRechazo: 'Envase roto',
  });

  assert.equal(rechazada.estado_recepcion, ESTADO_RECEPCION_MUESTRA.RECHAZADA);

  const antes = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(antes.estado, ESTADO_SOLICITUD.PAGO_APROBADO);

  const aceptada = await crearMuestraAceptada(escenario);
  assert.equal(aceptada.estado_recepcion, ESTADO_RECEPCION_MUESTRA.ACEPTADA);

  const despues = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(despues.estado, ESTADO_SOLICITUD.EN_ANALISIS);
});

test('crea una orden y evita duplicados activos', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const { orden } = await crearOrdenPendiente(escenario);

  assert.equal(orden.estado, 'PENDIENTE');

  await assert.rejects(
    () =>
      crearOrden({
        muestraId: orden.muestra,
        analisisId: escenario.analisis._id,
        usuarioId: escenario.usuario._id,
      }),
    (err) => err.status === 409
  );
});

test('rechaza una orden con un analisis ajeno a la solicitud', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const muestra = await crearMuestraAceptada(escenario);

  const otroAnalisis = await Analisis.create({
    nombre: `Otro analisis ${siguiente()}`,
    tarifa_externo: 1000,
    parametros: [escenario.parametro._id],
    tipos_muestra: [escenario.tipoMuestra._id],
    activo: true,
  });

  await assert.rejects(
    () =>
      crearOrden({
        muestraId: muestra._id,
        analisisId: otroAnalisis._id,
        usuarioId: escenario.usuario._id,
      }),
    (err) => err.status === 400
  );
});

test('no crea ordenes sobre muestras rechazadas', async () => {
  const escenario = await crearEscenario();
  const rechazada = await crearMuestra({
    solicitudId: escenario.solicitud._id,
    tipoMuestraId: escenario.tipoMuestra._id,
    usuarioId: escenario.usuario._id,
    unidadMedida: 'ml',
    fechaRecepcion: new Date(),
    estadoRecepcion: ESTADO_RECEPCION_MUESTRA.RECHAZADA,
    cantidadRecibida: 300,
    motivoRechazo: 'Muestra insuficiente',
  });

  await assert.rejects(
    () =>
      crearOrden({
        muestraId: rechazada._id,
        analisisId: escenario.analisis._id,
        usuarioId: escenario.usuario._id,
      }),
    (err) => err.status === 409
  );
});

test('avanza la orden y exige resultados antes de finalizar', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const { orden } = await crearOrdenPendiente(escenario);

  const enProceso = await avanzarEstadoOrden({
    ordenId: orden._id,
    estadoNuevo: 'EN_PROCESO',
  });
  assert.equal(enProceso.estado, 'EN_PROCESO');
  assert.ok(enProceso.fecha_inicio instanceof Date);

  await assert.rejects(
    () =>
      avanzarEstadoOrden({
        ordenId: orden._id,
        estadoNuevo: 'FINALIZADA',
      }),
    (err) => err.status === 400
  );

  const finalizada = await finalizarOrden(escenario, orden);
  assert.equal(finalizada.estado, 'FINALIZADA');
  assert.ok(finalizada.fecha_fin instanceof Date);
});

test('valida parametros y duplicados al registrar resultados', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const { orden } = await crearOrdenPendiente(escenario);

  await avanzarEstadoOrden({
    ordenId: orden._id,
    estadoNuevo: 'EN_PROCESO',
  });

  const otroParametro = await Parametro.create({
    nombre: `Otro parametro ${siguiente()}`,
    unidad_medida: 'mg/L',
  });

  await assert.rejects(
    () =>
      registrarResultadosOrden({
        ordenId: orden._id,
        resultados: [{ parametro: otroParametro._id, valor: 1 }],
      }),
    (err) => err.status === 400
  );

  await assert.rejects(
    () =>
      registrarResultadosOrden({
        ordenId: orden._id,
        resultados: [
          { parametro: escenario.parametro._id, valor: 1 },
          { parametro: escenario.parametro._id, valor: 2 },
        ],
      }),
    (err) => err.status === 400
  );

  const actualizada = await registrarResultadosOrden({
    ordenId: orden._id,
    resultados: [{ parametro: escenario.parametro._id, valor: 7.5 }],
  });
  assert.equal(actualizada.resultados.length, 1);
});

test('valida una orden aprobada y no permite validarla dos veces', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const { orden } = await crearOrdenPendiente(escenario);
  await finalizarOrden(escenario, orden);

  const coordinador = await crearUsuario();
  const validacion = await validarOrden({
    ordenId: orden._id,
    decision: 'APROBADO',
    usuarioId: coordinador._id,
  });

  assert.equal(validacion.decision, 'APROBADO');

  const recargada = await OrdenAnalisis.findById(orden._id);
  assert.equal(recargada.estado, 'FINALIZADA');

  await assert.rejects(
    () =>
      validarOrden({
        ordenId: orden._id,
        decision: 'RECHAZADO',
        motivo: 'Otra',
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('rechaza una orden, la invalida y permite repetirla', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const { orden } = await crearOrdenPendiente(escenario);
  await finalizarOrden(escenario, orden);

  const coordinador = await crearUsuario();
  await validarOrden({
    ordenId: orden._id,
    decision: 'RECHAZADO',
    motivo: 'Resultado fuera de rango',
    usuarioId: coordinador._id,
  });

  const invalidada = await OrdenAnalisis.findById(orden._id);
  assert.equal(invalidada.estado, 'INVALIDADA');

  const repetida = await repetirOrden({
    ordenId: orden._id,
    usuarioId: coordinador._id,
  });

  assert.equal(repetida.estado, 'PENDIENTE');
  assert.equal(repetida.numero_iteracion, 2);
  assert.equal(String(repetida.orden_anterior), String(orden._id));

  await assert.rejects(
    () =>
      repetirOrden({
        ordenId: orden._id,
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('autoriza muestras y ordenes por propietario o personal de laboratorio', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const otro = await crearCliente();
  const { muestra, orden } = await crearOrdenPendiente(escenario);

  await verificarPropietarioMuestra(muestra, {
    id: String(escenario.usuario._id),
    rol: ROLES.CLIENTE,
  });
  await verificarPropietarioMuestra(muestra, {
    id: String(otro.usuario._id),
    rol: ROLES.ANALISTA,
  });
  await verificarPropietarioOrden(orden, {
    id: String(escenario.usuario._id),
    rol: ROLES.CLIENTE,
  });
  await verificarPropietarioOrden(orden, {
    id: String(otro.usuario._id),
    rol: ROLES.ANALISTA,
  });

  await assert.rejects(
    () =>
      verificarPropietarioMuestra(muestra, {
        id: String(otro.usuario._id),
        rol: ROLES.CLIENTE,
      }),
    (err) => err.status === 403
  );

  await assert.rejects(
    () =>
      verificarPropietarioOrden(orden, {
        id: String(otro.usuario._id),
        rol: ROLES.CLIENTE,
      }),
    (err) => err.status === 403
  );
});

test('GET /muestras/mias y /ordenes/mias aislan al cliente', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const otro = await crearCliente();
  const { muestra, orden } = await crearOrdenPendiente(escenario);

  const token = tokenPara(escenario.usuario, ROLES.CLIENTE);
  const tokenOtro = tokenPara(otro.usuario, ROLES.CLIENTE);

  const muestras = await pedir('/api/v1/muestras/mias', { token });
  assert.equal(muestras.status, 200);
  assert.equal(muestras.body.datos.total, 1);
  assert.equal(String(muestras.body.datos.items[0]._id), String(muestra._id));

  const ordenes = await pedir('/api/v1/ordenes/mias', { token });
  assert.equal(ordenes.status, 200);
  assert.equal(ordenes.body.datos.total, 1);
  assert.equal(String(ordenes.body.datos.items[0]._id), String(orden._id));

  const muestraAjena = await pedir(`/api/v1/muestras/${muestra._id}`, {
    token: tokenOtro,
  });
  assert.equal(muestraAjena.status, 403);

  const ordenAjena = await pedir(`/api/v1/ordenes/${orden._id}`, {
    token: tokenOtro,
  });
  assert.equal(ordenAjena.status, 403);
});

test('flujo HTTP: muestra, orden, resultados y validacion', async () => {
  const escenario = await crearEscenario({ tipoCliente: 'INTERNO' });
  const coordinador = await crearUsuario();
  const analista = await crearUsuario();

  const tokenCliente = tokenPara(escenario.usuario, ROLES.CLIENTE);
  const tokenCoord = tokenPara(coordinador, ROLES.COORDINADOR);
  const tokenAnalista = tokenPara(analista, ROLES.ANALISTA);

  const muestraRes = await pedir('/api/v1/muestras', {
    method: 'POST',
    token: tokenCoord,
    body: {
      solicitud: String(escenario.solicitud._id),
      tipo_muestra: String(escenario.tipoMuestra._id),
      unidad_medida: 'ml',
      fecha_recepcion: new Date().toISOString(),
      estado_recepcion: 'ACEPTADA',
      cantidad_recibida: 300,
    },
  });
  assert.equal(muestraRes.status, 201);

  const ordenRes = await pedir('/api/v1/ordenes', {
    method: 'POST',
    token: tokenAnalista,
    body: {
      muestra: String(muestraRes.body.datos._id),
      analisis: String(escenario.analisis._id),
    },
  });
  assert.equal(ordenRes.status, 201);

  const ordenId = ordenRes.body.datos._id;

  const enProceso = await pedir(`/api/v1/ordenes/${ordenId}/estado`, {
    method: 'PATCH',
    token: tokenAnalista,
    body: { estado: 'EN_PROCESO' },
  });
  assert.equal(enProceso.status, 200);

  const resultados = await pedir(`/api/v1/ordenes/${ordenId}/resultados`, {
    method: 'PUT',
    token: tokenAnalista,
    body: {
      resultados: [
        { parametro: String(escenario.parametro._id), valor: 7.5 },
      ],
    },
  });
  assert.equal(resultados.status, 200);

  const finalizada = await pedir(`/api/v1/ordenes/${ordenId}/estado`, {
    method: 'PATCH',
    token: tokenAnalista,
    body: { estado: 'FINALIZADA' },
  });
  assert.equal(finalizada.status, 200);

  const validacion = await pedir('/api/v1/trazabilidad/validaciones', {
    method: 'POST',
    token: tokenCoord,
    body: { orden: String(ordenId), decision: 'APROBADO' },
  });
  assert.equal(validacion.status, 201);

  const mias = await pedir('/api/v1/ordenes/mias', { token: tokenCliente });
  assert.equal(mias.status, 200);
  assert.equal(mias.body.datos.total, 1);
});
