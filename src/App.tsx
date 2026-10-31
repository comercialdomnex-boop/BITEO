import React, { useState, useEffect, useMemo } from 'react';
import { Building } from 'lucide-react';
import {
  RestaurantProfile,
  Order,
  StoreConfig,
  StoreInstance,
} from './types';
import { createEmptyStoreConfig, StoreService } from './services/storeService';
import { MerchantApp } from './merchant/MerchantApp';
import { StorefrontApp } from './storefront/StorefrontApp';
import { LoginView } from './auth/LoginView';
import { RegisterView } from './auth/RegisterView';
import { ResetPasswordView } from './auth/ResetPasswordView';
import { useAuth } from './auth/AuthProvider';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { SessionService } from './services/sessionService';
import { RestaurantService } from './services/restaurantService';

export type AppRoute =
  | 'login'
  | 'cadastro'
  | 'recuperacao'
  | 'onboarding'
  | 'merchant'
  | 'storefront';

export default function App() {
  const { status, currentUser, isRecovery, signOut, profileError, clearRecovery } =
    useAuth();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('login');
  const [currentStore, setCurrentStore] = useState<StoreInstance | null>(null);
  const [availableStores, setAvailableStores] = useState<StoreInstance[]>([]);
  // Real empty state: no store exists yet, so there is nothing to show.
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() =>
    createEmptyStoreConfig()
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  // Store context boot: 'idle' until authenticated, then loading the real stores.
  const [storeBoot, setStoreBoot] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );
  const [storeBootError, setStoreBootError] = useState<string | null>(null);
  // Bumped by the retry button to re-run the store hydration effect.
  const [bootNonce, setBootNonce] = useState(0);

  const [availabilityTime, setAvailabilityTime] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setAvailabilityTime(new Date());
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  /** Derived read-only projection: never a second writable source. */
  const restaurant: RestaurantProfile = useMemo(
    () => RestaurantService.buildProfile(storeConfig, availabilityTime),
    [storeConfig, availabilityTime]
  );

  // Single writable source for the active store: mirrors it into React state and
  // keeps StoreService (the config the editors read/write) in sync.
  const syncStoreToState = (store: StoreInstance) => {
    StoreService.registerStore(store.id, store.config);
    setCurrentStore(store);
    setStoreConfig({ ...store.config });
    setOrders([...store.orders]);
    setAvailableStores(SessionService.getAvailableStores());
  };

  // Initialize local store context on mount. The Supabase session itself is
  // restored by AuthProvider (getSession + onAuthStateChange).
  useEffect(() => {
    SessionService.init();
    setAvailableStores(SessionService.getAvailableStores());
  }, []);

  // On a real authenticated session, load the user's stores from the database
  // (public.store_members + public.stores) so Minha Loja is bound to the real
  // store instead of an empty config. This is what makes the store settings
  // editable again after a reload. A recovery link takes precedence.
  useEffect(() => {
    if (status === 'loading' || isRecovery) return;

    if (status !== 'authenticated' || !currentUser) {
      setStoreBoot('idle');
      setStoreBootError(null);
      return;
    }

    let cancelled = false;
    setStoreBoot('loading');
    setStoreBootError(null);

    SessionService.hydrate(currentUser)
      .then(stores => {
        if (cancelled) return;
        setAvailableStores(stores);
        setStoreBoot('ready');

        if (stores.length === 0) {
          setCurrentRoute('onboarding');
          return;
        }

        const store = SessionService.getCurrentStore();
        if (store) syncStoreToState(store);
        setCurrentRoute(route =>
          route === 'login' || route === 'cadastro' ? 'merchant' : route
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStoreBoot('error');
        setStoreBootError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar suas lojas.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [status, currentUser?.id, isRecovery, bootNonce]);

  // Recovery links open the reset screen; signing out returns to the login.
  useEffect(() => {
    if (isRecovery && status === 'authenticated') {
      setCurrentRoute('recuperacao');
    }
  }, [isRecovery, status]);

  // Losing the session (sign-out or expiry) returns the private area to login.
  // Public browsing (storefront / login / cadastro) is left untouched.
  useEffect(() => {
    if (status === 'unauthenticated' && !isRecovery) {
      setCurrentRoute(route =>
        route === 'onboarding' || route === 'recuperacao' || route === 'merchant'
          ? 'login'
          : route
      );
    }
  }, [status, isRecovery]);

  const handleOnboardingComplete = (
    newStore: StoreInstance,
    targetView: 'merchant' | 'storefront'
  ) => {
    syncStoreToState(newStore);
    setCurrentRoute(targetView);
  };

  const handleSelectStore = (storeId: string) => {
    const store = SessionService.switchStore(storeId);
    if (store) {
      syncStoreToState(store);
    }
  };

  const handleCreateNewStore = () => {
    setCurrentRoute('onboarding');
  };

  const handleLogout = async () => {
    SessionService.logout();
    setCurrentStore(null);
    setStoreBoot('idle');
    setStoreBootError(null);
    setAvailableStores([]);
    setCurrentRoute('login');
    // Clears the Supabase session; the auth listener confirms the state change.
    await signOut();
  };

  // Single writable source: the store config. The restaurant profile is derived.
  const handleUpdateStoreConfig = (updated: StoreConfig) => {
    StoreService.registerStore(updated.id, updated);
    setStoreConfig(updated);
    if (currentStore) {
      SessionService.updateStoreData(currentStore.id, {
        config: updated,
      });
    }
  };

  const handleOrdersChange = (newOrders: Order[]) => {
    setOrders(newOrders);
    if (currentStore) {
      SessionService.updateStoreData(currentStore.id, {
        orders: newOrders,
      });
    }
  };

  const handleOrderPlaced = (newOrder: Order) => {
    setOrders(prev => {
      const updated = [newOrder, ...prev];
      if (currentStore) {
        SessionService.updateStoreData(currentStore.id, {
          orders: updated,
        });
      }
      return updated;
    });
  };

  const handleViewOrderInMerchant = (order: Order) => {
    setCurrentRoute('merchant');
    setHighlightOrderId(order.id);
  };

  // Render view based on route
  const renderCurrentView = (isFramed: boolean) => {
    // Session restore in progress: keep the branded screen instead of flashing
    // the login form before we know whether a session exists.
    if (status === 'loading') {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 py-16">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-2xl shadow-xl shadow-orange-950/60 animate-pulse">
            B
          </div>
          <p className="text-xs text-zinc-400">Restaurando sua sessão...</p>
        </div>
      );
    }

    // Authenticated, but the real store context is still loading (or failed to
    // load). Never fall through to a merchant screen bound to an empty config:
    // that is what made Minha Loja's fields reject input.
    if (status === 'authenticated' && !isRecovery && storeBoot === 'error') {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
            <Building className="w-6 h-6 text-rose-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white">
              Não foi possível carregar suas lojas
            </h2>
            <p className="text-xs text-zinc-400 max-w-sm">{storeBootError}</p>
          </div>
          <button
            type="button"
            onClick={() => setBootNonce(n => n + 1)}
            className="px-4 py-2 rounded-xl bg-[#FF5500] hover:bg-[#E04400] text-white text-xs font-bold transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    if (
      status === 'authenticated' &&
      !isRecovery &&
      (storeBoot === 'idle' || storeBoot === 'loading') &&
      currentRoute !== 'storefront'
    ) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 py-16">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-2xl shadow-xl shadow-orange-950/60 animate-pulse">
            B
          </div>
          <p className="text-xs text-zinc-400">Carregando sua loja...</p>
        </div>
      );
    }

    switch (currentRoute) {
      case 'login':
        return <LoginView onGoToRegister={() => setCurrentRoute('cadastro')} />;

      case 'cadastro':
        return <RegisterView onGoToLogin={() => setCurrentRoute('login')} />;

      case 'recuperacao':
        return (
          <ResetPasswordView
            onSuccess={() => {
              clearRecovery();
              setCurrentRoute('merchant');
            }}
            onCancel={() => setCurrentRoute('login')}
          />
        );

      case 'onboarding':
  if (status !== 'authenticated' || !currentUser) {
    return (
      <LoginView
        onGoToRegister={() => setCurrentRoute('cadastro')}
      />
    );
  }

  return (
    <OnboardingWizard
            onComplete={handleOnboardingComplete}
            onCancel={
              currentUser && availableStores.length > 0
                ? () => setCurrentRoute('merchant')
                : () => setCurrentRoute('login')
            }
            userInitialName={currentUser?.name || ''}
          />
        );

      case 'storefront':
        return (
          <StorefrontApp
            restaurant={restaurant}
            config={storeConfig}
            orders={orders}
            onBackToMerchant={() => setCurrentRoute('merchant')}
            onOrderPlaced={handleOrderPlaced}
            onViewOrderInMerchant={handleViewOrderInMerchant}
          />
        );

    case 'merchant':
default:
  if (status !== 'authenticated' || !currentUser) {
    return (
      <LoginView
        onGoToRegister={() => setCurrentRoute('cadastro')}
      />
    );
  }

  return (
    <MerchantApp
      restaurant={restaurant}
      storeConfig={storeConfig}
            orders={orders}
            forceMobileLayout={isFramed}
            initialSelectedOrderId={highlightOrderId}
            onClearInitialOrderId={() => setHighlightOrderId(null)}
            onUpdateStoreConfig={handleUpdateStoreConfig}
            onOrdersChange={handleOrdersChange}
            onOpenStorefront={() => setCurrentRoute('storefront')}
            onLogout={handleLogout}
            onSelectStore={handleSelectStore}
            onCreateNewStore={handleCreateNewStore}
            stores={availableStores}
            currentUser={currentUser}
            currentStoreId={currentStore?.id || storeConfig.id}
            currentRole={currentStore ? SessionService.getCurrentRole() : null}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {profileError && (
        <div role="alert" className="px-4 py-3 text-sm text-amber-200 bg-amber-950/80 border-b border-amber-600/40">
          Não foi possível carregar o perfil: {profileError}
        </div>
      )}
      <main className="flex-1 w-full">
        {renderCurrentView(false)}
      </main>
    </div>
  );
}
