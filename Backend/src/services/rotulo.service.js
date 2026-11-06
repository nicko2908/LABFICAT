/**
 * Service del modulo: rotulo (RF-11).
 *
 * Genera el PDF + QR del rotulo de una muestra ACEPTADA, lo sube a R2 y
 * guarda sus metadatos en Rotulo.
 */
import { ESTADO_COTIZACION, ESTADO_RECEPCION_MUESTRA } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import Muestra from '../models/laboratorio/Muestra.js';
import Rotulo from '../models/laboratorio/Rotulo.js';
import Analisis from '../models/laboratorio/Analisis.js';
import Cotizacion from '../models/servicios/Cotizacion.js';
import Cliente from '../models/clientes/Cliente.js';
import { generarRotuloPdf } from '../utils/generadores/pdf.js';
import {
  subirArchivo,
  descargarArchivo,
  eliminarArchivo,
} from './storage.service.js';
import { verificarPropietarioMuestra } from '../utils/propietario.js';

function itemsDeCotizacion(cotizacion) {
  if (Array.isArray(cotizacion.items) && cotizacion.items.length > 0) {
    return cotizacion.items;
  }
  return [{ numero: 1, detalle: cotizacion.detalle || [] }];
}

async function analisisDeMuestra(muestra, solicitud) {
  if (muestra.cotizacion) {
    const cotizacion = await Cotizacion.findOne({
      _id: muestra.cotizacion,
      estado: ESTADO_COTIZACION.ACEPTADA,
    }).lean();

    if (cotizacion) {
      const item = itemsDeCotizacion(cotizacion).find(
        (linea) => Number(linea.numero) === Number(muestra.cotizacion_item || 1)
      );
      if (item) {
        return [
          ...new Set((item.detalle || []).map((linea) => String(linea.analisis))),
        ];
      }
    }
  }

  return (solicitud.analisis || []).map((id) => String(id));
}

/**
 * POST /muestras/:id/rotulo.
 * @param {string} muestraId
 * @param {{ analisis?: Array<string> }} [body]
 */
async function generarRotulo(muestraId, body = {}) {
  const { analisis } = body;

  const muestra = await Muestra.findById(muestraId)
    .populate('tipo_muestra', 'nombre')
    .populate('solicitud', 'codigo_solicitud cliente analisis');

  if (!muestra) throw ApiError.notFound('Muestra no encontrada');
  if (muestra.estado_recepcion !== ESTADO_RECEPCION_MUESTRA.ACEPTADA) {
    throw ApiError.conflict('Solo se genera rotulo de una muestra ACEPTADA');
  }

  const solicitud = muestra.solicitud;
  if (!solicitud) throw ApiError.badRequest('La muestra no tiene solicitud asociada');

  let idsAnalisis;

  if (analisis !== undefined) {
    if (!Array.isArray(analisis) || analisis.length === 0) {
      throw ApiError.badRequest('analisis debe ser un arreglo no vacio');
    }
    const n = await Analisis.countDocuments({ _id: { $in: analisis } });
    if (n !== analisis.length) {
      throw ApiError.badRequest('Uno o mas analisis no existen');
    }
    idsAnalisis = analisis;
  } else {
    idsAnalisis = await analisisDeMuestra(muestra, solicitud);
  }

  const [cliente, analisisDocs] = await Promise.all([
    Cliente.findById(solicitud.cliente)
      .populate('usuario', 'nombres apellidos correo')
      .lean(),
    Analisis.find({ _id: { $in: idsAnalisis } })
      .select('nombre codigo')
      .lean(),
  ]);

  const buffer = await generarRotuloPdf({
    muestra,
    solicitud,
    cliente,
    analisis: analisisDocs,
    qrTexto: muestra.codigo_muestra,
  });

  const key = `rotulos/${muestra._id}-${Date.now()}.pdf`;
  const archivo = await subirArchivo({
    buffer,
    key,
    contentType: 'application/pdf',
    metadata: { muestra: muestra.codigo_muestra },
  });

  try {
    return await Rotulo.findOneAndUpdate(
      { muestra: muestra._id },
      {
        $set: {
          analisis: idsAnalisis,
          archivo_pdf: {
            ...archivo,
            nombre_original: `rotulo-${muestra.codigo_muestra || muestra._id}.pdf`,
          },
        },
      },
      { new: true, runValidators: true, upsert: true }
    ).populate('analisis', 'nombre tarifa_externo');
  } catch (error) {
    await eliminarArchivo(key).catch(() => {});
    throw error;
  }
}

/**
 * GET /muestras/:id/rotulo — descarga autenticada.
 * @param {string} muestraId
 * @param {object} usuario
 */
async function obtenerPdfRotulo(muestraId, usuario) {
  const muestra = await Muestra.findById(muestraId);
  if (!muestra) throw ApiError.notFound('Muestra no encontrada');

  await verificarPropietarioMuestra(muestra, usuario);

  const rotulo = await Rotulo.findOne({ muestra: muestra._id });
  if (!rotulo) throw ApiError.notFound('La muestra no tiene rotulo generado');

  const key = rotulo.archivo_pdf?.key || rotulo.ruta_pdf;
  if (!key) throw ApiError.notFound('El rotulo no tiene PDF generado');

  const buffer = await descargarArchivo(key);
  const nombre = `rotulo-${muestra.codigo_muestra || muestra._id}.pdf`;

  return { rotulo, buffer, nombre };
}

export { generarRotulo, obtenerPdfRotulo };
export default { generarRotulo, obtenerPdfRotulo };
