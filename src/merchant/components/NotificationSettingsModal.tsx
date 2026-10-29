import React, { useState } from 'react';
import { Modal, Button, playOrderNotificationSound } from '../../components/shared';
import { Bell, Volume2, VolumeX, AlertCircle, Check, Play } from 'lucide-react';
import { RestaurantProfile } from '../../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: RestaurantProfile;
  onChangeSoundAlerts: (enabled: boolean) => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  restaurant,
  onChangeSoundAlerts,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(Boolean(restaurant.soundAlertsEnabled));
  const [newOrderNotice, setNewOrderNotice] = useState(true);
  const [waitingAcceptAlert, setWaitingAcceptAlert] = useState(true);
  const [cancelledAlert, setCancelledAlert] = useState(true);
  const [soundTestSuccess, setSoundTestSuccess] = useState(false);

  const handleTestSound = () => {
    playOrderNotificationSound();
    setSoundTestSuccess(true);
    setTimeout(() => setSoundTestSuccess(false), 2000);
  };

  const handleSave = () => {
    onChangeSoundAlerts(soundEnabled);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurações de Notificações"
      subtitle="Alertas visuais e sonoros para pedidos em tempo real"
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-between w-full gap-2.5">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            Salvar Preferências
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-zinc-100 text-xs">
        {/* Sound toggle & test */}
        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-500" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-white">Som de Novo Pedido</h4>
                <p className="text-[11px] text-zinc-400">
                  Sino sonoro sintetizado ao receber pedidos da loja
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                soundEnabled ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Testar áudio no navegador:</span>
            <button
              type="button"
              onClick={handleTestSound}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              {soundTestSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Tocando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                  <span>Testar Som</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Other Alert Toggles */}
        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white">Notificação Visual no Topo</h4>
              <p className="text-[11px] text-zinc-400">Banner colorido quando novo pedido chega</p>
            </div>
            <button
              type="button"
              onClick={() => setNewOrderNotice(!newOrderNotice)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                newOrderNotice ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  newOrderNotice ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div>
              <h4 className="font-bold text-white">Alerta: Pedido Aguardando Aceite</h4>
              <p className="text-[11px] text-zinc-400">Lembrete se o pedido ficar &gt; 5 min novo</p>
            </div>
            <button
              type="button"
              onClick={() => setWaitingAcceptAlert(!waitingAcceptAlert)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                waitingAcceptAlert ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  waitingAcceptAlert ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div>
              <h4 className="font-bold text-white">Alerta: Pedido Cancelado</h4>
              <p className="text-[11px] text-zinc-400">Aviso imediato se o pedido for cancelado</p>
            </div>
            <button
              type="button"
              onClick={() => setCancelledAlert(!cancelledAlert)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                cancelledAlert ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  cancelledAlert ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
