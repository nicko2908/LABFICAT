/**
 * Migracion 003 - Plan de plantillas (datos existentes).
 *
 * Normaliza los documentos creados antes de la Fase de plantillas:
 *  - Cotizaciones: version=1, codigo NNNN-AAAA, items[] a partir del detalle,
 *    cliente_snapshot y subtotal.
 *  - Muestras: cotizacion + cotizacion_item=1, campos nuevos en null/[].
 *  - Clientes: mapeo de las 12 tipologias del RF-01 a las 16 comerciales y
 *    recalculo de tipo_cliente desde tipologia.es_interno.
 *  - Contadores: se inicializan con el maximo existente por ano para no
 *    reiniciar los codigos.
 *  - Indices: syncIndexes() elimina los indices viejos (solicitud_1 unique,
 *    nombre_1 unique) y crea los nuevos.
 *
 * Es idempotente. Uso:
 *   node scripts/migraciones/003-plan-plantillas.js
 *   node scripts/migraciones/003-plan-plantillas.js --dry-run
 */
import 'dotenv/config';

import { connectDB, disconnectDB } from '../../src/config/database.js';
import { TIPO_CLIENTE } from '../../src/config/constants.js';
import { fijarConsecutivo } from '../../src/services/contador.service.js';
import Cotizacion from '../../src/models/servicios/Cotizacion.js';
import Solicitud from '../../src/models/servicios/Solicitud.js';
import Cliente from '../../src/models/clientes/Cliente.js';
import Usuario from '../../src/models/seguridad/Usuario.js';
import TipologiaPoblacional from '../../src/models/clientes/TipologiaPoblacional.js';
import Muestra from '../../src/models/laboratorio/Muestra.js';
import Analisis from '../../src/models/laboratorio/Analisis.js';
import Reclamacion from '../../src/models/calidad/Reclamacion.js';

const dryRun = process.argv.includes('--dry-run');

const MAPA_LEGADO = {
  'Indígena': 'Persona natural',
  'Afrocolombiano, negro, raizal o palenquero': 'Persona natural',
  'Rrom o gitano': 'Persona natural',
  'Campesino': 'Campesinos',
  'Víctima del conflicto armado': 'Victimas del Conflicto',
  'Persona con discapacidad': 'Persona natural',
  'Mujer cabeza de hogar': 'Persona natural',
  'Población LGBTIQ+': 'Persona natural',
  'Persona reincorporada o reintegrada': 'Persona natural',
  'Empresario o emprendedor': 'Emprendedor',
  'Aprendiz, estudiante o egresado': 'Aprendices SENA',
  'Ninguna de las anteriores': 'Persona natural',
};

function pad4(valor) {
  return String(valor).padStart(4, '0');
}

function parseSolicitud(codigo) {
  const m = /^SOL-(\d{4})-(\d{4})$/.exec(codigo || '');
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}

function parseMuestra(codigo) {
  let m = /^(\d{4})-(\d{4})$/.exec(codigo || '');
  if (m) return { seq: Number(m[1]), year: Number(m[2]) };

  m = /^LAB-(\d{4})-(\d{4})$/.exec(codigo || '');
  if (m) return { year: Number(m[1]), seq: Number(m[2]) };

  return null;
}

function parseReclamacion(codigo) {
  const m = /^REC-(\d{4})-(\d{4})$/.exec(codigo || '');
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}

function parseCotizacion(codigo) {
  const m = /^(\d{4})-(\d{4})$/.exec(codigo || '');
  return m ? { seq: Number(m[1]), year: Number(m[2]) } : null;
}

function subirMax(mapa, year, seq) {
  if (!Number.isInteger(year) || !Number.isInteger(seq)) return;
  mapa.set(year, Math.max(mapa.get(year) || 0, seq));
}

async function snapshotDeSolicitud(solicitudId) {
  const solicitud = await Solicitud.findById(solicitudId).lean();
  if (!solicitud) return {};

  const cliente = await Cliente.findById(solicitud.cliente).lean();
  if (!cliente) return {};

  const [usuario, tipologia] = await Promise.all([
    Usuario.findById(cliente.usuario).select('nombres apellidos correo').lean(),
    cliente.tipologia
      ? TipologiaPoblacional.findById(cliente.tipologia).lean()
      : null,
  ]);

  const tipoCliente = tipologia
    ? tipologia.es_interno
      ? TIPO_CLIENTE.INTERNO
      : TIPO_CLIENTE.EXTERNO
    : cliente.tipo_cliente || TIPO_CLIENTE.EXTERNO;

  return {
    nombre:
      cliente.razon_social ||
      [usuario?.nombres, usuario?.apellidos].filter(Boolean).join(' ').trim() ||
      null,
    nit: cliente.nit || null,
    direccion: cliente.direccion || null,
    ciudad: cliente.ciudad || null,
    departamento: cliente.departamento || null,
    telefono: cliente.telefono || null,
    correo: usuario?.correo || null,
    tipologia: tipologia?.nombre || null,
    persona_contacto: cliente.persona_contacto || null,
    cargo: cliente.cargo || null,
    tipo_cliente: tipoCliente,
  };
}

async function migrarCotizaciones() {
  const cotizaciones = await Cotizacion.find({}).sort({ fecha_emision: 1 }).lean();
  const maxPorAnio = new Map();

  for (const doc of cotizaciones) {
    const parsed = parseCotizacion(doc.codigo_cotizacion);
    if (parsed) subirMax(maxPorAnio, parsed.year, parsed.seq);
  }

  const porSolicitud = new Map();
  for (const doc of cotizaciones) {
    const clave = String(doc.solicitud);
    if (!porSolicitud.has(clave)) porSolicitud.set(clave, []);
    porSolicitud.get(clave).push(doc);
  }

  let actualizadas = 0;

  for (const grupo of porSolicitud.values()) {
    grupo.sort((a, b) => new Date(a.fecha_emision) - new Date(b.fecha_emision));
    let siguienteVersion = 1;

    for (const doc of grupo) {
      const version = Math.max(Number(doc.version) || 1, siguienteVersion);
      siguienteVersion = version + 1;

      const year = new Date(doc.fecha_emision || doc.createdAt || Date.now()).getFullYear();
      let codigo = doc.codigo_cotizacion;
      if (!codigo) {
        const seq = (maxPorAnio.get(year) || 0) + 1;
        maxPorAnio.set(year, seq);
        codigo = `${pad4(seq)}-${year}`;
      } else {
        const parsed = parseCotizacion(codigo);
        if (parsed) subirMax(maxPorAnio, parsed.year, parsed.seq);
      }

      const items = Array.isArray(doc.items) && doc.items.length > 0
        ? doc.items.map((item) => ({
            numero: item.numero,
            descripcion_muestra: item.descripcion_muestra || null,
            detalle: (item.detalle || []).map((linea) => ({
              analisis: linea.analisis,
              cantidad: linea.cantidad ?? 1,
              tarifa_aplicada: linea.tarifa_aplicada || 0,
            })),
          }))
        : [{
            numero: 1,
            descripcion_muestra: null,
            detalle: (doc.detalle || []).map((linea) => ({
              analisis: linea.analisis,
              cantidad: linea.cantidad ?? 1,
              tarifa_aplicada: linea.tarifa_aplicada || 0,
            })),
          }];

      const detalle = Array.isArray(doc.detalle) && doc.detalle.length > 0
        ? doc.detalle.map((linea) => ({
            analisis: linea.analisis,
            cantidad: linea.cantidad ?? 1,
            tarifa_aplicada: linea.tarifa_aplicada || 0,
          }))
        : items.flatMap((item) => item.detalle);

      const subtotal = detalle.reduce(
        (acc, linea) => acc + Number(linea.tarifa_aplicada || 0) * Number(linea.cantidad || 1),
        0
      );

      const snapshotActual = doc.cliente_snapshot;
      const snapshotLegado = !snapshotActual?.nombre || MAPA_LEGADO[snapshotActual.tipologia];
      const clienteSnapshot = snapshotLegado
        ? await snapshotDeSolicitud(doc.solicitud)
        : snapshotActual;

      const cambios = {
        codigo_cotizacion: codigo,
        version,
        items,
        detalle,
        subtotal: doc.subtotal ?? subtotal,
        valor_total: doc.valor_total ?? subtotal,
        cliente_snapshot: clienteSnapshot,
      };

      if (!dryRun) {
        await Cotizacion.updateOne({ _id: doc._id }, { $set: cambios });
      }
      actualizadas += 1;
    }
  }

  console.log(`[003] Cotizaciones normalizadas: ${actualizadas}`);

  if (!dryRun) {
    for (const [year, max] of maxPorAnio) {
      await fijarConsecutivo(`cotizacion-${year}`, max);
    }
  }
}

async function migrarMuestras() {
  const muestras = await Muestra.find({}).lean();
  let actualizadas = 0;

  for (const doc of muestras) {
    let cotizacionId = doc.cotizacion || null;
    if (!cotizacionId) {
      const cotizacion = await Cotizacion.findOne({ solicitud: doc.solicitud })
        .sort({ version: -1 })
        .select('_id')
        .lean();
      if (cotizacion) cotizacionId = cotizacion._id;
    }

    const cambios = {
      cotizacion: cotizacionId,
      cotizacion_item: doc.cotizacion_item || 1,
      matriz: doc.matriz ?? null,
      municipio_recoleccion: doc.municipio_recoleccion ?? null,
      direccion_toma: doc.direccion_toma ?? null,
      lugar_toma: doc.lugar_toma ?? null,
      recolectada_por: doc.recolectada_por ?? null,
      procedimiento_muestreo: doc.procedimiento_muestreo || 'No Reporta',
      fecha_hora_recoleccion: doc.fecha_hora_recoleccion ?? null,
      observaciones_predefinidas: doc.observaciones_predefinidas || [],
      cantidad_recibida: doc.cantidad_recibida ?? null,
      unidad_medida: doc.unidad_medida || null,
    };

    if (!dryRun) {
      await Muestra.updateOne({ _id: doc._id }, { $set: cambios });
    }
    actualizadas += 1;
  }

  console.log(`[003] Muestras normalizadas: ${actualizadas}`);
}

async function migrarClientes() {
  const [clientes, tipologias] = await Promise.all([
    Cliente.find({}).lean(),
    TipologiaPoblacional.find({}).lean(),
  ]);

  const porNombre = new Map(tipologias.map((t) => [t.nombre, t]));
  const porId = new Map(tipologias.map((t) => [String(t._id), t]));
  let actualizados = 0;

  for (const cliente of clientes) {
    const actual = porId.get(String(cliente.tipologia));
    const nombreNuevo = MAPA_LEGADO[actual?.nombre] || actual?.nombre || 'Persona natural';
    const nueva = porNombre.get(nombreNuevo) || porNombre.get('Persona natural');

    if (!nueva) {
      console.warn(`[003] No se encontro la tipologia "${nombreNuevo}" para el cliente ${cliente._id}`);
      continue;
    }

    const tipoCliente = nueva.es_interno
      ? TIPO_CLIENTE.INTERNO
      : TIPO_CLIENTE.EXTERNO;

    const cambios = {
      tipologia: nueva._id,
      tipo_cliente: tipoCliente,
      direccion: cliente.direccion ?? null,
      ciudad: cliente.ciudad ?? null,
      departamento: cliente.departamento ?? null,
      cargo: cliente.cargo ?? null,
      persona_contacto: cliente.persona_contacto ?? null,
    };

    if (!dryRun) {
      await Cliente.updateOne({ _id: cliente._id }, { $set: cambios });
    }
    actualizados += 1;
  }

  console.log(`[003] Clientes normalizados: ${actualizados}`);
}

async function inicializarContadores() {
  const [solicitudes, muestras, reclamaciones] = await Promise.all([
    Solicitud.find({}, 'codigo_solicitud').lean(),
    Muestra.find({}, 'codigo_muestra').lean(),
    Reclamacion.find({}, 'codigo_soporte').lean(),
  ]);

  const maxSolicitud = new Map();
  for (const doc of solicitudes) {
    const parsed = parseSolicitud(doc.codigo_solicitud);
    if (parsed) subirMax(maxSolicitud, parsed.year, parsed.seq);
  }

  const maxMuestra = new Map();
  for (const doc of muestras) {
    const parsed = parseMuestra(doc.codigo_muestra);
    if (parsed) subirMax(maxMuestra, parsed.year, parsed.seq);
  }

  const maxReclamacion = new Map();
  for (const doc of reclamaciones) {
    const parsed = parseReclamacion(doc.codigo_soporte);
    if (parsed) subirMax(maxReclamacion, parsed.year, parsed.seq);
  }

  if (!dryRun) {
    for (const [year, max] of maxSolicitud) {
      await fijarConsecutivo(`solicitud-${year}`, max);
    }
    for (const [year, max] of maxMuestra) {
      await fijarConsecutivo(`muestra-${year}`, max);
    }
    for (const [year, max] of maxReclamacion) {
      await fijarConsecutivo(`reclamacion-${year}`, max);
    }
  }

  console.log(
    `[003] Contadores: solicitud=${maxSolicitud.size} muestra=${maxMuestra.size} reclamacion=${maxReclamacion.size}`
  );
}

async function sincronizarIndices() {
  if (dryRun) {
    console.log('[003] Indices: se ejecutaria syncIndexes() de Cotizacion, Muestra y Analisis.');
    return;
  }

  await Promise.all([
    Cotizacion.syncIndexes(),
    Muestra.syncIndexes(),
    Analisis.syncIndexes(),
    TipologiaPoblacional.syncIndexes(),
  ]);

  console.log('[003] Indices sincronizados (se eliminaron los indices legados).');
}

async function main() {
  try {
    await connectDB();
    if (dryRun) console.log('[003] Modo dry-run: no se escribira nada.');

    // Los clientes se migran primero para que el snapshot de la cotizacion
    // use la tipologia nueva y el tipo_cliente correcto.
    await migrarClientes();
    await migrarCotizaciones();
    await migrarMuestras();
    await inicializarContadores();
    await sincronizarIndices();

    console.log('[003] Completado.');
  } catch (error) {
    console.error('[003] Error:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
