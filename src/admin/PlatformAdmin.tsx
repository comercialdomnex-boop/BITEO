import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getSupabase } from '../lib/supabase';

type StoreSummary = {
  id: string; name: string; slug: string; published: boolean;
  acceptingOrders: boolean; createdAt: string; orderCount: number;
};
type Overview = { totalStores: number; publishedStores: number; stores: StoreSummary[] };

export const PlatformAdmin: React.FC = () => {
  const { status } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase) { setError('Supabase indisponível.'); return; }
      const { data, error: rpcError } = await supabase.rpc('get_platform_overview');
      if (!active) return;
      if (rpcError) setError(rpcError.code === '42501' ? 'Acesso restrito à administração da plataforma.' : 'Não foi possível carregar o painel.');
      else { setOverview(data as Overview); setError(null); }
    };
    void load();
    return () => { active = false; };
  }, [status, refresh]);

  if (status === 'loading') return <main className="p-8">Validando sessão...</main>;
  if (status !== 'authenticated') return <main className="p-8"><h1>Administração Biteo</h1><p>Entre com sua conta autorizada para continuar.</p><a href="/login" className="text-orange-500 underline">Fazer login</a></main>;
  return <main className="min-h-screen bg-[#0B0D10] text-zinc-100 p-5 md:p-10">
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-orange-500 font-bold">DOMNEX TECH</p><h1 className="text-3xl font-bold">Painel Master Biteo</h1></div>
        <button type="button" onClick={() => setRefresh(v => v + 1)} className="bg-orange-600 px-4 py-2 rounded-xl font-semibold">Atualizar</button>
      </header>
      {error && <p role="alert" className="text-rose-400">{error}</p>}
      {overview && <>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#151924] rounded-2xl p-5 border border-zinc-800"><p className="text-zinc-400">Lojas cadastradas</p><p className="text-3xl font-bold">{overview.totalStores}</p></div>
          <div className="bg-[#151924] rounded-2xl p-5 border border-zinc-800"><p className="text-zinc-400">Lojas publicadas</p><p className="text-3xl font-bold">{overview.publishedStores}</p></div>
        </div>
        <div className="space-y-3"><h2 className="text-xl font-bold">Estabelecimentos</h2>
          {overview.stores.map(store => <div key={store.id} className="rounded-xl bg-[#151924] border border-zinc-800 p-4 flex flex-wrap justify-between gap-3">
            <div><h3 className="font-bold">{store.name}</h3><p className="text-zinc-400 text-sm">/{store.slug}</p></div>
            <div className="text-sm text-right"><p>{store.published ? 'Publicada' : 'Não publicada'}</p><p className="text-zinc-400">{store.orderCount} pedidos</p></div>
          </div>)}
        </div>
      </>}
    </div>
  </main>;
};
