/**
 * Util: resolucion y validacion de tipologias (RF-01 / cotizacion).
 *
 * El catalogo vigente tiene 16 categorias comerciales. Las 4 marcadas con
 * es_interno=true son clientes internos (tarifa 0); el resto son externos.
 *
 * Politica de registro:
 *  - Autorregistro (auth.registrar): la tipologia es OBLIGATORIA.
 *  - Registro por tercero (clientes.crear): si no se conoce, se asigna
 *    "Persona natural" (externa).
 *  - Actualizacion: nunca se acepta null/vacio.
 */
import ApiError from './ApiError.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import { TIPOLOGIA_CODIGO, TIPO_CLIENTE } from '../config/constants.js';

async function buscarTipologiaPorId(id) {
  try {
    return await TipologiaPoblacional.findById(id);
  } catch (err) {
    if (err && err.name === 'CastError') {
      throw ApiError.badRequest('El identificador de tipologia no es valido');
    }
    throw err;
  }
}

/**
 * Determina INTERNO/EXTERNO a partir de la tipologia. No usa el correo.
 *
 * @param {{ es_interno?: boolean }|null|undefined} tipologia
 * @returns {'INTERNO'|'EXTERNO'}
 */
function tipoClienteDeTipologia(tipologia) {
  return tipologia && tipologia.es_interno
    ? TIPO_CLIENTE.INTERNO
    : TIPO_CLIENTE.EXTERNO;
}

/**
 * Devuelve el documento de tipologia solicitado.
 *
 * @param {unknown} valor ObjectId recibido en el body.
 * @param {{ obligatoria?: boolean }} [opciones]
 *   obligatoria=true  -> si falta, responde 400.
 *   obligatoria=false -> si falta, usa "Persona natural".
 * @returns {Promise<import('mongoose').Document>}
 */
async function resolverTipologia(valor, { obligatoria = true } = {}) {
  const falta = valor === undefined || valor === null || String(valor).trim() === '';

  if (falta) {
    if (obligatoria) {
      throw ApiError.badRequest('tipologia es obligatoria');
    }

    const personaNatural = await TipologiaPoblacional.findOne({
      codigo: TIPOLOGIA_CODIGO.PERSONA_NATURAL,
      activo: true,
    });

    if (!personaNatural) {
      throw new ApiError(
        500,
        'La tipologia PERSONA NATURAL no esta sembrada. Ejecute npm run seed o la migracion de catalogos'
      );
    }

    return personaNatural;
  }

  const doc = await buscarTipologiaPorId(valor);
  if (!doc) throw ApiError.badRequest('La tipologia indicada no existe');
  if (!doc.activo) throw ApiError.badRequest('La tipologia indicada esta inactiva');

  return doc;
}

export { resolverTipologia, tipoClienteDeTipologia };
export default { resolverTipologia, tipoClienteDeTipologia };
