import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';

type Tracking = {
  orderId: string;
  orderNumber: number;
  status: string;
  paymentStatus: string;
  paymentTiming: string;
  fulfillmentType: string;
  updatedAt: string;
  totalCents: number;
};
const LABELS: Record<string, string> = {
  novo: 'Aguardando aceite da loja', aceito: 'Pedido aceito',
  em_preparo: 'Em preparo', pronto: 'Pronto',
  em_entrega: 'Saiu para entrega', concluido: 'Concluído', cancelado: 'Cancelado',
};
export const PublicOrderTracking: React.FC<{ slug: string; token: string }> = ({ slug, token }) => {
  const [order, setOrder] = useState<Tracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase) { if (active) setError('Serviço temporariamente indisponível.'); return; }
      const { data, error: rpcError } = await supabase.rpc('get_public_order_tracking', { p_token: token });
      if (!active) return;
      if (rpcError) setError('Não foi possível consultar o pedido.');
      else if (!data) setError('Link de acompanhamento inválido ou expirado.');
      else { setOrder(data as Tracking); setError(null); }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token]);
  return <div className="min-h-screen bg-[#0B0D10] text-white px-5 py-12">
    <main className="mx-auto max-w-xl space-y-6">
      <a href={`/${slug}`} className="text-orange-500 font-bold">BITEO · Voltar ao cardápio</a>
      <h1 className="text-2xl font-bold">Acompanhe seu pedido</h1>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      {!order && !error && <p>Consultando pedido...</p>}
      {order && <section className="rounded-2xl bg-[#151924] border border-zinc-800 p-6 space-y-5">
        <div className="flex justify-between gap-4 items-center">
          <span className="text-zinc-400">Pedido</span><strong className="text-3xl text-orange-500">#{order.orderNumber}</strong>
        </div>
        <div><p className="text-zinc-400 text-sm">Status</p>
          <p className="text-xl font-bold">{LABELS[order.status] ?? order.status}</p></div>
        <div><p className="text-zinc-400 text-sm">Pagamento</p>
          <p className="font-semibold">{order.paymentStatus === 'pago' ? 'Pagamento confirmado' : 'Pagamento pendente'}</p></div>
        <div><p className="text-zinc-400 text-sm">Total</p>
          <p className="font-bold">{(order.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
        <p className="text-xs text-zinc-500">Atualização automática a cada 15 segundos. Guarde este link para acompanhar o pedido.</p>
      </section>}
    </main>
  </div>;
};
