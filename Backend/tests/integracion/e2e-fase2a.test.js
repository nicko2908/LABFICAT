/**
 * Prueba E2E de cierre de la Fase 2A.
 *
 * Recorre el flujo completo de un cliente externo:
 * registro -> login -> solicitud -> cotizacion -> cupon -> pago ->
 * muestra -> orden -> resultados -> validacion -> informe -> encuesta ->
 * descarga -> envio.
 *
 * La aceptacion de la cotizacion se hace por servicio con una firma simulada
 * para no subir archivos reales a Supabase durante las pruebas.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import app from '../../src/app.js';
import { firmar } from '../../src/utils/jwt.js';
import { ROLES, ESTADO_SOLICITUD } from '../../src/config/constants.js';
import { decidirCotizacion } from '../../src/services/cotizacion.service.js';
import Rol from '../../src/models/seguridad/Rol.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import TipologiaPoblacional from '../../src/models/clientes/TipologiaPoblacional.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Parametro from '../../src/models/laboratorio/Parametro.js';
import TipoMuestra from '../../src/models/laboratorio/TipoMuestra.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import Muestra from '../../src/models/laboratorio/Muestra.js';
import HistorialPrioridad from '../../src/models/laboratorio/HistorialPrioridad.js';
import OrdenAnalisis from '../../src/models/laboratorio/OrdenAnalisis.js';
import ValidacionResultado from '../../src/models/laboratorio/ValidacionResultado.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import Cotizacion from '../../src/models/servicios/Cotizacion.js';
import CuponPago from '../../src/models/servicios/CuponPago.js';
import SoportePago from '../../src/models/servicios/SoportePago.js';
import Informe from '../../src/models/calidad/Informe.js';
import Encuesta from '../../src/models/calidad/Encuesta.js';
import HistorialEstadoSolicitud from '../../src/models/servicios/HistorialEstadoSolicitud.js';

let replSet;
let server;
let base;

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

async function crearStaff(rol, documento, correo) {
  return Usuario.create({
    rol: rol._id,
    nombres: 'Usuario',
    apellidos: 'Staff',
    tipo_documento: 'CC',
    numero_documento: documento,
    correo,
    activo: true,
  });
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(replSet.getUri('labficat_test_e2e'));

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
    HistorialPrioridad.deleteMany({}),
    OrdenAnalisis.deleteMany({}),
    ValidacionResultado.deleteMany({}),
    Solicitud.deleteMany({}),
    Cotizacion.deleteMany({}),
    CuponPago.deleteMany({}),
    SoportePago.deleteMany({}),
    Informe.deleteMany({}),
    Encuesta.deleteMany({}),
    HistorialEstadoSolicitud.deleteMany({}),
  ]);
});

test('flujo E2E completo de la Fase 2A', async () => {
  const rolCliente = await Rol.create({
    nombre: ROLES.CLIENTE,
    descripcion: 'Cliente E2E',
  });
  const rolCoordinador = await Rol.create({
    nombre: ROLES.COORDINADOR,
    descripcion: 'Coordinador E2E',
  });
  const rolAnalista = await Rol.create({
    nombre: ROLES.ANALISTA,
    descripcion: 'Analista E2E',
  });

  const tipologia = await TipologiaPoblacional.create({
    nombre: 'Ninguna de las anteriores',
    codigo: 'NINGUNA',
    activo: true,
  });

  const parametro = await Parametro.create({
    nombre: 'pH E2E',
    unidad_medida: 'unidades',
  });
  const tipoMuestra = await TipoMuestra.create({
    nombre: 'Agua E2E',
    estado_fisico: 'LIQUIDO',
  });
  const analisis = await Analisis.create({
    nombre: 'Analisis E2E',
    tarifa_externo: 1000,
    cantidad_minima: 300,
    unidad_cantidad: 'ml',
    parametros: [parametro._id],
    tipos_muestra: [tipoMuestra._id],
    activo: true,
  });

  const coordinador = await crearStaff(
    rolCoordinador,
    '2000000001',
    'coordinador.e2e@test.local'
  );
  const analista = await crearStaff(
    rolAnalista,
    '2000000002',
    'analista.e2e@test.local'
  );

  const tokenCoord = firmar({
    sub: String(coordinador._id),
    rol: ROLES.COORDINADOR,
  });
  const tokenAnalista = firmar({
    sub: String(analista._id),
    rol: ROLES.ANALISTA,
  });

  // 1. Registro publico
  const registro = await pedir('/api/v1/auth/registro', {
    method: 'POST',
    body: {
      nombres: 'Cliente',
      apellidos: 'Externo',
      tipo_documento: 'CC',
      numero_documento: '1000000001',
      correo: 'cliente.e2e@externo.com',
      contrasena: 'Labficat123*',
      tipologia: String(tipologia._id),
      acepta_tratamiento_datos: true,
    },
  });
  assert.equal(registro.status, 201);

  // 2. Login
  const login = await pedir('/api/v1/auth/login', {
    method: 'POST',
    body: {
      correo: 'cliente.e2e@externo.com',
      contrasena: 'Labficat123*',
    },
  });
  assert.equal(login.status, 200);

  const tokenCliente = login.body.datos.token;
  const clienteUsuarioId = login.body.datos.usuario._id;

  // 3. Solicitud
  const solicitudRes = await pedir('/api/v1/solicitudes', {
    method: 'POST',
    token: tokenCliente,
    body: { analisis: [String(analisis._id)] },
  });
  assert.equal(solicitudRes.status, 201);
  const solicitudId = solicitudRes.body.datos._id;

  // 4. Cotizacion
  const cotizacionRes = await pedir('/api/v1/cotizaciones', {
    method: 'POST',
    token: tokenCoord,
    body: {
      solicitud: String(solicitudId),
      detalle: [{ analisis: String(analisis._id) }],
    },
  });
  assert.equal(cotizacionRes.status, 201);
  const cotizacionId = cotizacionRes.body.datos._id;

  // 5. Aceptacion con firma simulada (servicio, sin Supabase)
  await decidirCotizacion({
    cotizacionId,
    decision: 'ACEPTADA',
    firma: { ruta: 'firmas/e2e.png', hash: 'hash-e2e' },
    usuarioId: clienteUsuarioId,
  });

  // 6. Cupon
  const cuponRes = await pedir('/api/v1/cupones', {
    method: 'POST',
    token: tokenCoord,
    body: { cotizacion: String(cotizacionId) },
  });
  assert.equal(cuponRes.status, 201);
  const cuponId = cuponRes.body.datos._id;

  const generarRes = await pedir(`/api/v1/cupones/${cuponId}/generar`, {
    method: 'PATCH',
    token: tokenCoord,
    body: { codigo_cupon: 'E2E-CUP-001' },
  });
  assert.equal(generarRes.status, 200);

  // 7. Pago
  const pagoRes = await pedir('/api/v1/pagos', {
    method: 'POST',
    token: tokenCliente,
    body: {
      cupon: String(cuponId),
      ruta_archivo: 'pagos/e2e.pdf',
      formato: 'PDF',
    },
  });
  assert.equal(pagoRes.status, 201);
  const pagoId = pagoRes.body.datos._id;

  const validarPago = await pedir(`/api/v1/pagos/${pagoId}/validar`, {
    method: 'PATCH',
    token: tokenCoord,
    body: { decision: 'APROBADO' },
  });
  assert.equal(validarPago.status, 200);

  // 8. Muestra
  const muestraRes = await pedir('/api/v1/muestras', {
    method: 'POST',
    token: tokenCoord,
    body: {
      solicitud: String(solicitudId),
      tipo_muestra: String(tipoMuestra._id),
      unidad_medida: 'ml',
      fecha_recepcion: new Date().toISOString(),
      estado_recepcion: 'ACEPTADA',
      cantidad_recibida: 300,
    },
  });
  assert.equal(muestraRes.status, 201);
  const muestraId = muestraRes.body.datos._id;

  // 9. Orden
  const ordenRes = await pedir('/api/v1/ordenes', {
    method: 'POST',
    token: tokenAnalista,
    body: {
      muestra: String(muestraId),
      analisis: String(analisis._id),
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
        { parametro: String(parametro._id), valor: 7.5 },
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

  // 10. Validacion
  const validacion = await pedir('/api/v1/trazabilidad/validaciones', {
    method: 'POST',
    token: tokenCoord,
    body: { orden: String(ordenId), decision: 'APROBADO' },
  });
  assert.equal(validacion.status, 201);

  // 11. Informe
  const informeRes = await pedir('/api/v1/informes', {
    method: 'POST',
    token: tokenCoord,
    body: { muestra: String(muestraId) },
  });
  assert.equal(informeRes.status, 201);
  const informeId = informeRes.body.datos._id;

  // 12. Encuesta
  const encuestaRes = await pedir('/api/v1/encuestas', {
    method: 'POST',
    token: tokenCliente,
    body: {
      solicitud: String(solicitudId),
      satisfaccion_general: 5,
      tiempo_entrega: 4,
      atencion_personal: 5,
      claridad_informe: 4,
      recomendaria_servicio: true,
      comentarios: 'Flujo E2E completo',
    },
  });
  assert.equal(encuestaRes.status, 201);

  // 13. Descarga
  const descarga = await pedir(`/api/v1/informes/${informeId}/descarga`, {
    method: 'PATCH',
    token: tokenCliente,
  });
  assert.equal(descarga.status, 200);
  assert.ok(descarga.body.datos.fecha_descarga);

  // 14. Envio
  const envio = await pedir(`/api/v1/informes/${informeId}/envio`, {
    method: 'PATCH',
    token: tokenCoord,
  });
  assert.equal(envio.status, 200);
  assert.ok(envio.body.datos.fecha_envio);

  // 15. Estado final
  const solicitudFinal = await Solicitud.findById(solicitudId);
  assert.equal(solicitudFinal.estado, ESTADO_SOLICITUD.FINALIZADA);

  // 16. Consultas del cliente
  const misSolicitudes = await pedir('/api/v1/solicitudes/mias', {
    token: tokenCliente,
  });
  assert.equal(misSolicitudes.body.datos.total, 1);

  const misCupones = await pedir('/api/v1/cupones/mios', {
    token: tokenCliente,
  });
  assert.equal(misCupones.body.datos.total, 1);

  const misPagos = await pedir('/api/v1/pagos/mios', {
    token: tokenCliente,
  });
  assert.equal(misPagos.body.datos.total, 1);

  const misMuestras = await pedir('/api/v1/muestras/mias', {
    token: tokenCliente,
  });
  assert.equal(misMuestras.body.datos.total, 1);

  const misOrdenes = await pedir('/api/v1/ordenes/mias', {
    token: tokenCliente,
  });
  assert.equal(misOrdenes.body.datos.total, 1);

  const misInformes = await pedir('/api/v1/informes/mios', {
    token: tokenCliente,
  });
  assert.equal(misInformes.body.datos.total, 1);

  const misEncuestas = await pedir('/api/v1/encuestas/mias', {
    token: tokenCliente,
  });
  assert.equal(misEncuestas.body.datos.total, 1);

  // 17. Historial de estados
  const historial = await HistorialEstadoSolicitud.find({
    solicitud: solicitudId,
  }).sort({ fecha_hora: 1 });
  assert.ok(historial.length >= 6);
  assert.equal(
    historial[historial.length - 1].estado,
    ESTADO_SOLICITUD.FINALIZADA
  );
});
