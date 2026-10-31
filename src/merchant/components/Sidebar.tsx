import { OrderAcceptanceControl } from './OrderAcceptanceControl';
import React from 'react';
import { MerchantTab } from './BottomNav';
import { RestaurantProfile } from '../../types';
import {
  ClipboardList,
  UtensilsCrossed,
  Store,
  Users,
  BarChart3,
  MoreHorizontal,
  ExternalLink,
  Power,
  Bell,
  Volume2,
  VolumeX,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  activeTab: MerchantTab;
  onChangeTab: (tab: MerchantTab) => void;
  newOrdersCount: number;
  restaurant: RestaurantProfile;
  onToggleStatus: () => void;
  statusDisabled?: boolean;
  statusSaving?: boolean;
  onToggleSound?: () => void;
  onOpenStorefront?: () => void;
  onOpenStoreSwitcher?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  newOrdersCount,
  restaurant,
  onToggleStatus,
  statusDisabled,
  statusSaving,
  onToggleSound,
  onOpenStorefront,
  onOpenStoreSwitcher,
  onLogout,
}) => {
  const mainNav = [
    {
      id: 'pedidos' as MerchantTab,
      label: 'Pedidos',
      icon: ClipboardList,
      badge: newOrdersCount,
    },
    {
      id: 'cardapio' as MerchantTab,
      label: 'Cardápio',
      icon: UtensilsCrossed,
    },
    {
      id: 'clientes' as MerchantTab,
      label: 'Clientes',
      icon: Users,
    },
    {
      id: 'relatorios' as MerchantTab,
      label: 'Relatórios',
      icon: BarChart3,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#0B0D12] border-r border-zinc-850 h-screen sticky top-0 shrink-0 select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-850/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#DD3B00] flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-orange-950/50">
            B
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-extrabold text-white text-base tracking-wide">
              <span>BITEO</span>
              <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
            </div>
            <p className="text-[10px] text-zinc-400 font-medium">Smart orders. Better business.</p>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto no-scrollbar">
        {/* VISÃO GERAL */}
        <div>
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
            Visão Geral
          </span>
          <div className="space-y-1">
            {mainNav.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onChangeTab(item.id)}
                  type="button"
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-950/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {Boolean(item.badge && item.badge > 0) && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-white text-orange-600'
                          : 'bg-[#FF5500] text-white animate-pulse'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* LOJA */}
        <div>
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
            Loja
          </span>
          <div className="space-y-1">
            <button
              onClick={() => onChangeTab('loja')}
              type="button"
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'loja'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-950/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Store className={`w-4 h-4 ${activeTab === 'loja' ? 'text-white' : 'text-zinc-400'}`} />
                <span>Minha Loja</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Loja online publicada" />
            </button>
          </div>
        </div>

        {/* SISTEMA */}
        <div>
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
            Sistema
          </span>
          <div className="space-y-1">
            <button
              onClick={() => onChangeTab('mais')}
              type="button"
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'mais'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-950/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MoreHorizontal
                  className={`w-4 h-4 ${activeTab === 'mais' ? 'text-white' : 'text-zinc-400'}`}
                />
                <span>Mais Opções</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer / Store Identity & Quick Actions */}
      <div className="p-3 border-t border-zinc-850/80 bg-[#0E1016]/90 space-y-2.5">
        {/* Restaurant Card / Store Switcher Trigger */}
        <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenStoreSwitcher}
              className="min-w-0 flex-1 pr-2 text-left group/store cursor-pointer"
              title="Clique para trocar de estabelecimento"
            >
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white group-hover/store:text-orange-400 transition-colors truncate">
                  {restaurant.name}
                </h4>
                <span className="text-[9px] text-zinc-500 font-bold shrink-0">▼</span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate">{restaurant.segment} · Trocar loja</p>
            </button>

            {/* Sound indicator toggle */}
            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                className={`p-1.5 rounded-lg border text-xs transition-colors shrink-0 ${
                  restaurant.soundAlertsEnabled
                    ? 'border-orange-500/30 text-orange-400 bg-orange-500/15'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
                title={restaurant.soundAlertsEnabled ? 'Som ativado' : 'Som desativado'}
              >
                {restaurant.soundAlertsEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          <span role="status" className="text-xs text-zinc-400">{restaurant.isOpen ? 'Loja aberta' : 'Loja fechada'}</span>
        </div>

        {/* Storefront direct button */}
        {onOpenStorefront && (
          <button
            type="button"
            onClick={onOpenStorefront}
            className="w-full py-2 px-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-zinc-750"
          >
            <Store className="w-3.5 h-3.5 text-orange-400" />
            <span>Ver Loja do Consumidor</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </button>
        )}

        {/* Logout action */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-1.5 px-2 text-[11px] text-zinc-400 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            <span>Sair da conta</span>
          </button>
        )}
      </div>
    </aside>
  );
};
