import React, { useState, useEffect } from 'react';
import { MenuItem, ModifierGroup, OrderItemModifier } from '../../types';
import { CartItem } from '../types';
import { formatCurrency, Modal } from '../../components/shared';
import { fromCents, sumCents, toCents } from '../../utils/money';
import { effectiveUnitPriceCents, requiredSelectionCount } from '../../utils/menuRules';
import { Plus, Minus, Check, AlertCircle, Sparkles, Utensils } from 'lucide-react';

interface ProductDetailModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
  editingCartItem?: CartItem | null;
  primaryColor?: string;
  visualStyle?: 'moderno' | 'minimalista' | 'vibrante';
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
  editingCartItem,
  primaryColor = '#FF5500',
  visualStyle = 'moderno',
}) => {
  if (!item) return null;

  const [quantity, setQuantity] = useState<number>(1);
  const [selectedModifiers, setSelectedModifiers] = useState<{
    [groupId: string]: string[];
  }>({});
  const [itemNotes, setItemNotes] = useState<string>('');

  // Initialize or populate when opened or editing
  useEffect(() => {
    if (!isOpen) return;

    if (editingCartItem) {
      setQuantity(editingCartItem.quantity);
      setSelectedModifiers(editingCartItem.selectedModifiers);
      setItemNotes(editingCartItem.notes || '');
    } else {
      setQuantity(1);
      setItemNotes('');

      // Pre-select default or mandatory single-choice modifiers if configured
      const initial: { [groupId: string]: string[] } = {};
      if (item.modifierGroups) {
        item.modifierGroups.forEach(group => {
          if (group.isRequired && group.minQuantity === 1 && group.maxQuantity === 1) {
            const firstAvailable = group.options[0];
            if (firstAvailable) {
              initial[group.id] = [firstAvailable.id];
            } else {
              initial[group.id] = [];
            }
          } else {
            initial[group.id] = [];
          }
        });
      }
      setSelectedModifiers(initial);
    }
  }, [isOpen, item, editingCartItem]);

  const handleToggleOption = (group: ModifierGroup, optionId: string) => {
    setSelectedModifiers(prev => {
      const current = prev[group.id] || [];
      const isSingleSelect = group.maxQuantity === 1;

      if (isSingleSelect) {
        // If clicking already selected in single-select and not required, toggle off, otherwise set it
        if (current.includes(optionId) && requiredSelectionCount(group) === 0) {
          return { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [optionId] };
      }

      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter(id => id !== optionId) };
      } else {
        if (current.length >= group.maxQuantity) return prev;
        return { ...prev, [group.id]: [...current, optionId] };
      }
    });
  };

  // Check validation for required groups
  const validationErrors = (item.modifierGroups || []).filter(group => {
    const selected = selectedModifiers[group.id] || [];
    // Same rule as create_guest_order: greatest(min_select, is_required ? 1 : 0).
    if (selected.length < requiredSelectionCount(group)) {
      return true;
    }
    return false;
  });

  const isValid = validationErrors.length === 0;

  // Calculate Unit and Total Price
  // Same as the server: coalesce(promotional_price_cents, price_cents).
  const basePrice = fromCents(effectiveUnitPriceCents(item));
  const modifierSelections: OrderItemModifier[] = [];

  if (item.modifierGroups) {
    item.modifierGroups.forEach(group => {
      const selectedIds = selectedModifiers[group.id] || [];
      selectedIds.forEach(id => {
        const opt = group.options.find(o => o.id === id);
        if (opt) {
          modifierSelections.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            name: opt.name,
            unitPrice: opt.price,
            quantity: 1,
            total: opt.price,
          });
        }
      });
    });
  }

  const unitTotalCents = toCents(basePrice) + sumCents(modifierSelections.map(m => m.total));
  const unitTotal = fromCents(unitTotalCents);
  const grandTotal = fromCents(unitTotalCents * quantity);

  const handleConfirm = () => {
    if (!isValid) return;

    const cartItem: CartItem = {
      id: editingCartItem ? editingCartItem.id : `cart_${Date.now()}_${Math.random()}`,
      item,
      quantity,
      basePrice,
      unitPrice: unitTotal,
      totalPrice: grandTotal,
      selectedModifiers,
      modifierSelections,
      notes: itemNotes.trim() || undefined,
    };

    onAddToCart(cartItem);
    onClose();
  };

  const getStyleClasses = () => {
    switch (visualStyle) {
      case 'minimalista':
        return {
          button: 'rounded-lg font-medium',
          card: 'rounded-xl border border-zinc-800 bg-[#12141C]',
          input: 'rounded-lg',
        };
      case 'vibrante':
        return {
          button: 'rounded-2xl font-bold shadow-lg',
          card: 'rounded-2xl border-2 border-zinc-750 bg-[#151926]',
          input: 'rounded-2xl',
        };
      case 'moderno':
      default:
        return {
          button: 'rounded-xl font-semibold shadow-md',
          card: 'rounded-2xl border border-zinc-800 bg-[#141722]',
          input: 'rounded-xl',
        };
    }
  };

  const styles = getStyleClasses();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCartItem ? 'Editar Personalização' : 'Personalizar Pedido'}
      subtitle={item.name}
      maxWidth="md"
      footer={
        <div className="w-full space-y-2">
          {!isValid && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Selecione as opções obrigatórias acima para adicionar à sacola (
                {validationErrors.map(g => g.name).join(', ')})
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Quantity Stepper */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300 transition-colors"
                title="Diminuir"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 text-center font-bold font-mono text-sm text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                title="Aumentar"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Confirm Add to Cart Button */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isValid}
              className={`flex-1 py-3 px-4 ${styles.button} text-white font-bold text-sm flex items-center justify-between transition-all ${
                isValid
                  ? 'hover:brightness-110 active:scale-[0.98]'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                backgroundColor: isValid ? primaryColor : '#3f3f46',
              }}
            >
              <span>{editingCartItem ? 'Atualizar Sacola' : 'Adicionar à Sacola'}</span>
              <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-zinc-100 pb-2">
        {/* Product Media Header */}
        <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-48 sm:h-52 object-cover"
            />
          ) : (
            <div className="w-full h-36 bg-gradient-to-br from-zinc-850 to-zinc-950 flex flex-col items-center justify-center text-zinc-500">
              <Utensils className="w-10 h-10 mb-1 opacity-40 text-orange-400" />
              <span className="text-xs font-medium">Biteo Premium Food</span>
            </div>
          )}

          {item.promotionalPrice != null && (
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow-lg flex items-center gap-1"
              style={{ backgroundColor: primaryColor }}
            >
              <Sparkles className="w-3 h-3" />
              <span>Promoção</span>
            </div>
          )}

          <div className="p-4 bg-gradient-to-t from-[#10131A] via-[#10131A]/90 to-transparent">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold text-white">{item.name}</h3>
              <div className="text-right shrink-0">
                {item.promotionalPrice != null ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-zinc-500 line-through">
                      {formatCurrency(item.price)}
                    </span>
                    <span
                      className="text-base font-bold font-mono"
                      style={{ color: primaryColor }}
                    >
                      {formatCurrency(item.promotionalPrice)}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-base font-bold font-mono"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(item.price)}
                  </span>
                )}
              </div>
            </div>
            {item.description && (
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* Modifier Groups */}
        {item.modifierGroups && item.modifierGroups.length > 0 && (
          <div className="space-y-4">
            {item.modifierGroups.map(group => {
              const currentSelected = selectedModifiers[group.id] || [];
              const minRequired = requiredSelectionCount(group);
              const isGroupFilled = currentSelected.length >= minRequired;

              return (
                <div
                  key={group.id}
                  className={`p-3.5 ${styles.card} transition-colors ${
                    !isGroupFilled
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : ''
                  }`}
                >
                  {/* Group Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          {group.name}
                        </h4>
                        {minRequired > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Obrigatório
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400">
                            Opcional
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {minRequired > 0
                          ? minRequired === group.maxQuantity
                            ? `Selecione exatamente ${minRequired} ${minRequired === 1 ? 'opção' : 'opções'}`
                            : `Selecione de ${minRequired} a ${group.maxQuantity} opções`
                          : `Escolha até ${group.maxQuantity} ${
                              group.maxQuantity === 1 ? 'opção' : 'opções'
                            }`}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {isGroupFilled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          <span>Pronto</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-400">
                          {minRequired - currentSelected.length} restante(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5">
                    {group.options.map(option => {
                      const isSelected = currentSelected.includes(option.id);
                      const isSingle = group.maxQuantity === 1;

                      return (
                        <div
                          key={option.id}
                          onClick={() => handleToggleOption(group, option.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              handleToggleOption(group, option.id);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-zinc-800/90 border-zinc-650 shadow-xs'
                              : 'bg-zinc-900/60 hover:bg-zinc-850/80 border-zinc-800 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 flex items-center justify-center transition-colors ${
                                isSingle ? 'rounded-full' : 'rounded-md'
                              } border ${
                                isSelected
                                  ? 'border-transparent text-white'
                                  : 'border-zinc-700 bg-zinc-800'
                              }`}
                              style={{
                                backgroundColor: isSelected ? primaryColor : undefined,
                              }}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span
                              className={`font-medium ${
                                isSelected ? 'text-white' : 'text-zinc-300'
                              }`}
                            >
                              {option.name}
                            </span>
                          </div>

                          <span
                            className="font-mono text-xs font-semibold"
                            style={{
                              color: option.price > 0 ? primaryColor : '#71717a',
                            }}
                          >
                            {option.price > 0
                              ? `+ ${formatCurrency(option.price)}`
                              : 'Grátis'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Client Item Notes */}
        <div className={`p-3.5 ${styles.card}`}>
          <label
            htmlFor="itemNotes"
            className="block text-xs font-semibold text-zinc-300 mb-1.5"
          >
            Observações para a cozinha
          </label>
          <textarea
            id="itemNotes"
            rows={2}
            value={itemNotes}
            onChange={e => setItemNotes(e.target.value)}
            placeholder="Ex: sem cebola, ponto da carne bem passado, talher descartável..."
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500 transition-colors resize-none"
          />
        </div>
      </div>
    </Modal>
  );
};
