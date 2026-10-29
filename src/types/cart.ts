import { MenuItem } from './menu';
import { OrderItemModifier, OrderType } from './order';

/**
 * Selection state per modifier group: groupId -> selected option ids.
 * Kept separate from `modifierSelections`, which carries the resolved values.
 */
export type SelectedModifiersMap = Record<string, string[]>;

export interface CartItem {
  id: string;
  item: MenuItem;
  quantity: number;
  /** Product price without modifiers. */
  basePrice: number;
  /** basePrice + sum(modifierSelections.total) */
  unitPrice: number;
  /** unitPrice * quantity */
  totalPrice: number;
  selectedModifiers: SelectedModifiersMap;
  modifierSelections: OrderItemModifier[];
  notes?: string;
}

export interface Cart {
  items: CartItem[];
  itemsCount: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  modality: OrderType;
}