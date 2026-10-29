import React, { useState } from 'react';
import { MenuItem, MenuCategory } from '../../../types';
import { formatCurrency } from '../../../components/shared';
import {
  Edit3,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  UtensilsCrossed,
  Tag,
  Check,
} from 'lucide-react';

interface ProductCardProps {
  item: MenuItem;
  categoryName?: string;
  isFirstInCategory?: boolean;
  isLastInCategory?: boolean;
  onEdit: (item: MenuItem) => void;
  onDuplicate: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onToggleStatus: (itemId: string) => void;
  onMoveOrder: (itemId: string, direction: 'up' | 'down') => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  categoryName,
  isFirstInCategory = false,
  isLastInCategory = false,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
  onMoveOrder,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const modifierCount = item.modifierGroups?.length || 0;
  const hasPromotional = item.promotionalPrice && item.promotionalPrice < item.price;

  return (
    <div
      className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border transition-all duration-200 select-none ${
        item.isAvailable
          ? 'bg-[#13161D] hover:bg-[#161B24] border-zinc-800/80 hover:border-zinc-700/80'
          : 'bg-[#0E1015] border-zinc-850 opacity-60 hover:opacity-85'
      }`}
    >
      {/* Left zone: Image + Info */}
      <div className="flex items-start sm:items-center gap-3.5 w-full sm:w-auto flex-1 min-w-0">
        {/* Product Photo or Fallback */}
        <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0 overflow-hidden flex items-center justify-center">
          {item.imageUrl && !imageError ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600 p-2 text-center">
              <UtensilsCrossed className="w-6 h-6 text-zinc-500 mb-1" />
              <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400">
                Biteo
              </span>
            </div>
          )}

          {/* Availability mini indicator */}
          <span
            className={`absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#13161D] ${
              item.isAvailable ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-rose-500'
            }`}
            title={item.isAvailable ? 'Ativo no cardápio' : 'Pausado'}
          />

          {hasPromotional && (
            <span className="absolute bottom-1 right-1 bg-[#FF5500] text-white text-[9px] font-bold px-1 py-0.2 rounded shadow">
              PROMO
            </span>
          )}
        </div>

        {/* Content details */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              {item.name}
            </h4>

            {item.highlightBadge && (
              <span className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.2 rounded font-medium">
                {item.highlightBadge}
              </span>
            )}

            {categoryName && (
              <span className="hidden md:inline-block text-[11px] text-zinc-400 font-medium">
                · {categoryName}
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed max-w-xl">
            {item.description || 'Sem descrição cadastrada.'}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {/* Prices */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-bold text-white font-mono tabular-nums">
                {formatCurrency(item.promotionalPrice || item.price)}
              </span>
              {hasPromotional && (
                <span className="text-xs text-zinc-500 line-through font-mono">
                  {formatCurrency(item.price)}
                </span>
              )}
            </div>

            {/* Modifier Groups Count Indicator */}
            {modifierCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-orange-300/80 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md">
                <Layers className="w-3 h-3 text-orange-400" />
                <span>
                  {modifierCount} {modifierCount === 1 ? 'grupo extra' : 'grupos extras'}
                </span>
              </span>
            )}

            {/* Preparation time if present */}
            {item.preparationTimeMinutes && (
              <span className="text-[11px] text-zinc-400">
                · {item.preparationTimeMinutes} min
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right zone: Status toggle + Action buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto mt-3 sm:mt-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-zinc-850 shrink-0">
        {/* Availability Toggle Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
            {item.isAvailable ? 'Ativo' : 'Pausado'}
          </span>
          <button
            type="button"
            onClick={() => onToggleStatus(item.id)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500/50 ${
              item.isAvailable ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
            title={item.isAvailable ? 'Clique para pausar item' : 'Clique para ativar item'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                item.isAvailable ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Reordering Up/Down controls */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
          <button
            type="button"
            disabled={isFirstInCategory}
            onClick={() => onMoveOrder(item.id, 'up')}
            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-400 transition-colors"
            title="Mover produto para cima"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLastInCategory}
            onClick={() => onMoveOrder(item.id, 'down')}
            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-400 transition-colors"
            title="Mover produto para baixo"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons: Edit, Duplicate, Delete */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="p-2 text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700/60 rounded-xl transition-colors"
            title="Editar produto e adicionais"
          >
            <Edit3 className="w-4 h-4 text-orange-400" />
          </button>

          <button
            type="button"
            onClick={() => onDuplicate(item.id)}
            className="p-2 text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700/60 rounded-xl transition-colors"
            title="Duplicar produto"
          >
            <Copy className="w-4 h-4 text-zinc-300" />
          </button>

          {isDeleting ? (
            <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 rounded-xl p-1 animate-in fade-in">
              <button
                type="button"
                onClick={() => {
                  onDelete(item.id);
                  setIsDeleting(false);
                }}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="px-1.5 py-1 text-zinc-400 hover:text-white text-[11px]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsDeleting(true)}
              className="p-2 text-zinc-400 hover:text-rose-400 bg-zinc-800/80 hover:bg-rose-500/10 border border-zinc-700/60 hover:border-rose-500/30 rounded-xl transition-colors"
              title="Excluir produto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
