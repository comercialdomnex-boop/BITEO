import React from 'react';
import { Order, StoreConfig } from '../../types';
import { formatCurrency, getPaymentMethodLabel, StatusBadge } from '../../components/shared';
import { buildWhatsAppUrl, formatPhoneMask } from '../../utils/phone';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Bike,
  Store,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface OrderConfirmedViewProps {
  order: Order;
  storeConfig: StoreConfig;
  onNewOrder: () => void;
  onViewInMerchant?: () => void;
  primaryColor?: string;
  visualStyle?: 'moderno' | 'minimalista' | 'vibrante';
}

export const OrderConfirmedView: React.FC<OrderConfirmedViewProps> = ({
  order,
  storeConfig,
  onNewOrder,
  onViewInMerchant,
  primaryColor = '#FF5500',
  visualStyle = 'moderno',
}) => {
  const { info, delivery } = storeConfig;

  // Format WhatsApp message
  const generateWhatsAppMessage = () => {
    const itemsText = order.items
      .map(
        i =>
          `• ${i.quantity}x ${i.name}${
            i.modifiers && i.modifiers.length > 0
              ? ` (${i.modifiers.map(m => m.name).join(', ')})`
              : ''
          }`
      )
      .join('\n');

    const addressText =
      order.type === 'delivery' && order.deliveryAddress
        ? `📍 Entrega: ${order.deliveryAddress.street}, ${order.deliveryAddress.number} - ${order.deliveryAddress.neighborhood}, ${order.deliveryAddress.city} - ${order.deliveryAddress.state}`
        : '🏬 Retirada no Balcão';

    const msg = `*NOVO PEDIDO ${order.displayId} - BITEO*
Cliente: ${order.customer.name}
WhatsApp: ${formatPhoneMask(order.customer.phone)}

*Itens:*
${itemsText}

${addressText}
*Pagamento:* ${getPaymentMethodLabel(order.paymentMethod)}${
      order.changeFor ? ` (Troco para ${formatCurrency(order.changeFor)})` : ''
    }
*Total: ${formatCurrency(order.total)}*

Acompanhando pelo Biteo!`;

    const waBase = buildWhatsAppUrl(info.whatsapp) || 'https://wa.me/5511988887777';
    return `${waBase}?text=${encodeURIComponent(msg)}`;
  };

  const getStyleClasses = () => {
    switch (visualStyle) {
      case 'minimalista':
        return {
          card: 'rounded-xl border border-zinc-800 bg-[#12141C]',
          button: 'rounded-lg font-medium',
        };
      case 'vibrante':
        return {
          card: 'rounded-2xl border-2 border-zinc-750 bg-[#151926]',
          button: 'rounded-2xl font-bold shadow-lg',
        };
      case 'moderno':
      default:
        return {
          card: 'rounded-2xl border border-zinc-800 bg-[#141722]',
          button: 'rounded-xl font-semibold shadow-md',
        };
    }
  };

  const styles = getStyleClasses();

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Success Badge & Headline */}
      <div className="text-center space-y-3">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center animate-pulse">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
          </span>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pedido Confirmado com Sucesso!</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            Pedido {order.displayId}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Recebido por <strong className="text-zinc-200">{info.name}</strong>.
            A cozinha já está com o seu pedido!
          </p>
        </div>
      </div>

      {/* Storefront to Merchant handoff for a real order */}
      {onViewInMerchant && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/40 via-orange-900/20 to-zinc-900 border border-orange-500/40 shadow-lg text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-orange-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              Integração Storefront → Merchant Ativa
            </span>
            <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-[10px] font-mono">
              Biteo Sync
            </span>
          </div>
          <p className="text-zinc-300 leading-relaxed text-[11px]">
            Este pedido já foi inserido automaticamente no <strong>Dashboard de Pedidos</strong> do estabelecimento. Você pode alternar para o painel administrativo agora mesmo para vê-lo chegar em tempo real!
          </p>
          <button
            type="button"
            onClick={onViewInMerchant}
            className="w-full py-2.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
          >
            <span>Ver este Pedido no Painel do Estabelecimento</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Order Timeline */}
      {order.status === 'cancelado' ? (
        <div className={`p-4 rounded-2xl border border-rose-500/40 bg-rose-950/20 text-rose-200 space-y-2`}>
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>Este pedido foi cancelado</span>
          </div>
          <p className="text-xs text-rose-300/90 leading-relaxed">
            Motivo informado:{' '}
            <strong>{order.cancellationReason || 'Cancelado pelo estabelecimento'}</strong>
          </p>
          <p className="text-[11px] text-zinc-400">
            Dúvidas? Entre em contato diretamente com a loja pelo WhatsApp.
          </p>
        </div>
      ) : (
        <div className={`p-4 ${styles.card} space-y-4`}>
          <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-300">
              <Clock className="w-4 h-4 text-orange-400" />
              <span>
                Previsão:{' '}
                <strong className="text-white">
                  {order.type === 'delivery'
                    ? delivery.estimatedDeliveryTime || 'prazo não informado'
                    : delivery.estimatedPickupTime || 'prazo não informado'}
                </strong>
              </span>
            </div>
            <StatusBadge status={order.status} orderType={order.type} size="sm" />
          </div>

          {/* Progress steps corresponding to Merchant state */}
          {(() => {
            const getStepIndex = (): number => {
              switch (order.status) {
                case 'novo':
                  return 0;
                case 'aceito':
                case 'em_preparo':
                  return 1;
                case 'pronto':
                case 'em_entrega':
                  return 2;
                case 'concluido':
                  return 3;
                default:
                  return 0;
              }
            };
            const currentStep = getStepIndex();
            const stepLabels = [
              'Recebido',
              'Em Preparo',
              order.type === 'delivery' ? 'Em Rota' : 'Pronto',
              order.type === 'delivery' ? 'Entregue' : 'Retirado',
            ];

            return (
              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                {stepLabels.map((lbl, idx) => {
                  const isDone = idx < currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div key={lbl} className="space-y-1">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isDone
                            ? 'bg-emerald-500'
                            : isCurrent
                            ? 'animate-pulse'
                            : 'bg-zinc-800'
                        }`}
                        style={{
                          backgroundColor: isCurrent ? primaryColor : undefined,
                        }}
                      />
                      <span
                        className={`text-[10px] block ${
                          isCurrent
                            ? 'font-bold text-white'
                            : isDone
                            ? 'text-emerald-400 font-medium'
                            : 'text-zinc-500'
                        }`}
                      >
                        {lbl}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Order Details Card */}
      <div className={`p-4 ${styles.card} space-y-3.5 text-xs text-zinc-300`}>
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
          <div>
            <h4 className="font-bold text-white text-sm">{order.customer.name}</h4>
            <p className="text-zinc-400 font-mono mt-0.5">
              {formatPhoneMask(order.customer.phone)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-white">
            {order.type === 'delivery' ? (
              <>
                <Bike className="w-3.5 h-3.5 text-orange-400" />
                <span>Delivery</span>
              </>
            ) : (
              <>
                <Store className="w-3.5 h-3.5 text-sky-400" />
                <span>Retirada</span>
              </>
            )}
          </div>
        </div>

        {/* Destination Address */}
        <div className="flex items-start gap-2.5 text-xs">
          <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            {order.type === 'delivery' && order.deliveryAddress ? (
              <>
                <p className="font-semibold text-white">
                  {order.deliveryAddress.street}, {order.deliveryAddress.number}
                  {order.deliveryAddress.complement &&
                    ` (${order.deliveryAddress.complement})`}
                </p>
                <p className="text-zinc-400 text-[11px]">
                  {order.deliveryAddress.neighborhood} - {order.deliveryAddress.city} -{' '}
                  {order.deliveryAddress.state}
                </p>
                {order.deliveryAddress.reference && (
                  <p className="text-[11px] text-zinc-500 italic mt-0.5">
                    Ref: {order.deliveryAddress.reference}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold text-white">Retirada no Balcão</p>
                <p className="text-zinc-400 text-[11px]">
                  {info.address} - {info.city} - {info.state}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="pt-2 border-t border-zinc-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
            Itens Solicitados
          </span>
          <div className="space-y-2">
            {order.items.map(item => (
              <div key={item.id} className="flex justify-between items-start text-xs">
                <div>
                  <span className="font-medium text-white">
                    {item.quantity}x {item.name}
                  </span>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {item.modifiers.map(m => m.name).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-zinc-500 italic mt-0.5">
                      Obs: {item.notes}
                    </p>
                  )}
                </div>
                <span className="font-mono text-zinc-300 font-semibold shrink-0">
                  {formatCurrency(item.totalPrice)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Recap */}
        <div className="pt-3 border-t border-zinc-800 space-y-1.5 text-xs">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal</span>
            <span className="font-mono text-white">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Taxa de Entrega</span>
            <span className="font-mono text-white">
              {order.deliveryFee === 0 ? 'Grátis' : formatCurrency(order.deliveryFee)}
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Forma de Pagamento</span>
            <span className="font-semibold text-white">
              {getPaymentMethodLabel(order.paymentMethod)}
              {order.changeFor && ` (Troco p/ ${formatCurrency(order.changeFor)})`}
            </span>
          </div>
          <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline font-bold text-white">
            <span className="text-sm">Total Pago / A Pagar</span>
            <span
              className="text-base font-mono tabular-nums"
              style={{ color: primaryColor }}
            >
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5">
        {/* WhatsApp Link */}
        <a
          href={generateWhatsAppMessage()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-4 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Enviar Cópia do Pedido pelo WhatsApp</span>
        </a>

        {/* New Order Button */}
        <button
          type="button"
          onClick={onNewOrder}
          className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Fazer Novo Pedido / Voltar ao Cardápio</span>
        </button>
      </div>
    </div>
  );
};
