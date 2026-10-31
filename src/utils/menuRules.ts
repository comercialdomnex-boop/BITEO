/**
 * Pure menu rules shared by Merchant, Storefront and MenuService.
 *
 * Every rule here mirrors what the database (check constraints) and the
 * server-side checkout (public.create_guest_order) enforce, so the browser
 * rejects the same things the server would instead of failing at checkout.
 */
import type { CartItem, MenuCategory, MenuItem, ModifierGroup } from '../types';
import { fromCents, sumCents, toCents } from './money';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Minimum number of options a customer must pick in a group. Same formula as
 * create_guest_order: greatest(min_select, case when is_required then 1 else 0 end).
 */
export function requiredSelectionCount(group: Pick<ModifierGroup, 'isRequired' | 'minQuantity'>): number {
  return Math.max(group.minQuantity || 0, group.isRequired ? 1 : 0);
}

/** Server price: coalesce(promotional_price_cents, price_cents). */
export function effectiveUnitPriceCents(item: Pick<MenuItem, 'price' | 'promotionalPrice'>): number {
  return item.promotionalPrice == null ? toCents(item.price) : toCents(item.promotionalPrice);
}

export class MenuValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MenuValidationError';
  }
}

export function validateCategoryName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new MenuValidationError('O nome da categoria é obrigatório.');
  return trimmed;
}

/**
 * Validates the parts of a product that are present in `data` (works for a full
 * create payload and for partial updates). Throws before any write so a bad
 * payload never leaves half-written rows behind.
 */
export function validateProductInput(data: Partial<MenuItem>, isCreate: boolean): void {
  if (isCreate || 'name' in data) {
    if (!data.name || !data.name.trim()) throw new MenuValidationError('O nome do produto é obrigatório.');
  }
  if (isCreate || 'price' in data) {
    const cents = toCents(Number(data.price));
    if (!Number.isFinite(Number(data.price)) || cents <= 0) {
      throw new MenuValidationError('Informe um preço válido maior que zero.');
    }
  }
  if (data.promotionalPrice != null) {
    const promo = toCents(Number(data.promotionalPrice));
    if (!Number.isFinite(Number(data.promotionalPrice)) || promo < 0) {
      throw new MenuValidationError('Preço promocional inválido.');
    }
    if ('price' in data && promo >= toCents(Number(data.price))) {
      throw new MenuValidationError('O preço promocional deve ser menor que o preço original.');
    }
  }
  if (isCreate && !isUuid(data.categoryId)) {
    throw new MenuValidationError('Selecione uma categoria válida para o produto.');
  }
  if ('categoryId' in data && data.categoryId && !isUuid(data.categoryId)) {
    throw new MenuValidationError('Categoria inválida.');
  }
  if (data.preparationTimeMinutes != null && data.preparationTimeMinutes !== 0) {
    if (!Number.isInteger(data.preparationTimeMinutes) || data.preparationTimeMinutes < 0) {
      throw new MenuValidationError('Tempo de preparo inválido.');
    }
  }
  for (const group of data.modifierGroups || []) validateModifierGroup(group);
}

export function validateModifierGroup(group: ModifierGroup): void {
  const label = group.name?.trim() ? `"${group.name.trim()}"` : 'sem nome';
  if (!group.name || !group.name.trim()) throw new MenuValidationError('Todo grupo de adicionais precisa de um nome.');
  const min = group.minQuantity ?? 0;
  const max = group.maxQuantity ?? 1;
  if (!Number.isInteger(min) || min < 0) throw new MenuValidationError(`Mínimo inválido no grupo ${label}.`);
  if (!Number.isInteger(max) || max < 1) throw new MenuValidationError(`O máximo do grupo ${label} deve ser pelo menos 1.`);
  if (max < min) throw new MenuValidationError(`No grupo ${label}, o máximo não pode ser menor que o mínimo.`);
  if (!group.options.length) throw new MenuValidationError(`O grupo ${label} precisa de pelo menos uma opção.`);
  for (const option of group.options) {
    if (!option.name || !option.name.trim()) throw new MenuValidationError(`Há uma opção sem nome no grupo ${label}.`);
    if (!Number.isFinite(Number(option.price)) || toCents(Number(option.price)) < 0) {
      throw new MenuValidationError(`Preço inválido na opção "${option.name}".`);
    }
  }
  if (requiredSelectionCount(group) > group.options.length) {
    throw new MenuValidationError(`O grupo ${label} exige mais escolhas do que opções cadastradas.`);
  }
}

/**
 * What a customer may see and order. Mirrors create_guest_order: only available
 * products, active groups and available options are orderable. Products in a
 * paused category are hidden as well, and a product whose required group has no
 * longer enough available options is hidden because the server would refuse it.
 */
export function filterStorefrontMenu(
  categories: MenuCategory[],
  items: MenuItem[]
): { categories: MenuCategory[]; items: MenuItem[] } {
  const activeCategoryIds = new Set(categories.filter(c => c.isActive).map(c => c.id));
  const knownCategoryIds = new Set(categories.map(c => c.id));

  const visibleItems = items
    .filter(item => item.isAvailable)
    // A product without category (or pointing to a removed one) stays visible;
    // a product inside a paused category does not.
    .filter(item => !item.categoryId || !knownCategoryIds.has(item.categoryId) || activeCategoryIds.has(item.categoryId))
    .map(item => ({
      ...item,
      modifierGroups: (item.modifierGroups || [])
        .filter(group => group.isActive !== false)
        .map(group => ({ ...group, options: group.options.filter(o => o.isAvailable !== false) })),
    }))
    .filter(item => item.modifierGroups.every(group => group.options.length >= requiredSelectionCount(group)));

  const usedCategoryIds = new Set(visibleItems.map(i => i.categoryId));
  const visibleCategories = categories
    .filter(c => c.isActive && usedCategoryIds.has(c.id))
    .map(c => ({ ...c, itemCount: visibleItems.filter(i => i.categoryId === c.id).length }));

  return { categories: visibleCategories, items: visibleItems };
}

/**
 * Re-binds saved cart lines (localStorage) to the freshly loaded menu. Lines
 * whose product or options are no longer orderable are dropped; the remaining
 * ones get current names and prices so the displayed total matches what the
 * server will charge.
 */
export function reconcileCart(cart: CartItem[], menuItems: MenuItem[]): { cart: CartItem[]; removed: CartItem[] } {
  const byId = new Map(menuItems.map(i => [i.id, i]));
  const kept: CartItem[] = [];
  const removed: CartItem[] = [];

  for (const line of cart) {
    const item = line && line.item ? byId.get(line.item.id) : undefined;
    if (!item || !Number.isInteger(line.quantity) || line.quantity < 1) {
      removed.push(line);
      continue;
    }
    const groups = item.modifierGroups || [];
    let valid = true;
    const selections = (line.modifierSelections || []).map(sel => {
      const group = groups.find(g => g.id === sel.groupId);
      const option = group?.options.find(o => o.id === sel.optionId);
      if (!group || !option) {
        valid = false;
        return sel;
      }
      return { ...sel, groupName: group.name, name: option.name, unitPrice: option.price, quantity: 1, total: option.price };
    });
    if (valid) {
      for (const group of groups) {
        const count = selections.filter(s => s.groupId === group.id).length;
        if (count < requiredSelectionCount(group) || count > group.maxQuantity) valid = false;
      }
    }
    if (!valid) {
      removed.push(line);
      continue;
    }
    const baseCents = effectiveUnitPriceCents(item);
    const unitCents = baseCents + sumCents(selections.map(s => s.total));
    kept.push({
      ...line,
      item,
      modifierSelections: selections,
      basePrice: fromCents(baseCents),
      unitPrice: fromCents(unitCents),
      totalPrice: fromCents(unitCents * line.quantity),
    });
  }
  return { cart: kept, removed };
}

export type MenuErrorKind =
  | 'config'
  | 'network'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'unknown';

export class MenuServiceError extends Error {
  constructor(message: string, readonly kind: MenuErrorKind, readonly code?: string) {
    super(message);
    this.name = 'MenuServiceError';
  }
}

interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

/**
 * Translates a Supabase/PostgREST error into a real, actionable message.
 * Never turns a failure into an empty result.
 */
export function toMenuError(error: DbErrorLike | null | undefined, action: string): MenuServiceError {
  const message = error?.message || 'erro desconhecido';
  const code = error?.code || '';
  const lower = `${message} ${error?.details || ''}`.toLowerCase();

  if (/failed to fetch|networkerror|fetch failed|network request failed|load failed/.test(lower)) {
    return new MenuServiceError(
      `Não foi possível conectar ao servidor para ${action}. Verifique sua conexão e tente novamente.`,
      'network',
      code
    );
  }
  if (code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303' || error?.status === 401 || /jwt (expired|invalid)|invalid jwt/.test(lower)) {
    return new MenuServiceError(`Sua sessão expirou. Entre novamente para ${action}.`, 'auth', code);
  }
  if (code === '42501' || /row-level security|permission denied/.test(lower)) {
    return new MenuServiceError(
      `Sem permissão para ${action}. Apenas proprietário, administrador ou gerente desta loja podem alterar o cardápio.`,
      'permission',
      code
    );
  }
  if (code === 'PGRST116') {
    return new MenuServiceError(`Registro não encontrado ou sem permissão para ${action}.`, 'not_found', code);
  }
  if (code === '23505') {
    return new MenuServiceError('Já existe um registro com esse nome nesta loja.', 'conflict', code);
  }
  if (code === '23503') {
    return new MenuServiceError('A categoria ou o produto informado não pertence a esta loja.', 'validation', code);
  }
  if (code === '23514' || code === '23502') {
    return new MenuServiceError(`Dados inválidos ao ${action}: ${message}`, 'validation', code);
  }
  if (code === '22P02') {
    return new MenuServiceError(`Identificador inválido ao ${action}.`, 'validation', code);
  }
  return new MenuServiceError(`Falha ao ${action}: ${message}`, 'unknown', code);
}
