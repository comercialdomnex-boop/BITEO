export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  isAvailable?: boolean;
}
export type AddonOption = ModifierOption;

export interface ModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minQuantity: number;
  maxQuantity: number;
  /** Mirrors product_modifier_groups.is_active. Undefined means active. */
  isActive?: boolean;
  options: ModifierOption[];
}
export type AddonGroup = ModifierGroup;

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  itemCount?: number;
  isActive: boolean;
  sortOrder: number;
}
export type Category = MenuCategory;

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  promotionalPrice?: number;
  isAvailable: boolean;
  imageUrl?: string;
  preparationTimeMinutes?: number;
  highlightBadge?: string;
  sortOrder?: number;
  modifierGroups?: ModifierGroup[];
}
export type Product = MenuItem;

export interface MenuFilterOptions {
  categoryId?: string;
  status?: 'all' | 'active' | 'paused';
  searchQuery?: string;
}
