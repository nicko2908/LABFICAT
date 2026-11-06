/**
 * Contrato OpenAPI de LABFICAT.
 *
 * Es una especificacion pragmatica de los endpoints principales. Las rutas
 * se documentan con el prefijo /api/v1 y el servidor raiz "/".
 */

const json = (schema, description = 'OK') => ({
  description,
  content: {
    'application/json': { schema },
  },
});

const apiResponse = { $ref: '#/components/schemas/ApiResponse' };
const errorResponse = { $ref: '#/components/schemas/Error' };

const ok = (description = 'OK') => json(apiResponse, description);
const created = (description = 'Creado') => ({ 201: json(apiResponse, description) });
const accepted = (description = 'Aceptado') => ({ 202: json(apiResponse, description) });
const noContent = (description = 'Sin contenido') => ({ 204: { description } });
const errores = {
  400: json(errorResponse, 'Solicitud invalida'),
  401: json(errorResponse, 'No autenticado'),
  403: json(errorResponse, 'No autorizado'),
  404: json(errorResponse, 'No encontrado'),
  409: json(errorResponse, 'Conflicto de estado'),
};

const idParam = (name, description = 'Identificador') => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' },
});

const security = [{ bearerAuth: [] }];

const op = (tag, summary, extra = {}) => ({
  tags: [tag],
  summary,
  security,
  responses: { ...ok(), ...errores },
  ...extra,
});

const jsonBody = (schema) => ({
  required: true,
  content: {
    'application/json': { schema },
  },
});

const pdfResponse = (description) => ({
  200: {
    description,
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  },
  ...errores,
});

const excelResponse = (description) => ({
  200: {
    description,
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  },
  ...errores,
});

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'LABFICAT API',
    version: '1.0.0',
    description:
      'API REST del laboratorio LABFICAT. Formato de respuesta: { ok, mensaje, datos }. ' +
      'Los errores usan { ok:false, mensaje, detalles? }.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'Auth' },
    { name: 'Catalogos' },
    { name: 'Clientes' },
    { name: 'Solicitudes' },
    { name: 'Cotizaciones' },
    { name: 'Cupones' },
    { name: 'Pagos' },
    { name: 'Muestras' },
    { name: 'Ordenes' },
    { name: 'Informes' },
    { name: 'Encuestas' },
    { name: 'Reclamaciones' },
    { name: 'Reportes' },
    { name: 'Trazabilidad' },
    { name: 'Auditoria' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          mensaje: { type: 'string', example: 'OK' },
          datos: { nullable: true },
        },
      },
      Error: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          mensaje: { type: 'string' },
          detalles: { nullable: true },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['correo', 'contrasena'],
        properties: {
          correo: { type: 'string', format: 'email' },
          contrasena: { type: 'string', minLength: 8 },
        },
      },
      RegistroRequest: {
        type: 'object',
        required: [
          'nombres',
          'apellidos',
          'tipo_documento',
          'numero_documento',
          'correo',
          'contrasena',
          'tipologia',
          'acepta_tratamiento_datos',
        ],
        properties: {
          nombres: { type: 'string' },
          apellidos: { type: 'string' },
          tipo_documento: { type: 'string', enum: ['CC', 'CE', 'NIT', 'PP', 'TI', 'RC'] },
          numero_documento: { type: 'string' },
          correo: { type: 'string', format: 'email' },
          contrasena: { type: 'string', minLength: 8 },
          tipologia: { type: 'string', description: 'ObjectId de la tipologia' },
          telefono: { type: 'string', nullable: true },
          razon_social: { type: 'string', nullable: true },
          nit: { type: 'string', nullable: true },
          acepta_tratamiento_datos: { type: 'boolean', example: true },
        },
      },
      PagoRequest: {
        type: 'object',
        required: ['cupon'],
        properties: {
          cupon: { type: 'string' },
          referencia_externa: { type: 'string', nullable: true, maxLength: 100 },
          observaciones: { type: 'string', nullable: true, maxLength: 200 },
        },
      },
      DecisionRequest: {
        type: 'object',
        required: ['decision'],
        properties: {
          decision: { type: 'string', enum: ['ACEPTADA', 'RECHAZADA'] },
          firma_base64: { type: 'string', description: 'PNG en base64; obligatorio para ACEPTADA' },
          firma_ip: { type: 'string', nullable: true },
          motivo_rechazo: { type: 'string', nullable: true },
        },
      },
      EvidenciaUpload: {
        type: 'object',
        required: ['evidencias'],
        properties: {
          evidencias: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            maxItems: 5,
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Auth'],
        summary: 'Estado del servicio',
        security: [],
        responses: { 200: json({ type: 'object' }, 'Servicio activo') },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesion',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
        responses: { 200: ok('Token y usuario'), ...errores },
      },
    },
    '/api/v1/auth/registro': {
      post: {
        tags: ['Auth'],
        summary: 'Registro de cliente',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/RegistroRequest' }),
        responses: { 201: ok('Cliente registrado'), ...errores },
      },
    },
    '/api/v1/auth/perfil': {
      get: op('Auth', 'Perfil del usuario autenticado'),
    },
    '/api/v1/auth/contrasena': {
      patch: op('Auth', 'Cambiar contrasena', {
        requestBody: jsonBody({
          type: 'object',
          required: ['actual', 'nueva'],
          properties: {
            actual: { type: 'string' },
            nueva: { type: 'string', minLength: 8 },
          },
        }),
      }),
    },

    '/api/v1/catalogos/tipologias': {
      get: {
        tags: ['Catalogos'],
        summary: 'Listar tipologias activas',
        security: [],
        parameters: [
          { name: 'soloActivas', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: ok(), ...errores },
      },
    },
    '/api/v1/catalogos/tipos-muestra': {
      get: op('Catalogos', 'Listar tipos de muestra'),
    },
    '/api/v1/catalogos/parametros': {
      get: op('Catalogos', 'Listar parametros'),
    },
    '/api/v1/catalogos/etapas': {
      get: op('Catalogos', 'Listar etapas del proceso'),
    },
    '/api/v1/catalogos/analisis': {
      get: op('Catalogos', 'Listar analisis del catalogo'),
    },

    '/api/v1/clientes': {
      get: op('Clientes', 'Listar clientes (coordinador)'),
      post: op('Clientes', 'Crear cliente (coordinador)', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/clientes/{id}': {
      get: op('Clientes', 'Obtener cliente', {
        parameters: [idParam('id')],
      }),
      put: op('Clientes', 'Actualizar cliente', {
        parameters: [idParam('id')],
        requestBody: jsonBody({ type: 'object' }),
      }),
    },

    '/api/v1/solicitudes': {
      get: op('Solicitudes', 'Listar solicitudes (coordinador)'),
      post: op('Solicitudes', 'Crear solicitud', {
        requestBody: jsonBody({
          type: 'object',
          required: ['analisis'],
          properties: {
            analisis: { type: 'array', items: { type: 'string' } },
            descripcion_inicial: { type: 'string', nullable: true },
          },
        }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/solicitudes/mias': {
      get: op('Solicitudes', 'Solicitudes del cliente autenticado'),
    },
    '/api/v1/solicitudes/{id}': {
      get: op('Solicitudes', 'Detalle de solicitud', {
        parameters: [idParam('id')],
      }),
      put: op('Solicitudes', 'Editar solicitud registrada', {
        parameters: [idParam('id')],
        requestBody: jsonBody({ type: 'object' }),
      }),
    },
    '/api/v1/solicitudes/{id}/historial': {
      get: op('Solicitudes', 'Historial de estados', {
        parameters: [idParam('id')],
      }),
    },
    '/api/v1/solicitudes/{id}/estado': {
      patch: op('Solicitudes', 'Cambiar estado', {
        parameters: [idParam('id')],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            estado: { type: 'string' },
            observacion: { type: 'string', nullable: true },
          },
        }),
      }),
    },

    '/api/v1/cotizaciones': {
      get: op('Cotizaciones', 'Listar cotizaciones (coordinador)'),
      post: op('Cotizaciones', 'Crear cotizacion', {
        requestBody: jsonBody({
          type: 'object',
          required: ['solicitud', 'items'],
          properties: {
            solicitud: { type: 'string' },
            items: { type: 'array', items: { type: 'object' } },
            observaciones_propuesta: { type: 'string', nullable: true },
            fecha_validez: { type: 'string', format: 'date-time', nullable: true },
          },
        }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/cotizaciones/mias': {
      get: op('Cotizaciones', 'Cotizaciones del cliente'),
    },
    '/api/v1/cotizaciones/{id}': {
      get: op('Cotizaciones', 'Detalle de cotizacion', {
        parameters: [idParam('id')],
      }),
    },
    '/api/v1/cotizaciones/{id}/decision': {
      patch: op('Cotizaciones', 'Aceptar o rechazar cotizacion', {
        parameters: [idParam('id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/DecisionRequest' }),
      }),
    },
    '/api/v1/cotizaciones/{id}/nueva-version': {
      post: op('Cotizaciones', 'Crear nueva version de cotizacion', {
        parameters: [idParam('id')],
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/cotizaciones/{id}/excel': {
      get: op('Cotizaciones', 'Descargar oferta de servicios en Excel', {
        parameters: [idParam('id')],
        responses: excelResponse('Archivo Excel'),
      }),
    },
    '/api/v1/cotizaciones/{id}/firma': {
      get: op('Cotizaciones', 'Descargar firma del cliente (coordinador)', {
        parameters: [idParam('id')],
        responses: {
          200: {
            description: 'PNG de la firma',
            content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
          },
          ...errores,
        },
      }),
    },

    '/api/v1/cupones': {
      get: op('Cupones', 'Listar cupones (coordinador)'),
      post: op('Cupones', 'Crear cupon', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/cupones/mios': {
      get: op('Cupones', 'Cupones del cliente'),
    },
    '/api/v1/cupones/{id}/generar': {
      patch: op('Cupones', 'Generar cupon', {
        parameters: [idParam('id')],
        requestBody: jsonBody({ type: 'object' }),
      }),
    },

    '/api/v1/pagos': {
      get: op('Pagos', 'Listar pagos (coordinador)'),
      post: op('Pagos', 'Reportar pago sin archivo', {
        requestBody: jsonBody({ $ref: '#/components/schemas/PagoRequest' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/pagos/mios': {
      get: op('Pagos', 'Pagos del cliente'),
    },
    '/api/v1/pagos/{id}/reenviar': {
      put: op('Pagos', 'Actualizar referencia de pago rechazado', {
        parameters: [idParam('id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/PagoRequest' }),
      }),
    },
    '/api/v1/pagos/{id}/validar': {
      patch: op('Pagos', 'Validar pago (coordinador)', {
        parameters: [idParam('id')],
        requestBody: jsonBody({
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['APROBADO', 'RECHAZADO'] },
            observaciones: { type: 'string', nullable: true },
          },
        }),
      }),
    },

    '/api/v1/muestras': {
      get: op('Muestras', 'Listar muestras'),
      post: op('Muestras', 'Registrar muestra', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/muestras/mias': {
      get: op('Muestras', 'Muestras del cliente'),
    },
    '/api/v1/muestras/{id}/acta-recepcion': {
      get: op('Muestras', 'Descargar acta de recepcion en Excel', {
        parameters: [idParam('id')],
        responses: excelResponse('Acta de recepcion'),
      }),
    },
    '/api/v1/muestras/{id}/rotulo': {
      get: op('Muestras', 'Descargar rotulo PDF con QR', {
        parameters: [idParam('id')],
        responses: pdfResponse('Rotulo PDF'),
      }),
      post: op('Muestras', 'Generar rotulo PDF', {
        parameters: [idParam('id')],
        requestBody: jsonBody({
          type: 'object',
          properties: { analisis: { type: 'array', items: { type: 'string' } } },
        }),
        responses: { ...created(), ...errores },
      }),
    },

    '/api/v1/ordenes': {
      get: op('Ordenes', 'Listar ordenes'),
      post: op('Ordenes', 'Crear orden', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/ordenes/mias': {
      get: op('Ordenes', 'Ordenes del cliente'),
    },
    '/api/v1/ordenes/{id}/estado': {
      patch: op('Ordenes', 'Avanzar estado de orden', {
        parameters: [idParam('id')],
        requestBody: jsonBody({ type: 'object' }),
      }),
    },
    '/api/v1/ordenes/{id}/resultados': {
      put: op('Ordenes', 'Registrar resultados', {
        parameters: [idParam('id')],
        requestBody: jsonBody({ type: 'object' }),
      }),
    },

    '/api/v1/informes': {
      get: op('Informes', 'Listar informes'),
      post: op('Informes', 'Generar informe PDF', {
        requestBody: jsonBody({
          type: 'object',
          required: ['muestra'],
          properties: { muestra: { type: 'string' } },
        }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/informes/mios': {
      get: op('Informes', 'Informes del cliente'),
    },
    '/api/v1/informes/{id}/pdf': {
      get: op('Informes', 'Descargar informe PDF', {
        parameters: [idParam('id')],
        responses: pdfResponse('Informe PDF'),
      }),
    },
    '/api/v1/informes/{id}/envio': {
      patch: op('Informes', 'Registrar envio del informe', {
        parameters: [idParam('id')],
      }),
    },
    '/api/v1/informes/{id}/descarga': {
      patch: op('Informes', 'Registrar descarga del informe', {
        parameters: [idParam('id')],
      }),
    },

    '/api/v1/encuestas': {
      get: op('Encuestas', 'Listar encuestas'),
      post: op('Encuestas', 'Responder encuesta', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/encuestas/mias': {
      get: op('Encuestas', 'Encuestas del cliente'),
    },
    '/api/v1/encuestas/resumen/global': {
      get: op('Encuestas', 'Resumen global de satisfaccion'),
    },

    '/api/v1/reclamaciones': {
      get: op('Reclamaciones', 'Listar reclamaciones (coordinador)'),
      post: op('Reclamaciones', 'Crear reclamacion', {
        requestBody: jsonBody({
          type: 'object',
          required: ['solicitud', 'motivo'],
          properties: {
            solicitud: { type: 'string' },
            motivo: { type: 'string' },
          },
        }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/reclamaciones/mias': {
      get: op('Reclamaciones', 'Reclamaciones del cliente'),
    },
    '/api/v1/reclamaciones/{id}/evidencias': {
      post: op('Reclamaciones', 'Subir evidencias de reclamacion', {
        parameters: [idParam('id')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { $ref: '#/components/schemas/EvidenciaUpload' },
            },
          },
        },
        responses: { 200: ok('Evidencias agregadas'), ...errores },
      }),
    },
    '/api/v1/reclamaciones/{id}/evidencias/{evidenciaId}': {
      get: op('Reclamaciones', 'Descargar evidencia', {
        parameters: [idParam('id'), idParam('evidenciaId')],
        responses: {
          200: {
            description: 'Imagen de la evidencia',
            content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
          },
          ...errores,
        },
      }),
    },

    '/api/v1/reportes/solicitudes': {
      get: op('Reportes', 'Resumen de solicitudes por estado'),
    },
    '/api/v1/reportes/muestras': {
      get: op('Reportes', 'Resumen de muestras'),
    },
    '/api/v1/reportes/operacion': {
      get: op('Reportes', 'Resumen operativo'),
    },
    '/api/v1/reportes/satisfaccion': {
      get: op('Reportes', 'Resumen de satisfaccion'),
    },

    '/api/v1/trazabilidad/seguimiento': {
      post: op('Trazabilidad', 'Registrar avance de muestra', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/trazabilidad/muestra/{muestraId}': {
      get: op('Trazabilidad', 'Linea de tiempo de la muestra', {
        parameters: [idParam('muestraId')],
      }),
    },
    '/api/v1/trazabilidad/validaciones': {
      post: op('Trazabilidad', 'Validar resultados', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },

    '/api/v1/auditoria': {
      get: op('Auditoria', 'Listar bitacora (coordinador)'),
      post: op('Auditoria', 'Registrar accion manual', {
        requestBody: jsonBody({ type: 'object' }),
        responses: { ...created(), ...errores },
      }),
    },
    '/api/v1/auditoria/recuperacion/solicitar': {
      post: {
        tags: ['Auditoria'],
        summary: 'Solicitar recuperacion de contrasena',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['correo'],
          properties: { correo: { type: 'string', format: 'email' } },
        }),
        responses: { 202: ok('Respuesta generica'), ...errores },
      },
    },
    '/api/v1/auditoria/recuperacion/consumir': {
      post: {
        tags: ['Auditoria'],
        summary: 'Consumir token de recuperacion',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['token', 'nueva'],
          properties: {
            token: { type: 'string' },
            nueva: { type: 'string', minLength: 8 },
          },
        }),
        responses: { 200: ok('Contrasena restablecida'), ...errores },
      },
    },
  },
};

export default openapi;
