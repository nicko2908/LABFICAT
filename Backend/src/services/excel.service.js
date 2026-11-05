/**
 * Service: generacion de Excel (Oferta de servicios y Acta de recepcion).
 *
 * Usa las plantillas sanitizadas de src/templates/excel y solo escribe celdas
 * de entrada. Las plantillas no se editan a mano.
 */
import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ApiError from '../utils/ApiError.js';
import {
  CONFIGURACION_CLAVES,
  ESTADO_COTIZACION,
  OBSERVACIONES_RECEPCION,
} from '../config/constants.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Solicitud from '../models/servicios/Solicitud.js';
import Cliente from '../models/clientes/Cliente.js';
import Usuario from '../models/seguridad/Usuario.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import ConfiguracionSistema from '../models/sistema/ConfiguracionSistema.js';
import { descargarFirma } from './storage.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PLANTILLAS = path.resolve(__dirname, '..', 'templates', 'excel');

function formatearNit(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!/^\d+$/.test(texto)) return texto;
  return texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function pad2(valor) {
  return String(valor).padStart(2, '0');
}

function formatearFechaHora(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;

  const dia = pad2(fecha.getDate());
  const mes = pad2(fecha.getMonth() + 1);
  const anio = fecha.getFullYear();
  let hora = fecha.getHours();
  const ampm = hora >= 12 ? 'PM' : 'AM';
  hora = hora % 12 || 12;
  const minutos = pad2(fecha.getMinutes());

  return `${dia}/${mes}/${anio} ; ${hora}:${minutos} ${ampm}`;
}

function nombreCompleto(usuario) {
  if (!usuario) return null;
  return [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim() || null;
}

async function cargarPlantilla(nombre) {
  const ruta = path.join(DIR_PLANTILLAS, nombre);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  return wb;
}

async function responsableLaboratorio() {
  const config = await ConfiguracionSistema.findOne({
    clave: CONFIGURACION_CLAVES.RESPONSABLE_LABORATORIO,
  }).lean();
  return config?.valor || 'Responsable LABFICAT';
}

/**
 * Completa un snapshot a partir del cliente cuando la cotizacion es legada.
 */
async function snapshotDeCotizacion(cotizacion) {
  if (cotizacion.cliente_snapshot && cotizacion.cliente_snapshot.nombre) {
    return cotizacion.cliente_snapshot;
  }

  const solicitud = await Solicitud.findById(cotizacion.solicitud).lean();
  if (!solicitud) return {};

  const cliente = await Cliente.findById(solicitud.cliente).lean();
  if (!cliente) return {};

  const [usuario, tipologia] = await Promise.all([
    Usuario.findById(cliente.usuario).select('nombres apellidos correo').lean(),
    cliente.tipologia
      ? TipologiaPoblacional.findById(cliente.tipologia).select('nombre').lean()
      : null,
  ]);

  return {
    nombre:
      cliente.razon_social ||
      nombreCompleto(usuario) ||
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
    tipo_cliente: cliente.tipo_cliente || null,
  };
}

function escribirFilaEnsayo(ws, fila, linea) {
  const analisis = linea.analisis || {};
  const cantidad = Number(linea.cantidad || 1);
  const tarifa = Number(linea.tarifa_aplicada || 0);

  ws.getCell(`A${fila}`).value = analisis.codigo ?? null;
  ws.getCell(`B${fila}`).value = analisis.nombre
    ? `${analisis.nombre}${analisis.acreditado ? '°' : ''}`
    : null;
  ws.getCell(`C${fila}`).value = analisis.unidades ?? null;
  ws.getCell(`E${fila}`).value = analisis.metodo ?? null;
  ws.getCell(`F${fila}`).value = analisis.tecnica ?? null;
  ws.getCell(`G${fila}`).value = cantidad;
  ws.getCell(`H${fila}`).value = tarifa;
  ws.getCell(`I${fila}`).value = cantidad * tarifa;
}

function limpiarFilaEnsayo(ws, fila) {
  for (const col of ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I']) {
    ws.getCell(`${col}${fila}`).value = null;
  }
}

/**
 * Genera el buffer de la Oferta de servicios de una cotizacion.
 *
 * @param {string} cotizacionId
 * @returns {Promise<{buffer: Buffer, nombre: string}>}
 */
async function generarCotizacionXlsx(cotizacionId) {
  const cotizacion = await Cotizacion.findById(cotizacionId)
    .populate('items.detalle.analisis', 'codigo nombre unidades metodo tecnica acreditado')
    .populate('detalle.analisis', 'codigo nombre unidades metodo tecnica acreditado');

  if (!cotizacion) throw ApiError.notFound('Cotizacion no encontrada');

  const snapshot = await snapshotDeCotizacion(cotizacion);
  const responsable = await responsableLaboratorio();
  const codigoCompleto = cotizacion.codigo_cotizacion
    ? `${cotizacion.codigo_cotizacion}V${cotizacion.version}`
    : `SIN-CODIGOV${cotizacion.version}`;
  const fechaEmision = cotizacion.fecha_emision || new Date();

  const wb = await cargarPlantilla('cotizacion.xlsx');
  const ws = wb.worksheets[0];

  // Fila "Pegue" (K2:U2) y campos visibles.
  ws.getCell('K2').value = fechaEmision;
  ws.getCell('L2').value = codigoCompleto;
  ws.getCell('M2').value = snapshot.nombre || null;
  ws.getCell('N2').value = formatearNit(snapshot.nit);
  ws.getCell('O2').value = snapshot.direccion || null;
  ws.getCell('P2').value = snapshot.ciudad || null;
  ws.getCell('Q2').value = snapshot.departamento || null;
  ws.getCell('R2').value = snapshot.tipologia || null;
  ws.getCell('S2').value = snapshot.persona_contacto || snapshot.nombre || null;
  ws.getCell('T2').value = snapshot.telefono ? String(snapshot.telefono) : null;
  ws.getCell('U2').value = snapshot.correo ? String(snapshot.correo).trim() : null;

  ws.getCell('F2').value = codigoCompleto;
  ws.getCell('F6').value = fechaEmision;

  ws.getCell('B9').value = snapshot.nombre || null;
  ws.getCell('B10').value = formatearNit(snapshot.nit);
  ws.getCell('B11').value = snapshot.direccion || null;
  ws.getCell('B12').value = snapshot.ciudad || null;
  ws.getCell('B13').value = snapshot.cargo || null;
  ws.getCell('B14').value = cotizacion.fecha_validez || null;
  ws.getCell('F9').value = snapshot.departamento || null;
  ws.getCell('F10').value = snapshot.persona_contacto || null;
  ws.getCell('F11').value = snapshot.tipologia || null;
  ws.getCell('F12').value = snapshot.correo || null;
  ws.getCell('F13').value = snapshot.telefono ? String(snapshot.telefono) : null;

  // Un solo bloque de item en la plantilla. Si la cotizacion tiene varios,
  // se imprime el primero y se advierte en la respuesta del endpoint.
  const items = Array.isArray(cotizacion.items) && cotizacion.items.length > 0
    ? cotizacion.items
    : [{ numero: 1, descripcion_muestra: null, detalle: cotizacion.detalle || [] }];
  const item = items[0];
  ws.getCell('A16').value = item.descripcion_muestra
    ? `Ítem ${item.numero} - ${item.descripcion_muestra}`
    : `Ítem ${item.numero}`;

  const lineas = (item.detalle || []).slice(0, 3);
  for (let i = 0; i < 3; i += 1) {
    if (lineas[i]) escribirFilaEnsayo(ws, 18 + i, lineas[i]);
    else limpiarFilaEnsayo(ws, 18 + i);
  }

  const totalItem = lineas.reduce(
    (acc, linea) => acc + Number(linea.tarifa_aplicada || 0) * Number(linea.cantidad || 1),
    0
  );
  ws.getCell('I21').value = { formula: 'SUM(I18:I20)', result: totalItem };
  ws.getCell('I22').value = { formula: 'I21', result: totalItem };
  ws.getCell('I23').value = { formula: 'I22', result: totalItem };

  ws.getCell('A27').value = responsable;
  ws.getCell('C36').value = snapshot.nombre || null;
  ws.getCell('C37').value = null;
  ws.getCell('C38').value = formatearNit(snapshot.nit);

  // Firma del cliente aceptada (Supabase). Si no esta configurado o no hay
  // firma, el area queda en blanco para firma manuscrita.
  if (
    cotizacion.estado === ESTADO_COTIZACION.ACEPTADA &&
    cotizacion.firma_ruta
  ) {
    try {
      const firma = await descargarFirma(cotizacion.firma_ruta);
      const imageId = wb.addImage({ buffer: firma, extension: 'png' });
      ws.addImage(imageId, {
        tl: { col: 4, row: 28 },
        ext: { width: 105, height: 75 },
        editAs: 'oneCell',
      });
    } catch (err) {
      // La cotizacion se genera igual; solo se omite la firma.
    }
  }

  wb.calcProperties.fullCalcOnLoad = true;
  const buffer = await wb.xlsx.writeBuffer();

  const advertencias = [];
  if (items.length > 1) {
    advertencias.push('La plantilla imprime solo el primer item de la cotizacion');
  }
  if ((item.detalle || []).length > 3) {
    advertencias.push('La plantilla imprime solo los primeros 3 ensayos del item');
  }

  return {
    buffer: Buffer.from(buffer),
    nombre: `cotizacion-${codigoCompleto}.xlsx`,
    advertencia: advertencias.length > 0 ? advertencias.join('. ') : null,
  };
}

/**
 * Genera el buffer del Acta de recepcion de muestras.
 *
 * @param {string} muestraId
 * @returns {Promise<{buffer: Buffer, nombre: string}>}
 */
async function generarActaRecepcionXlsx(muestraId) {
  const muestra = await Muestra.findById(muestraId)
    .populate('tipo_muestra', 'nombre')
    .populate('usuario', 'nombres apellidos')
    .populate('solicitud');

  if (!muestra) throw ApiError.notFound('Muestra no encontrada');

  const solicitud = muestra.solicitud;
  const cliente = solicitud?.cliente
    ? await Cliente.findById(solicitud.cliente).lean()
    : null;

  const [usuarioCliente, tipologia, cotizacion] = await Promise.all([
    cliente?.usuario
      ? Usuario.findById(cliente.usuario).select('nombres apellidos correo').lean()
      : null,
    cliente?.tipologia
      ? TipologiaPoblacional.findById(cliente.tipologia).select('nombre').lean()
      : null,
    muestra.cotizacion
      ? Cotizacion.findById(muestra.cotizacion).lean()
      : Cotizacion.findOne({
          solicitud: muestra.solicitud,
          estado: ESTADO_COTIZACION.ACEPTADA,
        }).sort({ version: -1 }).lean(),
  ]);

  const snapshot = cotizacion?.cliente_snapshot?.nombre
    ? cotizacion.cliente_snapshot
    : {
        nombre:
          cliente?.razon_social ||
          nombreCompleto(usuarioCliente) ||
          null,
        nit: cliente?.nit || null,
        direccion: cliente?.direccion || null,
        ciudad: cliente?.ciudad || null,
        departamento: cliente?.departamento || null,
        telefono: cliente?.telefono || null,
        correo: usuarioCliente?.correo || null,
        tipologia: tipologia?.nombre || null,
        persona_contacto: cliente?.persona_contacto || null,
        cargo: cliente?.cargo || null,
      };

  const wb = await cargarPlantilla('actaRecepcion.xlsx');
  const ws = wb.worksheets[0];

  // Datos del solicitante.
  ws.getCell('C7').value = snapshot.nombre || null;
  ws.getCell('H7').value = snapshot.departamento || null;
  ws.getCell('C8').value = formatearNit(snapshot.nit);
  ws.getCell('H8').value = snapshot.persona_contacto || null;
  ws.getCell('C9').value = snapshot.direccion || null;
  ws.getCell('H9').value = snapshot.telefono ? String(snapshot.telefono) : null;
  ws.getCell('C10').value = snapshot.ciudad || null;
  ws.getCell('H10').value = snapshot.correo ? String(snapshot.correo).trim() : null;

  // Fila de la muestra.
  ws.getCell('A14').value = muestra.codigo_muestra;
  ws.getCell('B14').value = muestra.municipio_recoleccion || null;
  ws.getCell('C14').value = muestra.direccion_toma || null;
  ws.getCell('D14').value = muestra.lugar_toma || null;
  ws.getCell('E14').value = muestra.recolectada_por || null;
  ws.getCell('F14').value = muestra.procedimiento_muestreo || 'No Reporta';
  ws.getCell('G14').value = muestra.tipo_muestra?.nombre || null;
  ws.getCell('H14').value = muestra.matriz || null;
  ws.getCell('I14').value = muestra.fecha_hora_recoleccion || null;
  ws.getCell('J14').value = cotizacion?.codigo_cotizacion
    ? `${cotizacion.codigo_cotizacion}V${cotizacion.version}`
    : null;
  ws.getCell('K14').value = muestra.cotizacion_item || 1;
  ws.getCell('L14').value = (muestra.observaciones_predefinidas || []).length > 0
    ? muestra.observaciones_predefinidas.join(', ')
    : '-';

  // Quien entrega / quien recibe.
  ws.getCell('C27').value = snapshot.nombre || null;
  ws.getCell('C28').value = formatearNit(snapshot.nit);
  ws.getCell('J27').value = formatearFechaHora(muestra.fecha_recepcion);
  ws.getCell('J28').value = nombreCompleto(muestra.usuario);
  ws.getCell('J29').value = null;

  // Marca visual de las observaciones seleccionadas en la lista 1..7.
  const seleccionadas = new Set(muestra.observaciones_predefinidas || []);
  for (let i = 0; i < OBSERVACIONES_RECEPCION.length; i += 1) {
    const fila = 18 + i;
    const cell = ws.getCell(`B${fila}`);
    if (seleccionadas.has(i + 1)) {
      cell.font = { ...(cell.font || {}), bold: true, color: { argb: 'FFC00000' } };
    }
  }
  // La observacion 7 vive en la fila 24, oculta por defecto en el formato.
  if (seleccionadas.has(7)) {
    ws.getRow(24).hidden = false;
  }

  wb.calcProperties.fullCalcOnLoad = true;
  const buffer = await wb.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(buffer),
    nombre: `acta-recepcion-${muestra.codigo_muestra}.xlsx`,
  };
}

export { generarCotizacionXlsx, generarActaRecepcionXlsx };
export default { generarCotizacionXlsx, generarActaRecepcionXlsx };
