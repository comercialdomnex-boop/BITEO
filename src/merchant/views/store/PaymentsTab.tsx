import React from 'react';
import { StoreConfig, PaymentMethods } from '../../../types';
import { QrCode, Banknote, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';

interface PaymentsTabProps {
  config: StoreConfig;
  onUpdatePayments: (payments: Partial<PaymentMethods>) => void;
  onSaveNotice: (msg: string) => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  config,
  onUpdatePayments,
  onSaveNotice,
}) => {
  const { payments } = config;

  const handleChange = <K extends keyof PaymentMethods>(field: K, value: PaymentMethods[K]) => {
    onUpdatePayments({ [field]: value });
    onSaveNotice('Formas de pagamento atualizadas!');
  };

  return (
    <div className="space-y-6 text-zinc-200">
      <div className="p-3.5 rounded-2xl bg-[#0F1117] border border-zinc-850 text-xs text-zinc-400 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Escolha como e quando seus clientes podem pagar. Todo pedido começa com pagamento pendente: você confirma no painel do pedido quando receber. Pedidos com Pix antecipado só podem entrar em preparo depois da confirmação.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Métodos Aceitos no Checkout
        </h3>

        <div className="space-y-3">
          {/* PIX antecipado */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white">Pix antecipado</h4>
                    <span className="text-[10px] px-2 py-0.2 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/30">
                      Paga antes do preparo
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    O cliente paga ao fazer o pedido. O preparo só é liberado depois que você confirmar o recebimento.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Aceitar Pix antecipado"
                onClick={() => handleChange('acceptPixPrepaid', !payments.acceptPixPrepaid)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  payments.acceptPixPrepaid ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    payments.acceptPixPrepaid ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {payments.acceptPixPrepaid && !payments.pixKey?.trim() && (
              <div className="flex items-start gap-2 text-[11px] text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Cadastre sua chave Pix abaixo. Sem ela, o Pix antecipado não aparece para o cliente.</span>
              </div>
            )}
          </div>

          {/* PIX na entrega/retirada */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white">Pix na entrega/retirada</h4>
                    <span className="text-[10px] px-2 py-0.2 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Paga ao receber
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    O cliente paga com Pix quando recebe ou retira o pedido. Não bloqueia o preparo.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Aceitar Pix na entrega ou retirada"
                onClick={() => handleChange('acceptPix', !payments.acceptPix)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  payments.acceptPix ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    payments.acceptPix ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {(payments.acceptPix || payments.acceptPixPrepaid) && (
              <div className="pt-2 border-t border-zinc-850">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Chave PIX da loja (CPF, CNPJ, Celular ou E-mail), usada nas duas opções de Pix
                </label>
                <input
                  type="text"
                  value={payments.pixKey || ''}
                  onChange={e => handleChange('pixKey', e.target.value)}
                  placeholder="Ex: 11987654321 ou pix@restaurante.com.br"
                  className="w-full h-9 px-3 bg-[#0A0C0F] border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            )}
          </div>

          {/* Dinheiro com Troco */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Dinheiro na entrega/retirada</h4>
                  <p className="text-xs text-zinc-400">
                    Pago ao receber ou retirar o pedido. Você confirma o recebimento no painel.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleChange('acceptCash', !payments.acceptCash)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  payments.acceptCash ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    payments.acceptCash ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {payments.acceptCash && (
              <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                <div>
                  <span className="text-white font-medium block">
                    Solicitar campo "Precisa de troco?"
                  </span>
                  <span className="text-zinc-500 text-[11px]">
                    O consumidor informará o valor para a calculadora de troco
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleChange('cashNeedChange', !payments.cashNeedChange)
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    payments.cashNeedChange ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      payments.cashNeedChange ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Cartão de Crédito na Entrega */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">Cartão de crédito</h4>
                    <span className="text-[10px] px-2 py-0.2 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Na entrega/retirada (maquininha)
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Visa, Mastercard, Elo, Hipercard, Amex
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleChange('acceptCreditCard', !payments.acceptCreditCard)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  payments.acceptCreditCard ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    payments.acceptCreditCard ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Cartão de Débito na Entrega */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">Cartão de débito</h4>
                    <span className="text-[10px] px-2 py-0.2 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Na entrega/retirada (maquininha)
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Visa Electron, Maestro, Elo Débito
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleChange('acceptDebitCard', !payments.acceptDebitCard)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  payments.acceptDebitCard ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    payments.acceptDebitCard ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
