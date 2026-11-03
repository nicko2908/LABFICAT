/**
 * Semilla de datos iniciales: roles, configuracion del sistema, catalogos
 * del laboratorio y usuario de prueba.
 *
 * Los catalogos se siembran de forma idempotente. Las tipologias se
 * sincronizan por nombre para que la opcion NINGUNA exista tambien en bases
 * que ya tenian las 12 tipologias originales.
 * Ejecutar con:  npm run seed
 */
import 'dotenv/config';

import { connectDB, disconnectDB } from '../config/database.js';
import Rol from '../models/seguridad/Rol.js';
import Usuario from '../models/seguridad/Usuario.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import TipoMuestra from '../models/laboratorio/TipoMuestra.js';
import Parametro from '../models/laboratorio/Parametro.js';
import EtapaProceso from '../models/laboratorio/EtapaProceso.js';
import Analisis from '../models/laboratorio/Analisis.js';
import ConfiguracionSistema from '../models/sistema/ConfiguracionSistema.js';
import password from '../utils/password.js';
import {
  ROLES,
  PERMISOS,
  MODULOS,
  TIPOS_DOCUMENTO,
  CONFIGURACION_CLAVES,
} from '../config/constants.js';
import {
  TIPOLOGIAS_SEMILLA,
  TIPOLOGIAS_LEGADO,
  TIPOS_MUESTRA_SEMILLA,
  PARAMETRO_RESULTADO,
  ANALISIS_SEMILLA,
  PRECIO_ANALISIS,
} from './catalogos.js';

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
    clave: CONFIGURACION_CLAVES.CUPON_UMBRAL_RECORDATORIO_DIAS,
    valor: String(process.env.CUPON_UMBRAL_RECORDATORIO_DIAS || 5),
    descripcion: 'Dias habiles sin generar cupon para disparar el recordatorio (RF-24).',
  },
  {
    clave: CONFIGURACION_CLAVES.TOKEN_RECUPERACION_MINUTOS,
    valor: String(process.env.TOKEN_RECUPERACION_MINUTOS || 30),
    descripcion: 'Vigencia del token de recuperacion de contrasena (RF-27).',
  },
  {
    clave: CONFIGURACION_CLAVES.RESPONSABLE_LABORATORIO,
    valor: process.env.RESPONSABLE_LABORATORIO || 'Responsable LABFICAT',
    descripcion: 'Nombre del responsable que firma la Oferta de servicios.',
  },
];

// Parametros: se conservan los de ejemplo y se agrega "Resultado", que es el
// parametro generico que permite registrar un valor por ensayo en la orden.
const PARAMETROS_SEMILLA = [
  { nombre: 'pH', unidad_medida: 'unidades', activo: true },
  { nombre: 'Turbidez', unidad_medida: 'NTU', activo: true },
  { nombre: 'Conductividad', unidad_medida: 'uS/cm', activo: true },
  { nombre: 'Coliformes totales', unidad_medida: 'UFC/100 mL', activo: true },
  { nombre: 'Solidos totales', unidad_medida: 'mg/L', activo: true },
  PARAMETRO_RESULTADO,
];

// Etapas del proceso (segun el mapa de procesos LABFICAT).
const ETAPAS_SEMILLA = [
  { nombre: 'Recepcion y rotulado', orden: 1, activo: true },
  { nombre: 'Ejecucion de analisis', orden: 2, activo: true },
  { nombre: 'Validacion', orden: 3, activo: true },
  { nombre: 'Informe', orden: 4, activo: true },
  { nombre: 'Entrega y encuesta', orden: 5, activo: true },
];

// Analisis de ejemplo del catalogo anterior: se desactivan, no se borran,
// para no romper solicitudes/cotizaciones historicas que los referencian.
const ANALISIS_LEGADO_NOMBRES = [
  'Analisis fisicoquimico de agua',
  'Analisis microbiologico de agua',
  'Analisis de suelo',
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

/**
 * Sincroniza las 16 tipologias comerciales. Las 4 internas liquidan al 0 %.
 * Las 12 tipologias del RF-01 anterior se desactivan (no se borran) para
 * conservar la integridad de los clientes historicos.
 */
async function sembrarTipologias() {
  await TipologiaPoblacional.bulkWrite(
    TIPOLOGIAS_SEMILLA.map((tipologia) => ({
      updateOne: {
        filter: { nombre: tipologia.nombre },
        update: {
          $set: {
            codigo: tipologia.codigo,
            es_interno: Boolean(tipologia.es_interno),
            activo: tipologia.activo !== false,
            descripcion: tipologia.descripcion || null,
          },
        },
        upsert: true,
      },
    }))
  );

  await TipologiaPoblacional.updateMany(
    { nombre: { $in: TIPOLOGIAS_LEGADO } },
    { $set: { activo: false } }
  );

  const total = await TipologiaPoblacional.countDocuments({ activo: true });
  console.log(`[seed] Tipologias activas: ${total}`);
}

/** Sincroniza las presentaciones de muestra de la recepcion. */
async function sembrarTiposMuestra() {
  await TipoMuestra.bulkWrite(
    TIPOS_MUESTRA_SEMILLA.map((tipo) => ({
      updateOne: {
        filter: { nombre: tipo.nombre },
        update: { $set: tipo },
        upsert: true,
      },
    }))
  );

  // Los tipos de muestra del catalogo anterior quedan inactivos, pero no se
  // eliminan porque pueden estar referenciados por muestras historicas.
  await TipoMuestra.updateMany(
    { nombre: { $in: ['Agua', 'Sangre', 'Orina', 'Suelo', 'Alimento'] } },
    { $set: { activo: false } }
  );

  const total = await TipoMuestra.countDocuments({ activo: true });
  console.log(`[seed] Tipos de muestra activos: ${total}`);
}

/** Sincroniza los parametros, incluido el generico "Resultado". */
async function sembrarParametros() {
  await Parametro.bulkWrite(
    PARAMETROS_SEMILLA.map((parametro) => ({
      updateOne: {
        filter: { nombre: parametro.nombre },
        update: { $set: parametro },
        upsert: true,
      },
    }))
  );

  const total = await Parametro.countDocuments({ activo: true });
  console.log(`[seed] Parametros activos: ${total}`);
}

/**
 * Sincroniza los 35 ensayos por codigo. Cada ensayo referencia el parametro
 * generico "Resultado" para que una orden pueda registrar un valor y finalizar.
 */
async function sembrarAnalisis() {
  const resultado = await Parametro.findOne({ nombre: PARAMETRO_RESULTADO.nombre });
  if (!resultado) {
    throw new Error('No se encontro el parametro generico "Resultado"');
  }

  await Analisis.bulkWrite(
    ANALISIS_SEMILLA.map((analisis) => {
      const descripcion = `${analisis.nombre}${analisis.acreditado ? '°' : ''} - ${analisis.tecnica || ''}`
        .trim()
        .slice(0, 200);

      return {
        updateOne: {
          filter: { codigo: analisis.codigo },
          update: {
            $set: {
              codigo: analisis.codigo,
              nombre: analisis.nombre,
              descripcion,
              unidades: analisis.unidades,
              metodo: analisis.metodo,
              tecnica: analisis.tecnica,
              acreditado: Boolean(analisis.acreditado),
              tarifa_externo: PRECIO_ANALISIS,
              cantidad_minima: 0,
              unidad_cantidad: null,
              parametros: [resultado._id],
              tipos_muestra: [],
              activo: true,
            },
          },
          upsert: true,
        },
      };
    })
  );

  // Los tres analisis de ejemplo del catalogo anterior se desactivan.
  await Analisis.updateMany(
    { nombre: { $in: ANALISIS_LEGADO_NOMBRES } },
    { $set: { activo: false } }
  );

  const total = await Analisis.countDocuments({ codigo: { $ne: null }, activo: true });
  console.log(`[seed] Analisis activos con codigo: ${total}`);
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
    // $setOnInsert: no sobrescribe valores editados por el coordinador (RF-24).
    await ConfiguracionSistema.bulkWrite(
      CONFIGURACION_SEMILLA.map((cfg) => ({
        updateOne: { filter: { clave: cfg.clave }, update: { $setOnInsert: cfg }, upsert: true },
      }))
    );
    console.log(`[seed] Configuracion sincronizada: ${CONFIGURACION_SEMILLA.length}`);

    // 3. Catalogos
    await sembrarTipologias();
    await sembrarTiposMuestra();
    await sembrarParametros();
    await sembrarSiVacio(EtapaProceso, ETAPAS_SEMILLA, 'Etapas de proceso');
    await sembrarAnalisis();

    // 4. Usuario de prueba (coordinador)
    const rolCoordinador = await Rol.findOne({ nombre: ROLES.COORDINADOR });
    if (rolCoordinador) {
      const hash = await password.hash(USUARIO_PRUEBA.contrasena);
      const existente = await Usuario.findOne({ correo: USUARIO_PRUEBA.correo })
        .select('+contrasena_hash');

      if (!existente) {
        await Usuario.create({
          rol: rolCoordinador._id,
          nombres: USUARIO_PRUEBA.nombres,
          apellidos: USUARIO_PRUEBA.apellidos,
          tipo_documento: USUARIO_PRUEBA.tipo_documento,
          numero_documento: USUARIO_PRUEBA.numero_documento,
          correo: USUARIO_PRUEBA.correo,
          contrasena_hash: hash,
          activo: true,
        });
      } else {
        existente.rol = rolCoordinador._id;
        existente.nombres = USUARIO_PRUEBA.nombres;
        existente.apellidos = USUARIO_PRUEBA.apellidos;
        existente.tipo_documento = USUARIO_PRUEBA.tipo_documento;
        existente.numero_documento = USUARIO_PRUEBA.numero_documento;
        existente.activo = true;
        // Si el usuario fue creado como prospecto (sin credenciales),
        // el seed le asigna la contrasena de prueba. No la sobrescribe
        // si el usuario ya tiene una.
        if (!existente.contrasena_hash) existente.contrasena_hash = hash;
        await existente.save();
      }

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
