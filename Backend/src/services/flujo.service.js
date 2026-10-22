/**
 * Service: flujo (orquestador de transiciones de negocio).
 *
 * Centraliza las operaciones que tocan mas de una coleccion para que se
 * ejecuten dentro de una transaccion de MongoDB.
 *
 * La maquina de estados y las transiciones concretas se agregaran en los
 * siguientes pasos de la Fase 2A.
 */
import mongoose from 'mongoose';

const OPCIONES_POR_DEFECTO = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
};

/**
 * Ejecuta un callback dentro de una transaccion de MongoDB.
 *
 * - Si el callback termina bien, hace commit de todos los cambios.
 * - Si lanza un error, hace abort y no deja cambios parciales.
 * - La sesion se pasa al callback para que todas las operaciones la usen.
 *
 * Uso:
 *   await conTransaccion(async (session) => {
 *     await Modelo.create([doc], { session });
 *     await OtroModelo.updateOne(filtro, cambio, { session });
 *   });
 *
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} fn
 * @param {object} [opciones] Opciones adicionales de withTransaction.
 * @returns {Promise<T>}
 * @template T
 */
async function conTransaccion(fn, opciones = {}) {
  const session = await mongoose.startSession();

  try {
    let resultado;
    await session.withTransaction(
      async () => {
        resultado = await fn(session);
      },
      { ...OPCIONES_POR_DEFECTO, ...opciones }
    );
    return resultado;
  } finally {
    await session.endSession();
  }
}

export { conTransaccion };
export default { conTransaccion };
