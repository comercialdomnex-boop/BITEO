import { OrderAcceptanceControl } from '../../merchant/components/OrderAcceptanceControl';
import React from 'react';
import { Bell, Volume2, VolumeX, Store, ExternalLink } from 'lucide-react';
import { RestaurantProfile } from '../../types';

interface HeaderProps {
  restaurant: RestaurantProfile;
  onToggleStatus: () => void;
  statusDisabled?: boolean;
  statusSaving?: boolean;
  onToggleSound?: () => void;
  onOpenStorefront?: () => void;
  onOpenStoreSwitcher?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  restaurant,
  onToggleStatus,
  statusDisabled,
  statusSaving,
  onToggleSound,
  onOpenStorefront,
  onOpenStoreSwitcher,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-zinc-850 px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Brand Lockup / Store Switcher */}
        {onOpenStoreSwitcher ? (
          <button
            type="button"
            onClick={onOpenStoreSwitcher}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            title="Toque para alternar estabelecimento"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center shadow-md shadow-orange-950/40 text-white font-extrabold text-lg tracking-tighter shrink-0">
              B
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white font-['Plus_Jakarta_Sans'] group-hover:text-orange-400 transition-colors">
                  BITEO
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium tracking-wide">
                <span className="truncate max-w-[130px] sm:max-w-xs">{restaurant.name}</span>
                <span className="text-[9px] text-zinc-500">▼</span>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center shadow-md shadow-orange-950/40 text-white font-extrabold text-lg tracking-tighter">
              B
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white font-['Plus_Jakarta_Sans']">
                  BITEO
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
              </div>
              <p className="text-[10px] text-zinc-400 font-medium tracking-wide truncate max-w-[150px] sm:max-w-xs">
                {restaurant.name}
              </p>
            </div>
          </div>
        )}

        {/* Quick Operational Status & Actions */}
        <div className="flex items-center gap-2">
          <OrderAcceptanceControl restaurant={restaurant} onToggle={onToggleStatus}
            disabled={statusDisabled} saving={statusSaving} />

          {/* Sound Notification Alert Toggle */}
          {onToggleSound && (
            <button
              onClick={onToggleSound}
              type="button"
              className={`p-2 rounded-lg border transition-colors ${
                restaurant.soundAlertsEnabled
                  ? 'bg-zinc-900 text-orange-400 border-zinc-800 hover:border-zinc-700'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-850 hover:text-zinc-400'
              }`}
              title={
                restaurant.soundAlertsEnabled
                  ? 'Alerta sonoro de novo pedido ativado'
                  : 'Alerta sonoro desativado'
              }
            >
              {restaurant.soundAlertsEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Storefront Link Quick Preview */}
          {onOpenStorefront && (
            <button
              onClick={onOpenStorefront}
              type="button"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium transition-colors"
              title="Abrir cardápio público do cliente"
            >
              <Store className="w-3.5 h-3.5 text-orange-400" />
              <span>Ver Cardápio</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
