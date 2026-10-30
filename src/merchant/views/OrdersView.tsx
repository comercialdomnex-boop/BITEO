import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, OrderType } from '../../types';
import { OrderService } from '../../services/orderService';
import { OrdersMetricsBar } from '../components/OrdersMetricsBar';
import { OrdersFilterTabs } from '../components/OrdersFilterTabs';
import { OrderCard } from '../components/OrderCard';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { SearchInput, Button } from '../../components/shared';
import { phoneIdentity } from '../../utils/phone';
import { Plus, RefreshCw, ShoppingBag } from 'lucide-react';

interface OrdersViewProps {
  orders: Order[];
  onOrdersChange: (orders: Order[]) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onOrdersChange,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'todos'>('todos');
  const [selectedType, setSelectedType] = useState<OrderType | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalOrder, setActiveModalOrder] = useState<Order | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Compute metrics from current state
  const metrics = useMemo(() => {
    return OrderService.computeMetrics(orders);
  }, [orders]);

  // Counts for tabs
  const statusCounts = useMemo(() => {
    return {
      todos: orders.length,
      novo: orders.filter(o => o.status === 'novo').length,
      em_preparo: orders.filter(o => o.status === 'em_preparo').length,
      em_entrega: orders.filter(o => o.status === 'em_entrega').length,
      concluido: orders.filter(o => o.status === 'concluido').length,
      cancelado: orders.filter(o => o.status === 'cancelado').length,
    };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (selectedStatus !== 'todos' && order.status !== selectedStatus) {
        return false;
      }
      // Type filter
      if (selectedType !== 'todos' && order.type !== selectedType) {
        return false;
      }
      // Search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.displayId.toLowerCase().includes(q);
        const matchesCustomer = order.customer.name.toLowerCase().includes(q);
        const queryDigits = q.replace(/\D/g, '');
        const matchesPhone =
          queryDigits.length > 0 &&
          phoneIdentity(order.customer.phone).includes(queryDigits);
        const matchesItem = order.items.some(item =>
          item.name.toLowerCase().includes(q)
        );
        const matchesAddress =
          order.deliveryAddress?.street.toLowerCase().includes(q) ||
          order.deliveryAddress?.neighborhood.toLowerCase().includes(q);

        return matchesId || matchesCustomer || matchesPhone || matchesItem || matchesAddress;
      }
      return true;
    });
  }, [orders, selectedStatus, selectedType, searchQuery]);

  const handleUpdateStatus = async (orderOrId: string | Order, newStatus: OrderStatus) => {
    const orderId = typeof orderOrId === 'string' ? orderOrId : orderOrId.id;
    try {
      const updated = await OrderService.updateOrderStatus(orderId, newStatus);
      const nextList = orders.map(o => (o.id === orderId ? updated : o));
      onOrdersChange(nextList);

      // Keep modal order in sync if open
      if (activeModalOrder && activeModalOrder.id === orderId) {
        setActiveModalOrder(updated);
      }
      setStatusError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível alterar o status do pedido.';
      setStatusError(message);
      setTimeout(() => setStatusError(null), 4000);
    }
  };

  const handlePaymentConfirmed = (orderId: string) => {
    const nextOrders = orders.map(order => order.id === orderId ? { ...order, paymentStatus: 'pago' as const } : order);
    onOrdersChange(nextOrders);
    setActiveModalOrder(current => current?.id === orderId ? { ...current, paymentStatus: 'pago' } : current);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Metrics Bar */}
      <OrdersMetricsBar
        metrics={metrics}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
      />

      {/* State Machine Transition Error Toast */}
      {statusError && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
          <span>{statusError}</span>
          <button
            type="button"
            onClick={() => setStatusError(null)}
            className="text-[11px] underline text-rose-400 hover:text-white"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Control Row: Search & Refresh */}
      <div className="flex items-center gap-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por #pedido, cliente, item..."
          className="flex-1"
        />

        <button
          type="button"
          onClick={handleRefresh}
          className={`p-2.5 rounded-xl bg-[#13161C] border border-zinc-800 text-zinc-400 hover:text-white transition-colors ${
            isRefreshing ? 'animate-spin text-orange-400' : ''
          }`}
          title="Atualizar lista"
          aria-label="Atualizar lista"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <OrdersFilterTabs
        currentStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        currentType={selectedType}
        onSelectType={setSelectedType}
        statusCounts={statusCounts}
      />

      {/* List Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">
            Pedidos Recentes
          </h3>
          <span className="text-xs text-zinc-400 font-mono">
            ({filteredOrders.length})
          </span>
        </div>

        {(selectedStatus !== 'todos' || selectedType !== 'todos' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('todos');
              setSelectedType('todos');
              setSearchQuery('');
            }}
            className="text-xs text-orange-400 hover:text-orange-300 font-medium"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={setActiveModalOrder}
              onQuickAdvanceStatus={handleUpdateStatus}
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-[#12141A] border border-dashed border-zinc-800 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto border border-orange-500/20">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-bold text-zinc-100 mb-1">
              Sua loja ainda não possui pedidos
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Quando seus clientes fizerem pedidos pelo cardápio online, eles aparecerão aqui em tempo real com alerta sonoro e comanda para a cozinha.
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 px-4 rounded-2xl bg-[#12141A] border border-dashed border-zinc-800">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-200 mb-1">
            Nenhum pedido encontrado
          </h4>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto mb-4">
            Não há pedidos para os filtros selecionados no momento.
          </p>
          {(selectedStatus !== 'todos' || selectedType !== 'todos' || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedStatus('todos');
                setSelectedType('todos');
                setSearchQuery('');
              }}
            >
              Ver todos os pedidos
            </Button>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <OrderDetailModal
        order={activeModalOrder}
        isOpen={Boolean(activeModalOrder)}
        onClose={() => setActiveModalOrder(null)}
        onUpdateStatus={handleUpdateStatus}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </div>
  );
};
