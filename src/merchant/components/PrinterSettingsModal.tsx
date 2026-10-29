import React, { useState } from 'react';
import { Modal, Button, formatCurrency } from '../../components/shared';
import { Printer, FileText, Check, Settings, Copy, Eye } from 'lucide-react';
import { RestaurantProfile } from '../../types';
import { formatPhoneMask } from '../../utils/phone';

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: RestaurantProfile;
}

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({
  isOpen,
  onClose,
  restaurant,
}) => {
  const [autoPrint, setAutoPrint] = useState(false);
  const [copies, setCopies] = useState<1 | 2 | 3>(1);
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurações de Impressão"
      subtitle="Comandas térmicas para cozinha e entrega"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full gap-2.5">
          <Button variant="secondary" size="md" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="primary" size="md" onClick={onClose}>
            Salvar Preferências
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-zinc-100 text-xs">
        {/* Toggle between Config and Preview */}
        <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'config'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurações</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'preview'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-orange-400" />
            <span>Preview da Comanda ({paperWidth})</span>
          </button>
        </div>

        {activeTab === 'config' ? (
          <div className="space-y-3.5">
            {/* Auto Print */}
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white">Impressão Automática</h4>
                <p className="text-[11px] text-zinc-400">
                  Imprimir a comanda assim que o pedido for aceito no painel
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAutoPrint(!autoPrint)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  autoPrint ? 'bg-orange-500' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    autoPrint ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Copies */}
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
              <label className="font-bold text-white block">Número de Vias</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 1, label: '1 Via (Cozinha)' },
                  { val: 2, label: '2 Vias (Cozinha + Entrega)' },
                  { val: 3, label: '3 Vias (Completo)' },
                ].map(c => (
                  <button
                    key={c.val}
                    type="button"
                    onClick={() => setCopies(c.val as 1 | 2 | 3)}
                    className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                      copies === c.val
                        ? 'border-orange-500 bg-orange-500/15 text-orange-300 font-bold'
                        : 'border-zinc-800 bg-zinc-850/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Width: 58mm vs 80mm */}
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
              <label className="font-bold text-white block">Largura da Bobina Térmica</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaperWidth('80mm')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    paperWidth === '80mm'
                      ? 'border-orange-500 bg-orange-500/15 text-white font-bold'
                      : 'border-zinc-800 bg-zinc-850/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-sm">80mm (Padrão)</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    Impressoras Bematech, Epson, Daruma
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperWidth('58mm')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    paperWidth === '58mm'
                      ? 'border-orange-500 bg-orange-500/15 text-white font-bold'
                      : 'border-zinc-800 bg-zinc-850/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-sm">58mm (Compacto)</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    Mini impressoras Bluetooth e POS
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Thermal Ticket Preview */
          <div className="flex justify-center p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
            <div
              className={`bg-[#FAF8F5] text-zinc-900 font-mono p-4 rounded-md shadow-2xl transition-all ${
                paperWidth === '80mm' ? 'w-80 text-xs' : 'w-64 text-[11px]'
              }`}
            >
              {/* Receipt Header */}
              <div className="text-center pb-2 border-b border-dashed border-zinc-400 space-y-0.5">
                <p className="font-bold text-sm tracking-wider uppercase">{restaurant.name}</p>
                <p className="text-[10px] text-zinc-600">{restaurant.segment}</p>
                <p className="text-[10px] text-zinc-600">WhatsApp: {formatPhoneMask(restaurant.whatsapp)}</p>
              </div>

              {/* Order Info */}
              <div className="py-2 border-b border-dashed border-zinc-400 flex justify-between items-center">
                <span className="font-bold text-base">#----</span>
                <span className="font-bold uppercase px-1.5 py-0.5 bg-zinc-200 rounded">
                  ------
                </span>
              </div>

              <div className="py-1.5 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
                <p>Data: --/--/---- - --:--</p>
                <p>Cliente: —</p>
                <p>Telefone: —</p>
                <p>Endereço: —</p>
              </div>

              {/* Items */}
              <div className="py-2 border-b border-dashed border-zinc-400 space-y-1">
                <p className="text-center text-[10px] text-zinc-500 italic py-1">
                  Os itens do pedido selecionado aparecem aqui na impressão real.
                </p>
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>R$ 0,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Entrega:</span>
                  <span>R$ 0,00</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-zinc-300">
                  <span>TOTAL:</span>
                  <span>R$ 0,00</span>
                </div>
              </div>

              {/* Payment & Footer */}
              <div className="pt-2 text-center text-[10px] space-y-0.5">
                <p className="font-bold">FORMA DE PAGAMENTO: —</p>
                <p className="text-[9px] text-zinc-500 pt-1">Biteo Smart Orders - www.biteo.com.br</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
