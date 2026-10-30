import { getSupabase } from '../lib/supabase';
import type { Order, OrderItem, OrderItemModifier, OrderStatusHistoryItem } from '../types';
import { fromCents, toCents } from '../utils/money';

export async function fetchMerchantOrders(storeId: string): Promise<Order[]> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase não configurado.');
  const { data: rows, error } = await client.from('orders').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  if (!rows?.length) return [];
  const ids = rows.map(r => r.id);
  const [itemsResult, historyResult] = await Promise.all([
    client.from('order_items').select('*').eq('store_id', storeId).in('order_id', ids).order('sort_order'),
    client.from('order_status_history').select('*').eq('store_id', storeId).in('order_id', ids).order('created_at'),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (historyResult.error) throw historyResult.error;
  const items = itemsResult.data ?? [];
  const itemIds = items.map(i => i.id);
  const optionRows: any[] = [];
  for (let start = 0; start < itemIds.length; start += 200) {
    const { data, error: optionError } = await client.from('order_item_options').select('*').eq('store_id', storeId).in('order_item_id', itemIds.slice(start, start + 200)).order('sort_order');
    if (optionError) throw optionError;
    optionRows.push(...(data ?? []));
  }
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of items) {
    const modifiers: OrderItemModifier[] = optionRows.filter(o => o.order_item_id === item.id).map(o => ({
      groupId: o.group_id ?? '', groupName: o.group_name, optionId: o.option_id ?? '',
      name: o.option_name, unitPrice: fromCents(o.unit_price_cents),
      quantity: o.quantity, total: fromCents(o.total_price_cents),
    }));
    const quantity = item.quantity;
    const totalPrice = fromCents(item.item_total_cents);
    const orderItem: OrderItem = {
      id: item.id, productId: item.product_id ?? '', name: item.product_name,
      quantity, basePrice: fromCents(item.base_price_cents),
      unitPrice: quantity ? fromCents(Math.round(item.item_total_cents / quantity)) : 0,
      totalPrice, notes: item.notes ?? undefined, imageUrl: item.image_url ?? undefined, modifiers,
    };
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), orderItem]);
  }
  const historyByOrder = new Map<string, OrderStatusHistoryItem[]>();
  for (const entry of historyResult.data ?? []) {
    historyByOrder.set(entry.order_id, [...(historyByOrder.get(entry.order_id) ?? []), {
      status: entry.status, timestamp: entry.created_at, label: entry.status, note: entry.note ?? undefined,
    }]);
  }
  return rows.map(row => {
    const orderItems = itemsByOrder.get(row.id) ?? [];
    const deliveryAddress = row.delivery_address_street ? {
      street: row.delivery_address_street, number: row.delivery_address_number ?? '',
      neighborhood: row.delivery_address_neighborhood ?? '',
      complement: row.delivery_address_complement ?? undefined,
      reference: row.delivery_address_reference ?? undefined,
      city: row.delivery_address_city ?? '', state: row.delivery_address_state ?? '',
      zipCode: row.delivery_address_zip_code ?? undefined,
    } : undefined;
    return {
      id: row.id, displayId: '#' + row.order_number, orderNumber: Number(row.order_number),
      customer: { id: row.customer_id ?? row.id, name: row.customer_name, phone: row.customer_phone, email: row.customer_email ?? undefined },
      items: orderItems, itemsCount: orderItems.reduce((n, i) => n + i.quantity, 0),
      type: row.fulfillment_type, status: row.status,
      subtotal: fromCents(row.subtotal_cents), deliveryFee: fromCents(row.delivery_fee_cents),
      discount: fromCents(row.discount_cents), total: fromCents(row.total_cents),
      paymentMethod: row.payment_method, paymentStatus: row.payment_status,
      changeFor: row.change_for_cents == null ? undefined : fromCents(row.change_for_cents),
      createdAt: row.created_at, estimatedTimeMin: row.estimated_minutes ?? undefined,
      deliveryAddress, generalNotes: row.notes ?? undefined,
      cancellationReason: row.cancellation_reason ?? undefined,
      statusHistory: historyByOrder.get(row.id) ?? [],
    } as Order;
  });
}

export async function persistOrderStatus(orderId: string, status: string, reason?: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase não configurado.');
  const { error } = await client.rpc('set_order_status', {
    p_order_id: orderId, p_target_status: status,
    p_cancellation_reason: reason ?? null,
  });
  if (error) throw error;
}
