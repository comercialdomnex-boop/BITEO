import { StoreService } from './storeService';
import { persistOrderStatus } from './merchantOrderPersistence';
import { RestaurantService } from './restaurantService';
import {
  Order,
  OrderFilterOptions,
  OrderStatus,
  OrderType,
  OrdersDashboardMetrics,
  OrderStatusHistoryItem,
  ORDER_STATUS_TRANSITIONS,
} from '../types';
import { phoneIdentity } from '../utils/phone';
import { fromCents, sumCents } from '../utils/money';
import { canStartPreparation } from '../utils/paymentRules';

function highestOrderNumber(orders: Order[]): number {
  return orders.reduce((max, order) => {
    const candidate = order.orderNumber ?? parseOrderNumber(order.displayId);
    return candidate > max ? candidate : max;
  }, 0);
}

function parseOrderNumber(displayId: string): number {
  const parsed = Number(displayId.replace(/\D/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export class OrderService {
  private static storeOrdersMap: Map<string, Order[]> = new Map();
  private static activeStoreId: string = '';
  /** Order numbering is isolated per store: two tenants never share a sequence. */
  private static storeCounters: Map<string, number> = new Map();

  /**
   * Switches or initializes the active store context for orders
   */
  static setStoreContext(storeId: string, initialOrders?: Order[]): void {
    this.activeStoreId = storeId;
    if (!this.storeOrdersMap.has(storeId)) {
      this.storeOrdersMap.set(storeId, initialOrders ? [...initialOrders] : []);
    }
    if (!this.storeCounters.has(storeId)) {
      this.storeCounters.set(storeId, highestOrderNumber(initialOrders ?? []));
    }
  }

  static getActiveStoreId(): string {
    return this.activeStoreId;
  }

  private static get ordersState(): Order[] {
    if (!this.storeOrdersMap.has(this.activeStoreId)) {
      this.storeOrdersMap.set(this.activeStoreId, []);
    }
    return this.storeOrdersMap.get(this.activeStoreId)!;
  }

  private static set ordersState(next: Order[]) {
    this.storeOrdersMap.set(this.activeStoreId, next);
  }

  /**
   * Validates if a state transition is permitted by the state machine
   */
  static canTransition(
    current: OrderStatus,
    target: OrderStatus,
    type: OrderType
  ): boolean {
    if (current === target) return false;
    const allowed = ORDER_STATUS_TRANSITIONS[type]?.[current] || [];
    return allowed.includes(target);
  }

  /**
   * Only non-completed and non-already-cancelled orders can be cancelled
   */
  static canCancel(status: OrderStatus): boolean {
    return status !== 'concluido' && status !== 'cancelado';
  }

  static async getOrders(filters?: OrderFilterOptions): Promise<Order[]> {
    let result = [...this.ordersState];

    if (filters) {
      if (filters.status && filters.status !== 'todos') {
        result = result.filter(order => order.status === filters.status);
      }

      if (filters.type && filters.type !== 'todos') {
        result = result.filter(order => order.type === filters.type);
      }

      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const query = filters.searchQuery.toLowerCase().trim();
        const queryDigits = query.replace(/\D/g, '');
        result = result.filter(
          order =>
            order.displayId.toLowerCase().includes(query) ||
            order.customer.name.toLowerCase().includes(query) ||
            (queryDigits.length > 0 &&
              phoneIdentity(order.customer.phone).includes(queryDigits)) ||
            order.items.some(item => item.name.toLowerCase().includes(query))
        );
      }
    }

    return result;
  }

  static async getOrderById(id: string): Promise<Order | undefined> {
    return this.ordersState.find(
      order => order.id === id || order.displayId === id
    );
  }

  /**
   * True when this store already has an order for the given phone.
   * Scoped to the active store so the same customer can be "new" on one tenant
   * and "returning" on another.
   */
  static async hasPreviousOrder(phone: string): Promise<boolean> {
    const identity = phoneIdentity(phone);
    if (!identity) return false;
    return this.ordersState.some(
      order => phoneIdentity(order.customer.phone) === identity
    );
  }

  static getNextStatus(current: OrderStatus, type: 'delivery' | 'retirada'): OrderStatus | null {
    if (type === 'delivery') {
      switch (current) {
        case 'novo':
          return 'aceito';
        case 'aceito':
          return 'em_preparo';
        case 'em_preparo':
          return 'pronto';
        case 'pronto':
          return 'em_entrega';
        case 'em_entrega':
          return 'concluido';
        default:
          return null;
      }
    } else {
      switch (current) {
        case 'novo':
          return 'aceito';
        case 'aceito':
          return 'em_preparo';
        case 'em_preparo':
          return 'pronto';
        case 'pronto':
          return 'concluido';
        default:
          return null;
      }
    }
  }

  static getStatusActionLabel(status: OrderStatus, type: 'delivery' | 'retirada'): string {
    if (type === 'delivery') {
      switch (status) {
        case 'novo':
          return 'Aceitar Pedido';
        case 'aceito':
          return 'Iniciar Preparo';
        case 'em_preparo':
          return 'Marcar como Pronto';
        case 'pronto':
          return 'Despachar Entrega';
        case 'em_entrega':
          return 'Confirmar Entrega';
        default:
          return '';
      }
    } else {
      switch (status) {
        case 'novo':
          return 'Aceitar Pedido';
        case 'aceito':
          return 'Iniciar Preparo';
        case 'em_preparo':
          return 'Pronto para Retirada';
        case 'pronto':
          return 'Confirmar Retirada';
        default:
          return '';
      }
    }
  }

  static async createOrder(
    orderData: Omit<Order, 'id' | 'displayId' | 'createdAt' | 'statusHistory' | 'status'> & {
      status?: OrderStatus;
    },
    serverReceipt?: { orderId: string; orderNumber: number }
  ): Promise<Order> {
    const storeId = this.activeStoreId;
    const config = await StoreService.getStoreConfig(storeId);
    if (!RestaurantService.buildProfile(config).isOpen) {
      throw new Error('A loja não está recebendo pedidos agora.');
    }
    const orderNumber = serverReceipt?.orderNumber ?? (this.storeCounters.get(storeId) ?? 0) + 1;
    this.storeCounters.set(storeId, orderNumber);

    const displayId = `#${orderNumber}`;
    const id = serverReceipt?.orderId ?? `ord_${storeId}_${orderNumber}_${Date.now()}`;
    const now = new Date().toISOString();

    const status: OrderStatus = orderData.status || 'novo';
    const initialHistory: OrderStatusHistoryItem[] = [
      {
        status: 'novo',
        timestamp: now,
        label: 'Pedido recebido pela loja',
        note: 'Aguardando confirmação do estabelecimento',
      },
    ];

    const newOrder: Order = {
      ...orderData,
      id,
      displayId,
      orderNumber,
      status,
      createdAt: now,
      statusHistory: initialHistory,
    };

    // Prepend to list
    this.ordersState = [newOrder, ...this.ordersState];
    return newOrder;
  }

  static async updateOrderStatus(
    id: string,
    newStatus: OrderStatus,
    reason?: string
  ): Promise<Order> {
    const index = this.ordersState.findIndex(
      o => o.id === id || o.displayId === id
    );
    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }

    const order = this.ordersState[index];

    // Enforce strict state machine rules
    if (!this.canTransition(order.status, newStatus, order.type)) {
      throw new Error(
        `Transição de status inválida: pedido ${order.displayId} está '${order.status}' e não pode transitar para '${newStatus}'.`
      );
    }

    // Same rule as the backend: Pix antecipado only enters preparation once paid.
    if (newStatus === 'em_preparo' && !canStartPreparation(order)) {
      throw new Error(
        `Pedido ${order.displayId} aguarda a confirmação do Pix antecipado. Confirme o pagamento antes de iniciar o preparo.`
      );
    }

    await persistOrderStatus(order.id, newStatus, reason);
    const now = new Date().toISOString();

    const getHistoryLabel = (st: OrderStatus): string => {
      switch (st) {
        case 'novo':
          return 'Pedido recebido';
        case 'aceito':
          return 'Pedido confirmado e aceito';
        case 'em_preparo':
          return 'Pedido em preparo na cozinha';
        case 'pronto':
          return order.type === 'delivery'
            ? 'Pedido pronto, aguardando entregador'
            : 'Pedido pronto para retirada no balcão';
        case 'em_entrega':
          return 'Pedido saiu para entrega';
        case 'concluido':
          return order.type === 'delivery'
            ? 'Pedido entregue com sucesso'
            : 'Pedido retirado pelo cliente';
        case 'cancelado':
          return reason ? `Pedido cancelado: ${reason}` : 'Pedido cancelado';
      }
    };

    const currentHistory = order.statusHistory || [
      {
        status: order.status,
        timestamp: order.createdAt,
        label: 'Pedido criado',
      },
    ];

    const newHistoryItem: OrderStatusHistoryItem = {
      status: newStatus,
      timestamp: now,
      label: getHistoryLabel(newStatus),
      note: reason,
    };

    const updated: Order = {
      ...order,
      status: newStatus,
      cancellationReason: newStatus === 'cancelado' ? reason : order.cancellationReason,
      statusHistory: [...currentHistory, newHistoryItem],
    };

    this.ordersState[index] = updated;
    return updated;
  }

  static computeMetrics(orders: Order[]): OrdersDashboardMetrics {
    const newOrders = orders.filter(o => o.status === 'novo').length;
    const inPrep = orders.filter(
      o => o.status === 'aceito' || o.status === 'em_preparo' || o.status === 'pronto'
    ).length;
    const inDelivery = orders.filter(o => o.status === 'em_entrega').length;
    const completed = orders.filter(o => o.status === 'concluido').length;
    const cancelled = orders.filter(o => o.status === 'cancelado').length;

    const validCompleted = orders.filter(o => o.status !== 'cancelado');
    const grossSalesCents = sumCents(validCompleted.map(o => o.total));
    const grossSalesToday = fromCents(grossSalesCents);
    const averageTicket =
      validCompleted.length > 0
        ? fromCents(Math.round(grossSalesCents / validCompleted.length))
        : 0;

    return {
      totalToday: orders.length,
      grossSalesToday,
      newOrdersCount: newOrders,
      inPrepCount: inPrep,
      inDeliveryCount: inDelivery,
      completedCount: completed,
      cancelledCount: cancelled,
      averageTicket,
    };
  }
}
