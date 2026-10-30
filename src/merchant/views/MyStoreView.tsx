import { saveStorePublication } from '../../services/storePublicationPersistence';
import React, { useEffect, useRef, useState } from 'react';
import {
  StoreConfig,
  MenuItem,
  StoreTheme,
  StoreInfo,
  BusinessHours,
  DeliverySettings,
  DeliveryArea,
  PaymentMethods,
  StoreOnlineSettings,
} from '../../types';
import { StoreService } from '../../services/storeService';
import {
  saveStoreInfo,
  saveBusinessHours,
  saveDeliverySettings,
  saveDeliveryAreas,
  savePaymentMethods,
} from '../../services/storePersistence';
import { toFriendlyStoreUpdateError } from '../../auth/errors';
import { AppearanceTab } from './store/AppearanceTab';
import { InfoTab } from './store/InfoTab';
import { HoursTab } from './store/HoursTab';
import { DeliveryTab } from './store/DeliveryTab';
import { PaymentsTab } from './store/PaymentsTab';
import { OnlineStoreTab } from './store/OnlineStoreTab';
import { WhatsAppTab } from './store/WhatsAppTab';
import { StorePreviewPhone } from './store/StorePreviewPhone';
import { Modal, Button } from '../../components/shared';
import {
  Palette,
  Store,
  Clock,
  Bike,
  CreditCard,
  Globe,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  MessageCircle,
} from 'lucide-react';

export type StoreTab =
  | 'aparencia'
  | 'informacoes'
  | 'horarios'
  | 'entrega'
  | 'pagamentos'
  | 'whatsapp'
  | 'online';

interface MyStoreViewProps {
  config: StoreConfig;
  items: MenuItem[];
  onUpdateConfig: (config: StoreConfig) => void;
  onOpenStorefront?: () => void;
  /** Only management roles may change store settings. Defaults to editable. */
  canEdit?: boolean;
}

export const MyStoreView: React.FC<MyStoreViewProps> = ({
  config,
  items,
  onUpdateConfig,
  onOpenStorefront,
  canEdit = true,
}) => {
  const [activeTab, setActiveTab] = useState<StoreTab>('aparencia');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Latest committed config, so rapid successive commits never merge into a
  // stale snapshot. Updated on every render and immediately after a save.
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Last info change, kept so a failed save can be retried without retyping.
  const lastInfoCommitRef = useRef<Partial<StoreInfo> | null>(null);
  // Serialises saves so two quick blur commits never merge from a stale base
  // and overwrite each other.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  // Keep StoreService (the base config every updater reads) in sync with the
  // live config. Without this, an updater for a store whose config was never
  // registered rejected and the controlled inputs reverted on each keystroke,
  // which made the whole screen look blocked/read-only.
  useEffect(() => {
    if (config.id) {
      StoreService.registerStore(config.id, config);
    }
  }, [config]);

  // Auto-dismiss the "Salvo" confirmation; errors stay until resolved.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = setTimeout(() => setSaveState('idle'), 3000);
    return () => clearTimeout(timer);
  }, [saveState]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /**
   * Validates the non-blank columns the schema enforces, so the user gets an
   * actionable message instead of a raw constraint error.
   */
  const validateInfo = (info: StoreInfo): string | null => {
    if (!info.name.trim()) return 'O nome da loja não pode ficar vazio.';
    if (!info.category.trim()) return 'O segmento/categoria não pode ficar vazio.';
    if (!info.city.trim()) return 'A cidade não pode ficar vazia.';
    if (!info.state.trim()) return 'O estado (UF) não pode ficar vazio.';
    return null;
  };

  /**
   * Persists the basic store profile FIRST and only then mirrors it into local
   * state. Returns true on a confirmed write; on failure the committed state is
   * left untouched so the merchant's draft (kept by the field) can be retried.
   */
  const runInfoCommit = async (
    infoUpdates: Partial<StoreInfo>
  ): Promise<boolean> => {
    const current = configRef.current;
    const nextInfo: StoreInfo = { ...current.info, ...infoUpdates };
    lastInfoCommitRef.current = infoUpdates;

    const validation = validateInfo(nextInfo);
    if (validation) {
      setSaveState('error');
      setSaveError(validation);
      return false;
    }

    setSaveState('saving');
    setSaveError(null);

    try {
      await saveStoreInfo(current.id, nextInfo);
      const nextConfig: StoreConfig = { ...current, info: nextInfo };
      configRef.current = nextConfig;
      StoreService.registerStore(nextConfig.id, nextConfig);
      onUpdateConfig(nextConfig);
      setSaveState('saved');
      return true;
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
      return false;
    }
  };

  const commitInfo = (
    infoUpdates: Partial<StoreInfo>
  ): Promise<boolean> => {
    const chained = saveChainRef.current.then(() => runInfoCommit(infoUpdates));
    saveChainRef.current = chained.then(
      () => undefined,
      () => undefined
    );
    return chained;
  };

  const retryInfoSave = () => {
    if (lastInfoCommitRef.current) {
      void commitInfo(lastInfoCommitRef.current);
    }
  };

  // Updaters that update the shared StoreService and trigger parent state
  const handleUpdateTheme = async (themeUpdates: Partial<StoreTheme>) => {
    const updated = await StoreService.updateTheme(config.id, themeUpdates);
    onUpdateConfig(updated);
  };

  const handleUpdateInfo = async (infoUpdates: Partial<StoreInfo>) => {
    return commitInfo(infoUpdates);
  };

  const handleUpdateHours = async (hoursUpdates: BusinessHours) => {
    const updated = await StoreService.updateHours(config.id, hoursUpdates);
    onUpdateConfig(updated);
    try {
      await saveBusinessHours(config.id, hoursUpdates);
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
      // Revert by keeping previous? But we already updated UI - per requirements preserve on failure;
      // still surface error. UI already shows the state user set.
    }
  };

  const handleUpdateDelivery = async (
    deliveryUpdates: Partial<DeliverySettings>
  ) => {
    const updated = await StoreService.updateDelivery(config.id, deliveryUpdates);
    onUpdateConfig(updated);
    try {
      await saveDeliverySettings(config.id, updated.delivery);
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
    }
  };

  const handleAddArea = async (area: Omit<DeliveryArea, 'id'>) => {
    const updated = await StoreService.addDeliveryArea(config.id, area);
    onUpdateConfig(updated);
    try {
      await saveDeliveryAreas(config.id, updated.delivery.areas);
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
    }
  };

  const handleUpdateArea = async (
    id: string,
    updates: Partial<DeliveryArea>
  ) => {
    const updated = await StoreService.updateDeliveryArea(config.id, id, updates);
    onUpdateConfig(updated);
    try {
      await saveDeliveryAreas(config.id, updated.delivery.areas);
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
    }
  };

  const handleDeleteArea = async (id: string) => {
    const updated = await StoreService.deleteDeliveryArea(config.id, id);
    onUpdateConfig(updated);
    try {
      await saveDeliveryAreas(config.id, updated.delivery.areas);
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
    }
  };

  const handleToggleArea = async (id: string) => {
    const updated = await StoreService.toggleDeliveryArea(config.id, id);
    onUpdateConfig(updated);
    try {
      await saveDeliveryAreas(config.id, updated.delivery.areas);
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
    }
  };

  const handleUpdatePayments = async (
    paymentsUpdates: Partial<PaymentMethods>
  ) => {
    const updated = await StoreService.updatePayments(config.id, paymentsUpdates);
    onUpdateConfig(updated);
    try {
      await savePaymentMethods(config.id, updated.payments);
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
    }
  };

  const [publicationSaving, setPublicationSaving] = useState(false);
  const handleUpdateOnline = async (
    onlineUpdates: Partial<StoreOnlineSettings>
  ) => {
    if (publicationSaving) return;
    if (onlineUpdates.isPublished === undefined) {
      const updated = await StoreService.updateOnline(config.id, onlineUpdates);
      onUpdateConfig(updated);
      return;
    }
    setPublicationSaving(true);
    setSaveError(null);
    try {
      const published = await saveStorePublication(config.id, onlineUpdates.isPublished);
      const updated = await StoreService.updateOnline(config.id, { isPublished: published });
      onUpdateConfig(updated);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setSaveError(toFriendlyStoreUpdateError(error));
    } finally {
      setPublicationSaving(false);
    }
  };

  const tabs: {
    id: StoreTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'informacoes', label: 'Informações', icon: Store },
    { id: 'horarios', label: 'Horários', icon: Clock },
    { id: 'entrega', label: 'Entrega & Retirada', icon: Bike },
    { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'online', label: 'Loja Online', icon: Globe },
  ];

  return (
    <div className="space-y-5 pb-28">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-3.5 bg-zinc-900 border border-orange-500/50 text-orange-200 text-xs font-semibold rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11141B] p-4 sm:p-5 rounded-3xl border border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans']">
              Minha Loja & Construtor
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Online
            </span>

            {/* Real persistence status (never a fake success) */}
            {saveState === 'saving' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Salvando...</span>
              </span>
            )}
            {saveState === 'saved' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Salvo</span>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Personalize a identidade da sua loja e visualize as mudanças em tempo real.
          </p>

          {saveState === 'error' && (
            <div className="mt-2.5 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{saveError}</span>
              </div>
              <button
                type="button"
                onClick={retryInfoSave}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-bold transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        {/* Action button: View as customer */}
        <div className="flex items-center gap-2">
          {/* Mobile open preview button */}
          <button
            type="button"
            onClick={() => setIsMobilePreviewOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors"
          >
            <Smartphone className="w-4 h-4 text-orange-400" />
            <span>Ver Preview</span>
          </button>

          {onOpenStorefront && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<ExternalLink className="w-4 h-4" />}
              onClick={onOpenStorefront}
            >
              Loja do Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all select-none ${
                isActive
                  ? 'bg-[#FF5500] text-white shadow-md shadow-orange-950/40'
                  : 'bg-[#13161D] text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-750'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Split Layout on Desktop: [ Configuration Form (60%) ] | [ Real-time Preview (40%) ] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Settings Form */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4">
          {!canEdit && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Seu perfil não tem permissão para editar a loja. Você está no
                modo somente leitura.
              </span>
            </div>
          )}

          <fieldset
            disabled={!canEdit}
            className="border-0 p-0 m-0 min-w-0 space-y-4"
          >
            {activeTab === 'aparencia' && (
            <AppearanceTab
              config={config}
              onUpdateTheme={handleUpdateTheme}
              onSaveNotice={showToast}
            />
          )}

          {activeTab === 'informacoes' && (
            <InfoTab
              config={config}
              onUpdateInfo={handleUpdateInfo}
              onSaveNotice={showToast}
            />
          )}

          {activeTab === 'horarios' && (
            <HoursTab
              config={config}
              onUpdateHours={handleUpdateHours}
              onSaveNotice={showToast}
            />
          )}

          {activeTab === 'entrega' && (
            <DeliveryTab
              config={config}
              onUpdateDelivery={handleUpdateDelivery}
              onAddArea={handleAddArea}
              onUpdateArea={handleUpdateArea}
              onDeleteArea={handleDeleteArea}
              onToggleArea={handleToggleArea}
              onSaveNotice={showToast}
            />
          )}

          {activeTab === 'pagamentos' && (
            <PaymentsTab
              config={config}
              onUpdatePayments={handleUpdatePayments}
              onSaveNotice={showToast}
            />
          )}

          {activeTab === 'whatsapp' && (
            <WhatsAppTab storeName={config.info.name} />
          )}

          {activeTab === 'online' && (
            <OnlineStoreTab
              config={config}
              onUpdateOnline={handleUpdateOnline}
              publicationSaving={publicationSaving}
              onOpenStorefront={onOpenStorefront}
              onSaveNotice={showToast}
            />
          )}
          </fieldset>
        </div>

        {/* Right Side: Sticky Live Smartphone Preview (Visible on Large Screens) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-5 sticky top-20">
          <div className="p-4 rounded-3xl bg-[#11141B] border border-zinc-850 space-y-3">
            <div className="flex items-center justify-between text-xs px-2">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-orange-400" />
                <span>Preview em Tempo Real</span>
              </span>
              <span className="text-[11px] text-zinc-500">Atualização instantânea</span>
            </div>

            <StorePreviewPhone
              config={config}
              items={items}
              onOpenStorefront={onOpenStorefront}
            />
          </div>
        </div>
      </div>

      {/* Floating Bottom Button for Mobile Preview */}
      <div className="lg:hidden fixed bottom-18 left-4 right-4 z-30 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setIsMobilePreviewOpen(true)}
          className="w-full py-3 px-4 bg-gradient-to-r from-[#FF5500] to-[#E04400] text-white font-bold text-xs rounded-2xl shadow-xl shadow-orange-950/60 flex items-center justify-center gap-2 active:scale-98 transition-transform"
        >
          <Smartphone className="w-4 h-4" />
          <span>Ver Minha Loja (Preview em Tempo Real)</span>
        </button>
      </div>

      {/* Mobile Full Screen Preview Modal */}
      <Modal
        isOpen={isMobilePreviewOpen}
        onClose={() => setIsMobilePreviewOpen(false)}
        title="Prévia da Loja no Smartphone"
        subtitle="Simulação em tempo real da visão do consumidor"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsMobilePreviewOpen(false)}
            >
              Fechar
            </Button>
            {onOpenStorefront && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<ExternalLink className="w-4 h-4" />}
                onClick={() => {
                  setIsMobilePreviewOpen(false);
                  onOpenStorefront();
                }}
              >
                Abrir Loja Completa
              </Button>
            )}
          </div>
        }
      >
        <div className="py-2 flex justify-center">
          <StorePreviewPhone
            config={config}
            items={items}
            onOpenStorefront={onOpenStorefront}
          />
        </div>
      </Modal>
    </div>
  );
};
