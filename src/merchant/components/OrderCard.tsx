import React from 'react';
import { Order, OrderStatus } from '../../types';
import { OrderService } from '../../services/orderService';
import {
  StatusBadge,
  OrderTypeBadge,
  formatCurrency,
  formatTimeAgo,
} from '../../components/shared';
import { ChevronRight, Clock, MapPin, AlertCircle, XCircle } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onClick: (order: Order) => void;
  onQuickAdvanceStatus?: (order: Order, nextStatus: OrderStatus) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onClick,
  onQuickAdvanceStatus,
}) => {
  const nextStatus = OrderService.getNextStatus(order.status, order.type);
  const quickActionLabel = OrderService.getStatusActionLabel(order.status, order.type);

  const isNew = order.status === 'novo';
  const isCancelled = order.status === 'cancelado';

  return (
    <div
      onClick={() => onClick(order)}
      className={`group relative w-full text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none bg-[#13161D] hover:bg-[#171B24] active:scale-[0.99] ${
        isNew
          ? 'border-orange-500/50 shadow-lg shadow-orange-950/20'
          : isCancelled
          ? 'border-zinc-850 opacity-60'
          : 'border-zinc-800/80 hover:border-zinc-700'
      }`}
    >
      {/* Top Bar: Order ID, Time Ago & Status Badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-base tracking-tight font-mono">
            {order.displayId}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>{formatTimeAgo(order.createdAt)}</span>
          </div>
        </div>

        <StatusBadge status={order.status} orderType={order.type} size="sm" />
      </div>

      {/* Customer & Order Type */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-zinc-100 truncate">
            {order.customer.name}
          </span>
          {order.customer.isFirstOrder && (
            <span className="text-[10px] text-orange-400/90 font-medium px-1.5 py-0.2 rounded bg-orange-500/10 border border-orange-500/20 shrink-0">
              1º Pedido
            </span>
          )}
        </div>
        <OrderTypeBadge type={order.type} />
      </div>

      {/* Items Preview */}
      <div className="py-2 px-2.5 my-2 rounded-xl bg-[#0C0E12] border border-zinc-850/60 text-xs text-zinc-300">
        <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium mb-1">
          <span>{order.itemsCount} {order.itemsCount === 1 ? 'item' : 'itens'}</span>
          <span className="text-zinc-500 text-[10px]">Ver detalhes</span>
        </div>
        <p className="line-clamp-2 text-zinc-300 text-xs leading-relaxed">
          {order.items.map((item, idx) => (
            <span key={item.id}>
              {item.quantity}x {item.name}
              {idx < order.items.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </div>

      {/* Neighborhood / Address info */}
      {order.type === 'delivery' && order.deliveryAddress && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2.5 truncate">
          <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="truncate">
            {order.deliveryAddress.neighborhood} - {order.deliveryAddress.street}
          </span>
        </div>
      )}

      {/* General Notes if present */}
      {order.generalNotes && (
        <div className="flex items-start gap-1 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1 mb-2.5">
          <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
          <span className="line-clamp-1 italic">{order.generalNotes}</span>
        </div>
      )}

      {/* Cancellation Reason if cancelled */}
      {order.status === 'cancelado' && order.cancellationReason && (
        <div className="flex items-start gap-1 text-[11px] text-rose-300/90 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1 mb-2.5">
          <XCircle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
          <span className="line-clamp-1">Motivo: {order.cancellationReason}</span>
        </div>
      )}

      {/* Bottom Row: Total Value + Quick Action Button */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-850">
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
            Total
          </span>
          <span className="text-base font-bold text-white font-mono tabular-nums">
            {formatCurrency(order.total)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {nextStatus && onQuickAdvanceStatus && (
            <button
              onClick={e => {
                e.stopPropagation();
                onQuickAdvanceStatus(order, nextStatus);
              }}
              type="button"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                order.status === 'novo'
                  ? 'bg-[#FF5500] hover:bg-[#FF661A] text-white shadow-md shadow-orange-950/40 active:scale-95'
                  : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700/80 active:scale-95'
              }`}
            >
              {quickActionLabel}
            </button>
          )}

          <div className="p-1 rounded-lg text-zinc-400 group-hover:text-zinc-300 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
