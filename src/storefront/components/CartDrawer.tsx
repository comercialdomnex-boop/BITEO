import React from 'react';
import { CartItem } from '../types';
import { StoreConfig } from '../../types';
import { formatCurrency, Modal, calculateCartTotals } from '../../components/shared';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Edit2,
  Bike,
  Store,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  storeConfig: StoreConfig;
  orderModality: 'delivery' | 'retirada';
  onChangeModality: (modality: 'delivery' | 'retirada') => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onEditItem: (cartItem: CartItem) => void;
  onProceedToCheckout: () => void;
  primaryColor?: string;
  visualStyle?: 'moderno' | 'minimalista' | 'vibrante';
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  storeConfig,
  orderModality,
  onChangeModality,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  onProceedToCheckout,
  primaryColor = '#FF5500',
  visualStyle = 'moderno',
}) => {
  const { delivery } = storeConfig;

  const {
    subtotal,
    isFreeDelivery,
    deliveryFee,
    total,
    minimumOrder,
    isBelowMinimum,
    missingForMinimum,
    canProceed,
  } = calculateCartTotals(cartItems, delivery, orderModality);

  const freeThreshold = delivery.freeDeliveryThreshold || 0;
  const remainingForFreeDelivery =
    freeThreshold > 0 && subtotal < freeThreshold ? freeThreshold - subtotal : 0;

  const getStyleClasses = () => {
    switch (visualStyle) {
      case 'minimalista':
        return {
          button: 'rounded-lg font-medium',
          card: 'rounded-xl border border-zinc-800 bg-[#12141C]',
        };
      case 'vibrante':
        return {
          button: 'rounded-2xl font-bold shadow-lg',
          card: 'rounded-2xl border-2 border-zinc-750 bg-[#151926]',
        };
      case 'moderno':
      default:
        return {
          button: 'rounded-xl font-semibold shadow-md',
          card: 'rounded-2xl border border-zinc-800 bg-[#141722]',
        };
    }
  };

  const styles = getStyleClasses();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sua Sacola"
      subtitle={`${cartItems.length} ${
        cartItems.length === 1 ? 'item selecionado' : 'itens selecionados'
      }`}
      maxWidth="md"
      footer={
        cartItems.length > 0 ? (
          <div className="w-full space-y-3">
            {/* Minimum order warning */}
            {isBelowMinimum && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  O pedido mínimo para entrega é{' '}
                  <strong className="text-white">{formatCurrency(minimumOrder)}</strong>.
                  Adicione mais{' '}
                  <strong className="text-white">
                    {formatCurrency(missingForMinimum)}
                  </strong>{' '}
                  ou escolha retirar no balcão.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onProceedToCheckout}
              disabled={!canProceed}
              className={`w-full py-3.5 px-4 ${styles.button} text-white font-bold text-sm flex items-center justify-between transition-all ${
                canProceed
                  ? 'hover:brightness-110 active:scale-[0.98]'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                backgroundColor: canProceed ? primaryColor : '#3f3f46',
              }}
            >
              <div className="flex items-center gap-2">
                <span>Continuar Pedido</span>
                <ArrowRight className="w-4 h-4" />
              </div>
              <span className="font-mono text-base">{formatCurrency(total)}</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 text-zinc-100">
        {/* Modality Selector Inside Cart */}
        <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <button
            type="button"
            onClick={() => onChangeModality('delivery')}
            disabled={!delivery.allowDelivery}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
              orderModality === 'delivery'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            } ${!delivery.allowDelivery ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <Bike
              className="w-4 h-4"
              style={{
                color: orderModality === 'delivery' ? primaryColor : undefined,
              }}
            />
            <span>Entrega</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeModality('retirada')}
            disabled={!delivery.allowPickup}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
              orderModality === 'retirada'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            } ${!delivery.allowPickup ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <Store
              className="w-4 h-4"
              style={{
                color: orderModality === 'retirada' ? primaryColor : undefined,
              }}
            />
            <span>Retirar no Balcão</span>
          </button>
        </div>

        {/* Free Delivery Bar Progress */}
        {orderModality === 'delivery' && freeThreshold > 0 && (
          <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              {isFreeDelivery ? (
                <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Você ganhou ENTREGA GRÁTIS!</span>
                </span>
              ) : (
                <span className="text-zinc-300">
                  Faltam{' '}
                  <strong className="text-white font-mono">
                    {formatCurrency(remainingForFreeDelivery)}
                  </strong>{' '}
                  para entrega grátis
                </span>
              )}
              <span className="text-[11px] font-mono text-zinc-400">
                Meta: {formatCurrency(freeThreshold)}
              </span>
            </div>

            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (subtotal / freeThreshold) * 100)}%`,
                  backgroundColor: isFreeDelivery ? '#10b981' : primaryColor,
                }}
              />
            </div>
          </div>
        )}

        {/* Items List */}
        {cartItems.length > 0 ? (
          <div className="space-y-2.5">
            {cartItems.map(cartItem => (
              <div
                key={cartItem.id}
                className={`p-3.5 ${styles.card} relative flex flex-col gap-2`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white">{cartItem.item.name}</h4>
                    <span className="text-xs font-mono text-zinc-400">
                      {formatCurrency(cartItem.unitPrice)} cada
                    </span>

                    {/* Modifiers List */}
                    {cartItem.modifierSelections.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {cartItem.modifierSelections.map((modifier, idx) => (
                          <p
                            key={idx}
                            className="text-[11px] text-zinc-400 flex items-center gap-1"
                          >
                            <span
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: primaryColor }}
                            />
                            <span>
                              {modifier.quantity > 1
                                ? `${modifier.quantity}x ${modifier.name}`
                                : modifier.name}
                              {modifier.total > 0 && (
                                <span className="text-zinc-500 font-mono">
                                  {' '}
                                  (+{formatCurrency(modifier.total)})
                                </span>
                              )}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {cartItem.notes && (
                      <p className="text-[11px] text-zinc-400 mt-1.5 italic bg-zinc-900/80 px-2 py-1 rounded-lg border border-zinc-800">
                        Obs: {cartItem.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: primaryColor }}
                    >
                      {formatCurrency(cartItem.totalPrice)}
                    </span>
                  </div>
                </div>

                {/* Actions: Stepper + Edit + Remove */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditItem(cartItem)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                      title="Editar personalização"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(cartItem.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
                      title="Remover do carrinho"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remover</span>
                    </button>
                  </div>

                  {/* Stepper */}
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(cartItem.id, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                      title="Diminuir"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-mono font-bold text-xs text-white">
                      {cartItem.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(cartItem.id, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                      title="Aumentar"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Sua sacola está vazia</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Explore os itens do nosso cardápio e adicione os seus pratos favoritos.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Explorar Cardápio
            </button>
          </div>
        )}

        {/* Pricing Summary */}
        {cartItems.length > 0 && (
          <div className={`p-4 ${styles.card} space-y-2 text-xs`}>
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal dos itens</span>
              <span className="font-mono text-white">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between text-zinc-400">
              <span>
                {orderModality === 'delivery' ? 'Taxa de Entrega' : 'Taxa de Retirada'}
              </span>
              <span className="font-mono text-white">
                {orderModality === 'retirada'
                  ? 'Grátis (Balcão)'
                  : deliveryFee === 0
                  ? 'Grátis'
                  : formatCurrency(deliveryFee)}
              </span>
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline text-white">
              <span className="font-bold text-sm">Total</span>
              <span
                className="text-lg font-bold font-mono tabular-nums"
                style={{ color: primaryColor }}
              >
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
