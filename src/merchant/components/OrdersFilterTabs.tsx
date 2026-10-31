import React from 'react';
import { OrderStatus, OrderType } from '../../types';
import { Bike, ShoppingBag } from 'lucide-react';

interface OrdersFilterTabsProps {
  currentStatus: OrderStatus | 'todos';
  onSelectStatus: (status: OrderStatus | 'todos') => void;
  currentType: OrderType | 'todos';
  onSelectType: (type: OrderType | 'todos') => void;
  statusCounts: {
    todos: number;
    novo: number;
    em_preparo: number;
    pronto: number;
    em_entrega: number;
    concluido: number;
    cancelado: number;
  };
}

export const OrdersFilterTabs: React.FC<OrdersFilterTabsProps> = ({
  currentStatus,
  onSelectStatus,
  currentType,
  onSelectType,
  statusCounts,
}) => {
  const statusTabs: { id: OrderStatus | 'todos'; label: string; count: number; badgeColor?: string }[] = [
    { id: 'todos', label: 'Todos', count: statusCounts.todos },
    { id: 'novo', label: 'Novos', count: statusCounts.novo, badgeColor: 'bg-orange-500' },
    { id: 'em_preparo', label: 'Em Preparo', count: statusCounts.em_preparo, badgeColor: 'bg-amber-500' },
    { id: 'pronto', label: 'Prontos', count: statusCounts.pronto, badgeColor: 'bg-emerald-500' },
    { id: 'em_entrega', label: 'Em Entrega', count: statusCounts.em_entrega, badgeColor: 'bg-sky-500' },
    { id: 'concluido', label: 'Concluídos', count: statusCounts.concluido },
    { id: 'cancelado', label: 'Cancelados', count: statusCounts.cancelado },
  ];

  return (
    <div className="space-y-2.5">
      {/* Horizontal status filter scroller */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {statusTabs.map(tab => {
          const isActive = currentStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectStatus(tab.id)}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-all select-none ${
                isActive
                  ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                  : 'bg-[#14171E] text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                  isActive
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary filter: Delivery vs Retirada */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-850/60">
        <span className="text-[11px] font-medium text-zinc-400">Modalidade:</span>
        <div className="flex items-center gap-1 p-0.5 bg-[#12141A] rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => onSelectType('todos')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              currentType === 'todos'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => onSelectType('delivery')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              currentType === 'delivery'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bike className="w-3 h-3" />
            <span>Delivery</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectType('retirada')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              currentType === 'retirada'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShoppingBag className="w-3 h-3" />
            <span>Retirada</span>
          </button>
        </div>
      </div>
    </div>
  );
};
