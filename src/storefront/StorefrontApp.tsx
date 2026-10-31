import React, { useState, useEffect } from 'react';
import {
  RestaurantProfile,
  MenuItem,
  MenuCategory,
  StoreConfig,
  Order,
  PaymentMethod,
  PaymentStatus,
  PaymentTiming,
  buildOrderItemSnapshot,
} from '../types';
import { MenuService } from '../services/menuService';
import { OrderService } from '../services/orderService';
import { submitGuestOrder } from '../services/checkoutApi';

import { RestaurantService } from '../services/restaurantService';
import { createEmptyStoreConfig } from '../services/storeService';
import { evaluateSchedule } from '../utils/hours';
import { normalizePhone } from '../utils/phone';
import { fromCents, sumCents, toCents } from '../utils/money';
import { reconcileCart } from '../utils/menuRules';
import { formatCurrency, Modal, Button, playOrderNotificationSound } from '../components/shared';
import { CartItem } from './types';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderConfirmedView } from './components/OrderConfirmedView';
import {
  ArrowLeft,
  Clock,
  ShoppingBag,
  Search,
  Plus,
  Bike,
  Check,
  UtensilsCrossed,
  MapPin,
  Sparkles,
} from 'lucide-react';

interface StorefrontAppProps {
  restaurant: RestaurantProfile;
  config?: StoreConfig;
  orders?: Order[];
  onBackToMerchant: () => void;
  publicMode?: boolean;
  onOrderPlaced?: (order: Order) => void;
  onViewOrderInMerchant?: (order: Order) => void;
}

export const StorefrontApp: React.FC<StorefrontAppProps> = ({
  restaurant,
  config: propConfig,
  orders,
  onBackToMerchant,
  publicMode = false,
  onOrderPlaced,
  onViewOrderInMerchant,
}) => {
  // No fixture fallback: without a real store config this is the empty state.
  const storeConfig = propConfig || createEmptyStoreConfig();
  const { theme, info, hours, delivery } = storeConfig;

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderModality, setOrderModality] = useState<'delivery' | 'retirada'>(
    delivery.allowDelivery ? 'delivery' : 'retirada'
  );

  // Cart State (Persisted in Session / Local storage)
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(`biteo_cart_${storeConfig.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals & Navigation State
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isAreasModalOpen, setIsAreasModalOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  // Customization Modal State
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  // Confirmed Order State for Live Tracking
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);


  // Sync cart changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`biteo_cart_${storeConfig.id}`, JSON.stringify(cartItems));
    } catch {
      // ignore
    }
  }, [cartItems, storeConfig.id]);

  // Schedule detail + effective availability (schedule AND switch AND published)
  const openStatus = evaluateSchedule(hours);
  const activeDeliveryAreas = RestaurantService.getActiveDeliveryAreas(storeConfig);

  useEffect(() => {
    OrderService.setStoreContext(storeConfig.id, orders);
  }, [storeConfig.id, orders]);

  // Menu comes from the same Supabase tables the Merchant edits. A failure is
  // shown as an error with retry, never as an empty menu.
  const [menuStatus, setMenuStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuNonce, setMenuNonce] = useState(0);
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMenuStatus('loading');
    setMenuError(null);
    MenuService.getStorefrontMenu(storeConfig.id)
      .then(menu => {
        if (cancelled) return;
        setCategories(menu.categories);
        setItems(menu.items);
        setMenuStatus('ready');
        // Saved cart lines are re-bound to the current menu: unavailable items
        // are removed and prices refreshed to what the server will charge.
        setCartItems(prev => {
          const { cart, removed } = reconcileCart(prev, menu.items);
          if (removed.length) {
            setCartNotice(
              `${removed.length} ${removed.length === 1 ? 'item foi removido' : 'itens foram removidos'} da sacola porque não ${removed.length === 1 ? 'está' : 'estão'} mais disponíve${removed.length === 1 ? 'l' : 'is'}.`
            );
          }
          return cart;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMenuStatus('error');
        setMenuError(error instanceof Error ? error.message : 'Não foi possível carregar o cardápio.');
      });
    return () => {
      cancelled = true;
    };
  }, [storeConfig.id, menuNonce]);

  // Style classes based on visualStyle
  const getStyleClasses = () => {
    switch (theme.visualStyle) {
      case 'minimalista':
        return {
          card: 'rounded-lg border border-zinc-700/60 bg-[#12141A]',
          badge: 'rounded-md text-[10px] font-mono tracking-tight',
          button: 'rounded-lg font-medium',
          pill: 'rounded-lg',
          bannerRadius: 'rounded-b-none',
        };
      case 'vibrante':
        return {
          card: 'rounded-3xl border-2 border-zinc-700/80 bg-[#151924] shadow-xl',
          badge: 'rounded-full text-[10px] font-extrabold uppercase tracking-wider',
          button: 'rounded-2xl font-bold shadow-lg',
          pill: 'rounded-full',
          bannerRadius: 'rounded-b-3xl',
        };
      case 'moderno':
      default:
        return {
          card: 'rounded-2xl border border-zinc-800 bg-[#141720] shadow-md',
          badge: 'rounded-full text-[10px] font-semibold',
          button: 'rounded-xl font-semibold',
          pill: 'rounded-xl',
          bannerRadius: 'rounded-b-2xl',
        };
    }
  };

  const styleClasses = getStyleClasses();

  // Handlers for Cart
  const handleOpenProduct = (item: MenuItem) => {
    setEditingCartItem(null);
    setCustomizingItem(item);
  };

  const handleEditCartItem = (cartItem: CartItem) => {
    setIsCartModalOpen(false);
    setEditingCartItem(cartItem);
    setCustomizingItem(cartItem.item);
  };

  const handleSaveToCart = (newOrUpdatedItem: CartItem) => {
    setCartItems(prev => {
      const existsIndex = prev.findIndex(i => i.id === newOrUpdatedItem.id);
      if (existsIndex >= 0) {
        const next = [...prev];
        next[existsIndex] = newOrUpdatedItem;
        return next;
      }
      return [...prev, newOrUpdatedItem];
    });

    setAddedNotice(
      `${newOrUpdatedItem.quantity}x ${newOrUpdatedItem.item.name} na sacola!`
    );
    setTimeout(() => setAddedNotice(null), 3200);
    setCustomizingItem(null);
    setEditingCartItem(null);
  };

  const handleUpdateCartQuantity = (cartItemId: string, delta: number) => {
    setCartItems(prev =>
      prev
        .map(ci => {
          if (ci.id === cartItemId) {
            const nextQty = ci.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...ci,
              quantity: nextQty,
              totalPrice: fromCents(toCents(ci.unitPrice) * nextQty),
            };
          }
          return ci;
        })
        .filter((ci): ci is CartItem => ci !== null)
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCartItems(prev => prev.filter(ci => ci.id !== cartItemId));
  };

  // Cart Totals (integer cents to avoid float drift)
  const cartTotalCents = sumCents(cartItems.map(item => item.totalPrice));
  const cartTotalAmount = fromCents(cartTotalCents);
  const cartTotalItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const isFreeDelivery =
    Boolean(
      delivery.freeDeliveryThreshold &&
      delivery.freeDeliveryThreshold > 0 &&
      cartTotalCents >= toCents(delivery.freeDeliveryThreshold)
    ) && orderModality === 'delivery';

  const deliveryFeeCents =
    orderModality === 'delivery' ? (isFreeDelivery ? 0 : toCents(delivery.fixedFee)) : 0;
  const deliveryFee = fromCents(deliveryFeeCents);

  const orderGrandTotal = fromCents(cartTotalCents + deliveryFeeCents);

  // Filter items
  const filteredItems = items.filter(i => {
    if (!i.isAvailable) return false;
    if (selectedCat !== 'all' && i.categoryId !== selectedCat) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Proceed to Checkout
  const handleProceedToCheckout = () => {
    setIsCartModalOpen(false);
    setIsCheckoutModalOpen(true);
  };

  // Submit and Confirm Order
  const handleConfirmOrder = async (orderPayload: {
    customer: { name: string; phone: string };
    type: 'delivery' | 'retirada';
    deliveryAddress?: {
      street: string;
      number: string;
      neighborhood: string;
      complement?: string;
      reference?: string;
      city: string;
      state: string;
      zipCode?: string;
    };
    paymentMethod: PaymentMethod;
    paymentTiming: PaymentTiming;
    paymentStatus: PaymentStatus;
    changeFor?: number;
    generalNotes?: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    turnstileToken: string;
    deliveryAreaId?: string;
  }) => {
    // Re-evaluate the clock at submission, even if checkout was opened earlier.
    if (!RestaurantService.buildProfile(storeConfig).isOpen) {
      throw new Error('A loja não está recebendo pedidos agora. Confira o horário e tente novamente mais tarde.');
    }
    const customerPhone = normalizePhone(orderPayload.customer.phone);

    // Immutable snapshots: productId, basePrice and structured modifiers survive
    // any later menu change.
    const formattedOrderItems = cartItems.map(ci =>
      buildOrderItemSnapshot({
        lineId: ci.id,
        productId: ci.item.id,
        name: ci.item.name,
        quantity: ci.quantity,
        basePrice: ci.basePrice,
        notes: ci.notes,
        modifiers: ci.modifierSelections,
        imageUrl: ci.item.imageUrl,
      })
    );

    // Somente a confirmação do servidor autoriza exibir o pedido como recebido.
    const receipt = await submitGuestOrder({
      storeId: storeConfig.id,
      customer: { name: orderPayload.customer.name, phone: orderPayload.customer.phone, phoneNormalized: customerPhone },
      type: orderPayload.type,
      deliveryAddress: orderPayload.deliveryAddress,
      deliveryAreaId: orderPayload.deliveryAreaId,
      paymentMethod: orderPayload.paymentMethod,
      paymentTiming: orderPayload.paymentTiming,
      changeForCents: orderPayload.changeFor === undefined ? undefined : toCents(orderPayload.changeFor),
      notes: orderPayload.generalNotes,
      cartItems,
      turnstileToken: orderPayload.turnstileToken,
    });

    if (publicMode && receipt.trackingToken && /^[0-9a-f]{64}$/.test(receipt.trackingToken)) {
      const url = `${window.location.origin}/${storeConfig.online.slug}#/pedido/${receipt.trackingToken}`;
      setTrackingUrl(url);
      try { localStorage.setItem(`biteo_last_tracking_${storeConfig.id}`, url); } catch { /* storage disabled */ }
    }

    // A confirmação do Supabase já é definitiva neste ponto. Falhas na
    // projeção local ou em notificações nunca devem provocar um segundo POST.
    try {
      // First order must be derived from this store's own history.
      const isFirstOrder = !(await OrderService.hasPreviousOrder(customerPhone));
  
      const newOrder = await OrderService.createOrder({
        customer: {
          id: `cust_${Date.now()}`,
          name: orderPayload.customer.name,
          phone: customerPhone,
          isFirstOrder,
        },
        items: formattedOrderItems,
        itemsCount: formattedOrderItems.reduce((acc, i) => acc + i.quantity, 0),
        type: orderPayload.type,
        subtotal: orderPayload.subtotal,
        deliveryFee: orderPayload.deliveryFee,
        discount: 0,
        total: fromCents(receipt.totalCents),
        paymentMethod: receipt.paymentMethod ?? orderPayload.paymentMethod,
        paymentTiming: receipt.paymentTiming ?? orderPayload.paymentTiming,
        // Never shown as paid on creation: the server always starts 'pendente'.
        paymentStatus: 'pendente',
        changeFor: orderPayload.changeFor,
        deliveryAddress: orderPayload.deliveryAddress,
        generalNotes: orderPayload.generalNotes,
        estimatedTimeMin:
          orderPayload.type === 'delivery'
            ? parseInt(delivery.estimatedDeliveryTime) || 45
            : parseInt(delivery.estimatedPickupTime) || 20,
      }, { orderId: receipt.orderId, orderNumber: receipt.orderNumber });
  
      // Notify parent App and Merchant
      if (onOrderPlaced) {
        onOrderPlaced(newOrder);
      }
  
      // Play chime
      playOrderNotificationSound();
  
      // Clear cart
      setCartItems([]);
      try {
        localStorage.removeItem(`biteo_cart_${storeConfig.id}`);
      } catch {
        // ignore
      }
  
      // Close checkout and show confirmed view
      setIsCheckoutModalOpen(false);
      setConfirmedOrder(newOrder);
    } catch (error) {
      console.error('Pedido confirmado no servidor; falha na apresentação local', error);
      setCartItems([]);
      try { localStorage.removeItem(`biteo_cart_${storeConfig.id}`); } catch { /* storage indisponível */ }
      setIsCheckoutModalOpen(false);
      window.alert(`Pedido #${receipt.orderNumber} recebido pela loja. Houve um problema ao exibir a confirmação; NÃO envie novamente. Consulte o estabelecimento.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C0F] text-zinc-100 pb-28">
      {/* Toast Notice */}
      {addedNotice && (
        <div className="fixed top-16 left-4 right-4 sm:left-auto sm:right-6 z-50 p-3.5 bg-emerald-950 border border-emerald-500/40 text-emerald-200 text-xs font-semibold rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{addedNotice}</span>
        </div>
      )}

      {/* Only merchant preview shows admin navigation. */}
      {!publicMode && <div className="bg-[#12151D] border-b border-zinc-800 px-4 py-2 text-xs text-zinc-300 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: theme.primaryColor }}
          />
          <span className="truncate">
            Visualizando como cliente:{' '}
            <strong className="text-white">{info.name}</strong>
          </span>
        </div>
        <button
          onClick={onBackToMerchant}
          className="text-xs font-bold text-orange-400 hover:text-orange-300 underline shrink-0"
        >
          Voltar ao Painel BITEO
        </button>
      </div>}

      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-[#0A0C0F]/95 backdrop-blur-md border-b border-zinc-850 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {!publicMode ? <button
            onClick={onBackToMerchant}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar ao Painel</span>
          </button> : <span className="text-xs font-extrabold text-orange-500">BITEO</span>}

          <span className="text-xs font-bold tracking-tight text-white uppercase truncate">
            {info.name}
          </span>

          <div className="flex items-center gap-2">
            {cartTotalItemsCount > 0 && !confirmedOrder && (
              <button
                type="button"
                onClick={() => setIsCartModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-transform active:scale-95"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{cartTotalItemsCount}</span>
                <span className="font-mono hidden sm:inline">
                  · {formatCurrency(orderGrandTotal)}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {publicMode && !confirmedOrder && (() => {
        let lastUrl: string | null = null;
        try { lastUrl = localStorage.getItem(`biteo_last_tracking_${storeConfig.id}`); } catch { /* unavailable */ }
        return lastUrl ? <div className="mx-auto max-w-4xl px-4 pt-3"><a className="text-sm text-orange-400 underline" href={lastUrl}>Acompanhar meu último pedido</a></div> : null;
      })()}
      {/* If an order was just confirmed, render the tracking screen */}
      {confirmedOrder ? (
        (() => {
          const liveOrder =
            orders && orders.length > 0
              ? orders.find(o => o.id === confirmedOrder.id) || confirmedOrder
              : confirmedOrder;

          return (
            <div>
            {publicMode && trackingUrl && <div className="mx-auto max-w-4xl px-4 py-4"><a className="rounded-xl bg-orange-600 px-5 py-3 font-bold text-white inline-block" href={trackingUrl}>Acompanhar pedido e salvar link</a></div>}
            <OrderConfirmedView
              order={liveOrder}

              storeConfig={storeConfig}
              onNewOrder={() => { setConfirmedOrder(null); }}
              onViewInMerchant={
                onViewOrderInMerchant
                  ? () => onViewOrderInMerchant(liveOrder)
                  : undefined
              }
              primaryColor={theme.primaryColor}
              visualStyle={theme.visualStyle}
            />
            </div>
          );
        })()
      ) : (
        /* Regular Menu and Browsing Experience */
        <>
          {/* Hero Banner & Store Details */}
          <div className="max-w-4xl mx-auto px-4 pt-3">
            {/* Cover Banner */}
            <div
              className={`relative w-full h-36 sm:h-44 bg-zinc-900 overflow-hidden ${styleClasses.bannerRadius} border border-zinc-800 shadow-xl`}
            >
              {theme.bannerUrl ? (
                <img
                  src={theme.bannerUrl}
                  alt="Capa do restaurante"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primaryColor}22 0%, #11141B 100%)`,
                  }}
                >
                  <UtensilsCrossed className="w-8 h-8 text-zinc-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>

            {/* Profile Card Overlay */}
            <div className="relative -mt-10 px-2 sm:px-4 z-10">
              <div className={`${styleClasses.card} p-4 sm:p-5 shadow-2xl space-y-3`}>
                <div className="flex items-start gap-3.5">
                  {/* Logo */}
                  <div
                    className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden shrink-0 border-2 border-[#141720] shadow-xl flex items-center justify-center font-extrabold text-2xl text-white"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    {theme.logoUrl ? (
                      <img
                        src={theme.logoUrl}
                        alt={info.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{info.name.charAt(0) || 'B'}</span>
                    )}
                  </div>

                  {/* Title & Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                        {info.name}
                      </h1>

                      {/* Open Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 ${styleClasses.badge} ${
                          restaurant.isOpen
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            restaurant.isOpen
                              ? 'bg-emerald-400 animate-pulse'
                              : 'bg-rose-400'
                          }`}
                        />
                        <span>{openStatus.statusLabel}</span>
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {info.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{info.averageDeliveryTimeMin}</span>
                      </span>
                      <span>·</span>
                      <span className="text-[11px] text-zinc-400">
                        Mínimo: {formatCurrency(delivery.minimumOrderValue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery / Retirada Switcher & Area Lookup */}
                <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-1.5 bg-[#0E1015] p-1 rounded-xl border border-zinc-800">
                    {delivery.allowDelivery && (
                      <button
                        type="button"
                        onClick={() => setOrderModality('delivery')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          orderModality === 'delivery'
                            ? 'text-white shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={
                          orderModality === 'delivery'
                            ? { backgroundColor: theme.primaryColor }
                            : {}
                        }
                      >
                        <Bike className="w-3.5 h-3.5" />
                        <span>Entrega</span>
                      </button>
                    )}

                    {delivery.allowPickup && (
                      <button
                        type="button"
                        onClick={() => setOrderModality('retirada')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          orderModality === 'retirada'
                            ? 'text-white shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={
                          orderModality === 'retirada'
                            ? { backgroundColor: theme.primaryColor }
                            : {}
                        }
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Retirada</span>
                      </button>
                    )}
                  </div>

                  {/* Delivery Fee Notice or Areas trigger */}
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">
                      {orderModality === 'delivery' ? (
                        isFreeDelivery ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Frete Grátis alcançado!</span>
                          </span>
                        ) : (
                          <span>
                            Taxa de entrega:{' '}
                            <strong className="text-white font-mono">
                              {formatCurrency(delivery.fixedFee)}
                            </strong>
                          </span>
                        )
                      ) : (
                        <span className="text-emerald-400 font-semibold">
                          Sem taxa de entrega
                        </span>
                      )}
                    </span>

                    {activeDeliveryAreas.length > 0 && orderModality === 'delivery' && (
                      <button
                        type="button"
                        onClick={() => setIsAreasModalOpen(true)}
                        className="text-[11px] underline text-zinc-400 hover:text-white"
                      >
                        Ver bairros
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="max-w-4xl mx-auto px-4 mt-4">
            <div className="relative flex items-center w-full">
              <Search className="absolute left-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por pratos, bebidas..."
                className="w-full h-11 pl-10 pr-4 bg-[#141720] border border-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-1 transition-all"
                style={{ borderColor: theme.primaryColor + '40' }}
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="max-w-4xl mx-auto px-4 mt-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedCat('all')}
                className={`px-3.5 py-2 font-medium whitespace-nowrap transition-all ${
                  styleClasses.pill
                } ${
                  selectedCat === 'all'
                    ? 'text-white shadow-md'
                    : 'bg-[#141720] text-zinc-400 border border-zinc-800'
                }`}
                style={
                  selectedCat === 'all'
                    ? { backgroundColor: theme.primaryColor }
                    : {}
                }
              >
                Todos ({items.filter(i => i.isAvailable).length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  className={`px-3.5 py-2 font-medium whitespace-nowrap transition-all ${
                    styleClasses.pill
                  } ${
                    selectedCat === cat.id
                      ? 'text-white shadow-md'
                      : 'bg-[#141720] text-zinc-400 border border-zinc-800'
                  }`}
                  style={
                    selectedCat === cat.id
                      ? { backgroundColor: theme.primaryColor }
                      : {}
                  }
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Feed (Responsive Grid: 1 col on mobile, 2 cols on tablet/desktop) */}
          <div className="max-w-4xl mx-auto px-4 mt-4">
            {cartNotice && (
              <div role="status" className="mb-3 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200 flex items-start justify-between gap-3">
                <span>{cartNotice}</span>
                <button type="button" className="underline shrink-0" onClick={() => setCartNotice(null)}>OK</button>
              </div>
            )}
            {menuStatus === 'loading' ? (
              <p role="status" className="text-center py-16 text-xs text-zinc-400">Carregando cardápio...</p>
            ) : menuStatus === 'error' ? (
              <div role="alert" className="text-center py-12 px-4 rounded-3xl bg-rose-950/20 border border-rose-500/40 space-y-3">
                <h4 className="text-sm font-bold text-white">Não foi possível carregar o cardápio</h4>
                <p className="text-xs text-rose-200 max-w-sm mx-auto">{menuError}</p>
                <Button variant="secondary" size="sm" onClick={() => setMenuNonce(n => n + 1)} className="text-xs">
                  Tentar novamente
                </Button>
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenProduct(item)}
                    className={`${styleClasses.card} p-3.5 transition-all flex items-start justify-between gap-3.5 cursor-pointer group hover:border-zinc-700`}
                  >
                    {/* Image Thumbnail */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <UtensilsCrossed className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
                          {item.name}
                        </h3>
                        {item.highlightBadge && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                            style={{
                              color: theme.primaryColor,
                              backgroundColor: theme.primaryColor + '15',
                              borderColor: theme.primaryColor + '30',
                            }}
                          >
                            {item.highlightBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-2.5 flex items-baseline gap-2">
                        <span className="text-sm font-bold text-white font-mono">
                          {formatCurrency(item.promotionalPrice ?? item.price)}
                        </span>
                        {item.promotionalPrice != null && (
                          <span className="text-xs line-through text-zinc-500 font-mono">
                            {formatCurrency(item.price)}
                          </span>
                        )}
                        {item.modifierGroups && item.modifierGroups.length > 0 && (
                          <span
                            className="text-[10px] font-medium"
                            style={{ color: theme.primaryColor }}
                          >
                            · Personalizável
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenProduct(item);
                      }}
                      type="button"
                      className={`p-2.5 ${styleClasses.button} text-white shadow-md active:scale-95 transition-transform shrink-0`}
                      style={{ backgroundColor: theme.primaryColor }}
                      title="Personalizar e adicionar"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-[#12141A] border border-dashed border-zinc-800 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto border border-orange-500/20">
                  <UtensilsCrossed className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Cardápio em preparação</h4>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Este estabelecimento está cadastrando seus produtos e preparando novidades. Volte em instantes para fazer seu pedido!
                  </p>
                </div>
                {!publicMode && onBackToMerchant && (
                  <div className="pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onBackToMerchant}
                      className="text-xs"
                    >
                      Voltar para o Painel
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 px-4 rounded-3xl bg-[#12141A] border border-dashed border-zinc-800 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum produto encontrado</h4>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  {searchQuery
                    ? `Não encontramos pratos para "${searchQuery}". Tente outro termo.`
                    : 'Nenhum produto disponível nesta categoria no momento.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCat('all');
                    }}
                    className="mt-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Ver todo o cardápio
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Delivery Areas Modal */}
          {isAreasModalOpen && (
            <Modal
              isOpen={isAreasModalOpen}
              onClose={() => setIsAreasModalOpen(false)}
              title="Regiões Atendidas & Frete"
              subtitle={`Valores de entrega calculados para ${info.name}`}
              maxWidth="sm"
              footer={
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setIsAreasModalOpen(false)}
                >
                  Entendido
                </Button>
              }
            >
              <div className="space-y-2.5 text-xs text-zinc-200">
                {activeDeliveryAreas.map(area => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0E1015] border border-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-orange-400" />
                      <span className="font-semibold text-white">{area.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white block">
                        {formatCurrency(area.fee)}
                      </span>
                      {area.estimatedMinutes && (
                        <span className="text-[10px] text-zinc-500">
                          ~{area.estimatedMinutes} min
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Modal>
          )}

          {/* Product Customization Sheet / Modal */}
          <ProductDetailModal
            item={customizingItem}
            isOpen={Boolean(customizingItem)}
            onClose={() => {
              setCustomizingItem(null);
              setEditingCartItem(null);
            }}
            onAddToCart={handleSaveToCart}
            editingCartItem={editingCartItem}
            primaryColor={theme.primaryColor}
            visualStyle={theme.visualStyle}
          />

          {/* Persistent Cart Drawer / Modal */}
          <CartDrawer
            isOpen={isCartModalOpen}
            onClose={() => setIsCartModalOpen(false)}
            cartItems={cartItems}
            storeConfig={storeConfig}
            orderModality={orderModality}
            onChangeModality={setOrderModality}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onEditItem={handleEditCartItem}
            onProceedToCheckout={handleProceedToCheckout}
            primaryColor={theme.primaryColor}
            visualStyle={theme.visualStyle}
          />

          {/* Multi-Step Checkout Modal */}
          <CheckoutModal
            isOpen={isCheckoutModalOpen}
            onClose={() => setIsCheckoutModalOpen(false)}
            cartItems={cartItems}
            storeConfig={storeConfig}
            orderModality={orderModality}
            onChangeModality={setOrderModality}
            onConfirmOrder={handleConfirmOrder}
            primaryColor={theme.primaryColor}
            visualStyle={theme.visualStyle}
          />

          {/* Floating Bottom Cart Bar (Consumer UX) */}
          {cartTotalItemsCount > 0 && !isCartModalOpen && !isCheckoutModalOpen && (
            <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40 animate-in slide-in-from-bottom-4 duration-200">
              <div
                onClick={() => setIsCartModalOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    setIsCartModalOpen(true);
                  }
                }}
                className={`p-3.5 ${styleClasses.card} text-white shadow-2xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform`}
                style={{
                  backgroundColor: theme.primaryColor,
                  borderColor: theme.primaryColor,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-black/25 flex items-center justify-center font-bold text-xs">
                    {cartTotalItemsCount}
                  </div>
                  <div>
                    <p className="text-xs font-bold">Ver Sacola</p>
                    <p className="text-[11px] text-white/90 font-mono">
                      {formatCurrency(orderGrandTotal)}
                    </p>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 bg-black/25 hover:bg-black/40 rounded-xl text-xs font-bold transition-colors">
                  Avançar
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

