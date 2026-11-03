/**
 * Prepara las plantillas Excel sanitizadas a partir de los ejemplos reales.
 *
 * - Quita la firma del cliente del ejemplo de cotizacion (PII).
 * - Limpia los datos variables (cliente, items, fechas, firmas).
 * - Deja intactos logos, estilos, textos legales, catalogos y observaciones.
 *
 * Uso:
 *   node scripts/prepararPlantillas.mjs
 *
 * Variables opcionales:
 *   PLANTILLA_COTIZACION (default: %USERPROFILE%/Downloads/0041-2026V1.xlsx)
 *   PLANTILLA_RECEPCION  (default: %USERPROFILE%/Downloads/0015-2026.xlsx)
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(process.cwd());
const salida = path.join(raiz, 'src', 'templates', 'excel');
const origenCotizacion =
  process.env.PLANTILLA_COTIZACION ||
  path.join(process.env.USERPROFILE || '', 'Downloads', '0041-2026V1.xlsx');
const origenRecepcion =
  process.env.PLANTILLA_RECEPCION ||
  path.join(process.env.USERPROFILE || '', 'Downloads', '0015-2026.xlsx');

/**
 * Elimina imagenes huerfanas (por ejemplo, firmas que quedaron sueltas en el
 * ejemplo) y conserva solo las que estan referenciadas por un drawing/rel.
 */
async function sanitizarMediaHuerfana(rutaXlsx) {
  const data = fs.readFileSync(rutaXlsx);
  const zip = await JSZip.loadAsync(data);

  const referenciadas = new Set();
  for (const nombre of Object.keys(zip.files)) {
    if (!nombre.endsWith('.rels')) continue;
    const texto = await zip.file(nombre).async('string');
    for (const match of texto.matchAll(/Target="([^"]*media\/[^"]+)"/g)) {
      referenciadas.add(path.posix.basename(match[1]));
    }
  }

  for (const nombre of Object.keys(zip.files)) {
    if (!nombre.startsWith('xl/media/') || nombre.endsWith('/')) continue;
    if (!referenciadas.has(path.posix.basename(nombre))) {
      zip.remove(nombre);
      console.log(`[plantillas] Imagen huerfana eliminada: ${nombre}`);
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(rutaXlsx, buffer);
}

function limpiar(ws, celdas) {
  for (const ref of celdas) {
    ws.getCell(ref).value = null;
  }
}

function limpiarRango(ws, desdeFila, hastaFila, desdeCol, hastaCol) {
  for (let fila = desdeFila; fila <= hastaFila; fila += 1) {
    for (let col = desdeCol; col <= hastaCol; col += 1) {
      ws.getCell(fila, col).value = null;
    }
  }
}

async function prepararCotizacion() {
  if (!fs.existsSync(origenCotizacion)) {
    throw new Error(`No existe la plantilla de cotizacion: ${origenCotizacion}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(origenCotizacion);
  const ws = wb.worksheets[0];

  // La imagen 1 es la firma real del cliente; la 0 es el logo institucional.
  if (Array.isArray(ws._media)) {
    ws._media = ws._media.filter((media) => media.imageId !== 1);
  }
  if (Array.isArray(wb.model.media)) {
    wb.model.media = wb.model.media.slice(0, 1);
  }

  // Pegue (fila 2): dejar J2 "Pegue -->" y limpiar K2:U2.
  limpiarRango(ws, 2, 2, 11, 21);

  // Datos del cliente (filas 9-14) y campos del encabezado.
  limpiar(ws, [
    'B9', 'B10', 'B11', 'B12', 'B13', 'B14',
    'F9', 'F10', 'F11', 'F12', 'F13',
    'F2', 'F6', 'S2',
  ]);

  // Propuesta: descripcion del item, filas de ensayo y totales.
  limpiar(ws, ['A16']);
  limpiarRango(ws, 18, 20, 1, 9);
  limpiar(ws, ['I21', 'I22', 'I23']);

  // Responsable y firma de aceptacion.
  limpiar(ws, ['A27', 'C36', 'C37', 'C38']);

  wb.calcProperties.fullCalcOnLoad = true;

  const destino = path.join(salida, 'cotizacion.xlsx');
  await wb.xlsx.writeFile(destino);
  await sanitizarMediaHuerfana(destino);
  console.log(`[plantillas] Cotizacion: ${destino}`);
  console.log(`[plantillas] Imagenes restantes: ${ws.getImages().length}`);
}

async function prepararRecepcion() {
  if (!fs.existsSync(origenRecepcion)) {
    throw new Error(`No existe la plantilla de recepcion: ${origenRecepcion}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(origenRecepcion);
  const ws = wb.worksheets[0];

  // Datos del solicitante.
  limpiar(ws, ['C7', 'H7', 'C8', 'H8', 'C9', 'H9', 'C10', 'H10']);

  // Fila de la muestra.
  limpiarRango(ws, 14, 14, 1, 12);

  // Quien entrega, quien recibe y firma.
  limpiar(ws, ['C27', 'C28', 'J27', 'J28', 'J29']);

  wb.calcProperties.fullCalcOnLoad = true;

  const destino = path.join(salida, 'actaRecepcion.xlsx');
  await wb.xlsx.writeFile(destino);
  await sanitizarMediaHuerfana(destino);
  console.log(`[plantillas] Recepcion: ${destino}`);
  console.log(`[plantillas] Imagenes restantes: ${ws.getImages().length}`);
}

fs.mkdirSync(salida, { recursive: true });
await prepararCotizacion();
await prepararRecepcion();
