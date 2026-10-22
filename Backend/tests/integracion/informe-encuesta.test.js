/**
 * Pruebas de integracion del slice informe -> encuesta -> descarga (Fase 2A).
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
import { crearMuestra } from '../../src/services/muestra.service.js';
import {
  crearOrden,
  avanzarEstadoOrden,
  registrarResultadosOrden,
} from '../../src/services/orden.service.js';
import {
  generarInforme,
  registrarEnvioInforme,
  registrarDescargaInforme,
} from '../../src/services/informe.service.js';
import { responderEncuesta } from '../../src/services/encuesta.service.js';
import {
  verificarPropietarioInforme,
  verificarPropietarioEncuesta,
} from '../../src/utils/propietario.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Parametro from '../../src/models/laboratorio/Parametro.js';
import TipoMuestra from '../../src/models/laboratorio/TipoMuestra.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import Muestra from '../../src/models/laboratorio/Muestra.js';
import OrdenAnalisis from '../../src/models/laboratorio/OrdenAnalisis.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import Cotizacion from '../../src/models/servicios/Cotizacion.js';
import Informe from '../../src/models/calidad/Informe.js';
import Encuesta from '../../src/models/calidad/Encuesta.js';
import HistorialEstadoSolicitud from '../../src/models/servicios/HistorialEstadoSolicitud.js';

let replSet;
let server;
let base;
let secuencia = 0;

const DATOS_ENCUESTA = {
  satisfaccion_general: 5,
  tiempo_entrega: 4,
  atencion_personal: 5,
  claridad_informe: 4,
  recomendaria_servicio: true,
  comentarios: 'Muy buen servicio',
};

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
    correo: `calidad${n}@test.local`,
  });
}

async function crearCliente() {
  const usuario = await crearUsuario();
  const cliente = await Cliente.create({
    usuario: usuario._id,
    tipologia: new mongoose.Types.ObjectId(),
    tipo_cliente: 'INTERNO',
    acepta_tratamiento_datos: true,
  });
  return { usuario, cliente };
}

function tokenPara(usuario, rol) {
  return firmar({ sub: String(usuario._id), rol });
}

async function crearEscenario({ finalizar = true } = {}) {
  const { usuario, cliente } = await crearCliente();

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

  const muestra = await crearMuestra({
    solicitudId: solicitud._id,
    tipoMuestraId: tipoMuestra._id,
    usuarioId: usuario._id,
    unidadMedida: 'ml',
    fechaRecepcion: new Date(),
    estadoRecepcion: 'ACEPTADA',
    cantidadRecibida: 300,
  });

  const orden = await crearOrden({
    muestraId: muestra._id,
    analisisId: analisis._id,
    usuarioId: usuario._id,
  });

  if (finalizar) {
    await avanzarEstadoOrden({
      ordenId: orden._id,
      estadoNuevo: 'EN_PROCESO',
    });
    await registrarResultadosOrden({
      ordenId: orden._id,
      resultados: [{ parametro: parametro._id, valor: 7.5 }],
    });
    await avanzarEstadoOrden({
      ordenId: orden._id,
      estadoNuevo: 'FINALIZADA',
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
    muestra,
    orden: await OrdenAnalisis.findById(orden._id),
  };
}

async function crearInformeDeEscenario(escenario) {
  const coordinador = await crearUsuario();
  const informe = await generarInforme({
    muestraId: escenario.muestra._id,
    usuarioId: coordinador._id,
  });
  return { coordinador, informe };
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
  await mongoose.connect(replSet.getUri('labficat_test_calidad'));

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
    Solicitud.deleteMany({}),
    Cotizacion.deleteMany({}),
    Informe.deleteMany({}),
    Encuesta.deleteMany({}),
    HistorialEstadoSolicitud.deleteMany({}),
  ]);
});

test('genera el informe con ordenes finalizadas y pasa a Informe listo', async () => {
  const escenario = await crearEscenario();
  const { coordinador, informe } = await crearInformeDeEscenario(escenario);

  assert.ok(informe.fecha_generacion instanceof Date);
  assert.equal(String(informe.usuario), String(coordinador._id));

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.INFORME_LISTO);
});

test('no genera informe si hay una orden sin finalizar', async () => {
  const escenario = await crearEscenario({ finalizar: false });
  const coordinador = await crearUsuario();

  await assert.rejects(
    () =>
      generarInforme({
        muestraId: escenario.muestra._id,
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('no permite generar dos informes para la misma muestra', async () => {
  const escenario = await crearEscenario();
  const { informe } = await crearInformeDeEscenario(escenario);
  const otro = await crearUsuario();

  await assert.rejects(
    () =>
      generarInforme({
        muestraId: escenario.muestra._id,
        usuarioId: otro._id,
      }),
    (err) => err.status === 409
  );

  assert.ok(await Informe.exists({ _id: informe._id }));
});

test('registrar envio fija fecha y finaliza la solicitud', async () => {
  const escenario = await crearEscenario();
  const { coordinador, informe } = await crearInformeDeEscenario(escenario);

  const enviado = await registrarEnvioInforme({
    informeId: informe._id,
    usuarioId: coordinador._id,
  });

  assert.ok(enviado.fecha_envio instanceof Date);

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.FINALIZADA);

  await assert.rejects(
    () =>
      registrarEnvioInforme({
        informeId: informe._id,
        usuarioId: coordinador._id,
      }),
    (err) => err.status === 409
  );
});

test('responde una encuesta y no permite duplicarla', async () => {
  const escenario = await crearEscenario();
  const { informe } = await crearInformeDeEscenario(escenario);

  const encuesta = await responderEncuesta({
    solicitudId: escenario.solicitud._id,
    datos: DATOS_ENCUESTA,
  });

  assert.equal(encuesta.satisfaccion_general, 5);
  assert.equal(encuesta.recomendaria_servicio, true);

  await assert.rejects(
    () =>
      responderEncuesta({
        solicitudId: escenario.solicitud._id,
        datos: DATOS_ENCUESTA,
      }),
    (err) => err.status === 409
  );

  assert.ok(await Informe.exists({ _id: informe._id }));
});

test('no permite responder la encuesta antes del informe', async () => {
  const escenario = await crearEscenario();

  await assert.rejects(
    () =>
      responderEncuesta({
        solicitudId: escenario.solicitud._id,
        datos: DATOS_ENCUESTA,
      }),
    (err) => err.status === 409
  );
});

test('bloquea la descarga sin encuesta y la permite despues', async () => {
  const escenario = await crearEscenario();
  const { informe } = await crearInformeDeEscenario(escenario);

  await assert.rejects(
    () => registrarDescargaInforme({ informeId: informe._id }),
    (err) => err.status === 403
  );

  await responderEncuesta({
    solicitudId: escenario.solicitud._id,
    datos: DATOS_ENCUESTA,
  });

  const descargado = await registrarDescargaInforme({
    informeId: informe._id,
  });

  assert.ok(descargado.fecha_descarga instanceof Date);
});

test('autoriza informe y encuesta por propietario', async () => {
  const escenario = await crearEscenario();
  const { informe } = await crearInformeDeEscenario(escenario);
  const otro = await crearCliente();

  await responderEncuesta({
    solicitudId: escenario.solicitud._id,
    datos: DATOS_ENCUESTA,
  });
  const encuesta = await Encuesta.findOne({
    solicitud: escenario.solicitud._id,
  });

  await verificarPropietarioInforme(informe, {
    id: String(escenario.usuario._id),
    rol: ROLES.CLIENTE,
  });
  await verificarPropietarioInforme(informe, {
    id: String(otro.usuario._id),
    rol: ROLES.COORDINADOR,
  });
  await verificarPropietarioEncuesta(encuesta, {
    id: String(escenario.usuario._id),
    rol: ROLES.CLIENTE,
  });
  await verificarPropietarioEncuesta(encuesta, {
    id: String(otro.usuario._id),
    rol: ROLES.COORDINADOR,
  });

  await assert.rejects(
    () =>
      verificarPropietarioInforme(informe, {
        id: String(otro.usuario._id),
        rol: ROLES.CLIENTE,
      }),
    (err) => err.status === 403
  );

  await assert.rejects(
    () =>
      verificarPropietarioEncuesta(encuesta, {
        id: String(otro.usuario._id),
        rol: ROLES.CLIENTE,
      }),
    (err) => err.status === 403
  );
});

test('GET /informes/mios y /encuestas/mias aislan al cliente', async () => {
  const escenario = await crearEscenario();
  const { informe } = await crearInformeDeEscenario(escenario);

  await responderEncuesta({
    solicitudId: escenario.solicitud._id,
    datos: DATOS_ENCUESTA,
  });
  const encuesta = await Encuesta.findOne({
    solicitud: escenario.solicitud._id,
  });

  const otro = await crearCliente();
  const token = tokenPara(escenario.usuario, ROLES.CLIENTE);
  const tokenOtro = tokenPara(otro.usuario, ROLES.CLIENTE);

  const informes = await pedir('/api/v1/informes/mios', { token });
  assert.equal(informes.status, 200);
  assert.equal(informes.body.datos.total, 1);
  assert.equal(String(informes.body.datos.items[0]._id), String(informe._id));

  const encuestas = await pedir('/api/v1/encuestas/mias', { token });
  assert.equal(encuestas.status, 200);
  assert.equal(encuestas.body.datos.total, 1);
  assert.equal(String(encuestas.body.datos.items[0]._id), String(encuesta._id));

  const informeAjeno = await pedir(`/api/v1/informes/${informe._id}`, {
    token: tokenOtro,
  });
  assert.equal(informeAjeno.status, 403);

  const encuestaAjena = await pedir(`/api/v1/encuestas/${encuesta._id}`, {
    token: tokenOtro,
  });
  assert.equal(encuestaAjena.status, 403);
});

test('flujo HTTP: informe, encuesta, descarga y envio', async () => {
  const escenario = await crearEscenario();
  const coordinador = await crearUsuario();

  const tokenCliente = tokenPara(escenario.usuario, ROLES.CLIENTE);
  const tokenCoord = tokenPara(coordinador, ROLES.COORDINADOR);

  const informeRes = await pedir('/api/v1/informes', {
    method: 'POST',
    token: tokenCoord,
    body: { muestra: String(escenario.muestra._id) },
  });
  assert.equal(informeRes.status, 201);

  const informeId = informeRes.body.datos._id;

  const encuestaRes = await pedir('/api/v1/encuestas', {
    method: 'POST',
    token: tokenCliente,
    body: {
      solicitud: String(escenario.solicitud._id),
      ...DATOS_ENCUESTA,
    },
  });
  assert.equal(encuestaRes.status, 201);

  const descarga = await pedir(`/api/v1/informes/${informeId}/descarga`, {
    method: 'PATCH',
    token: tokenCliente,
  });
  assert.equal(descarga.status, 200);
  assert.ok(descarga.body.datos.fecha_descarga);

  const envio = await pedir(`/api/v1/informes/${informeId}/envio`, {
    method: 'PATCH',
    token: tokenCoord,
  });
  assert.equal(envio.status, 200);
  assert.ok(envio.body.datos.fecha_envio);

  const solicitud = await Solicitud.findById(escenario.solicitud._id);
  assert.equal(solicitud.estado, ESTADO_SOLICITUD.FINALIZADA);

  const informes = await pedir('/api/v1/informes/mios', {
    token: tokenCliente,
  });
  assert.equal(informes.body.datos.total, 1);

  const encuestas = await pedir('/api/v1/encuestas/mias', {
    token: tokenCliente,
  });
  assert.equal(encuestas.body.datos.total, 1);
});
