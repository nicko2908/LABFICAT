/**
 * Cliente de Supabase (Storage) para subir archivos desde el backend.
 * Usa la service role key (API_KEY_SUPABASE), nunca expuesta al cliente.
 */
import { createClient } from '@supabase/supabase-js';
import env from './env.js';

const supabase = createClient(env.supabase.url, env.supabase.key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default supabase;
