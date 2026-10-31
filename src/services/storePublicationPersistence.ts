import { getSupabase, supabaseConfigError } from '../lib/supabase';

/** Persist the publication switch with the merchant session and store-scoped RLS. */
export async function saveStorePublication(storeId: string, published: boolean): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  if (!storeId) throw new Error('Nenhuma loja ativa para salvar.');
  const { data, error } = await supabase.from('stores')
    .update({ is_published: published })
    .eq('id', storeId)
    .select('id, is_published')
    .single();
  if (error) throw error;
  if (!data || data.id !== storeId || typeof data.is_published !== 'boolean' || data.is_published !== published) {
    throw new Error('Não foi possível confirmar a publicação da loja.');
  }
  return data.is_published;
}
