/**
 * Generadores PDF de informe de resultados y rotulo de muestra.
 *
 * Se generan en memoria; el service correspondiente los sube a R2.
 */
import PDFDocument from 'pdfkit';
import { generarQrBuffer } from './qr.js';

const AZUL = '#123B5D';
const GRIS = '#F2F4F7';
const TEXTO = '#1F2937';
const MUTED = '#6B7280';

function formatearFecha(valor) {
  if (!valor) return 'No registra';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'No registra';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}

function texto(valor, defecto = 'No registra') {
  const limpio = String(valor ?? '').trim();
  return limpio || defecto;
}

function nombreCliente(cliente) {
  if (!cliente) return 'No registra';
  if (cliente.razon_social) return cliente.razon_social;
  if (cliente.nombre) return cliente.nombre;

  const usuario = cliente.usuario;
  if (usuario) {
    const nombre = [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim();
    if (nombre) return nombre;
  }

  return 'No registra';
}

function nombreAnalisis(analisis) {
  if (!analisis) return 'No registra';
  if (typeof analisis === 'string') return analisis;
  return texto(analisis.nombre, 'No registra');
}

function crearDocumento(titulo) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    bufferPages: true,
    info: {
      Title: titulo,
      Author: 'LABFICAT',
      Creator: 'LABFICAT Backend',
    },
  });

  const chunks = [];
  const listo = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  return { doc, listo };
}

function encabezado(doc, titulo) {
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(20).text('LABFICAT', {
    align: 'center',
  });
  doc
    .fillColor(TEXTO)
    .font('Helvetica')
    .fontSize(12)
    .text(titulo, { align: 'center' });

  doc.moveDown(0.6);
  doc
    .moveTo(48, doc.y)
    .lineTo(547, doc.y)
    .strokeColor(AZUL)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.8);
}

function dato(doc, etiqueta, valor, x, y, ancho = 150) {
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(etiqueta, x, y, { width: ancho });
  doc
    .fillColor(TEXTO)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(texto(valor), x, y + 11, { width: ancho });
}

function piePagina(doc) {
  const rango = doc.bufferedPageRange();
  for (let indice = 0; indice < rango.count; indice += 1) {
    doc.switchToPage(rango.start + indice);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `LABFICAT - Documento generado automaticamente - Pagina ${indice + 1} de ${rango.count}`,
        48,
        800,
        { align: 'center', width: 499 }
      );
  }
}

/**
 * Informe de resultados de una muestra.
 *
 * @param {{
 *   informe?: object,
 *   muestra?: object,
 *   solicitud?: object,
 *   cliente?: object,
 *   usuario?: object,
 *   ordenes?: Array<object>,
 * }} datos
 * @returns {Promise<Buffer>}
 */
export async function generarInformePdf({
  informe,
  muestra,
  solicitud,
  cliente,
  usuario,
  ordenes = [],
} = {}) {
  const { doc, listo } = crearDocumento('Informe de resultados');

  encabezado(doc, 'Informe de resultados');

  const y = doc.y;
  dato(doc, 'Muestra', muestra?.codigo_muestra, 48, y, 120);
  dato(doc, 'Solicitud', solicitud?.codigo_solicitud, 180, y, 120);
  dato(doc, 'Fecha de generacion', formatearFecha(informe?.fecha_generacion), 315, y, 120);
  dato(doc, 'Cliente', nombreCliente(cliente), 450, y, 97);

  doc.y = y + 38;
  dato(doc, 'Matriz', muestra?.matriz, 48, doc.y, 120);
  dato(doc, 'Tipo de muestra', muestra?.tipo_muestra?.nombre, 180, doc.y, 120);
  dato(doc, 'Responsable', usuario ? `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() : null, 315, doc.y, 232);

  doc.moveDown(2.2);

  const columnas = [
    { titulo: 'Analisis', x: 48, ancho: 120 },
    { titulo: 'Parametro', x: 168, ancho: 92 },
    { titulo: 'Resultado', x: 260, ancho: 65 },
    { titulo: 'Unidad', x: 325, ancho: 58 },
    { titulo: 'Metodo / tecnica', x: 383, ancho: 100 },
    { titulo: 'Estado', x: 483, ancho: 64 },
  ];

  let filaY = doc.y;
  doc.rect(48, filaY, 499, 18).fill(GRIS);
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(8);
  for (const columna of columnas) {
    doc.text(columna.titulo, columna.x + 3, filaY + 5, { width: columna.ancho - 6 });
  }

  filaY += 18;
  doc.font('Helvetica').fontSize(8).fillColor(TEXTO);

  for (const orden of ordenes) {
    const analisis = orden.analisis || {};
    const metodo = [analisis.metodo, analisis.tecnica].filter(Boolean).join(' / ') || 'No registra';
    const resultados =
      Array.isArray(orden.resultados) && orden.resultados.length > 0
        ? orden.resultados
        : [{ parametro: null, valor: null }];

    for (const resultado of resultados) {
      if (filaY > 755) {
        doc.addPage();
        filaY = 48;
      }

      const parametro = resultado?.parametro?.nombre || 'Resultado';
      const unidad = resultado?.parametro?.unidad_medida || analisis.unidades || '';
      const valor =
        resultado?.valor === null || resultado?.valor === undefined
          ? 'Pendiente'
          : String(resultado.valor);
      const estado = orden.estado || 'No registra';

      doc.fillColor(TEXTO).font('Helvetica').fontSize(8);
      doc.text(texto(analisis.nombre), 51, filaY, { width: 114 });
      const altoAnalisis = doc.heightOfString(texto(analisis.nombre), { width: 114 });

      doc.text(parametro, 171, filaY, { width: 86 });
      doc.text(valor, 263, filaY, { width: 59 });
      doc.text(unidad, 328, filaY, { width: 52 });
      doc.text(metodo, 386, filaY, { width: 94 });
      const altoMetodo = doc.heightOfString(metodo, { width: 94 });
      doc.text(estado, 486, filaY, { width: 58 });

      filaY += Math.max(16, altoAnalisis, altoMetodo) + 5;

      doc
        .moveTo(48, filaY - 2)
        .lineTo(547, filaY - 2)
        .strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .stroke();
    }
  }

  if (ordenes.length === 0) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('No hay ordenes registradas.', 48, filaY + 10);
  }

  doc.moveDown(2);
  doc.fillColor(MUTED).font('Helvetica').fontSize(8);
  doc.text('Documento generado por LABFICAT. Los resultados corresponden a las ordenes finalizadas y validadas.', 48, doc.y, {
    width: 499,
  });

  piePagina(doc);
  doc.end();
  return listo;
}

/**
 * Rotulo de identificacion de una muestra.
 *
 * @param {{
 *   muestra?: object,
 *   solicitud?: object,
 *   cliente?: object,
 *   analisis?: Array<object|string>,
 *   qrTexto?: string,
 * }} datos
 * @returns {Promise<Buffer>}
 */
export async function generarRotuloPdf({
  muestra,
  solicitud,
  cliente,
  analisis = [],
  qrTexto,
} = {}) {
  const codigo = texto(muestra?.codigo_muestra, 'SIN-CODIGO');
  const qr = await generarQrBuffer(qrTexto || codigo);

  const { doc, listo } = crearDocumento('Rotulo de muestra');
  encabezado(doc, 'Rotulo de muestra');

  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(28).text(codigo, 48, 130, {
    width: 320,
  });
  doc.image(qr, 400, 120, { width: 140 });

  doc
    .rect(40, 210, 515, 300)
    .strokeColor(AZUL)
    .lineWidth(1)
    .stroke();

  const y = 228;
  dato(doc, 'Cliente', nombreCliente(cliente), 56, y, 220);
  dato(doc, 'Solicitud', solicitud?.codigo_solicitud, 300, y, 120);
  dato(doc, 'Fecha de recepcion', formatearFecha(muestra?.fecha_recepcion), 430, y, 110);

  dato(doc, 'Tipo de muestra', muestra?.tipo_muestra?.nombre, 56, y + 45, 220);
  dato(doc, 'Matriz', muestra?.matriz, 300, y + 45, 120);
  dato(doc, 'Prioridad', muestra?.prioridad, 430, y + 45, 110);

  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Analisis', 56, y + 95);
  const nombres = analisis.length > 0
    ? analisis.map(nombreAnalisis).join(', ')
    : 'No registra';

  doc.fillColor(TEXTO).font('Helvetica').fontSize(10).text(nombres, 56, y + 110, {
    width: 480,
  });

  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(
    'Conservar el rotulo junto con la muestra. El codigo QR permite consultar la trazabilidad.',
    56,
    y + 245,
    { width: 480 }
  );

  piePagina(doc);
  doc.end();
  return listo;
}

export default { generarInformePdf, generarRotuloPdf };
