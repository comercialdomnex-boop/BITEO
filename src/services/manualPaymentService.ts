import { getSupabase } from '../lib/supabase';

export async function confirmManualOrderPayment(orderId: string): Promise<void> {
  const client = getSupabase();

  if (!client) {
    throw new Error('Supabase não configurado.');
  }

  const { data, error: authError } = await client.auth.getUser();

  if (authError || !data.user) {
    throw new Error('Faça login como lojista para confirmar pagamentos.');
  }

  const { error } = await client.rpc('confirm_manual_order_payment', {
    p_order_id: orderId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
