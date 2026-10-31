import React, { useRef, useState } from 'react';
import { Order, OrderStatus, StoreConfig } from '../../types';
import { formatCurrency } from '../../components/shared';
import { buildWhatsAppUrl, formatPhoneMask } from '../../utils/phone';
import {
  getConfirmationHeadline,
  getCustomerPaymentInstructions,
  getPaymentLabel,
  isPrepaid,
} from '../../utils/paymentRules';
import {
  Bike,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  QrCode,
  Receipt,
  RotateCcw,
  Store,
  Wallet,
  XCircle,
  Navigation,
} from 'lucide-react';

interface OrderConfirmedViewProps {
  order: Order;
  storeConfig: StoreConfig;
  onNewOrder: () => void;
  onViewInMerchant?: () => void;
  primaryColor?: string;
  visualStyle?: 'moderno' | 'minimalista' | 'vibrante';
}

const BRAND_ORANGE = '#FF5500';

/** Customer-facing order status. Never says "aceito" before the merchant does. */
function customerStatusLabel(status: OrderStatus, type: Order['type']): string {
  switch (status) {
    case 'novo':
      return 'Aguardando aceite da loja';
    case 'aceito':
      return 'Aceito pela loja';
    case 'em_preparo':
      return 'Em preparo';
    case 'pronto':
      return type === 'delivery' ? 'Pronto para envio' : 'Pronto para retirada';
    case 'em_entrega':
      return 'Saiu para entrega';
    case 'concluido':
      return type === 'delivery' ? 'Entregue' : 'Retirado';
    case 'cancelado':
      return 'Cancelado';
  }
}

export const OrderConfirmedView: React.FC<OrderConfirmedViewProps> = ({
  order,
  storeConfig,
  onNewOrder,
  onViewInMerchant,
  primaryColor = BRAND_ORANGE,
}) => {
  const { info, delivery } = storeConfig;
  const [copied, setCopied] = useState(false);
  const trackingRef = useRef<HTMLElement>(null);

  const pixKey = storeConfig.payments.pixKey?.trim() || '';
  const instructions = getCustomerPaymentInstructions(order);
  const headline = getConfirmationHeadline(order);
  const paid = order.paymentStatus === 'pago';
  const prepaidPending = isPrepaid(order.paymentTiming) && !paid;
  const cancelled = order.status === 'cancelado';

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('Não foi possível copiar. Selecione a chave PIX exibida.');
    }
  };

  const whatsAppUrl = (() => {
    const base = buildWhatsAppUrl(info.whatsapp);
    if (!base) return null;
    const items = order.items
      .map(i => `• ${i.quantity}x ${i.name}${i.modifiers?.length ? ` (${i.modifiers.map(m => m.name).join(', ')})` : ''}`)
      .join('\n');
    const msg = `*Pedido ${order.displayId}*
Cliente: ${order.customer.name}
WhatsApp: ${formatPhoneMask(order.customer.phone)}

${items}

${order.type === 'delivery' ? 'Entrega' : 'Retirada no balcão'}
*Pagamento:* ${getPaymentLabel(order.paymentMethod, order.paymentTiming)} (${paid ? 'pago' : 'pendente'})${
      order.changeFor ? ` · troco para ${formatCurrency(order.changeFor)}` : ''
    }
*Total: ${formatCurrency(order.total)}*`;
    return `${base}?text=${encodeURIComponent(msg)}`;
  })();

  // Timeline mirrors the real merchant status; it never advances on its own.
  const steps =
    order.type === 'delivery'
      ? [
          { key: 'novo', label: 'Recebido' },
          { key: 'aceito', label: 'Aceito' },
          { key: 'em_preparo', label: 'Em preparo' },
          { key: 'pronto', label: 'Pronto' },
          { key: 'em_entrega', label: 'A caminho' },
          { key: 'concluido', label: 'Entregue' },
        ]
      : [
          { key: 'novo', label: 'Recebido' },
          { key: 'aceito', label: 'Aceito' },
          { key: 'em_preparo', label: 'Em preparo' },
          { key: 'pronto', label: 'Pronto' },
          { key: 'concluido', label: 'Retirado' },
        ];
  const flow: OrderStatus[] =
    order.type === 'delivery'
      ? ['novo', 'aceito', 'em_preparo', 'pronto', 'em_entrega', 'concluido']
      : ['novo', 'aceito', 'em_preparo', 'pronto', 'concluido'];
  const currentFlowIndex = flow.indexOf(order.status);
  const stepIndex = (key: string) => flow.indexOf(key as OrderStatus);

  const eta = order.type === 'delivery' ? delivery.estimatedDeliveryTime : delivery.estimatedPickupTime;
  const card = 'rounded-2xl border border-white/[0.06] bg-[#12151B]';

  return (
    <div className="min-h-full bg-[#0B0D10] text-zinc-200">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 animate-in fade-in duration-300">
        {/* Hero */}
        <header className="text-center sm:text-left sm:flex sm:items-end sm:justify-between gap-6 mb-6">
          <div className="space-y-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                cancelled
                  ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                  : prepaidPending
                  ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                  : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
              }`}
            >
              {cancelled ? <XCircle className="w-3.5 h-3.5" /> : prepaidPending ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{cancelled ? 'Pedido cancelado' : 'Pedido registrado'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">
              {cancelled ? 'Este pedido foi cancelado pela loja.' : headline}
            </h1>
            <p className="text-xs text-zinc-400">
              <span className="text-zinc-200 font-medium">{info.name}</span>
              {eta && !cancelled ? <> · previsão {eta}</> : null}
            </p>
          </div>
          <div className="mt-5 sm:mt-0 sm:text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Pedido</p>
            <p className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums" style={{ color: primaryColor }}>
              {order.displayId}
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* Left column: status + payment */}
          <div className="space-y-4">
            {/* Status chips */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`${card} p-4`}>
                <p className="text-[11px] text-zinc-500 mb-1">Status do pedido</p>
                <p className={`text-sm font-semibold ${cancelled ? 'text-rose-300' : 'text-white'}`}>
                  {customerStatusLabel(order.status, order.type)}
                </p>
              </div>
              <div className={`${card} p-4`}>
                <p className="text-[11px] text-zinc-500 mb-1">Pagamento</p>
                <p className={`text-sm font-semibold ${paid ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {paid ? 'Confirmado pela loja' : 'Pendente'}
                </p>
              </div>
            </div>

            {/* Payment */}
            {!cancelled && (
              <section className={`${card} p-5 space-y-4`} aria-label="Pagamento">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/25 flex items-center justify-center shrink-0">
                    {order.paymentMethod === 'pix' ? (
                      <QrCode className="w-5 h-5 text-[#FF5500]" />
                    ) : (
                      <Wallet className="w-5 h-5 text-[#FF5500]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {getPaymentLabel(order.paymentMethod, order.paymentTiming)}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">{instructions.message}</p>
                  </div>
                </div>

                {instructions.showPixKey &&
                  (pixKey ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-xl bg-[#0B0D10] border border-white/[0.06] p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Chave PIX de {info.name}</p>
                          <p className="text-sm font-mono text-white break-all select-all">{pixKey}</p>
                        </div>
                        <button
                          type="button"
                          onClick={copyPixKey}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Valor: <strong className="text-white">{formatCurrency(order.total)}</strong>
                        {prepaidPending &&
                          ` · Informe o pedido ${order.displayId} à loja. A confirmação é feita pela loja após conferir o recebimento.`}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-300">
                      A chave PIX não está disponível. Não faça outro pedido: fale com a loja e informe o número {order.displayId}.
                    </p>
                  ))}

                {!instructions.showPixKey && !paid && (
                  <p className="text-xs text-zinc-400">
                    Valor a pagar: <strong className="text-white">{formatCurrency(order.total)}</strong>
                    {order.changeFor ? ` · troco para ${formatCurrency(order.changeFor)}` : ''}
                  </p>
                )}
              </section>
            )}

            {/* Tracking */}
            <section ref={trackingRef} className={`${card} p-5 space-y-4 scroll-mt-4`} aria-label="Acompanhamento">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Acompanhamento</h2>
                {!cancelled && eta && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                    <Clock className="w-3 h-3" /> {eta}
                  </span>
                )}
              </div>
              {cancelled ? (
                <p className="text-xs text-rose-300">
                  Motivo: <strong>{order.cancellationReason || 'Cancelado pelo estabelecimento'}</strong>
                </p>
              ) : (
                <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                  {steps.map(step => {
                    const idx = stepIndex(step.key);
                    const done = currentFlowIndex > idx;
                    const current = currentFlowIndex === idx;
                    return (
                      <li key={step.key} className="space-y-1.5 text-center">
                        <div
                          className={`h-1.5 rounded-full ${done ? 'bg-emerald-500' : current ? '' : 'bg-zinc-800'}`}
                          style={current ? { backgroundColor: primaryColor } : undefined}
                        />
                        <span
                          className={`block text-[10px] leading-tight ${
                            current ? 'text-white font-semibold' : done ? 'text-emerald-400' : 'text-zinc-500'
                          }`}
                        >
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {prepaidPending && !cancelled && (
                <p className="text-[11px] text-amber-300/90">O preparo começa somente após a loja confirmar o seu Pix.</p>
              )}
            </section>
          </div>

          {/* Right column: summary */}
          <section className={`${card} p-5 space-y-4 h-fit`} aria-label="Resumo do pedido">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Receipt className="w-4 h-4 text-zinc-400" /> Resumo
            </div>

            <div className="flex items-start gap-2.5 text-xs">
              {order.type === 'delivery' ? (
                <Bike className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
              ) : (
                <Store className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                {order.type === 'delivery' && order.deliveryAddress ? (
                  <>
                    <p className="font-medium text-white">
                      Entrega · {order.deliveryAddress.street}, {order.deliveryAddress.number}
                      {order.deliveryAddress.complement && ` (${order.deliveryAddress.complement})`}
                    </p>
                    <p className="text-zinc-500 text-[11px]">
                      {order.deliveryAddress.neighborhood} · {order.deliveryAddress.city}/{order.deliveryAddress.state}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-white">Retirada no balcão</p>
                    <p className="text-zinc-500 text-[11px] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[info.address, info.city, info.state].filter(Boolean).join(' · ')}
                    </p>
                  </>
                )}
              </div>
            </div>

            <ul className="divide-y divide-white/[0.05] border-y border-white/[0.05]">
              {order.items.map(item => (
                <li key={item.id} className="py-2.5 flex justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-white font-medium">
                      <span className="text-zinc-500 tabular-nums">{item.quantity}x</span> {item.name}
                    </p>
                    {item.modifiers?.length > 0 && (
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {item.modifiers.map(m => (m.total > 0 ? `${m.name} (+${formatCurrency(m.total)})` : m.name)).join(', ')}
                      </p>
                    )}
                    {item.notes && <p className="text-[11px] text-zinc-500 italic mt-0.5">Obs: {item.notes}</p>}
                  </div>
                  <span className="font-mono text-zinc-300 shrink-0 tabular-nums">{formatCurrency(item.totalPrice)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <dt>Subtotal</dt>
                <dd className="font-mono text-zinc-200 tabular-nums">{formatCurrency(order.subtotal)}</dd>
              </div>
              {order.type === 'delivery' && (
                <div className="flex justify-between text-zinc-400">
                  <dt>Entrega</dt>
                  <dd className="font-mono text-zinc-200 tabular-nums">
                    {order.deliveryFee === 0 ? 'Grátis' : formatCurrency(order.deliveryFee)}
                  </dd>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <dt>Desconto</dt>
                  <dd className="font-mono tabular-nums">-{formatCurrency(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-white/[0.05]">
                <dt className="text-sm font-semibold text-white">Total</dt>
                <dd className="text-lg font-bold font-mono tabular-nums" style={{ color: primaryColor }}>
                  {formatCurrency(order.total)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Actions */}
        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => trackingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="py-3 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            style={{ backgroundColor: primaryColor }}
          >
            <Navigation className="w-4 h-4" /> Acompanhar pedido
          </button>
          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl border border-white/[0.08] bg-[#12151B] hover:bg-[#171B23] text-zinc-200 text-sm font-medium flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-[#25D366]" /> Falar com a loja
            </a>
          )}
          <button
            type="button"
            onClick={onNewOrder}
            className="py-3 px-4 rounded-xl border border-white/[0.08] bg-[#12151B] hover:bg-[#171B23] text-zinc-200 text-sm font-medium flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Voltar ao cardápio
          </button>
        </div>

        {/* Merchant preview handoff (only when the panel passes it in) */}
        {onViewInMerchant && (
          <button
            type="button"
            onClick={onViewInMerchant}
            className="mt-4 w-full text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1.5"
          >
            Ver no painel do estabelecimento <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
