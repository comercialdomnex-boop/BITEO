import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '../../types';
import { fromCents, sumCents, toCents } from '../../utils/money';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Agora mesmo';
  if (diffInMinutes === 1) return 'Há 1 min';
  if (diffInMinutes < 60) return `Há ${diffInMinutes} min`;

  const hours = Math.floor(diffInMinutes / 60);
  const remainingMins = diffInMinutes % 60;
  if (hours < 24) {
    return remainingMins > 0 ? `Há ${hours}h ${remainingMins}m` : `Há ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `Há ${days}d`;
}

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function getStatusInfo(status: OrderStatus, orderType: OrderType = 'delivery'): {
  label: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
  pulsing?: boolean;
} {
  switch (status) {
    case 'novo':
      return {
        label: 'Novo Pedido',
        badgeBg: 'bg-orange-500/10',
        textColor: 'text-orange-400',
        borderColor: 'border-orange-500/30',
        dotColor: 'bg-orange-500',
        pulsing: true,
      };
    case 'aceito':
      return {
        label: 'Aceito',
        badgeBg: 'bg-indigo-500/10',
        textColor: 'text-indigo-400',
        borderColor: 'border-indigo-500/30',
        dotColor: 'bg-indigo-400',
      };
    case 'em_preparo':
      return {
        label: 'Em Preparo',
        badgeBg: 'bg-amber-500/10',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        dotColor: 'bg-amber-400',
      };
    case 'pronto':
      return {
        label: orderType === 'delivery' ? 'Pronto p/ Envio' : 'Pronto p/ Retirada',
        badgeBg: 'bg-purple-500/10',
        textColor: 'text-purple-400',
        borderColor: 'border-purple-500/30',
        dotColor: 'bg-purple-400',
      };
    case 'em_entrega':
      return {
        label: orderType === 'delivery' ? 'Saiu p/ Entrega' : 'Pronto p/ Retirar',
        badgeBg: 'bg-sky-500/10',
        textColor: 'text-sky-400',
        borderColor: 'border-sky-500/30',
        dotColor: 'bg-sky-400',
      };
    case 'concluido':
      return {
        label: orderType === 'delivery' ? 'Entregue' : 'Retirado',
        badgeBg: 'bg-emerald-500/10',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        dotColor: 'bg-emerald-400',
      };
    case 'cancelado':
      return {
        label: 'Cancelado',
        badgeBg: 'bg-rose-950/40',
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/30',
        dotColor: 'bg-rose-500',
      };
  }
}

export function getOrderTypeInfo(type: OrderType): {
  label: string;
  shortLabel: string;
  iconName: string;
} {
  if (type === 'delivery') {
    return {
      label: 'Delivery',
      shortLabel: 'Entrega',
      iconName: 'bike',
    };
  }
  return {
    label: 'Retirada no Balcão',
    shortLabel: 'Retirada',
    iconName: 'bag',
  };
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'pix':
      return 'PIX Instantâneo';
    case 'cartao_credito':
      return 'Cartão de Crédito';
    case 'cartao_debito':
      return 'Cartão de Débito';
    case 'dinheiro':
      return 'Dinheiro em Espécie';
  }
}

export function getPaymentStatusInfo(status: PaymentStatus): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'pago':
      return {
        label: 'Pagamento confirmado',
        colorClass: 'text-emerald-400',
      };
    case 'falhou':
      return {
        label: 'Pagamento recusado',
        colorClass: 'text-rose-400',
      };
    case 'reembolsado':
      return {
        label: 'Pagamento reembolsado',
        colorClass: 'text-zinc-400',
      };
    case 'pendente':
    default:
      return {
        label: 'Pagamento pendente',
        colorClass: 'text-amber-400',
      };
  }
}

export interface CartCalculationResult {
  subtotal: number;
  isFreeDelivery: boolean;
  deliveryFee: number;
  total: number;
  minimumOrder: number;
  isBelowMinimum: boolean;
  missingForMinimum: number;
  canProceed: boolean;
}

/**
 * Cart totals. The minimum order has a single source of truth:
 * `deliverySettings.minimumOrderValue`. There is no secondary fallback.
 */
export function calculateCartTotals(
  cartItems: { totalPrice: number }[],
  deliverySettings: {
    fixedFee: number;
    freeDeliveryThreshold?: number;
    minimumOrderValue: number;
  },
  modality: OrderType
): CartCalculationResult {
  const subtotalCents = sumCents(cartItems.map(item => item.totalPrice));
  const subtotal = fromCents(subtotalCents);
  const freeThresholdCents = toCents(deliverySettings.freeDeliveryThreshold || 0);
  const isFreeDelivery =
    freeThresholdCents > 0 &&
    subtotalCents >= freeThresholdCents &&
    modality === 'delivery';

  const deliveryFeeCents =
    modality === 'delivery'
      ? isFreeDelivery
        ? 0
        : toCents(deliverySettings.fixedFee)
      : 0;
  const deliveryFee = fromCents(deliveryFeeCents);
  const total = fromCents(subtotalCents + deliveryFeeCents);

  const minimumOrderCents = toCents(deliverySettings.minimumOrderValue || 0);
  const minimumOrder = fromCents(minimumOrderCents);
  const isBelowMinimum = modality === 'delivery' && subtotalCents < minimumOrderCents;
  const missingForMinimum = isBelowMinimum
    ? fromCents(minimumOrderCents - subtotalCents)
    : 0;
  const canProceed = cartItems.length > 0 && !isBelowMinimum;

  return {
    subtotal,
    isFreeDelivery,
    deliveryFee,
    total,
    minimumOrder,
    isBelowMinimum,
    missingForMinimum,
    canProceed,
  };
}
