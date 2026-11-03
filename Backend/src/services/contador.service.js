/**
 * Service: contadores atomicos de codigos.
 *
 * Usa findOneAndUpdate + $inc con upsert. Si se recibe una sesion, el
 * incremento participa de la misma transaccion que el documento que usa el
 * codigo; si no, sigue siendo atomico a nivel de documento.
 */
import Contador from '../models/sistema/Contador.js';

/**
 * Devuelve el siguiente valor de una secuencia.
 *
 * @param {string} clave
 * @param {import('mongoose').ClientSession|null} [session]
 * @returns {Promise<number>}
 */
async function siguienteConsecutivo(clave, session = null) {
  const opciones = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };
  if (session) opciones.session = session;

  const doc = await Contador.findOneAndUpdate(
    { clave },
    { $inc: { valor: 1 } },
    opciones
  );

  return doc.valor;
}

/**
 * Fija una secuencia en un valor minimo (usado por migraciones para no
 * reiniciar codigos sobre una base existente).
 *
 * @param {string} clave
 * @param {number} valor
 * @param {import('mongoose').ClientSession|null} [session]
 */
async function fijarConsecutivo(clave, valor, session = null) {
  const opciones = { new: true, upsert: true };
  if (session) opciones.session = session;

  return Contador.findOneAndUpdate(
    { clave },
    { $max: { valor: Number(valor) || 0 } },
    opciones
  );
}

export { siguienteConsecutivo, fijarConsecutivo };
export default { siguienteConsecutivo, fijarConsecutivo };
