import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Single browser client for BITEO.
 *
 * Only the publishable (anon) key ever reaches the bundle: there is no
 * service_role key here and there never will be. Session persistence uses the
 * browser localStorage so the session survives reloads, and the URL hash
 * (#access_token=...&type=recovery) is inspected so password-recovery links
 * open the reset screen with a real session.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Non-null when the environment is incomplete. Surfaced as a real error, never mocked. */
export const supabaseConfigError: string | null = !supabaseUrl
  ? 'Variável de ambiente VITE_SUPABASE_URL ausente. Configure o .env.local com a URL do seu projeto Supabase.'
  : !supabaseAnonKey
    ? 'Variável de ambiente VITE_SUPABASE_ANON_KEY ausente. Configure o .env.local com a chave anon/publishable do seu projeto Supabase.'
    : null;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseConfigError) return null;
  if (!client) {
    client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'biteo.auth.token',
      },
    });
  }
  return client;
}
