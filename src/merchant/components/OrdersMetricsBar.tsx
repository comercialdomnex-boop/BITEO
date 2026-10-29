import React from 'react';
import { OrdersDashboardMetrics, OrderStatus } from '../../types';
import { StatCard } from '../../components/shared/StatCard';
import {
  ShoppingBag,
  BellRing,
  ChefHat,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '../../components/shared/formatters';

interface OrdersMetricsBarProps {
  metrics: OrdersDashboardMetrics;
  selectedStatus: OrderStatus | 'todos';
  onSelectStatus: (status: OrderStatus | 'todos') => void;
}

export const OrdersMetricsBar: React.FC<OrdersMetricsBarProps> = ({
  metrics,
  selectedStatus,
  onSelectStatus,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Visão Geral de Hoje
        </h2>
        <span className="text-[11px] font-mono text-zinc-400">
          Faturamento: <strong className="text-white font-semibold">{formatCurrency(metrics.grossSalesToday)}</strong>
        </span>
      </div>

      {/* Grid of 5 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Total Hoje */}
        <StatCard
          label="Pedidos de Hoje"
          count={metrics.totalToday}
          subtext={`Ticket ${formatCurrency(metrics.averageTicket)}`}
          icon={<ShoppingBag className="w-4 h-4 text-zinc-400" />}
          highlightColor="zinc"
          isActive={selectedStatus === 'todos'}
          onClick={() => onSelectStatus('todos')}
        />

        {/* Novos */}
        <StatCard
          label="Novos"
          count={metrics.newOrdersCount}
          icon={<BellRing className="w-4 h-4 text-orange-400" />}
          highlightColor="orange"
          isActive={selectedStatus === 'novo'}
          onClick={() => onSelectStatus('novo')}
        />

        {/* Em Preparo */}
        <StatCard
          label="Em Preparo"
          count={metrics.inPrepCount}
          icon={<ChefHat className="w-4 h-4 text-amber-400" />}
          highlightColor="amber"
          isActive={selectedStatus === 'em_preparo'}
          onClick={() => onSelectStatus('em_preparo')}
        />

        {/* Em Entrega */}
        <StatCard
          label="Em Entrega"
          count={metrics.inDeliveryCount}
          icon={<Truck className="w-4 h-4 text-sky-400" />}
          highlightColor="sky"
          isActive={selectedStatus === 'em_entrega'}
          onClick={() => onSelectStatus('em_entrega')}
        />

        {/* Concluídos */}
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            label="Concluídos"
            count={metrics.completedCount}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            highlightColor="emerald"
            isActive={selectedStatus === 'concluido'}
            onClick={() => onSelectStatus('concluido')}
          />
        </div>
      </div>
    </div>
  );
};
