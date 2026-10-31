import React from 'react';
import { RestaurantProfile } from '../../types';

export function orderAvailabilityLabel(restaurant: RestaurantProfile): string {
  if (!restaurant.published) return 'Fechado · loja não publicada';
  if (!restaurant.acceptingOrders) return 'Fechado · recebimento pausado';
  if (!restaurant.scheduledOpen) return 'Fechado · fora do horário';
  return 'Aberto · recebendo pedidos';
}

export function OrderAcceptanceControl({ restaurant, onToggle, disabled = false, saving = false }: {
  restaurant: RestaurantProfile;
  onToggle: () => void;
  disabled?: boolean;
  saving?: boolean;
}) {
  return <div className="flex flex-col gap-1 text-xs">
    <button type="button" role="switch" aria-checked={restaurant.acceptingOrders}
      disabled={disabled || saving} onClick={onToggle} aria-busy={saving}
      className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed">
      <span className={`h-2 w-2 rounded-full ${restaurant.acceptingOrders ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
      {saving ? 'Salvando…' : restaurant.acceptingOrders ? 'Pausar pedidos' : 'Aceitar pedidos'}
    </button>
    <span role="status" className={restaurant.isOpen ? 'text-emerald-400' : 'text-zinc-400'}>
      {orderAvailabilityLabel(restaurant)}
    </span>
  </div>;
}
