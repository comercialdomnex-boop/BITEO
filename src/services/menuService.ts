import { MenuCategory, MenuItem, MenuFilterOptions } from '../types';

export const CATEGORY_HAS_ITEMS_ERROR =
  'Esta categoria possui produtos. Mova ou remova os produtos antes de excluir a categoria.';

/**
 * Menu data is strictly scoped per store. Every read/write requires an explicit
 * `storeId` so categories and products never leak between tenants.
 */
export class MenuService {
  private static storeCategoriesMap: Map<string, MenuCategory[]> = new Map();
  private static storeItemsMap: Map<string, MenuItem[]> = new Map();

  static setStoreContext(
    storeId: string,
    initialCategories?: MenuCategory[],
    initialItems?: MenuItem[]
  ): void {
    if (!this.storeCategoriesMap.has(storeId)) {
      this.storeCategoriesMap.set(
        storeId,
        initialCategories ? [...initialCategories] : []
      );
    }
    if (!this.storeItemsMap.has(storeId)) {
      this.storeItemsMap.set(storeId, initialItems ? [...initialItems] : []);
    }
  }

  private static categoriesOf(storeId: string): MenuCategory[] {
    if (!this.storeCategoriesMap.has(storeId)) {
      this.storeCategoriesMap.set(storeId, []);
    }
    return this.storeCategoriesMap.get(storeId)!;
  }

  private static itemsOf(storeId: string): MenuItem[] {
    if (!this.storeItemsMap.has(storeId)) {
      this.storeItemsMap.set(storeId, []);
    }
    return this.storeItemsMap.get(storeId)!;
  }

  // --- CATEGORIES OPERATIONS ---

  static async getCategories(storeId: string): Promise<MenuCategory[]> {
    const items = this.itemsOf(storeId);
    return this.categoriesOf(storeId)
      .map(cat => ({
        ...cat,
        itemCount: items.filter(item => item.categoryId === cat.id).length,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  static async createCategory(
    storeId: string,
    category: {
      name: string;
      description?: string;
      isActive?: boolean;
    }
  ): Promise<MenuCategory> {
    const categories = this.categoriesOf(storeId);
    const newId = `cat_${Date.now()}`;
    const nextSort = categories.length + 1;
    const newCat: MenuCategory = {
      id: newId,
      name: category.name,
      description: category.description || '',
      isActive: category.isActive !== undefined ? category.isActive : true,
      sortOrder: nextSort,
      itemCount: 0,
    };
    categories.push(newCat);
    return newCat;
  }

  static async updateCategory(
    storeId: string,
    id: string,
    updates: Partial<Omit<MenuCategory, 'id'>>
  ): Promise<MenuCategory> {
    const categories = this.categoriesOf(storeId);
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Categoria não encontrada.');
    categories[index] = { ...categories[index], ...updates };
    return categories[index];
  }

  static async toggleCategoryStatus(
    storeId: string,
    id: string
  ): Promise<MenuCategory> {
    const categories = this.categoriesOf(storeId);
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Categoria não encontrada.');
    categories[index].isActive = !categories[index].isActive;
    return categories[index];
  }

  /**
   * Refuses to delete a category that still owns products. Deleting it would
   * silently orphan (or destroy) menu items.
   */
  static async deleteCategory(storeId: string, id: string): Promise<boolean> {
    const categories = this.categoriesOf(storeId);
    const items = this.itemsOf(storeId);

    const hasItems = items.some(item => item.categoryId === id);
    if (hasItems) {
      throw new Error(CATEGORY_HAS_ITEMS_ERROR);
    }

    const next = categories.filter(c => c.id !== id);
    if (next.length === categories.length) {
      throw new Error('Categoria não encontrada.');
    }
    this.storeCategoriesMap.set(storeId, next);
    return true;
  }

  static async moveCategoryOrder(
    storeId: string,
    categoryId: string,
    direction: 'up' | 'down'
  ): Promise<MenuCategory[]> {
    const sorted = [...this.categoriesOf(storeId)].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    const index = sorted.findIndex(c => c.id === categoryId);
    if (index === -1) return sorted;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return sorted;

    const currentSort = sorted[index].sortOrder;
    sorted[index].sortOrder = sorted[targetIndex].sortOrder;
    sorted[targetIndex].sortOrder = currentSort;

    this.storeCategoriesMap.set(storeId, sorted);
    return this.getCategories(storeId);
  }

  // --- ITEMS OPERATIONS ---

  static async getItems(
    storeId: string,
    filters?: MenuFilterOptions
  ): Promise<MenuItem[]> {
    let result = [...this.itemsOf(storeId)];

    if (filters) {
      if (filters.categoryId && filters.categoryId !== 'all') {
        result = result.filter(item => item.categoryId === filters.categoryId);
      }

      if (filters.status && filters.status !== 'all') {
        const isAvailable = filters.status === 'active';
        result = result.filter(item => item.isAvailable === isAvailable);
      }

      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const q = filters.searchQuery.toLowerCase().trim();
        result = result.filter(
          item =>
            item.name.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.highlightBadge?.toLowerCase().includes(q)
        );
      }
    }

    return result.sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
  }

  static async getItemById(storeId: string, id: string): Promise<MenuItem | undefined> {
    return this.itemsOf(storeId).find(i => i.id === id);
  }

  static async toggleItemAvailability(
    storeId: string,
    itemId: string
  ): Promise<MenuItem> {
    const items = this.itemsOf(storeId);
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) throw new Error('Produto não encontrado.');
    items[index].isAvailable = !items[index].isAvailable;
    return { ...items[index] };
  }

  static async createItem(
    storeId: string,
    data: Omit<MenuItem, 'id'>
  ): Promise<MenuItem> {
    const items = this.itemsOf(storeId);
    const newId = `prod_${Date.now()}`;
    const categoryItems = items.filter(i => i.categoryId === data.categoryId);
    const nextSort = categoryItems.length + 1;

    const newItem: MenuItem = {
      ...data,
      id: newId,
      sortOrder: nextSort,
      modifierGroups: data.modifierGroups || [],
    };

    items.push(newItem);
    return newItem;
  }

  static async updateItem(
    storeId: string,
    id: string,
    updates: Partial<MenuItem>
  ): Promise<MenuItem> {
    const items = this.itemsOf(storeId);
    const index = items.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Produto não encontrado.');

    items[index] = {
      ...items[index],
      ...updates,
      id,
    };
    return items[index];
  }

  static async deleteItem(storeId: string, id: string): Promise<boolean> {
    const items = this.itemsOf(storeId);
    const next = items.filter(i => i.id !== id);
    if (next.length === items.length) return false;
    this.storeItemsMap.set(storeId, next);
    return true;
  }

  static async duplicateItem(storeId: string, id: string): Promise<MenuItem> {
    const items = this.itemsOf(storeId);
    const original = items.find(i => i.id === id);
    if (!original) throw new Error('Produto não encontrado.');

    const newId = `prod_${Date.now()}`;
    const duplicate: MenuItem = {
      ...original,
      id: newId,
      name: `${original.name} (Cópia)`,
      sortOrder: (original.sortOrder || 0) + 1,
      modifierGroups: original.modifierGroups
        ? JSON.parse(JSON.stringify(original.modifierGroups))
        : [],
    };

    items.push(duplicate);
    return duplicate;
  }

  static async moveItemOrder(
    storeId: string,
    itemId: string,
    direction: 'up' | 'down'
  ): Promise<MenuItem[]> {
    const items = this.itemsOf(storeId);
    const item = items.find(i => i.id === itemId);
    if (!item) return [...items];

    const catItems = items
      .filter(i => i.categoryId === item.categoryId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const index = catItems.findIndex(i => i.id === itemId);
    if (index === -1) return [...items];

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= catItems.length) return [...items];

    const currentOrder = catItems[index].sortOrder || index + 1;
    const targetOrder = catItems[targetIndex].sortOrder || targetIndex + 1;

    catItems[index].sortOrder = targetOrder;
    catItems[targetIndex].sortOrder = currentOrder;

    return [...items];
  }
}