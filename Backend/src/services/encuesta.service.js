/**
 * Service del modulo: encuesta.
 *
 * Reglas:
 *  - Una sola encuesta por solicitud.
 *  - Solo se responde cuando el informe esta listo o la solicitud finalizada.
 *  - Puntajes enteros de 1 a 5.
 *  - recomendaria_servicio es booleano.
 */
import ApiError from '../utils/ApiError.js';
import { ESTADO_SOLICITUD } from '../config/constants.js';
import { parseBoolean } from '../utils/booleanos.js';
import Encuesta from '../models/calidad/Encuesta.js';
import Solicitud from '../models/servicios/Solicitud.js';

const CAMPOS_PUNTAJE = [
  'satisfaccion_general',
  'tiempo_entrega',
  'atencion_personal',
  'claridad_informe',
];

/**
 * Registra la respuesta de satisfaccion del cliente.
 *
 * @param {{
 *   solicitudId: string|import('mongoose').Types.ObjectId,
 *   datos: Record<string, unknown>,
 * }} params
 * @returns {Promise<import('mongoose').Document>}
 */
async function responderEncuesta({ solicitudId, datos = {} }) {
  if (!solicitudId) throw ApiError.badRequest('solicitud es obligatoria');

  const solicitud = await Solicitud.findById(solicitudId);
  if (!solicitud) {
    throw ApiError.badRequest('La solicitud indicada no existe');
  }

  const estadosPermitidos = [
    ESTADO_SOLICITUD.INFORME_LISTO,
    ESTADO_SOLICITUD.FINALIZADA,
  ];
  if (!estadosPermitidos.includes(solicitud.estado)) {
    throw ApiError.conflict(
      'La encuesta solo se responde cuando el informe esta listo'
    );
  }

  const previa = await Encuesta.exists({ solicitud: solicitud._id });
  if (previa) throw ApiError.conflict('La solicitud ya tiene encuesta');

  const puntajes = {};
  for (const campo of CAMPOS_PUNTAJE) {
    const valor = Number(datos[campo]);
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      throw ApiError.badRequest(`${campo} debe ser un entero entre 1 y 5`);
    }
    puntajes[campo] = valor;
  }

  const recomendaria = parseBoolean(datos.recomendaria_servicio);
  if (recomendaria === null) {
    throw ApiError.badRequest('recomendaria_servicio debe ser booleano');
  }

  const comentarios =
    datos.comentarios === undefined || datos.comentarios === null
      ? null
      : String(datos.comentarios).trim();

  const [encuesta] = await Encuesta.create([
    {
      solicitud: solicitud._id,
      ...puntajes,
      recomendaria_servicio: recomendaria,
      comentarios,
    },
  ]);

  return encuesta;
}

export { responderEncuesta };
export default { responderEncuesta };
