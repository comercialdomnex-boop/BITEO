import { getSupabase, supabaseConfigError } from '../lib/supabase';

/** Writes only the operational switch, using the merchant's authenticated client/RLS. */
export async function saveOrderAcceptance(storeId: string, acceptingOrders: boolean): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  if (!storeId) throw new Error('Nenhuma loja ativa para salvar.');

  const { data, error } = await supabase.from('stores')
    .update({ is_accepting_orders: acceptingOrders })
    .eq('id', storeId)
    .select('id, is_accepting_orders')
    .single();
  if (error) throw error;
  if (!data || data.id !== storeId || typeof data.is_accepting_orders !== 'boolean') {
    throw new Error('Não foi possível atualizar o recebimento de pedidos. Verifique sua permissão.');
  }
  return data.is_accepting_orders;
}
