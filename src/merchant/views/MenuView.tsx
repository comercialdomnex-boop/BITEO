import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, MenuCategory } from '../../types';
import { MenuService } from '../../services/menuService';
import { SearchInput, Button, formatCurrency } from '../../components/shared';
import { fromCents, sumCents } from '../../utils/money';
import { ProductCard } from '../components/menu/ProductCard';
import { ProductModal } from '../components/menu/ProductModal';
import { CategoriesModal } from '../components/menu/CategoriesModal';
import {
  Plus,
  FolderPlus,
  UtensilsCrossed,
  Filter,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShoppingBag,
} from 'lucide-react';

export const MenuView: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<MenuItem | null>(null);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial load
  const loadMenuData = async () => {
    const [cats, prods] = await Promise.all([
      MenuService.getCategories(storeId),
      MenuService.getItems(storeId),
    ]);
    setCategories(cats);
    setItems(prods);
  };

  useEffect(() => {
    loadMenuData();
  }, [storeId]);

  // Filtered Items logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Category filter
      if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) {
        return false;
      }
      // Status filter
      if (statusFilter === 'active' && !item.isAvailable) {
        return false;
      }
      if (statusFilter === 'paused' && item.isAvailable) {
        return false;
      }
      // Search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesBadge = item.highlightBadge?.toLowerCase().includes(q);
        const matchesModifier = item.modifierGroups?.some(group =>
          group.name.toLowerCase().includes(q) ||
          group.options.some(opt => opt.name.toLowerCase().includes(q))
        );
        return matchesName || matchesDesc || matchesBadge || matchesModifier;
      }
      return true;
    });
  }, [items, selectedCategoryId, statusFilter, searchQuery]);

  // Menu Overview Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const active = items.filter(i => i.isAvailable).length;
    const paused = total - active;
    const withPromotions = items.filter(
      i => i.promotionalPrice && i.promotionalPrice < i.price
    ).length;
    const avgPrice = total > 0 ? fromCents(Math.round(sumCents(items.map(i => i.price)) / total)) : 0;

    return { total, active, paused, withPromotions, avgPrice };
  }, [items]);

  // Product Actions
  const handleOpenCreateProduct = () => {
    setProductToEdit(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (item: MenuItem) => {
    setProductToEdit(item);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (
    productData: Omit<MenuItem, 'id'> & { id?: string }
  ) => {
    try {
      if (productData.id) {
        // Update existing product
        const updated = await MenuService.updateItem(storeId, productData.id, productData);
        setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
        showToast(`Produto "${updated.name}" atualizado com sucesso!`);
      } else {
        // Create new product
        const created = await MenuService.createItem(storeId, productData);
        setItems(prev => [...prev, created]);
        // Update category count
        await loadMenuData();
        showToast(`Produto "${created.name}" cadastrado com sucesso!`);
      }
    } catch {
      showToast('Ocorreu um erro ao salvar o produto.');
    }
  };

  const handleDuplicateProduct = async (itemId: string) => {
    try {
      const duplicate = await MenuService.duplicateItem(storeId, itemId);
      setItems(prev => [...prev, duplicate]);
      await loadMenuData();
      showToast(`Produto duplicado como "${duplicate.name}"`);
    } catch {
      showToast('Erro ao duplicar produto.');
    }
  };

  const handleDeleteProduct = async (itemId: string) => {
    try {
      const deleted = await MenuService.deleteItem(storeId, itemId);
      if (deleted) {
        setItems(prev => prev.filter(i => i.id !== itemId));
        await loadMenuData();
        showToast('Produto excluído do cardápio.');
      }
    } catch {
      showToast('Erro ao excluir produto.');
    }
  };

  const handleToggleProductStatus = async (itemId: string) => {
    try {
      const updated = await MenuService.toggleItemAvailability(storeId, itemId);
      setItems(prev => prev.map(i => (i.id === itemId ? updated : i)));
      showToast(
        `"${updated.name}" agora está ${updated.isAvailable ? 'ATIVO' : 'PAUSADO'}`
      );
    } catch {
      showToast('Não foi possível alterar a disponibilidade do item.');
    }
  };

  const handleMoveProductOrder = async (
    itemId: string,
    direction: 'up' | 'down'
  ) => {
    try {
      const nextList = await MenuService.moveItemOrder(storeId, itemId, direction);
      setItems([...nextList]);
    } catch {
      showToast('Não foi possível reordenar o produto.');
    }
  };

  // Category Actions
  const handleCreateCategory = async (data: {
    name: string;
    description?: string;
  }) => {
    const created = await MenuService.createCategory(storeId, data);
    await loadMenuData();
    showToast(`Categoria "${created.name}" criada com sucesso!`);
  };

  const handleUpdateCategory = async (
    id: string,
    data: { name: string; description?: string }
  ) => {
    await MenuService.updateCategory(storeId, id, data);
    await loadMenuData();
    showToast('Categoria atualizada com sucesso!');
  };

  const handleToggleCategoryStatus = async (id: string) => {
    const updated = await MenuService.toggleCategoryStatus(storeId, id);
    await loadMenuData();
    showToast(
      `Categoria "${updated.name}" ${updated.isActive ? 'ativada' : 'pausada'}.`
    );
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await MenuService.deleteCategory(storeId, id);
      await loadMenuData();
      showToast('Categoria removida.');
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : 'Não foi possível excluir a categoria.'
      );
    }
  };

  const handleMoveCategoryOrder = async (
    id: string,
    direction: 'up' | 'down'
  ) => {
    const updated = await MenuService.moveCategoryOrder(storeId, id, direction);
    setCategories(updated);
  };

  // Helper to get category name
  const getCategoryName = (catId: string) => {
    return categories.find(c => c.id === catId)?.name || 'Sem categoria';
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-3.5 bg-zinc-900 border border-orange-500/50 text-orange-200 text-xs font-semibold rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11141B] p-4 sm:p-5 rounded-3xl border border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans']">
              Gestão do Cardápio
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
              {metrics.total} itens
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Organize categorias, produtos, fotos, preços e adicionais do restaurante.
          </p>
        </div>

        {/* Primary Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<FolderPlus className="w-4 h-4 text-orange-400" />}
            onClick={() => setIsCategoriesModalOpen(true)}
            className="flex-1 sm:flex-initial"
          >
            Categorias
          </Button>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreateProduct}
            className="flex-1 sm:flex-initial"
          >
            + Novo Produto
          </Button>
        </div>
      </div>

      {/* Metrics Row (Desktop & Tablet) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[#13161D] border border-zinc-800">
          <span className="text-[11px] text-zinc-400 font-medium block">
            Produtos Ativos
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              {metrics.active}
            </span>
            <span className="text-[10px] text-zinc-500">visíveis na loja</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#13161D] border border-zinc-800">
          <span className="text-[11px] text-zinc-400 font-medium block">
            Itens Pausados
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-bold text-rose-400 font-mono tabular-nums">
              {metrics.paused}
            </span>
            <span className="text-[10px] text-zinc-500">esgotados</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#13161D] border border-zinc-800">
          <span className="text-[11px] text-zinc-400 font-medium block">
            Categorias Ativas
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
              {categories.filter(c => c.isActive).length}
            </span>
            <span className="text-[10px] text-zinc-500">de {categories.length}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#13161D] border border-zinc-800">
          <span className="text-[11px] text-zinc-400 font-medium block">
            Ticket Médio Cadastrado
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-bold text-orange-400 font-mono tabular-nums">
              {formatCurrency(metrics.avgPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar produto por nome, ingrediente ou adicional..."
          className="flex-1"
        />

        {/* Status Filter Segmented Control */}
        <div className="flex items-center self-end sm:self-auto bg-[#13161D] p-1 rounded-xl border border-zinc-800 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Ativos ({metrics.active})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paused')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'paused'
                ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Pausados ({metrics.paused})</span>
          </button>
        </div>
      </div>

      {/* Category Horizontal Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategoryId('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all select-none ${
            selectedCategoryId === 'all'
              ? 'bg-[#FF5500] text-white font-semibold shadow-md shadow-orange-950/40'
              : 'bg-[#13161D] text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <span>Todas as Categorias</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-white font-mono text-[10px]">
            {items.length}
          </span>
        </button>

        {categories.map(cat => {
          const isSelected = selectedCategoryId === cat.id;
          const count = items.filter(i => i.categoryId === cat.id).length;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all select-none ${
                isSelected
                  ? 'bg-[#FF5500] text-white font-semibold shadow-md shadow-orange-950/40'
                  : 'bg-[#13161D] text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              } ${!cat.isActive ? 'opacity-50' : ''}`}
            >
              <span>{cat.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  isSelected ? 'bg-black/20 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {count}
              </span>
              {!cat.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Categoria pausada" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsCategoriesModalOpen(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-orange-400 hover:text-orange-300 border border-dashed border-orange-500/40 hover:border-orange-500 bg-orange-500/5 whitespace-nowrap transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Active Filter Clear Helper */}
      {(selectedCategoryId !== 'all' || statusFilter !== 'all' || searchQuery) && (
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1 pt-1">
          <span>
            Exibindo <strong>{filteredItems.length}</strong> de {items.length} produtos
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryId('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="text-orange-400 hover:text-orange-300 font-semibold"
          >
            Limpar todos os filtros
          </button>
        </div>
      )}

      {/* Products List & Groupings */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {filteredItems.map((item, index) => {
            // Check boundaries for reordering within category
            const sameCategoryItems = filteredItems.filter(
              i => i.categoryId === item.categoryId
            );
            const itemCatIndex = sameCategoryItems.findIndex(i => i.id === item.id);
            const isFirst = itemCatIndex === 0;
            const isLast = itemCatIndex === sameCategoryItems.length - 1;

            return (
              <ProductCard
                key={item.id}
                item={item}
                categoryName={getCategoryName(item.categoryId)}
                isFirstInCategory={isFirst}
                isLastInCategory={isLast}
                onEdit={handleOpenEditProduct}
                onDuplicate={handleDuplicateProduct}
                onDelete={handleDeleteProduct}
                onToggleStatus={handleToggleProductStatus}
                onMoveOrder={handleMoveProductOrder}
              />
            );
          })}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-[#12141A] border border-dashed border-zinc-800">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto mb-3 border border-orange-500/20">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-zinc-100 mb-1">
            Seu cardápio está vazio
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
            Adicione seu primeiro produto para começar a vender.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreateProduct}
              className="font-bold shadow-lg shadow-orange-950/40"
            >
              Adicionar produto
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 px-4 rounded-3xl bg-[#12141A] border border-dashed border-zinc-800">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-zinc-200 mb-1">
            Nenhum produto encontrado
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
            Não encontramos produtos para os filtros selecionados ou para o termo pesquisado.
          </p>
          <div className="flex items-center justify-center gap-2">
            {(selectedCategoryId !== 'all' || statusFilter !== 'all' || searchQuery) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreateProduct}
            >
              Adicionar produto
            </Button>
          </div>
        </div>
      )}

      {/* Product Creation / Edit Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductToEdit(null);
        }}
        productToEdit={productToEdit}
        categories={categories}
        onSave={handleSaveProduct}
      />

      {/* Categories Management Modal */}
      <CategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={categories}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onToggleCategoryStatus={handleToggleCategoryStatus}
        onDeleteCategory={handleDeleteCategory}
        onMoveCategory={handleMoveCategoryOrder}
      />
    </div>
  );
};
