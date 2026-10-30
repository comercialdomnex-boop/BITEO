import { MenuCategory, MenuItem, MenuFilterOptions, ModifierGroup } from '../types';
import { getSupabase } from '../lib/supabase';
import { toCents, fromCents } from '../utils/money';

export const CATEGORY_HAS_ITEMS_ERROR =
  'Esta categoria possui produtos. Mova ou remova os produtos antes de excluir a categoria.';

function db() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase não configurado.');
  return client;
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
function category(row: any): MenuCategory {
  return { id: row.id, name: row.name, description: row.description || '',
    icon: row.icon || undefined, isActive: row.is_active, sortOrder: row.sort_order };
}
function product(row: any, groups: ModifierGroup[] = []): MenuItem {
  return { id: row.id, categoryId: row.category_id || '', name: row.name,
    description: row.description || '', price: fromCents(row.price_cents),
    promotionalPrice: row.promotional_price_cents == null ? undefined : fromCents(row.promotional_price_cents),
    isAvailable: row.is_available, imageUrl: row.image_url || undefined,
    preparationTimeMinutes: row.preparation_time_minutes || undefined,
    highlightBadge: row.highlight_badge || undefined, sortOrder: row.sort_order,
    modifierGroups: groups };
}
function productPayload(data: Partial<MenuItem>) {
  const p: Record<string, unknown> = {};
  if ('categoryId' in data) p.category_id = data.categoryId || null;
  if ('name' in data) p.name = data.name;
  if ('description' in data) p.description = data.description || null;
  if ('price' in data) p.price_cents = toCents(data.price!);
  if ('promotionalPrice' in data) p.promotional_price_cents = data.promotionalPrice == null ? null : toCents(data.promotionalPrice);
  if ('isAvailable' in data) p.is_available = data.isAvailable;
  if ('imageUrl' in data) p.image_url = data.imageUrl || null;
  if ('preparationTimeMinutes' in data) p.preparation_time_minutes = data.preparationTimeMinutes || null;
  if ('highlightBadge' in data) p.highlight_badge = data.highlightBadge || null;
  if ('sortOrder' in data) p.sort_order = data.sortOrder || 0;
  return p;
}
async function writeGroups(storeId: string, productId: string, groups: ModifierGroup[]) {
  const client = db();
  // Retain historical order references through soft deletion rather than cascading deletes.
  const { data: existing, error: e } = await client.from('product_modifier_groups')
    .select('id').eq('store_id', storeId).eq('product_id', productId).is('deleted_at', null);
  check(e);
  for (const old of existing || []) {
    const { error: oe } = await client.from('modifier_options').update({ deleted_at: new Date().toISOString() })
      .eq('store_id', storeId).eq('group_id', old.id).is('deleted_at', null);
    check(oe);
  }
  const { error: ge } = await client.from('product_modifier_groups').update({ deleted_at: new Date().toISOString() })
    .eq('store_id', storeId).eq('product_id', productId).is('deleted_at', null);
  check(ge);
  for (const [index, group] of groups.entries()) {
    const { data: inserted, error: ie } = await client.from('product_modifier_groups')
      .insert({ store_id: storeId, product_id: productId, name: group.name,
        is_required: group.isRequired, min_select: group.minQuantity,
        max_select: Math.max(1, group.maxQuantity), sort_order: index, is_active: true })
      .select('id').single();
    check(ie);
    if (group.options.length) {
      const { error: optionError } = await client.from('modifier_options').insert(
        group.options.map((opt, i) => ({ store_id: storeId, group_id: inserted!.id,
          name: opt.name, price_cents: toCents(opt.price),
          is_available: opt.isAvailable !== false, sort_order: i }))
      );
      check(optionError);
    }
  }
}
export class MenuService {
  // Kept for existing boot callers; the database is the only source of truth.
  static setStoreContext(_storeId: string, _categories?: MenuCategory[], _items?: MenuItem[]): void {}

  static async getCategories(storeId: string): Promise<MenuCategory[]> {
    const client = db();
    const [{ data, error }, { data: products, error: pe }] = await Promise.all([
      client.from('categories').select('*').eq('store_id', storeId).is('deleted_at', null).order('sort_order'),
      client.from('products').select('category_id').eq('store_id', storeId).is('deleted_at', null)
    ]);
    check(error); check(pe);
    return (data || []).map(row => ({ ...category(row),
      itemCount: (products || []).filter(p => p.category_id === row.id).length }));
  }
  static async createCategory(storeId: string, data: { name: string; description?: string; isActive?: boolean }): Promise<MenuCategory> {
    const client = db();
    const { data: rows, error: re } = await client.from('categories').select('sort_order')
      .eq('store_id', storeId).is('deleted_at', null).order('sort_order', { ascending: false }).limit(1);
    check(re);
    const { data: row, error } = await client.from('categories').insert({
      store_id: storeId, name: data.name, description: data.description || null,
      is_active: data.isActive !== false, sort_order: (rows?.[0]?.sort_order || 0) + 1
    }).select('*').single();
    check(error); return category(row);
  }
  static async updateCategory(storeId: string, id: string, updates: Partial<Omit<MenuCategory, 'id'>>): Promise<MenuCategory> {
    const p: Record<string, unknown> = {};
    if (updates.name !== undefined) p.name = updates.name;
    if (updates.description !== undefined) p.description = updates.description;
    if (updates.isActive !== undefined) p.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) p.sort_order = updates.sortOrder;
    if (updates.icon !== undefined) p.icon = updates.icon;
    const { data, error } = await db().from('categories').update(p).eq('id', id)
      .eq('store_id', storeId).is('deleted_at', null).select('*').single();
    check(error); return category(data);
  }
  static async toggleCategoryStatus(storeId: string, id: string): Promise<MenuCategory> {
    const current = (await this.getCategories(storeId)).find(c => c.id === id);
    if (!current) throw new Error('Categoria não encontrada.');
    return this.updateCategory(storeId, id, { isActive: !current.isActive });
  }
  static async deleteCategory(storeId: string, id: string): Promise<boolean> {
    const { count, error: ce } = await db().from('products').select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).eq('category_id', id).is('deleted_at', null);
    check(ce);
    if (count) throw new Error(CATEGORY_HAS_ITEMS_ERROR);
    const { data, error } = await db().from('categories').update({ deleted_at: new Date().toISOString() })
      .eq('store_id', storeId).eq('id', id).is('deleted_at', null).select('id');
    check(error); return !!data?.length;
  }
  static async moveCategoryOrder(storeId: string, id: string, direction: 'up' | 'down'): Promise<MenuCategory[]> {
    const cats = await this.getCategories(storeId);
    const index = cats.findIndex(c => c.id === id), target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= cats.length) return cats;
    await this.updateCategory(storeId, cats[index].id, { sortOrder: cats[target].sortOrder });
    await this.updateCategory(storeId, cats[target].id, { sortOrder: cats[index].sortOrder });
    return this.getCategories(storeId);
  }
  static async getItems(storeId: string, filters?: MenuFilterOptions): Promise<MenuItem[]> {
    const client = db();
    const { data: products, error } = await client.from('products').select('*')
      .eq('store_id', storeId).is('deleted_at', null).order('sort_order');
    check(error);
    const ids = (products || []).map(p => p.id);
    if (!ids.length) return [];
    const { data: groups, error: ge } = await client.from('product_modifier_groups').select('*')
      .eq('store_id', storeId).in('product_id', ids).is('deleted_at', null).order('sort_order');
    check(ge);
    const groupIds = (groups || []).map(g => g.id);
    let options: any[] = [];
    if (groupIds.length) {
      const { data, error: oe } = await client.from('modifier_options').select('*')
        .eq('store_id', storeId).in('group_id', groupIds).is('deleted_at', null).order('sort_order');
      check(oe); options = data || [];
    }
    let result = (products || []).map(p => product(p, (groups || []).filter(g => g.product_id === p.id)
      .map(g => ({ id: g.id, name: g.name, isRequired: g.is_required,
        minQuantity: g.min_select, maxQuantity: g.max_select,
        options: options.filter(o => o.group_id === g.id).map(o => ({
          id: o.id, name: o.name, price: fromCents(o.price_cents), isAvailable: o.is_available
        })) }))));
    if (filters?.categoryId && filters.categoryId !== 'all') result = result.filter(p => p.categoryId === filters.categoryId);
    if (filters?.status && filters.status !== 'all') result = result.filter(p => p.isAvailable === (filters.status === 'active'));
    if (filters?.searchQuery?.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(p => p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) || p.highlightBadge?.toLowerCase().includes(q));
    }
    return result;
  }
  static async getItemById(storeId: string, id: string): Promise<MenuItem | undefined> {
    return (await this.getItems(storeId)).find(p => p.id === id);
  }
  static async createItem(storeId: string, data: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    const client = db();
    const { data: rows, error: re } = await client.from('products').select('sort_order')
      .eq('store_id', storeId).eq('category_id', data.categoryId).is('deleted_at', null)
      .order('sort_order', { ascending: false }).limit(1);
    check(re);
    const { data: row, error } = await client.from('products').insert({
      store_id: storeId, ...productPayload(data), sort_order: (rows?.[0]?.sort_order || 0) + 1
    }).select('id').single();
    check(error);
    if (data.modifierGroups?.length) await writeGroups(storeId, row.id, data.modifierGroups);
    const created = await this.getItemById(storeId, row.id);
    if (!created) throw new Error('Produto não encontrado após gravação.');
    return created;
  }
  static async updateItem(storeId: string, id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    const { error } = await db().from('products').update(productPayload(updates))
      .eq('store_id', storeId).eq('id', id).is('deleted_at', null).select('id').single();
    check(error);
    if ('modifierGroups' in updates) await writeGroups(storeId, id, updates.modifierGroups || []);
    const updated = await this.getItemById(storeId, id);
    if (!updated) throw new Error('Produto não encontrado após atualização.');
    return updated;
  }
  static async toggleItemAvailability(storeId: string, id: string): Promise<MenuItem> {
    const current = await this.getItemById(storeId, id);
    if (!current) throw new Error('Produto não encontrado.');
    return this.updateItem(storeId, id, { isAvailable: !current.isAvailable });
  }
  static async deleteItem(storeId: string, id: string): Promise<boolean> {
    const { data, error } = await db().from('products').update({ deleted_at: new Date().toISOString() })
      .eq('store_id', storeId).eq('id', id).is('deleted_at', null).select('id');
    check(error); return !!data?.length;
  }
  static async duplicateItem(storeId: string, id: string): Promise<MenuItem> {
    const original = await this.getItemById(storeId, id);
    if (!original) throw new Error('Produto não encontrado.');
    const { id: _id, ...data } = original;
    return this.createItem(storeId, { ...data, name: original.name + ' (Cópia)',
      modifierGroups: original.modifierGroups?.map(g => ({ ...g,
        options: g.options.map(o => ({ ...o })) })) });
  }
  static async moveItemOrder(storeId: string, id: string, direction: 'up' | 'down'): Promise<MenuItem[]> {
    const items = await this.getItems(storeId);
    const item = items.find(i => i.id === id);
    if (!item) return items;
    const same = items.filter(i => i.categoryId === item.categoryId);
    const index = same.findIndex(i => i.id === id), target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= same.length) return items;
    const a = same[index], b = same[target];
    const { error: ea } = await db().from('products').update({ sort_order: b.sortOrder || 0 })
      .eq('store_id', storeId).eq('id', a.id);
    check(ea);
    const { error: eb } = await db().from('products').update({ sort_order: a.sortOrder || 0 })
      .eq('store_id', storeId).eq('id', b.id);
    check(eb);
    return this.getItems(storeId);
  }
}
