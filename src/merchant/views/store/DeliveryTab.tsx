import React, { useState } from 'react';
import { StoreConfig, DeliverySettings, DeliveryArea } from '../../../types';
import { Button, formatCurrency } from '../../../components/shared';
import {
  Bike,
  ShoppingBag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MapPin,
  Clock,
  DollarSign,
  Power,
} from 'lucide-react';

interface DeliveryTabProps {
  config: StoreConfig;
  onUpdateDelivery: (delivery: Partial<DeliverySettings>) => void;
  onAddArea: (area: Omit<DeliveryArea, 'id'>) => void;
  onUpdateArea: (id: string, updates: Partial<DeliveryArea>) => void;
  onDeleteArea: (id: string) => void;
  onToggleArea: (id: string) => void;
  onSaveNotice: (msg: string) => void;
}

export const DeliveryTab: React.FC<DeliveryTabProps> = ({
  config,
  onUpdateDelivery,
  onAddArea,
  onUpdateArea,
  onDeleteArea,
  onToggleArea,
  onSaveNotice,
}) => {
  const { delivery } = config;

  // New Area form state
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('7.00');
  const [newAreaTime, setNewAreaTime] = useState('40');

  // Edit Area state
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editAreaName, setEditAreaName] = useState('');
  const [editAreaFee, setEditAreaFee] = useState('');
  const [editAreaTime, setEditAreaTime] = useState('');

  const handleCreateAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;

    onAddArea({
      name: newAreaName.trim(),
      fee: parseFloat(newAreaFee) || 0,
      estimatedMinutes: parseInt(newAreaTime, 10) || 40,
      isActive: true,
    });

    setNewAreaName('');
    setNewAreaFee('7.00');
    setNewAreaTime('40');
    setIsAddingArea(false);
    onSaveNotice('Nova área de entrega adicionada!');
  };

  const startEditArea = (area: DeliveryArea) => {
    setEditingAreaId(area.id);
    setEditAreaName(area.name);
    setEditAreaFee(String(area.fee));
    setEditAreaTime(String(area.estimatedMinutes || 40));
  };

  const handleSaveEditArea = (id: string) => {
    if (!editAreaName.trim()) return;
    onUpdateArea(id, {
      name: editAreaName.trim(),
      fee: parseFloat(editAreaFee) || 0,
      estimatedMinutes: parseInt(editAreaTime, 10) || 40,
    });
    setEditingAreaId(null);
    onSaveNotice('Área atualizada!');
  };

  return (
    <div className="space-y-6 text-zinc-200">
      {/* Modality Toggles: Delivery & Pickup */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Modalidades Atendidas
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Delivery Toggle */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Entrega (Delivery)</h4>
                <p className="text-xs text-zinc-400">
                  {delivery.allowDelivery ? 'Ativo para clientes' : 'Pausado'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateDelivery({ allowDelivery: !delivery.allowDelivery })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                delivery.allowDelivery ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  delivery.allowDelivery ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Pickup Toggle */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Retirada no Balcão</h4>
                <p className="text-xs text-zinc-400">
                  {delivery.allowPickup ? 'Ativo para clientes' : 'Pausado'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateDelivery({ allowPickup: !delivery.allowPickup })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                delivery.allowPickup ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  delivery.allowPickup ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* General Delivery Rules */}
      {delivery.allowDelivery && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Regras de Frete & Estimativa
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#13161D] border border-zinc-800">
            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Taxa de Entrega Padrão (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-mono">
                  R$
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={delivery.fixedFee}
                  onChange={e =>
                    onUpdateDelivery({ fixedFee: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full h-10 pl-9 pr-3 bg-[#0A0C0F] border border-zinc-800 rounded-xl text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Aplicada caso não haja área específica
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Frete Grátis acima de (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-mono">
                  R$
                </span>
                <input
                  type="number"
                  step="5"
                  min="0"
                  value={delivery.freeDeliveryThreshold || ''}
                  placeholder="Ex: 80.00"
                  onChange={e =>
                    onUpdateDelivery({
                      freeDeliveryThreshold: parseFloat(e.target.value) || undefined,
                    })
                  }
                  className="w-full h-10 pl-9 pr-3 bg-[#0A0C0F] border border-zinc-800 rounded-xl text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Deixe vazio se não oferecer frete grátis
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Tempo Estimado Delivery
              </label>
              <input
                type="text"
                value={delivery.estimatedDeliveryTime}
                onChange={e =>
                  onUpdateDelivery({ estimatedDeliveryTime: e.target.value })
                }
                placeholder="Ex: 35 - 50 min"
                className="w-full h-10 px-3 bg-[#0A0C0F] border border-zinc-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1.5">
                Pedido Mínimo para Entrega (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-mono">
                  R$
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={delivery.minimumOrderValue}
                  onChange={e =>
                    onUpdateDelivery({
                      minimumOrderValue: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full h-10 pl-9 pr-3 bg-[#0A0C0F] border border-zinc-800 rounded-xl text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Valor mínimo para o fechamento do pedido por delivery
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Areas Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Áreas de Entrega & Bairros
            </h3>
            <p className="text-[11px] text-zinc-500">
              Personalize o valor do frete e tempo de acordo com a região
            </p>
          </div>

          {!isAddingArea && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAddingArea(true)}
            >
              + Adicionar Área
            </Button>
          )}
        </div>

        {/* Add Area Form */}
        {isAddingArea && (
          <form
            onSubmit={handleCreateAreaSubmit}
            className="p-4 rounded-2xl bg-[#0F1117] border border-orange-500/40 space-y-3 animate-in fade-in"
          >
            <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Cadastrar Nova Região / Bairro
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Nome do Bairro ou Região *
                </label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  placeholder="Ex: Jardim Paulista, Centro..."
                  className="w-full h-9 px-3 bg-[#13161D] border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Taxa de Frete (R$)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newAreaFee}
                  onChange={e => setNewAreaFee(e.target.value)}
                  className="w-full h-9 px-3 bg-[#13161D] border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Tempo Estimado (min)
                </label>
                <input
                  type="number"
                  min="10"
                  value={newAreaTime}
                  onChange={e => setNewAreaTime(e.target.value)}
                  className="w-full h-9 px-3 bg-[#13161D] border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" variant="primary" size="sm">
                Salvar Área
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingArea(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Areas List */}
        <div className="divide-y divide-zinc-850 rounded-2xl bg-[#13161D] border border-zinc-800 overflow-hidden">
          {delivery.areas.map(area => {
            const isEditing = editingAreaId === area.id;

            return (
              <div key={area.id} className="p-3.5 sm:p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={editAreaName}
                        onChange={e => setEditAreaName(e.target.value)}
                        className="h-9 px-2.5 bg-[#0A0C0F] border border-zinc-700 rounded-lg text-xs text-white"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={editAreaFee}
                        onChange={e => setEditAreaFee(e.target.value)}
                        placeholder="Taxa R$"
                        className="h-9 px-2.5 bg-[#0A0C0F] border border-zinc-700 rounded-lg text-xs font-mono text-white"
                      />
                      <input
                        type="number"
                        value={editAreaTime}
                        onChange={e => setEditAreaTime(e.target.value)}
                        placeholder="Tempo min"
                        className="h-9 px-2.5 bg-[#0A0C0F] border border-zinc-700 rounded-lg text-xs font-mono text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleSaveEditArea(area.id)}
                      >
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAreaId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          area.isActive ? 'bg-emerald-400' : 'bg-zinc-600'
                        }`}
                      />
                      <div>
                        <h4
                          className={`text-xs sm:text-sm font-semibold truncate ${
                            area.isActive ? 'text-white' : 'text-zinc-500'
                          }`}
                        >
                          {area.name}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                          <span className="font-mono text-orange-400 font-semibold">
                            {formatCurrency(area.fee)}
                          </span>
                          {area.estimatedMinutes && (
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              <Clock className="w-3 h-3" />
                              {area.estimatedMinutes} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Active/Pause toggle */}
                      <button
                        type="button"
                        onClick={() => onToggleArea(area.id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          area.isActive
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-750'
                        }`}
                        title={area.isActive ? 'Pausar área' : 'Ativar área'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditArea(area)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteArea(area.id)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
