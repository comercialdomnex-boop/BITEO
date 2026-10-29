import React from 'react';
import { Customer, Order } from '../../types';
import {
  Modal,
  Button,
  formatCurrency,
  formatDateTime,
  StatusBadge,
  OrderTypeBadge,
} from '../../components/shared';
import { buildWhatsAppUrl, buildTelUrl, formatPhoneMask } from '../../utils/phone';
import {
  Phone,
  MessageSquare,
  ShoppingBag,
  TrendingUp,
  Calendar,
  MapPin,
  Heart,
  ChevronRight,
  UserCheck,
  Bike,
  Store,
} from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  if (!customer) return null;

  const waUrl = buildWhatsAppUrl(customer.phone);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer.name}
      subtitle={`Cliente ${
        customer.status === 'recorrente' ? 'Recorrente ⭐' : 'Novo'
      } · ${customer.totalOrders} ${
        customer.totalOrders === 1 ? 'pedido realizado' : 'pedidos realizados'
      }`}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>
            Fechar
          </Button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 max-w-xs py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Falar no WhatsApp</span>
          </a>
        </div>
      }
    >
      <div className="space-y-4 text-zinc-100 pb-2">
        {/* Profile & Quick Stats Card */}
        <div className="p-4 rounded-2xl bg-[#141722] border border-zinc-800 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{customer.name}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    customer.status === 'recorrente'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {customer.status === 'recorrente' ? 'Recorrente' : 'Novo Cliente'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {formatPhoneMask(customer.phone)}
              </p>
            </div>

            <a
              href={buildTelUrl(customer.phone)}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
              title="Ligar para o cliente"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800 text-center">
            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                Total Gasto
              </span>
              <span className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
                {formatCurrency(customer.totalSpent)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                Ticket Médio
              </span>
              <span className="text-sm font-bold font-mono text-orange-400 tabular-nums">
                {formatCurrency(
                  customer.averageTicket ??
                    (customer.totalOrders > 0
                      ? customer.totalSpent / customer.totalOrders
                      : 0)
                )}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                Pedidos
              </span>
              <span className="text-sm font-bold font-mono text-white tabular-nums">
                {customer.totalOrders}
              </span>
            </div>
          </div>

          {/* Modality & Item preferences */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-zinc-300 text-[11px]">
              {customer.preferredModality === 'delivery' ? (
                <>
                  <Bike className="w-3.5 h-3.5 text-orange-400" />
                  <span>Prefere Delivery</span>
                </>
              ) : (
                <>
                  <Store className="w-3.5 h-3.5 text-sky-400" />
                  <span>Prefere Retirada</span>
                </>
              )}
            </div>

            {customer.favoriteItem && (
              <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-zinc-300 text-[11px] truncate max-w-xs">
                <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">
                  Favorito: <strong className="text-white">{customer.favoriteItem}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Dates */}
        <div className="p-3.5 rounded-2xl bg-[#141722] border border-zinc-800 grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase">Primeiro Pedido</span>
              <span className="font-medium text-zinc-200">
                {formatDateTime(customer.firstOrderDate)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase">Último Pedido</span>
              <span className="font-medium text-zinc-200">
                {formatDateTime(customer.lastOrderDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Addresses Used */}
        {Boolean(customer.addresses && customer.addresses.length > 0) && (
          <div className="p-3.5 rounded-2xl bg-[#141722] border border-zinc-800 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-400" />
              <span>Endereços Utilizados ({customer.addresses?.length})</span>
            </span>
            <div className="space-y-1.5">
              {customer.addresses?.map((addr, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2"
                >
                  <span className="text-zinc-500 font-mono text-[10px] mt-0.5">#{idx + 1}</span>
                  <p className="flex-1 leading-relaxed">{addr}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-orange-400" />
              <span>Histórico de Pedidos ({customer.orders?.length || 0})</span>
            </span>
            <span className="text-[11px] text-zinc-500">Clique para abrir detalhes</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar pr-1">
            {(customer.orders || []).map(order => (
              <div
                key={order.id}
                onClick={() => {
                  onSelectOrder(order);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    onSelectOrder(order);
                  }
                }}
                className="p-3 rounded-2xl bg-[#141722] hover:bg-[#1a1f2e] border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">
                      {order.displayId}
                    </span>
                    <OrderTypeBadge type={order.type} />
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    {formatDateTime(order.createdAt)} · {order.itemsCount}{' '}
                    {order.itemsCount === 1 ? 'item' : 'itens'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">
                    {formatCurrency(order.total)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
