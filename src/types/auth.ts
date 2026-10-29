import { StoreConfig } from './store';
import { Order } from './order';
import { MenuCategory, MenuItem } from './menu';

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'ATTENDANT';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface UserStoreMembership {
  id: string;
  userId: string;
  storeId: string;
  role: UserRole;
  createdAt: string;
}

export interface StoreInstance {
  id: string;
  slug: string;
  name: string;
  category: string;
  /** Single writable source. The store profile is derived from it. */
  config: StoreConfig;
  orders: Order[];
  categories: MenuCategory[];
  items: MenuItem[];
  createdAt: string;
}

export interface SessionState {
  currentUser: CurrentUser | null;
  currentStoreId: string | null;
  memberships: UserStoreMembership[];
  stores: StoreInstance[];
  isAuthenticated: boolean;
}
