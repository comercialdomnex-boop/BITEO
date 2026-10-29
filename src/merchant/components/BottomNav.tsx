import React from 'react';
import {
  ClipboardList,
  UtensilsCrossed,
  Store,
  Users,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';

export type MerchantTab =
  | 'pedidos'
  | 'cardapio'
  | 'loja'
  | 'clientes'
  | 'relatorios'
  | 'mais';

interface BottomNavProps {
  activeTab: MerchantTab;
  onChangeTab: (tab: MerchantTab) => void;
  newOrdersCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  newOrdersCount = 0,
}) => {
  const navItems: {
    id: MerchantTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'pedidos',
      label: 'Pedidos',
      icon: ClipboardList,
      badge: newOrdersCount,
    },
    {
      id: 'cardapio',
      label: 'Cardápio',
      icon: UtensilsCrossed,
    },
    {
      id: 'loja',
      label: 'Minha Loja',
      icon: Store,
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: Users,
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: BarChart3,
    },
    {
      id: 'mais',
      label: 'Mais',
      icon: MoreHorizontal,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E1015]/95 backdrop-blur-lg border-t border-zinc-800/80 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-1.5 transition-all"
      aria-label="Navegação Principal do Estabelecimento"
    >
      <div className="max-w-xl mx-auto grid grid-cols-6 items-center px-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              type="button"
              className={`relative flex flex-col items-center justify-center min-h-[48px] py-1 px-0.5 rounded-xl transition-all duration-150 select-none ${
                isActive
                  ? 'text-orange-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4.5 h-4.5 transition-transform ${
                    isActive ? 'scale-110 text-[#FF5500]' : 'text-zinc-400'
                  }`}
                />
                {/* Badge for new orders or notifications */}
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 bg-[#FF5500] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[#0E1015] animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] tracking-tight mt-1 truncate max-w-full ${
                  isActive ? 'text-white font-medium' : 'text-zinc-400'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1 rounded-full bg-[#FF5500] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
