import React, { useEffect, useState } from 'react';
import type { StoreConfig } from '../types';
import { getSupabase, supabaseConfigError } from '../lib/supabase';
import { buildStoreInstanceFromRow, type CreatedStoreRow } from '../services/storeCreationService';
import { applyStoreSettingsToConfig, weekdayToDay, type StoreSettingsRow } from '../services/storePersistence';
import { RestaurantService } from '../services/restaurantService';
import { StorefrontApp } from './StorefrontApp';

type PublicPayload = {
  store: CreatedStoreRow;
  settings: StoreSettingsRow | null;
  hours: Array<{ weekday: number; is_open: boolean }>;
  periods: Array<{ id: string; weekday: number; opens_at: string; closes_at: string; sort_order: number }>;
  areas: Array<{ id: string; name: string; fee_cents: number; estimated_minutes: number | null; is_active: boolean }>;
};

function buildConfig(payload: PublicPayload): StoreConfig {
  let config = buildStoreInstanceFromRow(payload.store).config;
  if (!payload.settings) throw new Error('A loja ainda não configurou o atendimento.');
  config = applyStoreSettingsToConfig(config, payload.settings);
  const hoursByDay = new Map(payload.hours.map(h => [h.weekday, h.is_open]));
  config = {
    ...config,
    hours: {
      schedule: config.hours.schedule.map(entry => {
        const weekday = [0, 1, 2, 3, 4, 5, 6].find(n => weekdayToDay(n) === entry.day)!;
        return {
          ...entry,
          isOpen: hoursByDay.get(weekday) ?? false,
          periods: payload.periods.filter(p => p.weekday === weekday)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(p => ({ id: p.id, open: p.opens_at.slice(0, 5), close: p.closes_at.slice(0, 5) })),
        };
      }),
    },
    delivery: {
      ...config.delivery,
      areas: payload.areas.map(a => ({
        id: a.id, name: a.name, fee: a.fee_cents / 100,
        estimatedMinutes: a.estimated_minutes ?? undefined, isActive: a.is_active,
      })),
    },
  };
  return config;
}

export const PublicStorefront: React.FC<{ slug: string }> = ({ slug }) => {
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setError(null);
    const supabase = getSupabase();
    if (!supabase) { setError(supabaseConfigError ?? 'Supabase indisponível.'); return; }
    supabase.rpc('get_public_store', { p_slug: slug }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) throw rpcError;
      if (!data) throw new Error('Loja não encontrada ou ainda não publicada.');
      setConfig(buildConfig(data as PublicPayload));
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a loja.');
    });
    return () => { cancelled = true; };
  }, [slug, retry]);

  if (!config) return (
    <div className="min-h-screen bg-[#0B0D10] text-zinc-100 flex flex-col items-center justify-center gap-4 px-5 text-center">
      <strong className="text-2xl text-orange-500">BITEO</strong>
      <p>{error ?? 'Carregando cardápio...'}</p>
      {error && <button type="button" onClick={() => setRetry(n => n + 1)}
        className="rounded-xl bg-orange-600 px-5 py-2 font-bold">Tentar novamente</button>}
    </div>
  );
  return <StorefrontApp key={config.id} restaurant={RestaurantService.buildProfile(config)}
    config={config} publicMode onBackToMerchant={() => window.location.assign('/login')} />;
};
