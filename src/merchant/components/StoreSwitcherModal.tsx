import React from 'react';
import { Modal, Button } from '../../components/shared';
import { StoreInstance, CurrentUser } from '../../types';
import {
  Store,
  Plus,
  Check,
  LogOut,
  Sparkles,
  Shield,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface StoreSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
  stores: StoreInstance[];
  currentStoreId: string | null;
  onSelectStore: (storeId: string) => void;
  onCreateNewStore: () => void;
  onLogout: () => void;
}

export const StoreSwitcherModal: React.FC<StoreSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  stores,
  currentStoreId,
  onSelectStore,
  onCreateNewStore,
  onLogout,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Meus Estabelecimentos"
      subtitle="Gerencie ou alterne entre seus restaurantes e lojas"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onClose();
              onLogout();
            }}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sair da Conta
          </Button>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* User Card */}
        {currentUser && (
          <div className="p-3.5 rounded-2xl bg-[#0D0F14] border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-sm border border-orange-500/30">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">{currentUser.name}</h4>
                <p className="text-[11px] text-zinc-400 font-mono">{currentUser.email}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-semibold border border-zinc-700">
              Proprietário
            </span>
          </div>
        )}

        {/* Store List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-bold uppercase tracking-wider text-zinc-400 text-[11px]">
              Estabelecimentos ({stores.length})
            </span>
            <span className="text-[11px] text-zinc-500">Selecione para alternar</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
            {stores.map(store => {
              const isSelected = store.id === currentStoreId;

              return (
                <div
                  key={store.id}
                  onClick={() => {
                    onSelectStore(store.id);
                    onClose();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectStore(store.id);
                      onClose();
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-orange-500/10 border-orange-500/50 shadow-md ring-1 ring-orange-500/20'
                      : 'bg-[#12141C] border-zinc-800 hover:border-zinc-700 hover:bg-[#151924]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
                      style={{
                        backgroundColor: store.config.theme.primaryColor || '#FF5500',
                      }}
                    >
                      {store.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-xs truncate">{store.name}</h4>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-semibold shrink-0">
                            Atual
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {store.category} · biteo.com.br/{store.slug}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action: Create New Store */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onCreateNewStore();
          }}
          className="w-full p-3.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-850 border border-dashed border-orange-500/40 hover:border-orange-500 text-orange-400 hover:text-orange-300 flex items-center justify-center gap-2 font-bold transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Estabelecimento</span>
        </button>
      </div>
    </Modal>
  );
};
