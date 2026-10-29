import {
  CurrentUser,
  StoreInstance,
  UserStoreMembership,
  UserRole,
  SessionState,
} from '../types';
import { getSupabase, supabaseConfigError } from '../lib/supabase';
import { buildStoreInstanceFromRow, CreatedStoreRow } from './storeCreationService';
import {
  applyStoreSettingsToConfig,
  fetchStoreSettings,
  fetchBusinessHours,
  fetchDeliveryAreas,
} from './storePersistence';
import { OrderService } from './orderService';
import { MenuService } from './menuService';
import { StoreService } from './storeService';

/** Last store the merchant selected, revalidated against Supabase on every boot. */
const SELECTED_STORE_KEY = 'biteo.session.selectedStoreId';

/** Raw public.store_members row (RLS restricts it to the authenticated user). */
interface MembershipRow {
  id: string;
  store_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
}

/**
 * Session state. The identity comes from Supabase Auth and the stores/memberships
 * are read back from the database (public.store_members + public.stores, both
 * scoped by RLS). Nothing is invented locally: the in-memory arrays are only a
 * projection of rows the database actually returned.
 */
export class SessionService {
  private static currentUser: CurrentUser | null = null;
  private static currentStoreId: string | null = null;
  private static stores: StoreInstance[] = [];
  private static memberships: UserStoreMembership[] = [];

  /**
   * Hook kept for the app boot sequence. The async, database-backed restore is
   * `hydrate()`; this remains a no-op so existing call sites stay valid.
   */
  static init(): void {}

  /**
   * Loads the authenticated user's stores and memberships from Supabase and
   * rebuilds the local store context. Returns the stores the user can access
   * (possibly none). Throws on a real query error so the caller can show an
   * error state instead of silently treating it as "no store".
   */
  static async hydrate(user: CurrentUser): Promise<StoreInstance[]> {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
    }

    this.currentUser = user;

    const { data: membershipData, error: membershipError } = await supabase
      .from('store_members')
      .select('id, store_id, user_id, role, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (membershipError) throw membershipError;

    const membershipRows = (membershipData ?? []) as MembershipRow[];
    const storeIds = membershipRows.map(m => m.store_id);

    let stores: StoreInstance[] = [];
    if (storeIds.length > 0) {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .in('id', storeIds)
        .is('deleted_at', null);

      if (storeError) throw storeError;

      stores = ((storeData ?? []) as CreatedStoreRow[]).map(buildStoreInstanceFromRow);

      // Overlay the real public.store_settings (times, delivery, payments and
      // operations) so the merchant sees what was actually saved on reload.
      const settingsByStore = await fetchStoreSettings(storeIds);
      stores = await Promise.all(
        stores.map(async store => {
          const settings = settingsByStore.get(store.id);
          let config = store.config;
          if (settings) {
            config = applyStoreSettingsToConfig(config, settings);
          }
          try {
            const hours = await fetchBusinessHours(store.id);
            config = { ...config, hours };
          } catch (e) {
            // Ignore on fetch failure, keep defaults
          }
          try {
            const areas = await fetchDeliveryAreas(store.id);
            config = { ...config, delivery: { ...config.delivery, areas } };
          } catch (e) {
            // Ignore on fetch failure
          }
          return {
            ...store,
            config,
          };
        })
      );
    }

    this.stores = stores;
    this.memberships = membershipRows.map(m => ({
      id: m.id,
      userId: m.user_id,
      storeId: m.store_id,
      role: m.role as UserRole,
      createdAt: m.created_at,
    }));

    if (stores.length === 0) {
      this.currentStoreId = null;
      this.writeSelectedStoreId(null);
      return [];
    }

    const saved = this.readSelectedStoreId();
    const chosen = stores.find(s => s.id === saved) ?? stores[0];
    this.currentStoreId = chosen.id;
    this.writeSelectedStoreId(chosen.id);
    this.syncStoreContext(chosen);
    return stores;
  }

  private static readSelectedStoreId(): string | null {
    try {
      return localStorage.getItem(SELECTED_STORE_KEY);
    } catch {
      return null;
    }
  }

  private static writeSelectedStoreId(storeId: string | null): void {
    try {
      if (storeId) {
        localStorage.setItem(SELECTED_STORE_KEY, storeId);
      } else {
        localStorage.removeItem(SELECTED_STORE_KEY);
      }
    } catch {
      // Storage can be unavailable (private mode); selection is best-effort.
    }
  }

  static getSession(): SessionState {
    return {
      currentUser: this.currentUser,
      currentStoreId: this.currentStoreId,
      memberships: [...this.memberships],
      stores: [...this.stores],
      isAuthenticated: Boolean(this.currentUser),
    };
  }

  static getCurrentUser(): CurrentUser | null {
    return this.currentUser;
  }

  static getCurrentStore(): StoreInstance | null {
    if (!this.currentStoreId) return null;
    return this.stores.find(s => s.id === this.currentStoreId) || null;
  }

  static setCurrentUser(user: CurrentUser | null): void {
    this.currentUser = user;
  }

  /**
   * Role of the authenticated user in the active store, or null when it cannot
   * be determined. Used to gate who may edit "Minha Loja".
   */
  static getCurrentRole(): UserRole | null {
    if (!this.currentUser || !this.currentStoreId) return null;
    const membership = this.memberships.find(
      m => m.userId === this.currentUser?.id && m.storeId === this.currentStoreId
    );
    return membership ? membership.role : null;
  }

  static getUserStores(): StoreInstance[] {
    if (!this.currentUser) return [];
    const userStoreIds = this.memberships
      .filter(m => m.userId === this.currentUser?.id)
      .map(m => m.storeId);
    return this.stores.filter(s => userStoreIds.includes(s.id));
  }

  static getAvailableStores(): StoreInstance[] {
    return this.getUserStores();
  }

  /**
   * Registers a store that already exists in the database (returned by
   * public.create_first_store). Nothing is invented here: the StoreInstance is
   * projected from the real stores row by storeCreationService and only kept in
   * memory so the session can render it. Requires the authenticated owner.
   */
  static registerCreatedStore(store: StoreInstance, userId: string): void {
    const existing = this.stores.find(s => s.id === store.id);
    if (!existing) {
      this.stores.push(store);
      this.memberships.push({
        id: `membership:${store.id}:${userId}`,
        userId,
        storeId: store.id,
        role: 'OWNER',
        createdAt: store.createdAt,
      });
    }

    this.currentStoreId = store.id;
    this.writeSelectedStoreId(store.id);
    this.syncStoreContext(existing ?? store);
  }

  /**
   * Switch active store for the session
   */
  static switchStore(storeId: string): StoreInstance | null {
    const store = this.stores.find(s => s.id === storeId);
    if (!store) return null;

    this.currentStoreId = storeId;
    this.writeSelectedStoreId(storeId);
    this.syncStoreContext(store);
    return store;
  }

  /**
   * Update current store data (e.g. settings, orders)
   */
  static updateStoreData(storeId: string, updates: Partial<StoreInstance>): void {
    const idx = this.stores.findIndex(s => s.id === storeId);
    if (idx !== -1) {
      this.stores[idx] = { ...this.stores[idx], ...updates };
    }
  }

  /**
   * Logout from session
   */
  static logout(): void {
    this.currentUser = null;
    this.currentStoreId = null;
    this.stores = [];
    this.memberships = [];
    this.writeSelectedStoreId(null);
  }

  private static syncStoreContext(store: StoreInstance): void {
    StoreService.registerStore(store.id, store.config);
    OrderService.setStoreContext(store.id, store.orders);
    MenuService.setStoreContext(store.id, store.categories, store.items);
  }
}
