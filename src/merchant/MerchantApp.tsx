import './merchantTheme.css';
import { saveStorePublication } from '../services/storePublicationPersistence';
import React, { useState, useEffect, useRef } from 'react';
import {
  RestaurantProfile,
  Order,
  OrderStatus,
  StoreConfig,
  MenuItem,
  StoreInstance,
  CurrentUser,
  UserRole,
} from '../types';
import { saveOrderAcceptance } from '../services/orderAcceptancePersistence';
import { OrderAcceptanceControl } from './components/OrderAcceptanceControl';
import { Header } from '../components/shared/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav, MerchantTab } from './components/BottomNav';
import { OrdersView } from './views/OrdersView';
import { MenuView } from './views/MenuView';
import { MyStoreView } from './views/MyStoreView';
import { CustomersView } from './views/CustomersView';
import { ReportsView } from './views/ReportsView';
import { MoreView } from './views/MoreView';
import { OrderDetailModal } from './components/OrderDetailModal';
import { StoreSwitcherModal } from './components/StoreSwitcherModal';
import { MenuService } from '../services/menuService';
import { OrderService } from '../services/orderService';
import { formatCurrency, playOrderNotificationSound } from '../components/shared';
import { BellRing, Check, ExternalLink, Power, Volume2, VolumeX } from 'lucide-react';

interface MerchantAppProps {
  restaurant: RestaurantProfile;
  orders: Order[];
  storeConfig: StoreConfig;
  forceMobileLayout?: boolean;
  initialSelectedOrderId?: string | null;
  onClearInitialOrderId?: () => void;
  onUpdateStoreConfig: (config: StoreConfig) => void;
  onOrdersChange: (orders: Order[]) => void;
  onOpenStorefront?: () => void;
  onLogout?: () => void;
  onSelectStore?: (storeId: string) => void;
  onCreateNewStore?: () => void;
  stores?: StoreInstance[];
  currentUser?: CurrentUser | null;
  currentStoreId?: string | null;
  currentRole?: UserRole | null;
}

export const MerchantApp: React.FC<MerchantAppProps> = ({
  restaurant,
  orders,
  storeConfig,
  forceMobileLayout = false,
  initialSelectedOrderId,
  onClearInitialOrderId,
  onUpdateStoreConfig,
  onOrdersChange,
  onOpenStorefront,
  onLogout,
  onSelectStore,
  onCreateNewStore,
  stores = [],
  currentUser = null,
  currentStoreId,
  currentRole = null,
}) => {
  const [activeTab, setActiveTab] = useState<MerchantTab>('pedidos');
  const [incomingOrderNotification, setIncomingOrderNotification] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeModalOrder, setActiveModalOrder] = useState<Order | null>(null);
  const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState(false);

  const [acceptanceSaving, setAcceptanceSaving] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null);
  const acceptanceInFlight = useRef(false);
  const latestConfig = useRef(storeConfig);
  latestConfig.current = storeConfig;

  useEffect(() => { setAcceptanceError(null); }, [storeConfig.id]);

  const activeStoreId = currentStoreId || storeConfig.id;

  // Only management roles may edit store settings. ATENDANT is read-only; when
  // the role is unknown (membership not resolved) editing stays enabled so a
  // real owner is never locked out by a lookup failure.
  const canEditStore =
    currentRole === null ||
    currentRole === 'OWNER' ||
    currentRole === 'ADMIN' ||
    currentRole === 'MANAGER';

  // Handle incoming selection from storefront
  useEffect(() => {
    if (initialSelectedOrderId) {
      const match = orders.find(
        o => o.id === initialSelectedOrderId || o.displayId === initialSelectedOrderId
      );
      if (match) {
        setActiveModalOrder(match);
        setActiveTab('pedidos');
      }
      if (onClearInitialOrderId) {
        onClearInitialOrderId();
      }
    }
  }, [initialSelectedOrderId, orders, onClearInitialOrderId]);

  // Sync menu items for MyStore preview
  useEffect(() => {
    const loadItems = async () => {
      const prods = await MenuService.getItems(activeStoreId);
      setMenuItems(prods);
    };
    loadItems();
  }, [activeStoreId, activeTab]);

  // Track incoming orders from Storefront to trigger visual banner and sound alert
  const previousOrdersCountRef = useRef(orders.length);
  useEffect(() => {
    if (orders.length > previousOrdersCountRef.current) {
      const latestOrder = orders[0];
      if (latestOrder && latestOrder.status === 'novo') {
        setIncomingOrderNotification(
          `Novo pedido ${latestOrder.displayId} recebido de ${latestOrder.customer.name}! (${formatCurrency(latestOrder.total)})`
        );
        if (storeConfig.operations.soundAlertsEnabled) {
          playOrderNotificationSound();
        }
        setTimeout(() => {
          setIncomingOrderNotification(null);
        }, 5000);
      }
    }
    previousOrdersCountRef.current = orders.length;
  }, [orders, restaurant.soundAlertsEnabled]);

  const newOrdersCount = orders.filter(o => o.status === 'novo').length;

  const handleToggleStatus = async () => {
    if (!canEditStore || currentRole === null || acceptanceInFlight.current) return;
    acceptanceInFlight.current = true;
    const storeId = storeConfig.id;
    const opening = !storeConfig.operations.acceptingOrders || !storeConfig.online.isPublished;
    setAcceptanceSaving(true);
    setAcceptanceError(null);
    try {
      // Opening publishes the storefront first, then enables checkout.
      // Closing only pauses orders; the menu remains available to browse.
      if (opening && !storeConfig.online.isPublished) {
        await saveStorePublication(storeId, true);
      }
      const acceptingOrders = await saveOrderAcceptance(storeId, opening);
      if (latestConfig.current.id !== storeId) return;
      const current = latestConfig.current;
      onUpdateStoreConfig({
        ...current,
        online: { ...current.online, isPublished: opening ? true : current.online.isPublished },
        operations: { ...current.operations, acceptingOrders },
      });
    } catch (error) {
      if (latestConfig.current.id === storeId) {
        setAcceptanceError(error instanceof Error ? error.message : 'Não foi possível alterar o estado da loja.');
      }
    } finally {
      acceptanceInFlight.current = false;
      setAcceptanceSaving(false);
    }
  };

  const handleToggleSound = () => {
    const nextVal = !storeConfig.operations.soundAlertsEnabled;
    onUpdateStoreConfig({
      ...storeConfig,
      operations: {
        ...storeConfig.operations,
        soundAlertsEnabled: nextVal,
      },
    });
    if (nextVal) {
      playOrderNotificationSound();
    }
  };

  const handleChangeSoundAlerts = (enabled: boolean) => {
    onUpdateStoreConfig({
      ...storeConfig,
      operations: {
        ...storeConfig.operations,
        soundAlertsEnabled: enabled,
      },
    });
  };

  // Status update from global modal
  const handleUpdateModalOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    reason?: string
  ) => {
    try {
      const updated = await OrderService.updateOrderStatus(orderId, status, reason);
      const nextList = orders.map(o => (o.id === orderId ? updated : o));
      onOrdersChange(nextList);
      if (activeModalOrder && activeModalOrder.id === orderId) {
        setActiveModalOrder(updated);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao atualizar status do pedido';
      setIncomingOrderNotification(msg);
      setTimeout(() => setIncomingOrderNotification(null), 4000);
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'pedidos':
        return 'Dashboard de Pedidos';
      case 'cardapio':
        return 'Cardápio & Produtos';
      case 'loja':
        return 'Minha Loja Online';
      case 'clientes':
        return 'Clientes & Fidelidade';
      case 'relatorios':
        return 'Relatórios & Inteligência';
      case 'mais':
        return 'Mais Opções & Sistema';
    }
  };

  return (
    <div className="merchant-theme min-h-screen bg-[#0B0D10] text-zinc-100 flex flex-col md:flex-row">
      {acceptanceError && <div role="alert" className="fixed bottom-20 left-4 right-4 z-50 rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{acceptanceError}</div>}
      {/* Real-time Order Arrival Banner */}
      {incomingOrderNotification && (
        <div className="fixed top-14 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-2xl shadow-2xl border border-orange-400 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-black/20 rounded-xl">
              <BellRing className="w-4 h-4 animate-bounce text-white" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">NOVO PEDIDO CHEGANDO!</p>
              <p className="text-[11px] text-orange-100">{incomingOrderNotification}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('pedidos');
              setIncomingOrderNotification(null);
            }}
            className="text-xs font-semibold px-2.5 py-1 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
          >
            Ver
          </button>
        </div>
      )}

      {/* Desktop Sidebar (hidden on mobile and inside mobile mockup frame) */}
      {!forceMobileLayout && (
        <Sidebar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          newOrdersCount={newOrdersCount}
          restaurant={restaurant}
          onToggleStatus={handleToggleStatus}
          statusDisabled={!canEditStore || currentRole === null}
          statusSaving={acceptanceSaving}
          onToggleSound={handleToggleSound}
          onOpenStorefront={onOpenStorefront}
          onOpenStoreSwitcher={() => setIsStoreSwitcherOpen(true)}
          onLogout={onLogout}
        />
      )}

      {/* Main Column (Responsive) */}
      <div className={`flex-1 flex flex-col min-w-0 ${!forceMobileLayout ? 'md:h-screen md:overflow-y-auto no-scrollbar' : ''}`}>
        {/* Mobile Header (Hidden on Desktop unless forceMobileLayout is set) */}
        <div className={forceMobileLayout ? 'block' : 'md:hidden'}>
          <Header
            restaurant={restaurant}
            onToggleStatus={handleToggleStatus}
            statusDisabled={!canEditStore || currentRole === null}
            statusSaving={acceptanceSaving}
            onToggleSound={handleToggleSound}
            onOpenStorefront={onOpenStorefront}
            onOpenStoreSwitcher={() => setIsStoreSwitcherOpen(true)}
          />
        </div>

        {/* Desktop Top Bar (Hidden on Mobile or when in forceMobileLayout) */}
        {!forceMobileLayout && (
          <header className="hidden md:flex items-center justify-between px-6 py-3.5 bg-[#0B0D12]/90 backdrop-blur-md border-b border-zinc-850 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold text-white tracking-tight">{getTabTitle()}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-850 text-zinc-400 border border-zinc-750">
                Painel do Comerciante
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sound alert quick toggle */}
              <button
                type="button"
                onClick={handleToggleSound}
                className={`p-2 rounded-xl border text-xs transition-colors ${
                  storeConfig.operations.soundAlertsEnabled
                    ? 'border-orange-500/30 bg-orange-500/15 text-orange-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
                title={
                  storeConfig.operations.soundAlertsEnabled
                    ? 'Alertas sonoros ativos'
                    : 'Alertas sonoros mudos'
                }
              >
                {storeConfig.operations.soundAlertsEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              <OrderAcceptanceControl restaurant={restaurant} onToggle={handleToggleStatus}
                disabled={!canEditStore || currentRole === null} saving={acceptanceSaving} />

              {/* Storefront direct link */}
              {onOpenStorefront && (
                <button
                  type="button"
                  onClick={onOpenStorefront}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-colors border border-zinc-750"
                >
                  <span>Loja Online</span>
                  <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
                </button>
              )}
            </div>
          </header>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-20 md:pb-8">
          {activeTab === 'pedidos' && (
            <OrdersView
              orders={orders}
              onOrdersChange={onOrdersChange}
            />
          )}

          {activeTab === 'cardapio' && (
            <MenuView key={activeStoreId} storeId={activeStoreId} />
          )}

          {activeTab === 'loja' && (
            <MyStoreView
              config={storeConfig}
              items={menuItems}
              onUpdateConfig={onUpdateStoreConfig}
              onOpenStorefront={onOpenStorefront}
              canEdit={canEditStore}
            />
          )}

          {activeTab === 'clientes' && (
            <CustomersView
              orders={orders}
              onSelectOrder={order => setActiveModalOrder(order)}
            />
          )}

          {activeTab === 'relatorios' && <ReportsView orders={orders} />}

          {activeTab === 'mais' && (
            <MoreView
              restaurant={restaurant}
              onToggleStoreStatus={handleToggleStatus}
              onChangeSoundAlerts={handleChangeSoundAlerts}
              onOpenStorefront={onOpenStorefront}
              onOpenStoreSwitcher={() => setIsStoreSwitcherOpen(true)}
              onLogout={onLogout}
              onNavigateToTab={setActiveTab}
            />
          )}
        </main>
      </div>

      {/* Global Order Detail Modal (Accessible from CustomersView, etc.) */}
      {activeModalOrder && (
        <OrderDetailModal
          order={activeModalOrder}
          isOpen={Boolean(activeModalOrder)}
          onClose={() => setActiveModalOrder(null)}
          onUpdateStatus={handleUpdateModalOrderStatus}
        />
      )}

      {/* Store Switcher Modal */}
      {isStoreSwitcherOpen && (
        <StoreSwitcherModal
          isOpen={isStoreSwitcherOpen}
          onClose={() => setIsStoreSwitcherOpen(false)}
          currentUser={currentUser}
          stores={stores}
          currentStoreId={activeStoreId}
          onSelectStore={storeId => {
            if (onSelectStore) {
              onSelectStore(storeId);
            }
          }}
          onCreateNewStore={() => {
            if (onCreateNewStore) {
              onCreateNewStore();
            }
          }}
          onLogout={() => {
            if (onLogout) {
              onLogout();
            }
          }}
        />
      )}

      {/* Fixed Bottom Navigation (Mobile Only, or forced in mockup) */}
      <div className={forceMobileLayout ? 'block' : 'md:hidden'}>
        <BottomNav
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          newOrdersCount={newOrdersCount}
        />
      </div>
    </div>
  );
};
