import React from 'react';
import { StoreConfig, MenuItem } from '../../../types';
import { evaluateSchedule } from '../../../utils/hours';
import { formatCurrency } from '../../../components/shared';
import {
  Clock,
  Bike,
  ExternalLink,
  UtensilsCrossed,
  Plus,
} from 'lucide-react';

interface StorePreviewPhoneProps {
  config: StoreConfig;
  items: MenuItem[];
  onOpenStorefront?: () => void;
}

export const StorePreviewPhone: React.FC<StorePreviewPhoneProps> = ({
  config,
  items,
  onOpenStorefront,
}) => {
  const { theme, info, hours, delivery } = config;
  const openStatus = evaluateSchedule(hours);

  // Style class generators based on theme.visualStyle
  const getStyleClasses = () => {
    switch (theme.visualStyle) {
      case 'minimalista':
        return {
          card: 'rounded-lg border border-zinc-700/60 bg-[#12141A]',
          badge: 'rounded-md text-[10px] font-mono tracking-tight',
          button: 'rounded-lg font-medium',
          bannerRadius: 'rounded-b-none',
        };
      case 'vibrante':
        return {
          card: 'rounded-3xl border-2 border-zinc-700/80 bg-[#161A24] shadow-xl',
          badge: 'rounded-full text-[10px] font-extrabold uppercase tracking-wider',
          button: 'rounded-2xl font-bold shadow-lg',
          bannerRadius: 'rounded-b-3xl',
        };
      case 'moderno':
      default:
        return {
          card: 'rounded-2xl border border-zinc-800 bg-[#141720] shadow-md',
          badge: 'rounded-full text-[10px] font-semibold',
          button: 'rounded-xl font-semibold',
          bannerRadius: 'rounded-b-2xl',
        };
    }
  };

  const styleClasses = getStyleClasses();
  const availableItems = items.filter(i => i.isAvailable).slice(0, 4);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Phone Frame */}
      <div className="w-full max-w-[340px] sm:max-w-[360px] bg-[#0A0C0F] border-[6px] border-zinc-800 rounded-[38px] shadow-2xl overflow-hidden flex flex-col relative select-none">
        {/* Phone Notch & Status Bar */}
        <div className="pt-2 pb-1 px-5 bg-[#0A0C0F] flex items-center justify-between z-20 text-[10px] text-zinc-400 font-mono">
          <span>19:42</span>
          <div className="w-20 h-3.5 bg-zinc-900 rounded-full border border-zinc-800" />
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>5G</span>
          </div>
        </div>

        {/* Scrollable Screen Content */}
        <div className="h-[520px] overflow-y-auto no-scrollbar pb-16 text-zinc-100 text-xs">
          {/* Cover Banner */}
          <div className="relative w-full h-28 bg-zinc-900 overflow-hidden">
            {theme.bannerUrl ? (
              <img
                src={theme.bannerUrl}
                alt="Banner de capa"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor}22 0%, #11141B 100%)`,
                }}
              >
                <UtensilsCrossed className="w-6 h-6 text-zinc-600" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C0F] via-transparent to-black/30" />
          </div>

          {/* Store Info Overlay Card */}
          <div className="px-3 -mt-9 relative z-10">
            <div className={`${styleClasses.card} p-3.5`}>
              <div className="flex items-start gap-2.5">
                {/* Logo */}
                <div
                  className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 border-[#141720] shadow-md flex items-center justify-center font-bold text-lg text-white"
                  style={{
                    backgroundColor: theme.primaryColor,
                  }}
                >
                  {theme.logoUrl ? (
                    <img
                      src={theme.logoUrl}
                      alt={info.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{info.name.charAt(0) || 'B'}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-white text-sm truncate leading-tight">
                    {info.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {info.category}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    {/* Live Open / Closed Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 ${styleClasses.badge} ${
                        openStatus.isOpen
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          openStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                        }`}
                      />
                      <span>{openStatus.statusLabel}</span>
                    </span>

                    <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{openStatus.statusLabel}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery info pills */}
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
                <span className="flex items-center gap-1 truncate">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span>{delivery.estimatedDeliveryTime}</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-mono">
                  <Bike className="w-3 h-3 text-zinc-500" />
                  <span>
                    {delivery.fixedFee > 0
                      ? formatCurrency(delivery.fixedFee)
                      : 'Grátis'}
                  </span>
                </span>
                <span>·</span>
                <span>Mín. {formatCurrency(delivery.minimumOrderValue)}</span>
              </div>
            </div>
          </div>

          {/* Real products only: no sample cards */}
          <div className="px-3 mt-2.5 space-y-2">
            {availableItems.length > 0 ? (
              availableItems.map(item => (
              <div
                key={item.id}
                className={`${styleClasses.card} p-2.5 flex items-start gap-2`}
              >
                {/* Product thumb */}
                <div className="w-14 h-14 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UtensilsCrossed className="w-4 h-4 text-zinc-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-white text-xs truncate">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-white font-mono text-[11px]">
                      {formatCurrency(item.promotionalPrice || item.price)}
                    </span>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-white"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              ))
            ) : (
              <div className="text-center py-8 px-3 text-[11px] text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Nenhum produto disponível no cardápio ainda.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Button Below Phone: Open full storefront preview */}
      {onOpenStorefront && (
        <button
          type="button"
          onClick={onOpenStorefront}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
          <span>Visualizar como cliente (Tela cheia)</span>
        </button>
      )}
    </div>
  );
};
