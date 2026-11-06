/**
 * Semilla QA: usuarios de los tres roles y un flujo demo basico.
 *
 * Uso:
 *   npm run seed:qa
 *
 * Es idempotente: actualiza usuarios/clientes existentes y no duplica la
 * solicitud demo. Requiere haber ejecutado `npm run seed` al menos una vez.
 */
import 'dotenv/config';

import { connectDB, disconnectDB } from '../config/database.js';
import { ROLES, TIPOLOGIA_CODIGO } from '../config/constants.js';
import Rol from '../models/seguridad/Rol.js';
import Usuario from '../models/seguridad/Usuario.js';
import Cliente from '../models/clientes/Cliente.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import Analisis from '../models/laboratorio/Analisis.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import { crearSolicitud } from '../services/solicitud.service.js';
import { crearCotizacion } from '../services/cotizacion.service.js';

const CREDENCIALES = {
  cliente: {
    correo: 'cliente.qa@labficat.test',
    contrasena: 'ClienteQA123*',
  },
  clienteExterno: {
    correo: 'cliente.externo.qa@labficat.test',
    contrasena: 'ClienteExternoQA123*',
  },
  analista: {
    correo: 'analista.qa@labficat.test',
    contrasena: 'AnalistaQA123*',
  },
};

async function obtenerRol(nombre) {
  const rol = await Rol.findOne({ nombre });
  if (!rol) {
    throw new Error(`Falta el rol ${nombre}. Ejecute npm run seed`);
  }
  return rol;
}

async function upsertUsuario({
  rol,
  correo,
  contrasena,
  nombres,
  apellidos,
  numeroDocumento,
}) {
  let usuario = await Usuario.findOne({ correo }).select('+contrasena_hash');

  if (!usuario) {
    usuario = new Usuario({
      rol: rol._id,
      nombres,
      apellidos,
      tipo_documento: 'CC',
      numero_documento: numeroDocumento,
      correo,
    });
  } else {
    usuario.rol = rol._id;
    usuario.nombres = nombres;
    usuario.apellidos = apellidos;
    usuario.tipo_documento = 'CC';
    usuario.numero_documento = numeroDocumento;
    usuario.activo = true;
  }

  await usuario.establecerContrasena(contrasena);
  await usuario.save();
  return usuario;
}

async function upsertCliente({ usuario, tipologia, razonSocial = null }) {
  const tipoCliente = tipologia.es_interno ? 'INTERNO' : 'EXTERNO';
  let cliente = await Cliente.findOne({ usuario: usuario._id });

  if (!cliente) {
    cliente = await Cliente.create({
      usuario: usuario._id,
      tipologia: tipologia._id,
      tipo_cliente: tipoCliente,
      razon_social: razonSocial,
      acepta_tratamiento_datos: true,
      fecha_aceptacion_datos: new Date(),
    });
  } else {
    cliente.tipologia = tipologia._id;
    cliente.tipo_cliente = tipoCliente;
    cliente.razon_social = razonSocial;
    cliente.acepta_tratamiento_datos = true;
    await cliente.save();
  }

  return cliente;
}

async function sembrarDemo({ cliente, usuario, analisis }) {
  const marcador = 'DEMO-QA';
  let solicitud = await Solicitud.findOne({
    cliente: cliente._id,
    descripcion_inicial: marcador,
  });

  if (!solicitud) {
    solicitud = await crearSolicitud({
      clienteId: cliente._id,
      analisis: analisis.map((item) => item._id),
      descripcionInicial: marcador,
      usuarioId: usuario._id,
    });
    console.log(`[seed:qa] Solicitud demo creada: ${solicitud.codigo_solicitud}`);
  } else {
    console.log(`[seed:qa] Solicitud demo existente: ${solicitud.codigo_solicitud}`);
  }

  const cotizacion = await Cotizacion.findOne({ solicitud: solicitud._id });
  if (cotizacion) {
    console.log(
      `[seed:qa] Cotizacion demo existente: ${cotizacion.codigo_cotizacion}V${cotizacion.version}`
    );
    return;
  }

  const creada = await crearCotizacion({
    solicitudId: solicitud._id,
    items: analisis.map((item, indice) => ({
      numero: indice + 1,
      descripcion_muestra: `Muestra demo ${indice + 1}`,
      detalle: [{ analisis: item._id }],
    })),
    usuarioId: usuario._id,
  });

  console.log(
    `[seed:qa] Cotizacion demo creada: ${creada.codigo_cotizacion}V${creada.version}`
  );
}

async function main() {
  try {
    await connectDB();

    const rolCliente = await obtenerRol(ROLES.CLIENTE);
    const rolAnalista = await obtenerRol(ROLES.ANALISTA);

    const tipologiaInterna = await TipologiaPoblacional.findOne({
      codigo: TIPOLOGIA_CODIGO.APRENDICES_SENA || 'APRENDICES_SENA',
      activo: true,
    });
    const tipologiaExterna = await TipologiaPoblacional.findOne({
      codigo: 'EMPRESAS',
      activo: true,
    }) || await TipologiaPoblacional.findOne({ activo: true, es_interno: false });

    if (!tipologiaInterna || !tipologiaExterna) {
      throw new Error('Faltan tipologias. Ejecute npm run seed');
    }

    const analisis = await Analisis.find({ activo: true }).sort({ codigo: 1 }).limit(2);
    if (analisis.length < 2) {
      throw new Error('Se necesitan al menos 2 analisis activos. Ejecute npm run seed');
    }

    const usuarioCliente = await upsertUsuario({
      rol: rolCliente,
      correo: CREDENCIALES.cliente.correo,
      contrasena: CREDENCIALES.cliente.contrasena,
      nombres: 'Cliente',
      apellidos: 'QA',
      numeroDocumento: '900000001',
    });

    const usuarioExterno = await upsertUsuario({
      rol: rolCliente,
      correo: CREDENCIALES.clienteExterno.correo,
      contrasena: CREDENCIALES.clienteExterno.contrasena,
      nombres: 'Cliente',
      apellidos: 'Externo',
      numeroDocumento: '900000002',
    });

    const usuarioAnalista = await upsertUsuario({
      rol: rolAnalista,
      correo: CREDENCIALES.analista.correo,
      contrasena: CREDENCIALES.analista.contrasena,
      nombres: 'Analista',
      apellidos: 'QA',
      numeroDocumento: '900000003',
    });

    const clienteInterno = await upsertCliente({
      usuario: usuarioCliente,
      tipologia: tipologiaInterna,
    });

    await upsertCliente({
      usuario: usuarioExterno,
      tipologia: tipologiaExterna,
      razonSocial: 'Empresa QA',
    });

    await sembrarDemo({
      cliente: clienteInterno,
      usuario: usuarioCliente,
      analisis,
    });

    console.log('\n[seed:qa] Credenciales de prueba:');
    console.log(`  Coordinador: ${process.env.SEED_QA_COORDINADOR || 'coordinador@sena.edu.co'} / Labficat123*`);
    console.log(`  Cliente interno: ${CREDENCIALES.cliente.correo} / ${CREDENCIALES.cliente.contrasena}`);
    console.log(`  Cliente externo: ${CREDENCIALES.clienteExterno.correo} / ${CREDENCIALES.clienteExterno.contrasena}`);
    console.log(`  Analista: ${CREDENCIALES.analista.correo} / ${CREDENCIALES.analista.contrasena}`);
    console.log('[seed:qa] Completado.');
  } catch (error) {
    console.error('[seed:qa] Error:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
