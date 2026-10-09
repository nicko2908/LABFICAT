/**
 * Constantes del sistema: enums y estados alineados al modelo de datos.
 * Se usan para no escribir "strings magicos" en el codigo.
 */

const ROLES = {
  CLIENTE: 'cliente',
  ANALISTA: 'analista',
  COORDINADOR: 'coordinador',
};

// Lista de roles validos (se usa como enum de Mongoose).
const ROLES_LISTA = Object.values(ROLES);

// Tipos de documento de identidad permitidos (enum cerrado, evita valores libres).
const TIPOS_DOCUMENTO = {
  CC: 'CC',   // Cedula de ciudadania
  CE: 'CE',   // Cedula de extranjeria
  NIT: 'NIT', // Numero de identificacion tributaria
  PP: 'PP',   // Pasaporte
  TI: 'TI',   // Tarjeta de identidad
  RC: 'RC',   // Registro civil
};

const TIPOS_DOCUMENTO_LISTA = Object.values(TIPOS_DOCUMENTO);

// Modulos de la plataforma (usados dentro de los permisos de un rol).
const MODULOS = {
  CLIENTES: 'clientes',
  TIPOLOGIAS: 'tipologias',
  SOLICITUDES: 'solicitudes',
  COTIZACIONES: 'cotizaciones',
  CUPONES: 'cupones',
  PAGOS: 'pagos',
  MUESTRAS: 'muestras',
  ROTULOS: 'rotulos',
  ORDENES: 'ordenes',
  INFORMES: 'informes',
  ENCUESTAS: 'encuestas',
  RECLAMACIONES: 'reclamaciones',
  REPORTES: 'reportes',
  TRAZABILIDAD: 'trazabilidad',
  CATALOGO: 'catalogo',
  PARAMETRIZACION: 'parametrizacion',
};

// Catalogo de codigos de permiso validos. Evita typos al construir un rol.
const PERMISOS = {
  // Cliente
  CREAR_SOLICITUD: 'crear_solicitud',
  VER_MIS_SOLICITUDES: 'ver_mis_solicitudes',
  FIRMAR_COTIZACION: 'firmar_cotizacion',
  CARGAR_SOPORTE_PAGO: 'cargar_soporte_pago',
  CONSULTAR_TRAZABILIDAD: 'consultar_trazabilidad',
  RESPONDER_ENCUESTA: 'responder_encuesta',
  REGISTRAR_RECLAMACION: 'registrar_reclamacion',
  // Analista
  VER_MUESTRAS_ASIGNADAS: 'ver_muestras_asignadas',
  REGISTRAR_AVANCE_ANALISIS: 'registrar_avance_analisis',
  REGISTRAR_RESULTADOS: 'registrar_resultados',
  // Coordinador
  GESTIONAR_CLIENTES: 'gestionar_clientes',
  GESTIONAR_TIPOLOGIAS: 'gestionar_tipologias',
  GESTIONAR_CATALOGO: 'gestionar_catalogo',
  GESTIONAR_SOLICITUDES: 'gestionar_solicitudes',
  GESTIONAR_CUPONES: 'gestionar_cupones',
  VALIDAR_PAGOS: 'validar_pagos',
  RECIBIR_MUESTRAS: 'recibir_muestras',
  ASIGNAR_CODIGO_ROTULAR: 'asignar_codigo_rotular',
  PRIORIZAR_MUESTRAS: 'priorizar_muestras',
  VALIDAR_RESULTADOS: 'validar_resultados',
  REPETIR_ANALISIS: 'repetir_analisis',
  GENERAR_INFORMES: 'generar_informes',
  ENVIAR_INFORMES: 'enviar_informes',
  GESTIONAR_RECLAMACIONES: 'gestionar_reclamaciones',
  GENERAR_REPORTES: 'generar_reportes',
  PARAMETRIZAR_SISTEMA: 'parametrizar_sistema',
};

// Claves de la coleccion ConfiguracionSistema (parametrizacion, RF-24).
// Produccion de Centro (Opcion A) se guarda aqui como destinatario configurable.
const CONFIGURACION_CLAVES = {
  PRODUCCION_CENTRO_EMAIL: 'PRODUCCION_CENTRO_EMAIL',
  PRODUCCION_CENTRO_NOMBRE: 'PRODUCCION_CENTRO_NOMBRE',
  CUPON_UMBRAL_RECORDATORIO_DIAS: 'CUPON_UMBRAL_RECORDATORIO_DIAS',
  TOKEN_RECUPERACION_MINUTOS: 'TOKEN_RECUPERACION_MINUTOS',
};

// Parametros de seguridad de la cuenta (RF-27).
const SEGURIDAD = {
  MAX_INTENTOS_FALLIDOS: 5,
};

const TIPO_CLIENTE = {
  INTERNO: 'INTERNO',
  EXTERNO: 'EXTERNO',
};

const ESTADO_SOLICITUD = {
  REGISTRADA: 'Registrada',
  COTIZADA: 'Cotizada',
  ACEPTADA: 'Aceptada',
  DESISTIDA: 'Desistida',
  PAGO_PENDIENTE_VERIFICACION: 'Pago pendiente de verificacion',
  PAGO_APROBADO: 'Pago aprobado',
  PAGO_RECHAZADO: 'Pago rechazado',
  EN_ANALISIS: 'En analisis',
  INFORME_LISTO: 'Informe listo',
  FINALIZADA: 'Finalizada',
  CERRADA: 'Cerrada',
};

// Estados validos de una solicitud (enum de Mongoose).
const ESTADO_SOLICITUD_LISTA = Object.values(ESTADO_SOLICITUD);

const ESTADO_COTIZACION = {
  PENDIENTE: 'PENDIENTE',
  ACEPTADA: 'ACEPTADA',
  RECHAZADA: 'RECHAZADA',
};

const ESTADO_COTIZACION_LISTA = Object.values(ESTADO_COTIZACION);

const ESTADO_CUPON = {
  PENDIENTE: 'PENDIENTE',
  GENERADO: 'GENERADO',
  UTILIZADO: 'UTILIZADO',
  VENCIDO: 'VENCIDO',
};

const ESTADO_CUPON_LISTA = Object.values(ESTADO_CUPON);

const ESTADO_SOPORTE_PAGO = {
  PENDIENTE_VERIFICACION: 'PENDIENTE_VERIFICACION',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO',
};

const ESTADO_SOPORTE_PAGO_LISTA = Object.values(ESTADO_SOPORTE_PAGO);

const ESTADO_ORDEN = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN_PROCESO',
  FINALIZADA: 'FINALIZADA',
  INVALIDADA: 'INVALIDADA',
};

const ESTADO_ORDEN_LISTA = Object.values(ESTADO_ORDEN);

const ESTADO_RECEPCION_MUESTRA = {
  ACEPTADA: 'ACEPTADA',
  RECHAZADA: 'RECHAZADA',
};

const PRIORIDAD = {
  ALTA: 1,
  MEDIA: 3,
  BAJA: 5,
};

const ESTADO_RECLAMACION = {
  ABIERTA: 'ABIERTA',
  RESUELTA: 'RESUELTA',
};

const ESTADO_RECLAMACION_LISTA = Object.values(ESTADO_RECLAMACION);

// Decisiones de validacion de resultados (RF-13).
const DECISION_VALIDACION = ['APROBADO', 'RECHAZADO'];

const FORMATOS_SOPORTE = ['PDF', 'JPG', 'PNG'];
const FORMATOS_EVIDENCIA = ['PNG', 'JPG', 'JPEG'];

const LIMITES = {
  SOPORTE_PAGO_MAX_MB: 5,
  EVIDENCIA_MAX_MB: 5,
  EVIDENCIA_MAX_ARCHIVOS: 5,
  RECLAMACION_DIAS_HABILES: 5,
  CANTIDAD_MINIMA_MUESTRA: 300, // gr o ml (RF-09)
  CUPON_VIGENCIA_DIAS: 5,       // vigencia fija del cupon, la establece Produccion de Centro
};

export {
  ROLES,
  ROLES_LISTA,
  TIPOS_DOCUMENTO,
  TIPOS_DOCUMENTO_LISTA,
  MODULOS,
  PERMISOS,
  CONFIGURACION_CLAVES,
  SEGURIDAD,
  TIPO_CLIENTE,
  ESTADO_SOLICITUD,
  ESTADO_SOLICITUD_LISTA,
  ESTADO_COTIZACION,
  ESTADO_COTIZACION_LISTA,
  ESTADO_CUPON,
  ESTADO_CUPON_LISTA,
  ESTADO_SOPORTE_PAGO,
  ESTADO_SOPORTE_PAGO_LISTA,
  ESTADO_ORDEN,
  ESTADO_ORDEN_LISTA,
  ESTADO_RECEPCION_MUESTRA,
  PRIORIDAD,
  ESTADO_RECLAMACION,
  ESTADO_RECLAMACION_LISTA,
  DECISION_VALIDACION,
  FORMATOS_SOPORTE,
  FORMATOS_EVIDENCIA,
  LIMITES,
};
