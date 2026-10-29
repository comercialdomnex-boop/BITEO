import React, { useState } from 'react';
import { StoreConfig, PaymentMethod, PaymentStatus } from '../../types';
import { CartItem, CustomerFormData, AddressFormData, PaymentFormData } from '../types';
import { formatCurrency, Modal, calculateCartTotals } from '../../components/shared';
import { RestaurantService } from '../../services/restaurantService';
import { normalizePhone } from '../../utils/phone';
import { parseMoneyInput } from '../../utils/money';
import {
  User,
  Phone,
  MapPin,
  Bike,
  Store,
  CreditCard,
  QrCode,
  Banknote,
  Check,
  Copy,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileText,
  Clock,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  storeConfig: StoreConfig;
  orderModality: 'delivery' | 'retirada';
  onChangeModality: (modality: 'delivery' | 'retirada') => void;
  onConfirmOrder: (orderPayload: {
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
    paymentStatus: PaymentStatus;
    changeFor?: number;
    generalNotes?: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
  }) => Promise<void>;
  primaryColor?: string;
  visualStyle?: 'moderno' | 'minimalista' | 'vibrante';
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  storeConfig,
  orderModality,
  onChangeModality,
  onConfirmOrder,
  primaryColor = '#FF5500',
  visualStyle = 'moderno',
}) => {
  const { delivery, payments, info } = storeConfig;

  // Checkout Step: 1 = Identification, 2 = Delivery / Pickup, 3 = Payment, 4 = Review
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  // Form State: Customer
  const [customer, setCustomer] = useState<CustomerFormData>({
    name: '',
    phone: '',
  });
  const [customerErrors, setCustomerErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});

  // Form State: Address
  const activeAreas = RestaurantService.getActiveDeliveryAreas(storeConfig);
  const [address, setAddress] = useState<AddressFormData>({
    zipCode: '',
    street: '',
    number: '',
    neighborhood: activeAreas[0]?.name || '',
    complement: '',
    reference: '',
    city: info.city || '',
    state: info.state || '',
  });
  const [addressErrors, setAddressErrors] = useState<{
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }>({});

  // Form State: Payment
  const defaultPaymentMethod: PaymentMethod = payments.acceptPix
    ? 'pix'
    : payments.acceptCreditCard
    ? 'cartao_credito'
    : payments.acceptDebitCard
    ? 'cartao_debito'
    : 'dinheiro';

  const [payment, setPayment] = useState<PaymentFormData>({
    method: defaultPaymentMethod,
    needChange: false,
    changeFor: '',
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // General notes
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Values calculation via centralized utility
  const {
    subtotal,
    isFreeDelivery,
    deliveryFee,
    total,
    minimumOrder,
    isBelowMinimum,
  } = calculateCartTotals(cartItems, delivery, orderModality);

  // Masking helpers
  const formatPhone = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) return raw;
    if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length <= 10)
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  const formatZip = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 8);
    if (raw.length <= 5) return raw;
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  };

  const formatState = (val: string) => val.replace(/[^A-Za-z]/g, '').toUpperCase();

  // Step 1 validation
  const validateStep1 = () => {
    const errors: { name?: string; phone?: string } = {};
    if (!customer.name.trim() || customer.name.trim().length < 3) {
      errors.name = 'Informe seu nome completo';
    }
    if (!normalizePhone(customer.phone)) {
      errors.phone = 'Informe um WhatsApp com DDD (mínimo 10 dígitos)';
    }
    setCustomerErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 validation
  const validateStep2 = () => {
    if (orderModality === 'retirada') return true;

    if (isBelowMinimum) {
      return false;
    }

    const errors: {
      street?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
    } = {};
    if (!address.street.trim()) errors.street = 'Informe o nome da rua/avenida';
    if (!address.number.trim()) errors.number = 'Informe o número';
    if (!address.neighborhood.trim()) errors.neighborhood = 'Informe o bairro';
    if (!address.city.trim()) errors.city = 'Informe a cidade';
    if (!address.state.trim()) errors.state = 'Informe a UF';

    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 3 validation
  const validateStep3 = () => {
    setPaymentError(null);
    if (payment.method === 'dinheiro' && payment.needChange) {
      const changeNum = parseMoneyInput(payment.changeFor);
      if (changeNum === null || changeNum < total) {
        setPaymentError(
          `O valor para troco deve ser maior que o total do pedido (${formatCurrency(total)})`
        );
        return false;
      }
    }
    return true;
  };

  const handleCopyPixKey = () => {
    const key = payments.pixKey;
    if (!key) {
      setPaymentError(
        'Esta loja ainda não cadastrou uma chave Pix. Avise o estabelecimento.'
      );
      return;
    }
    navigator.clipboard?.writeText(key);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const changeForInput =
        payment.method === 'dinheiro' && payment.needChange
          ? parseMoneyInput(payment.changeFor)
          : undefined;

      await onConfirmOrder({
        customer: {
          name: customer.name.trim(),
          phone: normalizePhone(customer.phone),
        },
        type: orderModality,
        deliveryAddress:
          orderModality === 'delivery'
            ? {
                street: address.street.trim(),
                number: address.number.trim(),
                neighborhood: address.neighborhood.trim(),
                complement: address.complement.trim() || undefined,
                reference: address.reference.trim() || undefined,
                city: address.city.trim(),
                state: address.state.trim(),
                zipCode: address.zipCode.trim() || undefined,
              }
            : undefined,
        paymentMethod: payment.method,
        // No channel marks money as paid: every new order starts neutral.
        paymentStatus: 'pendente',
        changeFor: changeForInput ?? undefined,
        generalNotes: generalNotes.trim() || undefined,
        subtotal,
        deliveryFee,
        total,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStyleClasses = () => {
    switch (visualStyle) {
      case 'minimalista':
        return {
          button: 'rounded-lg font-medium',
          card: 'rounded-xl border border-zinc-800 bg-[#12141C]',
          input: 'rounded-lg',
        };
      case 'vibrante':
        return {
          button: 'rounded-2xl font-bold shadow-lg',
          card: 'rounded-2xl border-2 border-zinc-750 bg-[#151926]',
          input: 'rounded-2xl',
        };
      case 'moderno':
      default:
        return {
          button: 'rounded-xl font-semibold shadow-md',
          card: 'rounded-2xl border border-zinc-800 bg-[#141722]',
          input: 'rounded-xl',
        };
    }
  };

  const styles = getStyleClasses();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Finalizar Pedido"
      subtitle={`Etapa ${step} de 4 · ${
        step === 1
          ? 'Identificação'
          : step === 2
          ? 'Entrega ou Retirada'
          : step === 3
          ? 'Forma de Pagamento'
          : 'Revisão e Confirmação'
      }`}
      maxWidth="md"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => (s - 1) as 1 | 2 | 3 | 4)}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-zinc-750 bg-zinc-850 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 transition-colors"
            >
              Cancelar
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && validateStep1()) setStep(2);
                if (step === 2 && validateStep2()) setStep(3);
                if (step === 3 && validateStep3()) setStep(4);
              }}
              className={`py-3 px-5 ${styles.button} text-white font-bold text-xs flex items-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]`}
              style={{ backgroundColor: primaryColor }}
            >
              <span>
                {step === 1
                  ? 'Avançar para Entrega'
                  : step === 2
                  ? 'Avançar para Pagamento'
                  : 'Revisar Pedido'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className={`py-3.5 px-6 ${styles.button} text-white font-bold text-sm flex items-center gap-2 shadow-xl transition-all ${
                isSubmitting
                  ? 'opacity-70 cursor-not-allowed'
                  : 'hover:brightness-110 active:scale-[0.98]'
              }`}
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando Pedido...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar e Enviar Pedido</span>
                  <span className="font-mono ml-1 font-extrabold">
                    ({formatCurrency(total)})
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-zinc-100">
        {/* Step Progress Indicators */}
        <div className="grid grid-cols-4 gap-1.5 pb-2 border-b border-zinc-800">
          {[
            { num: 1, label: 'Identificação' },
            { num: 2, label: 'Entrega' },
            { num: 3, label: 'Pagamento' },
            { num: 4, label: 'Revisão' },
          ].map(s => {
            const isDone = step > s.num;
            const isCurrent = step === s.num;

            return (
              <div key={s.num} className="text-center">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isDone || isCurrent ? '' : 'bg-zinc-800'
                  }`}
                  style={{
                    backgroundColor: isDone || isCurrent ? primaryColor : undefined,
                    opacity: isDone ? 0.7 : isCurrent ? 1 : 0.3,
                  }}
                />
                <span
                  className={`text-[10px] mt-1 block truncate font-medium ${
                    isCurrent ? 'text-white font-bold' : 'text-zinc-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* STEP 1: Identification */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
              <p>
                Informe seus dados para contato. O estabelecimento enviará atualizações
                do pedido diretamente no seu WhatsApp.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Seu Nome Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={customer.name}
                    onChange={e => {
                      setCustomer(prev => ({ ...prev, name: e.target.value }));
                      if (customerErrors.name) {
                        setCustomerErrors(prev => ({ ...prev, name: undefined }));
                      }
                    }}
                    placeholder="Ex: Carlos Silva"
                    className={`w-full pl-9 pr-3 py-2.5 bg-zinc-900 border ${
                      customerErrors.name ? 'border-rose-500' : 'border-zinc-800'
                    } rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500 transition-colors`}
                  />
                </div>
                {customerErrors.name && (
                  <p className="text-[11px] text-rose-400 mt-1">{customerErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  WhatsApp com DDD *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={e => {
                      const formatted = formatPhone(e.target.value);
                      setCustomer(prev => ({ ...prev, phone: formatted }));
                      if (customerErrors.phone) {
                        setCustomerErrors(prev => ({ ...prev, phone: undefined }));
                      }
                    }}
                    placeholder="(11) 99999-9999"
                    className={`w-full pl-9 pr-3 py-2.5 bg-zinc-900 border ${
                      customerErrors.phone ? 'border-rose-500' : 'border-zinc-800'
                    } rounded-xl text-xs text-white font-mono placeholder-zinc-500 focus:outline-hidden focus:border-orange-500 transition-colors`}
                  />
                </div>
                {customerErrors.phone && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    {customerErrors.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Modality & Delivery Address */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            {/* Modality toggle */}
            <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <button
                type="button"
                onClick={() => onChangeModality('delivery')}
                disabled={!delivery.allowDelivery}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
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
                <span>Delivery (Entrega)</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeModality('retirada')}
                disabled={!delivery.allowPickup}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
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
                <span>Retirada no Balcão</span>
              </button>
            </div>

            {/* If Pickup */}
            {orderModality === 'retirada' ? (
              <div className={`p-4 ${styles.card} space-y-3`}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Retirar no Estabelecimento
                    </h4>
                    <p className="text-xs text-zinc-300 mt-1">
                      {info.address} - {info.city}, {info.state}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Pronto para retirada em{' '}
                    {delivery.estimatedPickupTime || 'prazo não informado'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                  Taxa de entrega: <strong className="text-emerald-400">R$ 0,00 (Grátis)</strong>
                </div>
              </div>
            ) : (
              /* If Delivery */
              <div className="space-y-3">
                {/* Minimum order alert */}
                {isBelowMinimum && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>
                      O valor mínimo para entrega é {formatCurrency(minimumOrder)}.
                      Adicione mais itens na sacola ou opte por retirar no balcão.
                    </span>
                  </div>
                )}

                {/* Delivery fee info */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    <span>Tempo estimado: {delivery.estimatedDeliveryTime || '35 - 50 min'}</span>
                  </div>
                  <div className="font-mono font-bold text-white">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-400">Entrega Grátis</span>
                    ) : (
                      <span>Taxa: {formatCurrency(deliveryFee)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-zinc-300">
                    Endereço de Entrega
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[11px] text-zinc-400 mb-1">CEP</label>
                    <input
                      type="text"
                      value={address.zipCode}
                      onChange={e =>
                        setAddress(prev => ({
                          ...prev,
                          zipCode: formatZip(e.target.value),
                        }))
                      }
                      placeholder="00000-000"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono placeholder-zinc-500 focus:outline-hidden focus:border-orange-500"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Cidade *
                    </label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={e => {
                        setAddress(prev => ({ ...prev, city: e.target.value }));
                        if (addressErrors.city) {
                          setAddressErrors(prev => ({ ...prev, city: undefined }));
                        }
                      }}
                      className={`w-full px-3 py-2 bg-zinc-900 border ${
                        addressErrors.city ? 'border-rose-500' : 'border-zinc-800'
                      } rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500`}
                    />
                    {addressErrors.city && (
                      <p className="text-[10px] text-rose-400 mt-0.5">
                        {addressErrors.city}
                      </p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-zinc-400 mb-1">UF *</label>
                    <input
                      type="text"
                      value={address.state}
                      onChange={e => {
                        setAddress(prev => ({
                          ...prev,
                          state: formatState(e.target.value),
                        }));
                        if (addressErrors.state) {
                          setAddressErrors(prev => ({ ...prev, state: undefined }));
                        }
                      }}
                      placeholder="SP"
                      maxLength={2}
                      className={`w-full px-3 py-2 bg-zinc-900 border ${
                        addressErrors.state ? 'border-rose-500' : 'border-zinc-800'
                      } rounded-xl text-xs text-white font-mono uppercase placeholder-zinc-500 focus:outline-hidden focus:border-orange-500`}
                    />
                    {addressErrors.state && (
                      <p className="text-[10px] text-rose-400 mt-0.5">
                        {addressErrors.state}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-3">
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Rua / Avenida *
                    </label>
                    <input
                      type="text"
                      value={address.street}
                      onChange={e => {
                        setAddress(prev => ({ ...prev, street: e.target.value }));
                        if (addressErrors.street) {
                          setAddressErrors(prev => ({ ...prev, street: undefined }));
                        }
                      }}
                      placeholder="Ex: Rua das Flores"
                      className={`w-full px-3 py-2 bg-zinc-900 border ${
                        addressErrors.street ? 'border-rose-500' : 'border-zinc-800'
                      } rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500`}
                    />
                    {addressErrors.street && (
                      <p className="text-[10px] text-rose-400 mt-0.5">
                        {addressErrors.street}
                      </p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Número *
                    </label>
                    <input
                      type="text"
                      value={address.number}
                      onChange={e => {
                        setAddress(prev => ({ ...prev, number: e.target.value }));
                        if (addressErrors.number) {
                          setAddressErrors(prev => ({ ...prev, number: undefined }));
                        }
                      }}
                      placeholder="123"
                      className={`w-full px-3 py-2 bg-zinc-900 border ${
                        addressErrors.number ? 'border-rose-500' : 'border-zinc-800'
                      } rounded-xl text-xs text-white font-mono placeholder-zinc-500 focus:outline-hidden focus:border-orange-500`}
                    />
                    {addressErrors.number && (
                      <p className="text-[10px] text-rose-400 mt-0.5">
                        {addressErrors.number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Bairro *
                    </label>
                    <input
                      type="text"
                      value={address.neighborhood}
                      onChange={e => {
                        setAddress(prev => ({
                          ...prev,
                          neighborhood: e.target.value,
                        }));
                        if (addressErrors.neighborhood) {
                          setAddressErrors(prev => ({
                            ...prev,
                            neighborhood: undefined,
                          }));
                        }
                      }}
                      placeholder="Ex: Centro"
                      className={`w-full px-3 py-2 bg-zinc-900 border ${
                        addressErrors.neighborhood
                          ? 'border-rose-500'
                          : 'border-zinc-800'
                      } rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500`}
                    />
                    {addressErrors.neighborhood && (
                      <p className="text-[10px] text-rose-400 mt-0.5">
                        {addressErrors.neighborhood}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={address.complement}
                      onChange={e =>
                        setAddress(prev => ({ ...prev, complement: e.target.value }))
                      }
                      placeholder="Apto, Bloco..."
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Ponto de Referência (opcional)
                  </label>
                  <input
                    type="text"
                    value={address.reference}
                    onChange={e =>
                      setAddress(prev => ({ ...prev, reference: e.target.value }))
                    }
                    placeholder="Ex: Em frente à padaria, portão branco"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Payment Method & Notes */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <span className="text-xs font-semibold text-zinc-300 block">
              Escolha como deseja pagar:
            </span>

            <div className="space-y-2">
              {/* PIX */}
              {payments.acceptPix && (
                <div
                  onClick={() => setPayment(prev => ({ ...prev, method: 'pix' }))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      setPayment(prev => ({ ...prev, method: 'pix' }));
                    }
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    payment.method === 'pix'
                      ? 'bg-zinc-800 border-zinc-650 shadow-md'
                      : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-850/80 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>PIX Instantâneo</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300">
                            Aprovação Imediata
                          </span>
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Pague pelo app do seu banco com chave ou QR Code
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        payment.method === 'pix'
                          ? 'border-transparent text-white'
                          : 'border-zinc-700'
                      }`}
                      style={{
                        backgroundColor: payment.method === 'pix' ? primaryColor : undefined,
                      }}
                    >
                      {payment.method === 'pix' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  {payment.method === 'pix' && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                      <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="text-[10px] text-zinc-500 block uppercase font-mono">
                            Chave PIX
                          </span>
                          <span className="text-xs font-mono font-bold text-teal-400 truncate block">
                            {payments.pixKey ||
                              'chave pix não configurada nesta loja'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleCopyPixKey();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-medium flex items-center gap-1 shrink-0 transition-colors"
                        >
                          {copiedPix ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-zinc-400" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cartão de Crédito na Entrega */}
              {payments.acceptCreditCard && (
                <div
                  onClick={() =>
                    setPayment(prev => ({ ...prev, method: 'cartao_credito' }))
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      setPayment(prev => ({ ...prev, method: 'cartao_credito' }));
                    }
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    payment.method === 'cartao_credito'
                      ? 'bg-zinc-800 border-zinc-650 shadow-md'
                      : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-850/80 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          Cartão de Crédito na Entrega
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          {payments.cardPaymentOnDeliveryNote ||
                            'O entregador levará a maquininha'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        payment.method === 'cartao_credito'
                          ? 'border-transparent text-white'
                          : 'border-zinc-700'
                      }`}
                      style={{
                        backgroundColor:
                          payment.method === 'cartao_credito' ? primaryColor : undefined,
                      }}
                    >
                      {payment.method === 'cartao_credito' && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cartão de Débito na Entrega */}
              {payments.acceptDebitCard && (
                <div
                  onClick={() =>
                    setPayment(prev => ({ ...prev, method: 'cartao_debito' }))
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      setPayment(prev => ({ ...prev, method: 'cartao_debito' }));
                    }
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    payment.method === 'cartao_debito'
                      ? 'bg-zinc-800 border-zinc-650 shadow-md'
                      : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-850/80 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          Cartão de Débito na Entrega
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Pague ao receber na maquininha
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        payment.method === 'cartao_debito'
                          ? 'border-transparent text-white'
                          : 'border-zinc-700'
                      }`}
                      style={{
                        backgroundColor:
                          payment.method === 'cartao_debito' ? primaryColor : undefined,
                      }}
                    >
                      {payment.method === 'cartao_debito' && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Dinheiro */}
              {payments.acceptCash && (
                <div
                  onClick={() =>
                    setPayment(prev => ({ ...prev, method: 'dinheiro' }))
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      setPayment(prev => ({ ...prev, method: 'dinheiro' }));
                    }
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    payment.method === 'dinheiro'
                      ? 'bg-zinc-800 border-zinc-650 shadow-md'
                      : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-850/80 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          Dinheiro na Entrega
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Pagamento em cédulas
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        payment.method === 'dinheiro'
                          ? 'border-transparent text-white'
                          : 'border-zinc-700'
                      }`}
                      style={{
                        backgroundColor:
                          payment.method === 'dinheiro' ? primaryColor : undefined,
                      }}
                    >
                      {payment.method === 'dinheiro' && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                  </div>

                  {payment.method === 'dinheiro' && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium">Precisa de troco?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setPayment(prev => ({ ...prev, needChange: false }));
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                              !payment.needChange
                                ? 'bg-zinc-700 text-white'
                                : 'bg-zinc-900 text-zinc-400'
                            }`}
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setPayment(prev => ({ ...prev, needChange: true }));
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                              payment.needChange
                                ? 'bg-zinc-700 text-white'
                                : 'bg-zinc-900 text-zinc-400'
                            }`}
                          >
                            Sim
                          </button>
                        </div>
                      </div>

                      {payment.needChange && (
                        <div className="space-y-1.5">
                          <label className="block text-[11px] text-zinc-400">
                            Troco para quanto? (R$)
                          </label>
                          <input
                            type="text"
                            value={payment.changeFor}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9,.]/g, '');
                              setPayment(prev => ({ ...prev, changeFor: val }));
                              setPaymentError(null);
                            }}
                            placeholder={`Ex: ${Math.ceil(total / 10) * 10 || 50}`}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono placeholder-zinc-500 focus:outline-hidden focus:border-orange-500"
                          />
                          {payment.changeFor && (
                            <div className="text-[11px] font-mono text-emerald-400 pt-0.5">
                              {(() => {
                                const parsed = parseMoneyInput(payment.changeFor);
                                if (parsed === null || parsed < total) {
                                  return (
                                    <span className="text-rose-400">
                                      Valor menor que o total ({formatCurrency(total)})
                                    </span>
                                  );
                                }
                                return `Seu troco será: ${formatCurrency(
                                  parsed - total
                                )}`;
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {paymentError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* General Order Notes */}
            <div className={`p-3.5 ${styles.card}`}>
              <label
                htmlFor="orderNotes"
                className="block text-xs font-semibold text-zinc-300 mb-1"
              >
                Observações gerais do pedido (opcional)
              </label>
              <textarea
                id="orderNotes"
                rows={2}
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder="Ex: Não tocar campainha, chamar no WhatsApp, deixar com o porteiro..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-orange-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Review & Final Confirmation */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in">
            {/* Customer & Modality Summary */}
            <div className={`p-3.5 ${styles.card} space-y-2 text-xs`}>
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-bold text-white">{customer.name}</span>
                </div>
                <span className="font-mono text-zinc-400">{customer.phone}</span>
              </div>

              <div className="flex items-start gap-2 pt-1 text-zinc-300">
                {orderModality === 'delivery' ? (
                  <>
                    <Bike className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-white">
                        Entrega em: {address.street}, {address.number}
                        {address.complement && ` (${address.complement})`}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {address.neighborhood} - {address.city} - {address.state}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Store className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-white">Retirada no Balcão</p>
                      <p className="text-[11px] text-zinc-400">
                        {info.address} - {info.city}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Payment Summary */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400">Forma de Pagamento:</span>
                <span className="font-semibold text-white">
                  {payment.method === 'pix'
                    ? 'PIX Instantâneo'
                    : payment.method === 'cartao_credito'
                    ? 'Cartão de Crédito na Entrega'
                    : payment.method === 'cartao_debito'
                    ? 'Cartão de Débito na Entrega'
                    : `Dinheiro ${
                        payment.needChange && payment.changeFor
                          ? `(Troco p/ ${formatCurrency(
                              parseMoneyInput(payment.changeFor) ?? 0
                            )})`
                          : '(Sem troco)'
                      }`}
                </span>
              </div>

              {generalNotes && (
                <div className="pt-2 border-t border-zinc-800 text-[11px] text-amber-300/90 italic">
                  Obs do pedido: &ldquo;{generalNotes}&rdquo;
                </div>
              )}
            </div>

            {/* Items summary */}
            <div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                Itens ({cartItems.reduce((acc, i) => acc + i.quantity, 0)})
              </span>
              <div className="divide-y divide-zinc-850 rounded-2xl bg-[#11141B] border border-zinc-800 overflow-hidden">
                {cartItems.map(cartItem => (
                  <div key={cartItem.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-white">
                        {cartItem.quantity}x {cartItem.item.name}
                      </span>
                      {cartItem.modifierSelections.length > 0 && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {cartItem.modifierSelections
                            .map(m => m.name)
                            .join(', ')}
                        </p>
                      )}
                      {cartItem.notes && (
                        <p className="text-[10px] text-zinc-500 italic mt-0.5">
                          Obs: {cartItem.notes}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">
                      {formatCurrency(cartItem.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className={`p-3.5 ${styles.card} space-y-2 text-xs`}>
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
                    ? 'Grátis'
                    : deliveryFee === 0
                    ? 'Grátis'
                    : formatCurrency(deliveryFee)}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline text-white">
                <span className="text-sm font-bold">Total do Pedido</span>
                <span
                  className="text-lg font-mono font-bold tabular-nums"
                  style={{ color: primaryColor }}
                >
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
