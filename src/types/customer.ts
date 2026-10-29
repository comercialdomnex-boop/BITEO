import { Order } from './order';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  neighborhood: string;
  totalOrders: number;
  totalSpent: number;
  averageTicket?: number;
  firstOrderDate?: string;
  lastOrderDate: string;
  preferredModality?: 'delivery' | 'retirada';
  status?: 'novo' | 'recorrente';
  addresses?: string[];
  favoriteItem?: string;
  orders?: Order[];
}
