/**
 * MenuService — the Supabase tables are the only source of truth.
 *
 * Tables: categories, products, product_modifier_groups, modifier_options.
 * - Every query is filtered by store_id on top of RLS (never a replacement for it).
 * - Money is stored in integer cents; the UI works in reais (utils/money).
 * - Deletions are logical (deleted_at), so past orders keep their references.
 * - Modifier groups/options keep their UUIDs across edits, so carts and order
 *   history stay valid after the merchant edits a product.
 * - A failing query throws a MenuServiceError with a real message. Failure is
 *   never turned into an empty menu and there is no mock fallback.
 */
import { MenuCategory, MenuItem, MenuFilterOptions, ModifierGroup } from '../types';
import { getSupabase, supabaseConfigError } from '../lib/supabase';
import { toCents, fromCents } from '../utils/money';
import {
  MenuServiceError,
  filterStorefrontMenu,
  isUuid,
  toMenuError,
  validateCategoryName,
  validateProductInput,
} from '../utils/menuRules';

export { MenuServiceError } from '../utils/menuRules';

export const CATEGORY_HAS_ITEMS_ERROR =
  'Esta categoria possui produtos. Mova ou remova os produtos antes de excluir a categoria.';

type Row = Record<string, any>;
type DbResult<T> = { data: T | null; error: any; count?: number | null };

function db() {
  const client = getSupabase();
  if (!client) {
    throw new MenuServiceError(supabaseConfigError || 'Supabase não configurado.', 'config');
  }
  return client;
}

/** Awaits a PostgREST query, turning both returned errors and thrown network errors into MenuServiceError. */
async function run<T>(query: PromiseLike<DbResult<T>>, action: string): Promise<DbResult<T>> {
  let result: DbResult<T>;
  try {
    result = await query;
  } catch (thrown) {
    throw toMenuError({ message: thrown instanceof Error ? thrown.message : String(thrown) }, action);
  }
  if (result.error) throw toMenuError(result.error, action);
  return result;
}

function requireStoreId(storeId: string): void {
  if (!isUuid(storeId)) {
    throw new MenuServiceError('Loja inválida: identificador ausente ou malformado.', 'validation');
  }
}

function requireId(id: string, what: string): void {
  if (!isUuid(id)) throw new MenuServiceError(`${what} inválido(a).`, 'validation');
}

const now = () => new Date().toISOString();

function mapCategory(row: Row): MenuCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    icon: row.icon || undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function mapProduct(row: Row, groups: ModifierGroup[] = []): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id || '',
    name: row.name,
    description: row.description || '',
    price: fromCents(row.price_cents),
    promotionalPrice: row.promotional_price_cents == null ? undefined : fromCents(row.promotional_price_cents),
    isAvailable: row.is_available,
    imageUrl: row.image_url || undefined,
    preparationTimeMinutes: row.preparation_time_minutes || undefined,
    highlightBadge: row.highlight_badge || undefined,
    sortOrder: row.sort_order,
    modifierGroups: groups,
  };
}

function productPayload(data: Partial<MenuItem>): Row {
  const p: Row = {};
  if ('categoryId' in data) p.category_id = data.categoryId || null;
  if ('name' in data) p.name = data.name?.trim();
  if ('description' in data) p.description = data.description?.trim() || null;
  if ('price' in data) p.price_cents = toCents(data.price!);
  if ('promotionalPrice' in data) {
    p.promotional_price_cents = data.promotionalPrice == null ? null : toCents(data.promotionalPrice);
  }
  if ('isAvailable' in data) p.is_available = data.isAvailable;
  if ('imageUrl' in data) p.image_url = data.imageUrl?.trim() || null;
  if ('preparationTimeMinutes' in data) p.preparation_time_minutes = data.preparationTimeMinutes || null;
  if ('highlightBadge' in data) p.highlight_badge = data.highlightBadge?.trim() || null;
  if ('sortOrder' in data) p.sort_order = data.sortOrder || 0;
  return p;
}

function groupPayload(group: ModifierGroup, index: number): Row {
  const p: Row = {
    name: group.name.trim(),
    is_required: group.isRequired,
    min_select: group.minQuantity || 0,
    max_select: Math.max(1, group.maxQuantity || 1),
    sort_order: index,
  };
  if (group.isActive !== undefined) p.is_active = group.isActive;
  return p;
}

function optionPayload(option: ModifierGroup['options'][number], index: number): Row {
  return {
    name: option.name.trim(),
    price_cents: toCents(option.price),
    is_available: option.isAvailable !== false,
    sort_order: index,
  };
}

/**
 * Brings the product's modifier groups/options in line with `groups` without
 * changing the UUIDs of what still exists: existing ids are updated, unknown
 * ids are inserted, and rows that disappeared are soft-deleted (last, so a
 * mid-way failure never leaves the product without its previous add-ons).
 */
async function syncModifierGroups(storeId: string, productId: string, groups: ModifierGroup[]): Promise<void> {
  const client = db();
  const action = 'salvar os adicionais';

  const { data: existingGroups } = await run<Row[]>(
    client.from('product_modifier_groups').select('id')
      .eq('store_id', storeId).eq('product_id', productId).is('deleted_at', null),
    action
  );
  const existingGroupIds = new Set((existingGroups || []).map(g => g.id as string));

  let existingOptions: Row[] = [];
  if (existingGroupIds.size) {
    const { data } = await run<Row[]>(
      client.from('modifier_options').select('id, group_id')
        .eq('store_id', storeId).in('group_id', [...existingGroupIds]).is('deleted_at', null),
      action
    );
    existingOptions = data || [];
  }

  const keptGroupIds = new Set<string>();
  const keptOptionIds = new Set<string>();

  for (const [gi, group] of groups.entries()) {
    let groupId: string;
    if (isUuid(group.id) && existingGroupIds.has(group.id)) {
      groupId = group.id;
      await run(
        client.from('product_modifier_groups').update(groupPayload(group, gi))
          .eq('store_id', storeId).eq('id', groupId).is('deleted_at', null),
        action
      );
    } else {
      const { data: inserted } = await run<Row>(
        client.from('product_modifier_groups')
          .insert({ store_id: storeId, product_id: productId, is_active: true, ...groupPayload(group, gi) })
          .select('id').single(),
        action
      );
      groupId = inserted!.id;
    }
    keptGroupIds.add(groupId);

    const ownOptionIds = new Set(existingOptions.filter(o => o.group_id === groupId).map(o => o.id as string));
    for (const [oi, option] of group.options.entries()) {
      if (isUuid(option.id) && ownOptionIds.has(option.id)) {
        keptOptionIds.add(option.id);
        await run(
          client.from('modifier_options').update(optionPayload(option, oi))
            .eq('store_id', storeId).eq('id', option.id).is('deleted_at', null),
          action
        );
      } else {
        const { data: insertedOption } = await run<Row>(
          client.from('modifier_options')
            .insert({ store_id: storeId, group_id: groupId, ...optionPayload(option, oi) })
            .select('id').single(),
          action
        );
        keptOptionIds.add(insertedOption!.id);
      }
    }
  }

  const staleOptionIds = existingOptions.map(o => o.id as string).filter(id => !keptOptionIds.has(id));
  if (staleOptionIds.length) {
    await run(
      client.from('modifier_options').update({ deleted_at: now() })
        .eq('store_id', storeId).in('id', staleOptionIds).is('deleted_at', null),
      action
    );
  }
  const staleGroupIds = [...existingGroupIds].filter(id => !keptGroupIds.has(id));
  if (staleGroupIds.length) {
    await run(
      client.from('product_modifier_groups').update({ deleted_at: now() })
        .eq('store_id', storeId).in('id', staleGroupIds).is('deleted_at', null),
      action
    );
  }
}

/** Assigns 1..n to `ordered` and writes only rows whose sort_order changed. */
async function persistOrder(table: 'categories' | 'products', storeId: string, ordered: { id: string; sortOrder?: number }[]) {
  const client = db();
  for (const [index, row] of ordered.entries()) {
    const next = index + 1;
    if (row.sortOrder === next) continue;
    await run(
      client.from(table).update({ sort_order: next })
        .eq('store_id', storeId).eq('id', row.id).is('deleted_at', null),
      'reordenar o cardápio'
    );
  }
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export class MenuService {
  /** Kept for existing boot callers. The database is the only source of truth; nothing is cached. */
  static setStoreContext(_storeId: string, _categories?: MenuCategory[], _items?: MenuItem[]): void {}

  /**
   * Full menu as stored, for the Merchant. When nothing comes back, checks that
   * the store itself is readable, so "no access" is reported as an error
   * instead of looking like an empty menu.
   */
  static async getMenu(storeId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
    const [categories, items] = await Promise.all([this.getCategories(storeId), this.getItems(storeId)]);
    if (!categories.length && !items.length) await this.assertStoreReadable(storeId);
    return { categories, items };
  }

  /** What customers see: same persisted data, filtered by the same rules the checkout enforces. */
  static async getStorefrontMenu(storeId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
    const menu = await this.getMenu(storeId);
    return filterStorefrontMenu(menu.categories, menu.items);
  }

  static async assertStoreReadable(storeId: string): Promise<void> {
    requireStoreId(storeId);
    const { data } = await run<Row[]>(
      db().from('stores').select('id').eq('id', storeId).is('deleted_at', null).limit(1),
      'carregar a loja'
    );
    if (!data?.length) {
      throw new MenuServiceError(
        'Loja não encontrada ou sua conta não tem acesso a ela. Entre novamente ou selecione outra loja.',
        'permission'
      );
    }
  }

  static async getCategories(storeId: string): Promise<MenuCategory[]> {
    requireStoreId(storeId);
    const client = db();
    const action = 'carregar as categorias';
    const [{ data }, { data: products }] = await Promise.all([
      run<Row[]>(
        client.from('categories').select('*').eq('store_id', storeId).is('deleted_at', null)
          .order('sort_order').order('created_at').order('id'),
        action
      ),
      run<Row[]>(
        client.from('products').select('category_id').eq('store_id', storeId).is('deleted_at', null),
        action
      ),
    ]);
    return (data || []).map(row => ({
      ...mapCategory(row),
      itemCount: (products || []).filter(p => p.category_id === row.id).length,
    }));
  }

  static async createCategory(
    storeId: string,
    data: { name: string; description?: string; isActive?: boolean }
  ): Promise<MenuCategory> {
    requireStoreId(storeId);
    const name = validateCategoryName(data.name);
    const client = db();
    const action = 'criar a categoria';
    const { data: rows } = await run<Row[]>(
      client.from('categories').select('sort_order').eq('store_id', storeId).is('deleted_at', null)
        .order('sort_order', { ascending: false }).limit(1),
      action
    );
    const { data: row } = await run<Row>(
      client.from('categories').insert({
        store_id: storeId,
        name,
        description: data.description?.trim() || null,
        is_active: data.isActive !== false,
        sort_order: (rows?.[0]?.sort_order || 0) + 1,
      }).select('*').single(),
      action
    );
    return { ...mapCategory(row!), itemCount: 0 };
  }

  static async updateCategory(
    storeId: string,
    id: string,
    updates: Partial<Omit<MenuCategory, 'id'>>
  ): Promise<MenuCategory> {
    requireStoreId(storeId);
    requireId(id, 'Categoria');
    const p: Row = {};
    if (updates.name !== undefined) p.name = validateCategoryName(updates.name);
    if (updates.description !== undefined) p.description = updates.description?.trim() || null;
    if (updates.isActive !== undefined) p.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) p.sort_order = updates.sortOrder;
    if (updates.icon !== undefined) p.icon = updates.icon || null;
    const { data } = await run<Row>(
      db().from('categories').update(p).eq('id', id).eq('store_id', storeId).is('deleted_at', null)
        .select('*').single(),
      'atualizar a categoria'
    );
    return mapCategory(data!);
  }

  static async toggleCategoryStatus(storeId: string, id: string): Promise<MenuCategory> {
    const current = (await this.getCategories(storeId)).find(c => c.id === id);
    if (!current) throw new MenuServiceError('Categoria não encontrada.', 'not_found');
    return this.updateCategory(storeId, id, { isActive: !current.isActive });
  }

  static async deleteCategory(storeId: string, id: string): Promise<boolean> {
    requireStoreId(storeId);
    requireId(id, 'Categoria');
    const action = 'excluir a categoria';
    const { count } = await run(
      db().from('products').select('id', { count: 'exact', head: true })
        .eq('store_id', storeId).eq('category_id', id).is('deleted_at', null),
      action
    );
    if (count) throw new MenuServiceError(CATEGORY_HAS_ITEMS_ERROR, 'validation');
    const { data } = await run<Row[]>(
      db().from('categories').update({ deleted_at: now() })
        .eq('store_id', storeId).eq('id', id).is('deleted_at', null).select('id'),
      action
    );
    if (!data?.length) {
      throw new MenuServiceError('Categoria não encontrada ou sem permissão para excluí-la.', 'not_found');
    }
    return true;
  }

  static async moveCategoryOrder(storeId: string, id: string, direction: 'up' | 'down'): Promise<MenuCategory[]> {
    const cats = await this.getCategories(storeId);
    const index = cats.findIndex(c => c.id === id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= cats.length) return cats;
    // Renumbering the whole list makes reordering work even when rows share the
    // same sort_order (e.g. rows created directly in the database with 0).
    await persistOrder('categories', storeId, swap(cats, index, target));
    return this.getCategories(storeId);
  }

  static async getItems(storeId: string, filters?: MenuFilterOptions): Promise<MenuItem[]> {
    requireStoreId(storeId);
    const client = db();
    const action = 'carregar os produtos';
    const { data: products } = await run<Row[]>(
      client.from('products').select('*').eq('store_id', storeId).is('deleted_at', null)
        .order('sort_order').order('created_at').order('id'),
      action
    );
    const ids = (products || []).map(p => p.id);
    if (!ids.length) return [];

    const { data: groups } = await run<Row[]>(
      client.from('product_modifier_groups').select('*').eq('store_id', storeId)
        .in('product_id', ids).is('deleted_at', null).order('sort_order').order('created_at'),
      'carregar os adicionais'
    );
    const groupIds = (groups || []).map(g => g.id);
    let options: Row[] = [];
    if (groupIds.length) {
      const { data } = await run<Row[]>(
        client.from('modifier_options').select('*').eq('store_id', storeId)
          .in('group_id', groupIds).is('deleted_at', null).order('sort_order').order('created_at'),
        'carregar os adicionais'
      );
      options = data || [];
    }

    let result = (products || []).map(p =>
      mapProduct(
        p,
        (groups || []).filter(g => g.product_id === p.id).map(g => ({
          id: g.id,
          name: g.name,
          isRequired: g.is_required,
          minQuantity: g.min_select,
          maxQuantity: g.max_select,
          isActive: g.is_active,
          options: options.filter(o => o.group_id === g.id).map(o => ({
            id: o.id,
            name: o.name,
            price: fromCents(o.price_cents),
            isAvailable: o.is_available,
          })),
        }))
      )
    );

    if (filters?.categoryId && filters.categoryId !== 'all') {
      result = result.filter(p => p.categoryId === filters.categoryId);
    }
    if (filters?.status && filters.status !== 'all') {
      result = result.filter(p => p.isAvailable === (filters.status === 'active'));
    }
    if (filters?.searchQuery?.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.highlightBadge?.toLowerCase().includes(q)
      );
    }
    return result;
  }

  static async getItemById(storeId: string, id: string): Promise<MenuItem | undefined> {
    return (await this.getItems(storeId)).find(p => p.id === id);
  }

  static async createItem(storeId: string, data: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    requireStoreId(storeId);
    validateProductInput(data, true);
    const client = db();
    const action = 'criar o produto';
    const { data: rows } = await run<Row[]>(
      client.from('products').select('sort_order').eq('store_id', storeId)
        .eq('category_id', data.categoryId).is('deleted_at', null)
        .order('sort_order', { ascending: false }).limit(1),
      action
    );
    const { sortOrder: _ignored, ...rest } = data;
    const { data: row } = await run<Row>(
      client.from('products').insert({
        ...productPayload(rest),
        store_id: storeId,
        sort_order: (rows?.[0]?.sort_order || 0) + 1,
      }).select('id').single(),
      action
    );
    const productId = row!.id as string;
    if (data.modifierGroups?.length) await syncModifierGroups(storeId, productId, data.modifierGroups);
    const created = await this.getItemById(storeId, productId);
    if (!created) throw new MenuServiceError('Produto gravado, mas não foi possível relê-lo. Recarregue a página.', 'unknown');
    return created;
  }

  static async updateItem(storeId: string, id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    requireStoreId(storeId);
    requireId(id, 'Produto');
    const { id: _id, ...rest } = updates;
    // Promotional price is checked against the stored price when only one side changes.
    if ('promotionalPrice' in rest && !('price' in rest) && rest.promotionalPrice != null) {
      const current = await this.getItemById(storeId, id);
      if (!current) throw new MenuServiceError('Produto não encontrado.', 'not_found');
      validateProductInput({ ...rest, price: current.price }, false);
    } else {
      validateProductInput(rest, false);
    }
    const payload = productPayload(rest);
    if (Object.keys(payload).length) {
      await run(
        db().from('products').update(payload).eq('store_id', storeId).eq('id', id).is('deleted_at', null)
          .select('id').single(),
        'atualizar o produto'
      );
    }
    if ('modifierGroups' in rest) await syncModifierGroups(storeId, id, rest.modifierGroups || []);
    const updated = await this.getItemById(storeId, id);
    if (!updated) throw new MenuServiceError('Produto não encontrado após a atualização.', 'not_found');
    return updated;
  }

  static async toggleItemAvailability(storeId: string, id: string): Promise<MenuItem> {
    const current = await this.getItemById(storeId, id);
    if (!current) throw new MenuServiceError('Produto não encontrado.', 'not_found');
    return this.updateItem(storeId, id, { isAvailable: !current.isAvailable });
  }

  static async deleteItem(storeId: string, id: string): Promise<boolean> {
    requireStoreId(storeId);
    requireId(id, 'Produto');
    const { data } = await run<Row[]>(
      db().from('products').update({ deleted_at: now() })
        .eq('store_id', storeId).eq('id', id).is('deleted_at', null).select('id'),
      'excluir o produto'
    );
    if (!data?.length) {
      throw new MenuServiceError('Produto não encontrado ou sem permissão para excluí-lo.', 'not_found');
    }
    return true;
  }

  static async duplicateItem(storeId: string, id: string): Promise<MenuItem> {
    const original = await this.getItemById(storeId, id);
    if (!original) throw new MenuServiceError('Produto não encontrado.', 'not_found');
    const { id: _id, sortOrder: _sort, ...data } = original;
    // Group/option ids belong to the original product, so syncModifierGroups
    // inserts fresh rows for the copy instead of touching the original's.
    return this.createItem(storeId, {
      ...data,
      name: `${original.name} (Cópia)`,
      modifierGroups: original.modifierGroups?.map(g => ({ ...g, options: g.options.map(o => ({ ...o })) })),
    });
  }

  static async moveItemOrder(storeId: string, id: string, direction: 'up' | 'down'): Promise<MenuItem[]> {
    const items = await this.getItems(storeId);
    const item = items.find(i => i.id === id);
    if (!item) return items;
    const same = items.filter(i => i.categoryId === item.categoryId);
    const index = same.findIndex(i => i.id === id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= same.length) return items;
    await persistOrder('products', storeId, swap(same, index, target));
    return this.getItems(storeId);
  }
}
