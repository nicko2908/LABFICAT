/**
 * Cliente de Supabase (Storage) para subir archivos desde el backend.
 * Usa la service role key (API_KEY_SUPABASE), nunca expuesta al cliente.
 *
 * La creacion del cliente es PEREZOSA: no se ejecuta al importar el modulo.
 * Asi el backend puede arrancar aunque Supabase no este configurado en local;
 * solo los endpoints que usan storage reciben un 503.
 */
import { createClient } from '@supabase/supabase-js';
import env from './env.js';
import ApiError from '../utils/ApiError.js';

let cliente = null;

/**
 * Devuelve el cliente de Supabase, creandolo la primera vez que se usa.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 * @throws {ApiError} 503 si faltan SUPABASE_URL o API_KEY_SUPABASE.
 */
function getSupabase() {
  if (cliente) return cliente;

  if (!env.supabase.configurado) {
    throw new ApiError(
      503,
      'Storage no configurado: defina SUPABASE_URL y API_KEY_SUPABASE en el archivo .env'
    );
  }

  cliente = createClient(env.supabase.url, env.supabase.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cliente;
}

export { getSupabase };
export default getSupabase;
