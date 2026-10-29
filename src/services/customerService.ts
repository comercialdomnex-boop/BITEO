import { Customer, Order } from '../types';
import { normalizePhone, phoneIdentity } from '../utils/phone';
import { fromCents, sumCents } from '../utils/money';

export class CustomerService {
  /**
   * Derives unique customers 100% dynamically from orders.
   * Ensures zero duplicate state and instant synchronization with storefront orders.
   *
   * Identity is keyed by the canonical phone (E.164 without separators), so the
   * same person typing "(11) 99999-9999" or "+5511999999999" collapses into a
   * single customer.
   */
  static deriveFromOrders(orders: Order[]): Customer[] {
    const customerMap = new Map<string, Order[]>();

    orders.forEach(order => {
      const key =
        phoneIdentity(order.customer.phone) ||
        order.customer.id ||
        order.customer.name.trim().toLowerCase();
      const existing = customerMap.get(key) || [];
      customerMap.set(key, [...existing, order]);
    });

    const customers: Customer[] = [];

    customerMap.forEach((custOrders, identityKey) => {
      // Sort orders chronologically
      const sortedAsc = [...custOrders].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const latestOrder = sortedAsc[sortedAsc.length - 1];
      const firstOrder = sortedAsc[0];

      // Financials (valid orders only) computed in integer cents
      const validOrders = custOrders.filter(o => o.status !== 'cancelado');
      const totalSpent = fromCents(sumCents(validOrders.map(o => o.total)));
      const totalOrders = custOrders.length;
      const averageTicket =
        validOrders.length > 0
          ? fromCents(Math.round(sumCents(validOrders.map(o => o.total)) / validOrders.length))
          : 0;

      // Modality breakdown
      const deliveryCount = custOrders.filter(o => o.type === 'delivery').length;
      const pickupCount = custOrders.filter(o => o.type === 'retirada').length;
      const preferredModality: 'delivery' | 'retirada' =
        deliveryCount >= pickupCount ? 'delivery' : 'retirada';

      // Status
      const status: 'novo' | 'recorrente' = totalOrders > 1 ? 'recorrente' : 'novo';

      // Unique addresses (city kept separate from state)
      const addressSet = new Set<string>();
      custOrders.forEach(o => {
        if (o.deliveryAddress) {
          const a = o.deliveryAddress;
          const full = `${a.street}, ${a.number}${
            a.complement ? ` (${a.complement})` : ''
          } - ${a.neighborhood}, ${a.city} - ${a.state}`;
          addressSet.add(full);
        }
      });
      const addresses = Array.from(addressSet);

      const neighborhood = latestOrder.deliveryAddress?.neighborhood || 'Não informado';

      // Favorite item
      const itemCounts = new Map<string, number>();
      custOrders.forEach(o => {
        o.items.forEach(i => {
          itemCounts.set(i.name, (itemCounts.get(i.name) || 0) + i.quantity);
        });
      });
      let favoriteItem: string | undefined;
      let maxCount = 0;
      itemCounts.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count;
          favoriteItem = name;
        }
      });

      // Orders sorted descending for history timeline
      const ordersDesc = [...custOrders].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      customers.push({
        id: `cust_${identityKey.replace(/\D/g, '') || latestOrder.id}`,
        name: latestOrder.customer.name,
        phone: normalizePhone(latestOrder.customer.phone),
        email: latestOrder.customer.email,
        neighborhood,
        totalOrders,
        totalSpent,
        averageTicket,
        firstOrderDate: firstOrder.createdAt,
        lastOrderDate: latestOrder.createdAt,
        preferredModality,
        status,
        addresses,
        favoriteItem,
        orders: ordersDesc,
      });
    });

    // Default sort by lastOrderDate descending
    return customers.sort(
      (a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
    );
  }

  /**
   * True when the given phone has no previous order in this store.
   * Cancelled orders still count: the customer already placed an order here.
   */
  static isFirstOrder(orders: Order[], phone: string): boolean {
    const identity = phoneIdentity(phone);
    if (!identity) return true;
    return !orders.some(order => phoneIdentity(order.customer.phone) === identity);
  }

  static findByPhone(orders: Order[], phone: string): Order | undefined {
    const identity = phoneIdentity(phone);
    if (!identity) return undefined;
    return orders.find(order => phoneIdentity(order.customer.phone) === identity);
  }
}