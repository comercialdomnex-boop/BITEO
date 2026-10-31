/**
 * BITEO — regras de pagamento compartilhadas por checkout, confirmação e painel.
 *
 * Três eixos independentes do status de preparo:
 *   - método  (payment_method): pix | dinheiro | cartao_credito | cartao_debito
 *   - momento (payment_timing): antecipado | na_entrega | na_retirada
 *   - status  (payment_status): pendente | pago | falhou | reembolsado
 *
 * Estas funções só orientam a interface. O backend (create_guest_order,
 * set_order_status e confirm_manual_order_payment) valida tudo de novo.
 */
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  PaymentTiming,
} from '../types/order';
import type { PaymentMethods } from '../types/store';

export interface PaymentOption {
  /** Stable key for UI selection, e.g. "pix:antecipado". */
  id: string;
  method: PaymentMethod;
  timing: PaymentTiming;
  label: string;
  description: string;
}

export function paymentOptionId(method: PaymentMethod, timing: PaymentTiming): string {
  return `${method}:${timing}`;
}

/** Payment on receipt for a given fulfillment type. */
export function onReceiptTiming(type: OrderType): PaymentTiming {
  return type === 'delivery' ? 'na_entrega' : 'na_retirada';
}

export function isPrepaid(timing: PaymentTiming): boolean {
  return timing === 'antecipado';
}

/** "na entrega" / "na retirada" / "antecipado". */
export function getPaymentTimingLabel(timing: PaymentTiming): string {
  switch (timing) {
    case 'antecipado':
      return 'antecipado';
    case 'na_entrega':
      return 'na entrega';
    case 'na_retirada':
      return 'na retirada';
  }
}

const METHOD_NAMES: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
};

/** Full label, e.g. "Pix antecipado", "Dinheiro na retirada". */
export function getPaymentLabel(method: PaymentMethod, timing: PaymentTiming): string {
  return `${METHOD_NAMES[method]} ${getPaymentTimingLabel(timing)}`;
}

/**
 * Payment options the store accepts for the chosen fulfillment type, in display
 * order. Pix antecipado requires a registered Pix key (the customer needs it).
 */
export function getAvailablePaymentOptions(
  payments: PaymentMethods,
  type: OrderType
): PaymentOption[] {
  const receipt = onReceiptTiming(type);
  const where = type === 'delivery' ? 'na entrega' : 'na retirada';
  const options: PaymentOption[] = [];

  if (payments.acceptPixPrepaid && payments.pixKey?.trim()) {
    options.push({
      id: paymentOptionId('pix', 'antecipado'),
      method: 'pix',
      timing: 'antecipado',
      label: 'Pix antecipado',
      description: 'Pague agora. O preparo começa depois que a loja confirmar o pagamento.',
    });
  }
  if (payments.acceptPix) {
    options.push({
      id: paymentOptionId('pix', receipt),
      method: 'pix',
      timing: receipt,
      label: getPaymentLabel('pix', receipt),
      description: `Pague com Pix ${where}.`,
    });
  }
  if (payments.acceptCreditCard) {
    options.push({
      id: paymentOptionId('cartao_credito', receipt),
      method: 'cartao_credito',
      timing: receipt,
      label: getPaymentLabel('cartao_credito', receipt),
      description: payments.cardPaymentOnDeliveryNote?.trim() || `Pague na maquininha ${where}.`,
    });
  }
  if (payments.acceptDebitCard) {
    options.push({
      id: paymentOptionId('cartao_debito', receipt),
      method: 'cartao_debito',
      timing: receipt,
      label: getPaymentLabel('cartao_debito', receipt),
      description: `Pague na maquininha ${where}.`,
    });
  }
  if (payments.acceptCash) {
    options.push({
      id: paymentOptionId('dinheiro', receipt),
      method: 'dinheiro',
      timing: receipt,
      label: getPaymentLabel('dinheiro', receipt),
      description: `Pague em dinheiro ${where}.`,
    });
  }
  return options;
}

interface PaymentGateInput {
  status: OrderStatus;
  paymentTiming: PaymentTiming;
  paymentStatus: PaymentStatus;
}

/**
 * Mirrors the backend gate in set_order_status: Pix antecipado cannot enter
 * preparation until paid. Payment on receipt never blocks preparation.
 */
export function canStartPreparation(order: Pick<PaymentGateInput, 'paymentTiming' | 'paymentStatus'>): boolean {
  return !isPrepaid(order.paymentTiming) || order.paymentStatus === 'pago';
}

/** True when the order is blocked from its next status by a missing payment. */
export function isWaitingPrepaidPayment(order: PaymentGateInput): boolean {
  return (
    (order.status === 'novo' || order.status === 'aceito') &&
    isPrepaid(order.paymentTiming) &&
    order.paymentStatus !== 'pago'
  );
}

/** Mirrors confirm_manual_order_payment: only pending, never cancelled. */
export function canConfirmPaymentManually(order: PaymentGateInput): boolean {
  return order.paymentStatus === 'pendente' && order.status !== 'cancelado';
}

export interface CustomerPaymentInstructions {
  title: string;
  message: string;
  /** Whether the store Pix key should be shown to the customer. */
  showPixKey: boolean;
}

/** Tells the customer when and how to pay. */
export function getCustomerPaymentInstructions(order: {
  paymentMethod: PaymentMethod;
  paymentTiming: PaymentTiming;
  paymentStatus: PaymentStatus;
  type: OrderType;
}): CustomerPaymentInstructions {
  const where = order.type === 'delivery' ? 'na entrega' : 'na retirada';
  const moment = order.type === 'delivery' ? 'quando receber o pedido' : 'quando retirar o pedido no balcão';

  if (order.paymentStatus === 'pago') {
    return {
      title: 'Pagamento confirmado',
      message: 'A loja confirmou o recebimento do seu pagamento.',
      showPixKey: false,
    };
  }

  if (isPrepaid(order.paymentTiming)) {
    return {
      title: 'Pague agora com Pix',
      message:
        'Seu pedido só entra em preparo depois que a loja confirmar o pagamento. Faça o Pix agora para não atrasar.',
      showPixKey: true,
    };
  }

  switch (order.paymentMethod) {
    case 'pix':
      return {
        title: `Pix ${where}`,
        message: `Você paga com Pix ${moment}. Não é preciso pagar agora.`,
        showPixKey: true,
      };
    case 'dinheiro':
      return {
        title: `Dinheiro ${where}`,
        message: `Você paga em dinheiro ${moment}. Não é preciso pagar agora.`,
        showPixKey: false,
      };
    case 'cartao_credito':
      return {
        title: `Cartão de crédito ${where}`,
        message: `Você paga na maquininha ${moment}. Não é preciso pagar agora.`,
        showPixKey: false,
      };
    case 'cartao_debito':
      return {
        title: `Cartão de débito ${where}`,
        message: `Você paga na maquininha ${moment}. Não é preciso pagar agora.`,
        showPixKey: false,
      };
  }
}

/** Short merchant-facing label for the manual confirmation action. */
export function getManualConfirmationLabel(method: PaymentMethod, timing: PaymentTiming): string {
  if (isPrepaid(timing)) return 'Confirmar Pix recebido';
  switch (method) {
    case 'pix':
      return 'Confirmar Pix recebido';
    case 'dinheiro':
      return 'Confirmar dinheiro recebido';
    default:
      return 'Confirmar pagamento no cartão';
  }
}

/**
 * Headline for the customer confirmation screen. Never claims the order was
 * accepted or that money was received without a real confirmation.
 */
export function getConfirmationHeadline(order: {
  paymentMethod: PaymentMethod;
  paymentTiming: PaymentTiming;
  paymentStatus: PaymentStatus;
}): string {
  if (isPrepaid(order.paymentTiming)) {
    return order.paymentStatus === 'pago'
      ? 'Pedido registrado! Pix confirmado pela loja.'
      : 'Pedido registrado! Aguardando confirmação do Pix.';
  }
  if (order.paymentMethod === 'pix') {
    return order.paymentTiming === 'na_retirada'
      ? 'Pedido recebido! Pague via Pix na retirada.'
      : 'Pedido recebido! Pague via Pix na entrega.';
  }
  return 'Pedido recebido! Pagamento na entrega ou retirada.';
}
