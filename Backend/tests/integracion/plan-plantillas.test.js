/**
 * Pruebas de integracion del plan de plantillas:
 *  - tipologia -> tipo de cliente (4 internas / 12 externas)
 *  - cotizacion por items y versionado (V2 reemplaza V1)
 *  - flujo multi-item/multi-muestra hasta Finalizada
 *  - codigos atomicos (20 solicitudes concurrentes)
 *  - generadores Excel de cotizacion y acta de recepcion
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import {
  ESTADO_SOLICITUD,
  ESTADO_RECEPCION_MUESTRA,
  ROLES,
  TIPO_CLIENTE,
} from '../../src/config/constants.js';
import { tipoClienteDeTipologia } from '../../src/utils/tipologias.js';
import { generarCodigoMuestra } from '../../src/services/codigo.service.js';
import { crearSolicitud } from '../../src/services/solicitud.service.js';
import {
  crearCotizacion,
  decidirCotizacion,
  crearNuevaVersion,
} from '../../src/services/cotizacion.service.js';
import { crearMuestra } from '../../src/services/muestra.service.js';
import { crearCupon } from '../../src/services/cupon.service.js';
import {
  crearOrden,
  avanzarEstadoOrden,
  registrarResultadosOrden,
} from '../../src/services/orden.service.js';
import {
  generarInforme,
  registrarEnvioInforme,
} from '../../src/services/informe.service.js';
import {
  generarCotizacionXlsx,
  generarActaRecepcionXlsx,
} from '../../src/services/excel.service.js';
import { generarRotulo, obtenerPdfRotulo } from '../../src/services/rotulo.service.js';
import Rol from '../../src/models/seguridad/Rol.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import TipologiaPoblacional from '../../src/models/clientes/TipologiaPoblacional.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Parametro from '../../src/models/laboratorio/Parametro.js';
import TipoMuestra from '../../src/models/laboratorio/TipoMuestra.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import Muestra from '../../src/models/laboratorio/Muestra.js';
import OrdenAnalisis from '../../src/models/laboratorio/OrdenAnalisis.js';
import Informe from '../../src/models/calidad/Informe.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import Cotizacion from '../../src/models/servicios/Cotizacion.js';
import CuponPago from '../../src/models/servicios/CuponPago.js';
import HistorialEstadoSolicitud from '../../src/models/servicios/HistorialEstadoSolicitud.js';
import HistorialPrioridad from '../../src/models/laboratorio/HistorialPrioridad.js';
import Contador from '../../src/models/sistema/Contador.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { instalarS3Mock, s3Mock } from '../helpers/s3.js';

instalarS3Mock();

let replSet;
let server;
let base;
let secuencia = 0;

function siguiente() {
  secuencia += 1;
  return secuencia;
}

async function crearUsuario(extra = {}) {
  const n = siguiente();
  return Usuario.create({
    rol: new mongoose.Types.ObjectId(),
    nombres: 'Cliente',
    apellidos: 'Prueba',
    tipo_documento: 'CC',
    numero_documento: String(900000000 + n),
    correo: `cliente${n}@test.local`,
    ...extra,
  });
}

async function crearTipologia({ nombre, codigo, esInterno = false }) {
  return TipologiaPoblacional.create({
    nombre,
    codigo,
    es_interno: esInterno,
    activo: true,
  });
}

async function crearCliente({ tipologia, tipoCliente = TIPO_CLIENTE.EXTERNO, extra = {} } = {}) {
  const usuario = await crearUsuario();
  const cliente = await Cliente.create({
    usuario: usuario._id,
    tipologia: tipologia?._id,
    tipo_cliente: tipoCliente,
    acepta_tratamiento_datos: true,
    razon_social: 'Cliente de prueba',
    nit: '1101074333',
    direccion: 'CRA 9 #20-20',
    ciudad: 'San Gil',
    departamento: 'Santander',
    telefono: '3223757647',
    cargo: 'Aprendiz',
    persona_contacto: 'Yury Suarez',
    ...extra,
  });

  return { usuario, cliente };
}

async function crearAnalisis({ nombre, codigo, tarifa = 15000, parametro, acreditado = false }) {
  return Analisis.create({
    codigo,
    nombre,
    unidades: '%',
    metodo: 'Metodo de prueba',
    tecnica: 'Tecnica de prueba',
    acreditado,
    tarifa_externo: tarifa,
    cantidad_minima: 0,
    parametros: [parametro._id],
    tipos_muestra: [],
    activo: true,
  });
}

function tokenPara(usuario, rol) {
  return firmar({ sub: String(usuario._id), rol });
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
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('labficat_test_plan'));

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
    Rol.deleteMany({}),
    Usuario.deleteMany({}),
    TipologiaPoblacional.deleteMany({}),
    Cliente.deleteMany({}),
    Parametro.deleteMany({}),
    TipoMuestra.deleteMany({}),
    Analisis.deleteMany({}),
    Muestra.deleteMany({}),
    OrdenAnalisis.deleteMany({}),
    Informe.deleteMany({}),
    Solicitud.deleteMany({}),
    Cotizacion.deleteMany({}),
    CuponPago.deleteMany({}),
    HistorialEstadoSolicitud.deleteMany({}),
    HistorialPrioridad.deleteMany({}),
    Contador.deleteMany({}),
  ]);
});

test('las 4 tipologias internas liquidan 0 y el resto son externas', () => {
  assert.equal(tipoClienteDeTipologia({ es_interno: true }), TIPO_CLIENTE.INTERNO);
  assert.equal(tipoClienteDeTipologia({ es_interno: false }), TIPO_CLIENTE.EXTERNO);
  assert.equal(tipoClienteDeTipologia(null), TIPO_CLIENTE.EXTERNO);
});

test('el registro deriva tipo_cliente de la tipologia, no del correo', async () => {
  await Rol.create({ nombre: ROLES.CLIENTE, descripcion: 'Cliente', activo: true });
  const interna = await crearTipologia({
    nombre: 'Aprendices SENA',
    codigo: 'APRENDICES_SENA',
    esInterno: true,
  });
  const externa = await crearTipologia({
    nombre: 'Empresas',
    codigo: 'EMPRESAS',
    esInterno: false,
  });

  const baseBody = {
    nombres: 'Cliente',
    apellidos: 'Registro',
    tipo_documento: 'CC',
    contrasena: 'Labficat123*',
    acepta_tratamiento_datos: true,
  };

  const interno = await pedir('/api/v1/auth/registro', {
    method: 'POST',
    body: {
      ...baseBody,
      numero_documento: '1000000001',
      correo: 'aprendiz@gmail.com',
      tipologia: String(interna._id),
    },
  });
  assert.equal(interno.status, 201);
  assert.equal(interno.body.datos.cliente.tipo_cliente, TIPO_CLIENTE.INTERNO);

  const externo = await pedir('/api/v1/auth/registro', {
    method: 'POST',
    body: {
      ...baseBody,
      numero_documento: '1000000002',
      correo: 'empresa@sena.edu.co',
      tipologia: String(externa._id),
    },
  });
  assert.equal(externo.status, 201);
  assert.equal(externo.body.datos.cliente.tipo_cliente, TIPO_CLIENTE.EXTERNO);
});

test('la cotizacion por items congela snapshot y calcula cantidades', async () => {
  const tipologia = await crearTipologia({
    nombre: 'Empresas',
    codigo: 'EMPRESAS',
  });
  const { usuario, cliente } = await crearCliente({ tipologia });
  const parametro = await Parametro.create({
    nombre: 'Resultado plan',
    unidad_medida: 'unidades',
  });
  const a1 = await crearAnalisis({ nombre: 'Humedad', codigo: 1, parametro });
  const a2 = await crearAnalisis({ nombre: 'Cenizas', codigo: 2, parametro });

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [a1._id, a2._id],
    usuarioId: usuario._id,
  });

  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    items: [
      {
        numero: 1,
        descripcion_muestra: 'Muestra de cacao',
        detalle: [{ analisis: a1._id, cantidad: 2 }],
      },
      {
        numero: 2,
        descripcion_muestra: 'Muestra de miel',
        detalle: [{ analisis: a2._id, cantidad: 1 }],
      },
    ],
    usuarioId: usuario._id,
  });

  assert.match(cotizacion.codigo_cotizacion, /^\d{4}-\d{4}$/);
  assert.equal(cotizacion.version, 1);
  assert.equal(cotizacion.codigo_completo.endsWith('V1'), true);
  assert.equal(cotizacion.items.length, 2);
  assert.equal(cotizacion.valor_total, 45000);
  assert.equal(cotizacion.cliente_snapshot.nombre, 'Cliente de prueba');
  assert.equal(cotizacion.cliente_snapshot.tipologia, 'Empresas');
  assert.equal(cotizacion.cliente_snapshot.tipo_cliente, TIPO_CLIENTE.EXTERNO);
});

test('V2 reemplaza V1 y solo la ultima version se puede decidir', async () => {
  const tipologia = await crearTipologia({ nombre: 'Empresas', codigo: 'EMPRESAS' });
  const { usuario, cliente } = await crearCliente({ tipologia });
  const parametro = await Parametro.create({ nombre: 'Resultado V2', unidad_medida: 'unidades' });
  const analisis = await crearAnalisis({ nombre: 'Humedad', codigo: 11, parametro });

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  const v1 = await crearCotizacion({
    solicitudId: solicitud._id,
    detalle: [{ analisis: analisis._id }],
    usuarioId: usuario._id,
  });

  const v2 = await crearNuevaVersion({ cotizacionId: v1._id, usuarioId: usuario._id });
  assert.equal(v2.version, 2);
  assert.equal(v2.codigo_cotizacion, v1.codigo_cotizacion);
  assert.equal(v2.codigo_completo, `${v1.codigo_cotizacion}V2`);

  const v1Recargada = await Cotizacion.findById(v1._id);
  assert.equal(v1Recargada.estado, 'REEMPLAZADA');

  await assert.rejects(
    () =>
      decidirCotizacion({
        cotizacionId: v1._id,
        decision: 'ACEPTADA',
        firma: { ruta: 'firmas/v1.png', hash: 'v1' },
        usuarioId: usuario._id,
      }),
    (err) => err.status === 409
  );

  const aceptada = await decidirCotizacion({
    cotizacionId: v2._id,
    decision: 'ACEPTADA',
    firma: { ruta: 'firmas/v2.png', hash: 'v2' },
    usuarioId: usuario._id,
  });
  assert.equal(aceptada.estado, 'ACEPTADA');
});

test('flujo multi-item y multi-muestra llega a Finalizada', async () => {
  const tipologia = await crearTipologia({
    nombre: 'Aprendices SENA',
    codigo: 'APRENDICES_SENA',
    esInterno: true,
  });
  const { usuario, cliente } = await crearCliente({
    tipologia,
    tipoCliente: TIPO_CLIENTE.INTERNO,
  });
  const parametro = await Parametro.create({
    nombre: 'Resultado multi',
    unidad_medida: 'unidades',
  });
  const tipoMuestra = await TipoMuestra.create({
    nombre: 'Pasta',
    estado_fisico: 'SOLIDO',
    activo: true,
  });
  const a1 = await crearAnalisis({ nombre: 'Humedad', codigo: 21, parametro });
  const a2 = await crearAnalisis({ nombre: 'Cenizas', codigo: 22, parametro });

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [a1._id, a2._id],
    usuarioId: usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    items: [
      {
        numero: 1,
        descripcion_muestra: 'Cacao pasta',
        detalle: [{ analisis: a1._id }],
      },
      {
        numero: 2,
        descripcion_muestra: 'Cacao polvo',
        detalle: [{ analisis: a2._id }],
      },
    ],
    usuarioId: usuario._id,
  });

  assert.equal(cotizacion.valor_total, 0, 'cliente interno debe liquidar en 0');

  await decidirCotizacion({
    cotizacionId: cotizacion._id,
    decision: 'ACEPTADA',
    firma: { ruta: 'firmas/multi.png', hash: 'multi' },
    usuarioId: usuario._id,
  });

  const muestra1 = await crearMuestra({
    solicitudId: solicitud._id,
    tipoMuestraId: tipoMuestra._id,
    usuarioId: usuario._id,
    fechaRecepcion: new Date(),
    estadoRecepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
    cotizacionItem: 1,
    matriz: 'Cacao',
  });
  const muestra2 = await crearMuestra({
    solicitudId: solicitud._id,
    tipoMuestraId: tipoMuestra._id,
    usuarioId: usuario._id,
    fechaRecepcion: new Date(),
    estadoRecepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
    cotizacionItem: 2,
    matriz: 'Cacao',
  });

  assert.notEqual(String(muestra1.codigo_muestra), String(muestra2.codigo_muestra));
  assert.match(muestra1.codigo_muestra, /^\d{4}-\d{4}$/);

  const orden1 = await crearOrden({
    muestraId: muestra1._id,
    analisisId: a1._id,
    usuarioId: usuario._id,
  });
  const orden2 = await crearOrden({
    muestraId: muestra2._id,
    analisisId: a2._id,
    usuarioId: usuario._id,
  });

  for (const orden of [orden1, orden2]) {
    await avanzarEstadoOrden({ ordenId: orden._id, estadoNuevo: 'EN_PROCESO' });
    await registrarResultadosOrden({
      ordenId: orden._id,
      resultados: [{ parametro: parametro._id, valor: 7.5 }],
    });
    await avanzarEstadoOrden({ ordenId: orden._id, estadoNuevo: 'FINALIZADA' });
  }

  const rotulo = await generarRotulo(muestra1._id, {});
  assert.match(rotulo.archivo_pdf.key, /^rotulos\//);

  s3Mock.on(GetObjectCommand).resolves({
    Body: {
      transformToByteArray: async () => Buffer.from('%PDF-1.4\nrotulo de prueba'),
    },
  });
  const { buffer: rotuloPdf } = await obtenerPdfRotulo(muestra1._id, {
    id: String(usuario._id),
    sub: String(usuario._id),
    rol: 'cliente',
  });
  assert.equal(rotuloPdf.subarray(0, 4).toString(), '%PDF');
  instalarS3Mock();

  const informe1 = await generarInforme({
    muestraId: muestra1._id,
    usuarioId: usuario._id,
  });
  let actual = await Solicitud.findById(solicitud._id);
  assert.equal(actual.estado, ESTADO_SOLICITUD.EN_ANALISIS);

  const informe2 = await generarInforme({
    muestraId: muestra2._id,
    usuarioId: usuario._id,
  });
  actual = await Solicitud.findById(solicitud._id);
  assert.equal(actual.estado, ESTADO_SOLICITUD.INFORME_LISTO);

  await registrarEnvioInforme({ informeId: informe1._id, usuarioId: usuario._id });
  actual = await Solicitud.findById(solicitud._id);
  assert.equal(actual.estado, ESTADO_SOLICITUD.INFORME_LISTO);

  await registrarEnvioInforme({ informeId: informe2._id, usuarioId: usuario._id });
  actual = await Solicitud.findById(solicitud._id);
  assert.equal(actual.estado, ESTADO_SOLICITUD.FINALIZADA);
});

test('una cotizacion en 0 no genera cupon', async () => {
  const tipologia = await crearTipologia({
    nombre: 'Comunidad SENA',
    codigo: 'COMUNIDAD_SENA',
    esInterno: true,
  });
  const { usuario, cliente } = await crearCliente({
    tipologia,
    tipoCliente: TIPO_CLIENTE.INTERNO,
  });
  const parametro = await Parametro.create({ nombre: 'Resultado cupon', unidad_medida: 'unidades' });
  const analisis = await crearAnalisis({ nombre: 'Humedad', codigo: 31, parametro });
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
    firma: { ruta: 'firmas/cupon.png', hash: 'cupon' },
    usuarioId: usuario._id,
  });

  await assert.rejects(
    () => crearCupon({ cotizacionId: cotizacion._id, usuarioId: usuario._id }),
    (err) => err.status === 409
  );
});

test('20 codigos de muestra concurrentes son unicos', async () => {
  await Contador.create({
    clave: `muestra-${new Date().getFullYear()}`,
    valor: 0,
  });
  const codigos = await Promise.all(
    Array.from({ length: 20 }, () => generarCodigoMuestra())
  );
  assert.equal(new Set(codigos).size, 20);
  for (const codigo of codigos) assert.match(codigo, /^\d{4}-\d{4}$/);
});

test('20 solicitudes concurrentes no duplican codigos', async () => {
  const tipologia = await crearTipologia({ nombre: 'Empresas', codigo: 'EMPRESAS' });
  const { usuario, cliente } = await crearCliente({ tipologia });
  const parametro = await Parametro.create({ nombre: 'Resultado concurrencia', unidad_medida: 'unidades' });
  const analisis = await crearAnalisis({ nombre: 'Humedad', codigo: 41, parametro });

  await Contador.create({
    clave: `solicitud-${new Date().getFullYear()}`,
    valor: 0,
  });

  const solicitudes = await Promise.all(
    Array.from({ length: 20 }, () =>
      crearSolicitud({
        clienteId: cliente._id,
        analisis: [analisis._id],
        usuarioId: usuario._id,
      })
    )
  );

  const codigos = new Set(solicitudes.map((s) => s.codigo_solicitud));
  assert.equal(codigos.size, 20);
});

test('los endpoints de Excel responden el archivo y validan permisos', async () => {
  const tipologia = await crearTipologia({
    nombre: 'Aprendices SENA',
    codigo: 'APRENDICES_SENA',
    esInterno: true,
  });
  const { usuario, cliente } = await crearCliente({
    tipologia,
    tipoCliente: TIPO_CLIENTE.INTERNO,
  });
  const otro = await crearCliente({
    tipologia,
    tipoCliente: TIPO_CLIENTE.INTERNO,
    extra: { nit: '1101074334' },
  });
  const parametro = await Parametro.create({ nombre: 'Resultado HTTP Excel', unidad_medida: 'unidades' });
  const tipoMuestra = await TipoMuestra.create({
    nombre: 'Pasta',
    estado_fisico: 'SOLIDO',
    activo: true,
  });
  const analisis = await crearAnalisis({ nombre: 'Humedad', codigo: 61, parametro });

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
    firma: { ruta: 'firmas/http.png', hash: 'http' },
    usuarioId: usuario._id,
  });
  const muestra = await Muestra.create({
    solicitud: solicitud._id,
    cotizacion: cotizacion._id,
    cotizacion_item: 1,
    tipo_muestra: tipoMuestra._id,
    usuario: usuario._id,
    fecha_recepcion: new Date(),
    estado_recepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
    matriz: 'Cacao',
  });

  const tokenCoord = tokenPara(usuario, ROLES.COORDINADOR);
  const tokenCliente = tokenPara(usuario, ROLES.CLIENTE);
  const tokenOtro = tokenPara(otro.usuario, ROLES.CLIENTE);

  const cotizacionExcel = await fetch(`${base}/api/v1/cotizaciones/${cotizacion._id}/excel`, {
    headers: { Authorization: `Bearer ${tokenCoord}` },
  });
  assert.equal(cotizacionExcel.status, 200);
  assert.match(cotizacionExcel.headers.get('content-type'), /spreadsheetml/);
  assert.ok((await cotizacionExcel.arrayBuffer()).byteLength > 1000);

  const actaExcel = await fetch(`${base}/api/v1/muestras/${muestra._id}/acta-recepcion`, {
    headers: { Authorization: `Bearer ${tokenCoord}` },
  });
  assert.equal(actaExcel.status, 200);
  assert.match(actaExcel.headers.get('content-type'), /spreadsheetml/);
  assert.ok((await actaExcel.arrayBuffer()).byteLength > 1000);

  const propio = await fetch(`${base}/api/v1/cotizaciones/${cotizacion._id}/excel`, {
    headers: { Authorization: `Bearer ${tokenCliente}` },
  });
  assert.equal(propio.status, 200);
  await propio.arrayBuffer();

  const ajeno = await fetch(`${base}/api/v1/cotizaciones/${cotizacion._id}/excel`, {
    headers: { Authorization: `Bearer ${tokenOtro}` },
  });
  assert.equal(ajeno.status, 403);
  await ajeno.arrayBuffer();
});

test('genera la cotizacion y el acta de recepcion en Excel', async () => {
  const tipologia = await crearTipologia({ nombre: 'Empresas', codigo: 'EMPRESAS' });
  const { usuario, cliente } = await crearCliente({ tipologia });
  const parametro = await Parametro.create({ nombre: 'Resultado excel', unidad_medida: 'unidades' });
  const tipoMuestra = await TipoMuestra.create({
    nombre: 'Pasta',
    estado_fisico: 'SOLIDO',
    activo: true,
  });
  const analisis = await crearAnalisis({
    nombre: 'Humedad',
    codigo: 51,
    parametro,
    acreditado: true,
  });

  const solicitud = await crearSolicitud({
    clienteId: cliente._id,
    analisis: [analisis._id],
    usuarioId: usuario._id,
  });
  const cotizacion = await crearCotizacion({
    solicitudId: solicitud._id,
    items: [
      {
        numero: 1,
        descripcion_muestra: 'Cacao pasta',
        detalle: [{ analisis: analisis._id, cantidad: 1 }],
      },
    ],
    usuarioId: usuario._id,
  });
  await decidirCotizacion({
    cotizacionId: cotizacion._id,
    decision: 'ACEPTADA',
    firma: { ruta: 'firmas/no-configurada.png', hash: 'x' },
    usuarioId: usuario._id,
  });

  const { buffer: cotBuffer, nombre: cotNombre } = await generarCotizacionXlsx(cotizacion._id);
  assert.match(cotNombre, /\.xlsx$/);

  const cotWb = new ExcelJS.Workbook();
  await cotWb.xlsx.load(cotBuffer);
  const cotWs = cotWb.worksheets[0];
  assert.equal(cotWs.getCell('L2').value, `${cotizacion.codigo_cotizacion}V1`);
  assert.equal(cotWs.getCell('M2').value, 'Cliente de prueba');
  assert.equal(cotWs.getCell('A18').value, 51);
  assert.match(String(cotWs.getCell('B18').value), /Humedad°/);
  assert.equal(cotWs.getCell('H18').value, 15000);
  assert.equal(cotWs.getCell('I21').result, 15000);
  assert.equal(cotWs.getImages().length, 2, 'deben quedar el logo y la firma');

  // Se crea la muestra directamente para probar el acta sin montar el pago
  // externo completo; el generador solo depende de la muestra y su cotizacion.
  const muestra = await Muestra.create({
    solicitud: solicitud._id,
    cotizacion: cotizacion._id,
    cotizacion_item: 1,
    tipo_muestra: tipoMuestra._id,
    usuario: usuario._id,
    fecha_recepcion: new Date('2026-05-04T09:39:00'),
    estado_recepcion: ESTADO_RECEPCION_MUESTRA.ACEPTADA,
    matriz: 'Cacao',
    municipio_recoleccion: 'San Gil',
    direccion_toma: 'Calle 22 #09-82',
    lugar_toma: 'Laboratorio',
    recolectada_por: 'Cliente',
    procedimiento_muestreo: 'Muestreo aleatorio',
    fecha_hora_recoleccion: new Date('2026-05-02T08:00:00'),
    observaciones_predefinidas: [1, 5],
  });

  const { buffer: actaBuffer, nombre: actaNombre } = await generarActaRecepcionXlsx(muestra._id);
  assert.match(actaNombre, /\.xlsx$/);

  const actaWb = new ExcelJS.Workbook();
  await actaWb.xlsx.load(actaBuffer);
  const actaWs = actaWb.worksheets[0];
  assert.equal(actaWs.getCell('A14').value, muestra.codigo_muestra);
  assert.equal(actaWs.getCell('G14').value, 'Pasta');
  assert.equal(actaWs.getCell('H14').value, 'Cacao');
  assert.equal(actaWs.getCell('J14').value, `${cotizacion.codigo_cotizacion}V1`);
  assert.equal(actaWs.getCell('K14').value, 1);
  assert.equal(actaWs.getCell('L14').value, '1, 5');
  assert.equal(actaWs.getCell('J29').value, null);
  assert.equal(actaWs.getImages().length, 1, 'solo debe quedar el logo');
});
