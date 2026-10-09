/**
 * Semilla de datos iniciales: roles, configuracion del sistema, catalogos
 * del laboratorio y usuario de prueba.
 *
 * Cada catalogo se siembra SOLO si su coleccion esta vacia (idempotente).
 * Ejecutar con:  npm run seed
 */
require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/database');
const Rol = require('../models/seguridad/Rol');
const Usuario = require('../models/seguridad/Usuario');
const TipologiaPoblacional = require('../models/clientes/TipologiaPoblacional');
const TipoMuestra = require('../models/laboratorio/TipoMuestra');
const Parametro = require('../models/laboratorio/Parametro');
const EtapaProceso = require('../models/laboratorio/EtapaProceso');
const Analisis = require('../models/laboratorio/Analisis');
const ConfiguracionSistema = require('../models/sistema/ConfiguracionSistema');
const password = require('../utils/password');
const {
  ROLES,
  PERMISOS,
  MODULOS,
  TIPOS_DOCUMENTO,
  CONFIGURACION_CLAVES,
} = require('../config/constants');

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const ROLES_SEMILLA = [
  {
    nombre: ROLES.CLIENTE,
    descripcion: 'Cliente interno o externo del laboratorio',
    permisos: [
      { nombre: PERMISOS.CREAR_SOLICITUD, modulos: [MODULOS.SOLICITUDES, MODULOS.COTIZACIONES] },
      { nombre: PERMISOS.VER_MIS_SOLICITUDES, modulos: [MODULOS.SOLICITUDES] },
      { nombre: PERMISOS.FIRMAR_COTIZACION, modulos: [MODULOS.COTIZACIONES] },
      { nombre: PERMISOS.CARGAR_SOPORTE_PAGO, modulos: [MODULOS.PAGOS] },
      { nombre: PERMISOS.CONSULTAR_TRAZABILIDAD, modulos: [MODULOS.TRAZABILIDAD] },
      { nombre: PERMISOS.RESPONDER_ENCUESTA, modulos: [MODULOS.ENCUESTAS] },
      { nombre: PERMISOS.REGISTRAR_RECLAMACION, modulos: [MODULOS.RECLAMACIONES] },
    ],
  },
  {
    nombre: ROLES.ANALISTA,
    descripcion: 'Analista del laboratorio',
    permisos: [
      { nombre: PERMISOS.VER_MUESTRAS_ASIGNADAS, modulos: [MODULOS.MUESTRAS, MODULOS.ORDENES] },
      { nombre: PERMISOS.REGISTRAR_AVANCE_ANALISIS, modulos: [MODULOS.ORDENES] },
      { nombre: PERMISOS.REGISTRAR_RESULTADOS, modulos: [MODULOS.ORDENES] },
    ],
  },
  {
    nombre: ROLES.COORDINADOR,
    descripcion: 'Coordinador / administrador del laboratorio',
    permisos: [
      { nombre: PERMISOS.GESTIONAR_CLIENTES, modulos: [MODULOS.CLIENTES] },
      { nombre: PERMISOS.GESTIONAR_TIPOLOGIAS, modulos: [MODULOS.TIPOLOGIAS] },
      { nombre: PERMISOS.GESTIONAR_CATALOGO, modulos: [MODULOS.CATALOGO] },
      { nombre: PERMISOS.GESTIONAR_SOLICITUDES, modulos: [MODULOS.SOLICITUDES] },
      { nombre: PERMISOS.GESTIONAR_CUPONES, modulos: [MODULOS.CUPONES] },
      { nombre: PERMISOS.VALIDAR_PAGOS, modulos: [MODULOS.PAGOS] },
      { nombre: PERMISOS.RECIBIR_MUESTRAS, modulos: [MODULOS.MUESTRAS] },
      { nombre: PERMISOS.ASIGNAR_CODIGO_ROTULAR, modulos: [MODULOS.MUESTRAS, MODULOS.ROTULOS] },
      { nombre: PERMISOS.PRIORIZAR_MUESTRAS, modulos: [MODULOS.MUESTRAS] },
      { nombre: PERMISOS.VALIDAR_RESULTADOS, modulos: [MODULOS.ORDENES] },
      { nombre: PERMISOS.REPETIR_ANALISIS, modulos: [MODULOS.ORDENES] },
      { nombre: PERMISOS.GENERAR_INFORMES, modulos: [MODULOS.INFORMES] },
      { nombre: PERMISOS.ENVIAR_INFORMES, modulos: [MODULOS.INFORMES] },
      { nombre: PERMISOS.GESTIONAR_RECLAMACIONES, modulos: [MODULOS.RECLAMACIONES] },
      { nombre: PERMISOS.GENERAR_REPORTES, modulos: [MODULOS.REPORTES] },
      { nombre: PERMISOS.PARAMETRIZAR_SISTEMA, modulos: [MODULOS.PARAMETRIZACION] },
    ],
  },
];

const CONFIGURACION_SEMILLA = [
  {
    clave: CONFIGURACION_CLAVES.PRODUCCION_CENTRO_EMAIL,
    valor: process.env.MAIL_TO_PRODUCCION || 'produccioncentro@sena.edu.co',
    descripcion: 'Correo de Produccion de Centro (destinatario de alertas de cupones, RF-06/RF-24).',
  },
  {
    clave: CONFIGURACION_CLAVES.PRODUCCION_CENTRO_NOMBRE,
    valor: 'Produccion de Centro',
    descripcion: 'Nombre del area que provee los cupones de pago.',
  },
  {
    clave: CONFIGURACION_CLAVES.CUPON_VIGENCIA_DIAS,
    valor: String(process.env.CUPON_VIGENCIA_DIAS || 15),
    descripcion: 'Dias de vigencia del cupon de pago (RF-06).',
  },
  {
    clave: CONFIGURACION_CLAVES.CUPON_UMBRAL_RECORDATORIO_DIAS,
    valor: String(process.env.CUPON_UMBRAL_RECORDATORIO_DIAS || 5),
    descripcion: 'Dias habiles sin generar cupon para disparar el recordatorio (RF-24).',
  },
  {
    clave: CONFIGURACION_CLAVES.TOKEN_RECUPERACION_MINUTOS,
    valor: String(process.env.TOKEN_RECUPERACION_MINUTOS || 30),
    descripcion: 'Vigencia del token de recuperacion de contrasena (RF-27).',
  },
];

// Las 12 tipologias poblacionales iniciales (RF-01).
const TIPOLOGIAS_SEMILLA = [
  'Indígena',
  'Afrocolombiano, negro, raizal o palenquero',
  'Rrom o gitano',
  'Campesino',
  'Víctima del conflicto armado',
  'Persona con discapacidad',
  'Mujer cabeza de hogar',
  'Población LGBTIQ+',
  'Persona reincorporada o reintegrada',
  'Empresario o emprendedor',
  'Aprendiz, estudiante o egresado',
  'Ninguna de las anteriores',
].map((nombre) => ({ nombre, activo: true }));

// Tipos de muestra (ejemplos de prueba).
const TIPOS_MUESTRA_SEMILLA = [
  { nombre: 'Agua', estado_fisico: 'LIQUIDO', activo: true },
  { nombre: 'Sangre', estado_fisico: 'LIQUIDO', activo: true },
  { nombre: 'Orina', estado_fisico: 'LIQUIDO', activo: true },
  { nombre: 'Suelo', estado_fisico: 'SOLIDO', activo: true },
  { nombre: 'Alimento', estado_fisico: 'SOLIDO', activo: true },
];

// Parametros (ejemplos de prueba).
const PARAMETROS_SEMILLA = [
  { nombre: 'pH', unidad_medida: 'unidades', activo: true },
  { nombre: 'Turbidez', unidad_medida: 'NTU', activo: true },
  { nombre: 'Conductividad', unidad_medida: 'uS/cm', activo: true },
  { nombre: 'Coliformes totales', unidad_medida: 'UFC/100 mL', activo: true },
  { nombre: 'Solidos totales', unidad_medida: 'mg/L', activo: true },
];

// Etapas del proceso (segun el mapa de procesos LABFICAT).
const ETAPAS_SEMILLA = [
  { nombre: 'Recepcion y rotulado', orden: 1, activo: true },
  { nombre: 'Ejecucion de analisis', orden: 2, activo: true },
  { nombre: 'Validacion', orden: 3, activo: true },
  { nombre: 'Informe', orden: 4, activo: true },
  { nombre: 'Entrega y encuesta', orden: 5, activo: true },
];

// Analisis (ejemplos de prueba). Los parametros y tipos de muestra se resuelven
// por nombre a ObjectId al momento de sembrar.
const ANALISIS_SEMILLA = [
  {
    nombre: 'Analisis fisicoquimico de agua',
    descripcion: 'Determinacion de parametros fisicoquimicos en muestras de agua.',
    tarifa_externo: 120000,
    cantidad_minima: 500,
    unidad_cantidad: 'ml',
    parametros: ['pH', 'Turbidez', 'Conductividad'],
    tipos_muestra: ['Agua'],
  },
  {
    nombre: 'Analisis microbiologico de agua',
    descripcion: 'Recuento de microorganismos indicadores en muestras de agua.',
    tarifa_externo: 150000,
    cantidad_minima: 500,
    unidad_cantidad: 'ml',
    parametros: ['Coliformes totales'],
    tipos_muestra: ['Agua'],
  },
  {
    nombre: 'Analisis de suelo',
    descripcion: 'Determinacion de parametros fisicoquimicos en muestras de suelo.',
    tarifa_externo: 180000,
    cantidad_minima: 300,
    unidad_cantidad: 'gr',
    parametros: ['pH', 'Solidos totales'],
    tipos_muestra: ['Suelo'],
  },
];

// Usuario de prueba con rol coordinador (para poder entrar al sistema).
const USUARIO_PRUEBA = {
  nombres: 'Coordinador',
  apellidos: 'LABFICAT',
  tipo_documento: TIPOS_DOCUMENTO.CC,
  numero_documento: '1000000000',
  correo: 'coordinador@sena.edu.co',
  contrasena: 'Labficat123*',
};

// ---------------------------------------------------------------------------
// Utilidades de siembra
// ---------------------------------------------------------------------------

async function sembrarSiVacio(Modelo, datos, etiqueta) {
  const total = await Modelo.estimatedDocumentCount();
  if (total > 0) {
    console.log(`[seed] ${etiqueta}: ya existen ${total}, no se siembran.`);
    return;
  }
  await Modelo.insertMany(datos);
  console.log(`[seed] ${etiqueta} sembrados: ${datos.length}`);
}

async function sembrarAnalisis() {
  const total = await Analisis.estimatedDocumentCount();
  if (total > 0) {
    console.log(`[seed] Analisis: ya existen ${total}, no se siembran.`);
    return;
  }

  const parametros = await Parametro.find({ nombre: { $in: PARAMETROS_SEMILLA.map((p) => p.nombre) } });
  const tipos = await TipoMuestra.find({ nombre: { $in: TIPOS_MUESTRA_SEMILLA.map((t) => t.nombre) } });
  const idParametro = new Map(parametros.map((p) => [p.nombre, p._id]));
  const idTipo = new Map(tipos.map((t) => [t.nombre, t._id]));

  const docs = ANALISIS_SEMILLA.map((a) => ({
    nombre: a.nombre,
    descripcion: a.descripcion,
    tarifa_externo: a.tarifa_externo,
    cantidad_minima: a.cantidad_minima,
    unidad_cantidad: a.unidad_cantidad,
    parametros: a.parametros.map((n) => idParametro.get(n)).filter(Boolean),
    tipos_muestra: a.tipos_muestra.map((n) => idTipo.get(n)).filter(Boolean),
    activo: true,
  }));

  await Analisis.insertMany(docs);
  console.log(`[seed] Analisis sembrados: ${docs.length}`);
}

// ---------------------------------------------------------------------------
// Proceso principal
// ---------------------------------------------------------------------------

async function seed() {
  try {
    await connectDB();

    // 1. Roles
    await Rol.bulkWrite(
      ROLES_SEMILLA.map((rol) => ({
        updateOne: { filter: { nombre: rol.nombre }, update: { $set: rol }, upsert: true },
      }))
    );
    console.log(`[seed] Roles sembrados: ${ROLES_SEMILLA.length}`);

    // 2. Configuracion del sistema
    await ConfiguracionSistema.bulkWrite(
      CONFIGURACION_SEMILLA.map((cfg) => ({
        updateOne: { filter: { clave: cfg.clave }, update: { $set: cfg }, upsert: true },
      }))
    );
    console.log(`[seed] Configuracion sembrada: ${CONFIGURACION_SEMILLA.length}`);

    // 3. Catalogos
    await sembrarSiVacio(TipologiaPoblacional, TIPOLOGIAS_SEMILLA, 'Tipologias');
    await sembrarSiVacio(TipoMuestra, TIPOS_MUESTRA_SEMILLA, 'Tipos de muestra');
    await sembrarSiVacio(Parametro, PARAMETROS_SEMILLA, 'Parametros');
    await sembrarSiVacio(EtapaProceso, ETAPAS_SEMILLA, 'Etapas de proceso');
    await sembrarAnalisis();

    // 4. Usuario de prueba (coordinador)
    const rolCoordinador = await Rol.findOne({ nombre: ROLES.COORDINADOR });
    if (rolCoordinador) {
      const hash = await password.hash(USUARIO_PRUEBA.contrasena);
      await Usuario.updateOne(
        { correo: USUARIO_PRUEBA.correo },
        {
          $set: {
            rol: rolCoordinador._id,
            nombres: USUARIO_PRUEBA.nombres,
            apellidos: USUARIO_PRUEBA.apellidos,
            tipo_documento: USUARIO_PRUEBA.tipo_documento,
            numero_documento: USUARIO_PRUEBA.numero_documento,
            activo: true,
          },
          $setOnInsert: { contrasena_hash: hash },
        },
        { upsert: true }
      );
      console.log(`[seed] Usuario de prueba: ${USUARIO_PRUEBA.correo} / ${USUARIO_PRUEBA.contrasena}`);
    }

    console.log('[seed] Completado.');
  } catch (error) {
    console.error('[seed] Error:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

seed();
