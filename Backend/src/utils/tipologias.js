/**
 * Util: resolucion y validacion de tipologias poblacionales (RF-01).
 *
 * Politica aplicada (hibrida):
 *  - Autorregistro (auth.registrar): la tipologia es OBLIGATORIA.
 *  - Registro por tercero (clientes.crear): si no se conoce, se asigna
 *    la tipologia del catalogo con codigo NINGUNA.
 *  - Actualizacion: nunca se acepta null/vacio.
 *
 * La busqueda por ID se hace con manejo explicito de CastError para que un
 * identificador mal formado responda 400 y no 500.
 */
import ApiError from './ApiError.js';
import TipologiaPoblacional from '../models/clientes/TipologiaPoblacional.js';
import { TIPOLOGIA_CODIGO } from '../config/constants.js';

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
 * Devuelve el documento de tipologia solicitado.
 *
 * @param {unknown} valor ObjectId recibido en el body.
 * @param {{ obligatoria?: boolean }} [opciones]
 *   obligatoria=true  -> si falta, responde 400.
 *   obligatoria=false -> si falta, usa la tipologia NINGUNA.
 * @returns {Promise<import('mongoose').Document>}
 */
async function resolverTipologia(valor, { obligatoria = true } = {}) {
  const falta = valor === undefined || valor === null || String(valor).trim() === '';

  if (falta) {
    if (obligatoria) {
      throw ApiError.badRequest('tipologia es obligatoria');
    }

    const ninguna = await TipologiaPoblacional.findOne({
      codigo: TIPOLOGIA_CODIGO.NINGUNA,
      activo: true,
    });

    if (!ninguna) {
      throw new ApiError(
        500,
        'La tipologia NINGUNA no esta sembrada. Ejecute npm run seed o la migracion de tipologia'
      );
    }

    return ninguna;
  }

  const doc = await buscarTipologiaPorId(valor);
  if (!doc) throw ApiError.badRequest('La tipologia indicada no existe');
  if (!doc.activo) throw ApiError.badRequest('La tipologia indicada esta inactiva');

  return doc;
}

export { resolverTipologia };
export default { resolverTipologia };
