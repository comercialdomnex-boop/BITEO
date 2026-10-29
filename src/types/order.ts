import { fromCents, sumCents, toCents } from '../utils/money';

export type OrderStatus =
  | 'novo'
  | 'aceito'
  | 'em_preparo'
  | 'pronto'
  | 'em_entrega'
  | 'concluido'
  | 'cancelado';

export type OrderType = 'delivery' | 'retirada';

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';

/**
 * Neutral payment state. `pendente` means "no money confirmed yet" and never
 * implies a specific settlement channel (PIX, card or cash on delivery).
 */
export type PaymentStatus = 'pendente' | 'pago' | 'falhou' | 'reembolsado';

/**
 * Snapshot of a selected modifier option. It intentionally duplicates the menu
 * values so a historical order can be rendered/repriced even after the menu
 * changes or the option is deleted.
 */
export interface OrderItemModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
}
export type OrderItemOption = OrderItemModifier;

export interface OrderItem {
  id: string;
  /** Menu product this snapshot came from. */
  productId: string;
  name: string;
  quantity: number;
  /** Product price before modifiers. */
  basePrice: number;
  /** basePrice + sum(modifiers.total). */
  unitPrice: number;
  /** unitPrice * quantity. */
  totalPrice: number;
  notes?: string;
  modifiers: OrderItemModifier[];
  imageUrl?: string;
}

export interface OrderCustomer {
  id: string;
  name: string;
  /** Canonical E.164 without separators, e.g. "+5511999999999". */
  phone: string;
  email?: string;
  isFirstOrder?: boolean;
}

export interface OrderDeliveryAddress {
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  reference?: string;
  city: string;
  /** Brazilian federative unit (UF). Kept separate from `city`. */
  state: string;
  zipCode?: string;
}
export type DeliveryAddress = OrderDeliveryAddress;

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  timestamp: string;
  label: string;
  note?: string;
}
export type OrderStatusHistory = OrderStatusHistoryItem[];

export interface Order {
  id: string;
  displayId: string; // ex: #1049
  orderNumber?: number;
  customer: OrderCustomer;
  items: OrderItem[];
  itemsCount: number;
  type: OrderType;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  changeFor?: number;
  createdAt: string; // ISO string
  estimatedTimeMin?: number;
  deliveryAddress?: OrderDeliveryAddress;
  generalNotes?: string;
  cancellationReason?: string;
  statusHistory?: OrderStatusHistoryItem[];
}

export interface OrderFilterOptions {
  status?: OrderStatus | 'todos';
  type?: OrderType | 'todos';
  searchQuery?: string;
}

export const ORDER_STATUS_FLOW_DELIVERY: OrderStatus[] = [
  'novo',
  'aceito',
  'em_preparo',
  'pronto',
  'em_entrega',
  'concluido',
];

export const ORDER_STATUS_FLOW_PICKUP: OrderStatus[] = [
  'novo',
  'aceito',
  'em_preparo',
  'pronto',
  'concluido',
];

export const ORDER_STATUS_TRANSITIONS: Record<OrderType, Record<OrderStatus, OrderStatus[]>> = {
  delivery: {
    novo: ['aceito', 'cancelado'],
    aceito: ['em_preparo', 'cancelado'],
    em_preparo: ['pronto', 'cancelado'],
    pronto: ['em_entrega', 'cancelado'],
    em_entrega: ['concluido', 'cancelado'],
    concluido: [], // Terminal state
    cancelado: [], // Terminal state
  },
  retirada: {
    novo: ['aceito', 'cancelado'],
    aceito: ['em_preparo', 'cancelado'],
    em_preparo: ['pronto', 'cancelado'],
    pronto: ['concluido', 'cancelado'],
    em_entrega: [], // Not applicable for pickup
    concluido: [], // Terminal state
    cancelado: [], // Terminal state
  },
};

/**
 * Builds the immutable order item snapshot from a cart line.
 * Financial rule: effectiveUnitPrice = basePrice + optionsTotal; totals are
 * never derived by adding the option amounts a second time.
 */
export function buildOrderItemSnapshot(params: {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  basePrice: number;
  notes?: string;
  modifiers: OrderItemModifier[];
  imageUrl?: string;
}): OrderItem {
  const unitPriceCents =
    toCents(params.basePrice) + sumCents(params.modifiers.map(m => m.total));
  const unitPrice = fromCents(unitPriceCents);

  return {
    id: params.lineId,
    productId: params.productId,
    name: params.name,
    quantity: params.quantity,
    basePrice: params.basePrice,
    unitPrice,
    totalPrice: fromCents(unitPriceCents * params.quantity),
    notes: params.notes,
    modifiers: params.modifiers.map(modifier => ({ ...modifier })),
    imageUrl: params.imageUrl,
  };
}