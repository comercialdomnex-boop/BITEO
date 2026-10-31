import React, { useState } from 'react';
import { Order, OrderStatus } from '../../types';
import { OrderService } from '../../services/orderService';
import { confirmManualOrderPayment } from '../../services/manualPaymentService';
import {
  Modal,
  Button,
  StatusBadge,
  OrderTypeBadge,
  formatCurrency,
  formatTimeAgo,
  getPaymentStatusInfo,
} from '../../components/shared';
import { buildWhatsAppUrl, buildTelUrl, formatPhoneMask } from '../../utils/phone';
import {
  canConfirmPaymentManually,
  getManualConfirmationLabel,
  getPaymentLabel,
  isPrepaid,
  isWaitingPrepaidPayment,
} from '../../utils/paymentRules';
import {
  Phone,
  MapPin,
  Clock,
  Printer,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  MessageSquare,
  AlertCircle,
  FileCheck,
  Check,
  PackageCheck,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, reason?: string) => void;
  onPaymentConfirmed: (orderId: string) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onPaymentConfirmed,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [printFeedback, setPrintFeedback] = useState(false);

  // Cancellation Modal state
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('Cliente solicitou');
  const [customCancelReason, setCustomCancelReason] = useState('');

  if (!order) return null;

  const paymentInfo = getPaymentStatusInfo(order.paymentStatus);
  const paymentLabel = getPaymentLabel(order.paymentMethod, order.paymentTiming);
  const confirmLabel = getManualConfirmationLabel(order.paymentMethod, order.paymentTiming);
  const waitingPrepaid = isWaitingPrepaidPayment(order);
  const canConfirmPayment = canConfirmPaymentManually(order);
  const confirmQuestion = isPrepaid(order.paymentTiming) || order.paymentMethod === 'pix'
    ? `Você conferiu no banco que a loja recebeu o Pix de ${formatCurrency(order.total)}?`
    : order.paymentMethod === 'dinheiro'
    ? `Você recebeu ${formatCurrency(order.total)} em dinheiro${order.type === 'delivery' ? ' na entrega' : ' na retirada'}?`
    : `O pagamento de ${formatCurrency(order.total)} foi aprovado na maquininha?`;

  const handleConfirmPayment = async () => {
    if (!order || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      await confirmManualOrderPayment(order.id);
      onPaymentConfirmed(order.id);
      setConfirmingPayment(false);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Não foi possível confirmar o pagamento.');
    } finally {
      setPaymentBusy(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      setIsPrinting(false);
      setPrintFeedback(true);
      setTimeout(() => setPrintFeedback(false), 2500);
    }, 700);
  };

  const handleConfirmCancel = () => {
    const finalReason =
      cancelReason === 'Outro' && customCancelReason.trim()
        ? customCancelReason.trim()
        : cancelReason;
    onUpdateStatus(order.id, 'cancelado', finalReason);
    setIsCancelling(false);
  };

  // Timeline Steps Definition based on Order Type
  const deliverySteps: { status: OrderStatus; label: string }[] = [
    { status: 'novo', label: 'Recebido' },
    { status: 'aceito', label: 'Aceito' },
    { status: 'em_preparo', label: 'Em Preparo' },
    { status: 'pronto', label: 'Pronto p/ Envio' },
    { status: 'em_entrega', label: 'Saiu p/ Entrega' },
    { status: 'concluido', label: 'Entregue' },
  ];

  const pickupSteps: { status: OrderStatus; label: string }[] = [
    { status: 'novo', label: 'Recebido' },
    { status: 'aceito', label: 'Aceito' },
    { status: 'em_preparo', label: 'Em Preparo' },
    { status: 'pronto', label: 'Pronto p/ Retirada' },
    { status: 'concluido', label: 'Retirado' },
  ];

  const timelineSteps = order.type === 'delivery' ? deliverySteps : pickupSteps;

  const getStepIndex = (st: OrderStatus): number => {
    return timelineSteps.findIndex(s => s.status === st);
  };

  const currentStepIndex = getStepIndex(order.status);

  // Action Buttons Renderer based on status
  const renderActionButtons = () => {
    if (order.status === 'cancelado') {
      return (
        <div className="flex items-center justify-between w-full text-zinc-400 text-xs">
          <div className="flex items-center gap-1.5 text-rose-400">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>Cancelado: {order.cancellationReason || 'Sem motivo informado'}</span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            Pedido finalizado
          </span>
        </div>
      );
    }

    if (order.status === 'concluido') {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span>
              {order.type === 'delivery'
                ? 'Pedido entregue com sucesso!'
                : 'Pedido retirado pelo cliente!'}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            onClick={handlePrint}
            isLoading={isPrinting}
          >
            {printFeedback ? 'Impresso' : 'Comanda'}
          </Button>
        </div>
      );
    }

    const nextStatus = OrderService.getNextStatus(order.status, order.type);
    const nextLabel = OrderService.getStatusActionLabel(order.status, order.type);
    // Pix antecipado: preparation waits for the confirmed payment (backend enforces it too).
    const blockedByPayment = waitingPrepaid && nextStatus === 'em_preparo';

    return (
      <div className="flex flex-col sm:flex-row gap-2.5 w-full">
        <Button
          variant="danger"
          size="md"
          leftIcon={<XCircle className="w-4 h-4" />}
          onClick={() => setIsCancelling(true)}
          className="sm:w-1/3"
        >
          Cancelar Pedido
        </Button>

        {nextStatus && (
          <Button
            variant="primary"
            size="md"
            leftIcon={
              order.status === 'novo' ? (
                <Check className="w-4 h-4" />
              ) : order.status === 'aceito' ? (
                <ChefHat className="w-4 h-4" />
              ) : order.status === 'em_preparo' ? (
                <PackageCheck className="w-4 h-4" />
              ) : order.status === 'pronto' && order.type === 'delivery' ? (
                <Truck className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )
            }
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            className="flex-1"
            disabled={blockedByPayment}
            title={blockedByPayment ? 'Confirme o Pix antecipado antes de iniciar o preparo' : undefined}
          >
            {blockedByPayment ? 'Aguardando Pix antecipado' : nextLabel}
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isCancelling}
        onClose={onClose}
        title={`Pedido ${order.displayId}`}
        subtitle={`Recebido ${formatTimeAgo(order.createdAt)}`}
        maxWidth="md"
        footer={renderActionButtons()}
      >
        <div className="space-y-4 text-zinc-200">
          {/* Top Status & Badge Bar */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0F1117] border border-zinc-850">
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} orderType={order.type} />
              <OrderTypeBadge type={order.type} />
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700/60 rounded-xl transition-colors"
            >
              {printFeedback ? (
                <>
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Impresso!</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Comanda</span>
                </>
              )}
            </button>
          </div>

          {/* Visual Order Status Timeline */}
          {order.status !== 'cancelado' && (
            <div className="p-3.5 rounded-2xl bg-[#11141D] border border-zinc-850 space-y-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Progresso do Pedido
              </span>

              <div className="flex items-center justify-between relative pt-1">
                {/* Connecting background line */}
                <div className="absolute top-4 left-3 right-3 h-0.5 bg-zinc-800 -z-0" />

                {timelineSteps.map((step, idx) => {
                  const isDone = currentStepIndex >= idx;
                  const isCurrent = currentStepIndex === idx;

                  return (
                    <div
                      key={step.status}
                      className="flex flex-col items-center text-center relative z-10"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          isCurrent
                            ? 'bg-[#FF5500] text-white ring-4 ring-orange-500/20 shadow-md'
                            : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {isDone && !isCurrent ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={`text-[10px] mt-1.5 leading-tight max-w-[60px] truncate ${
                          isCurrent
                            ? 'text-orange-400 font-bold'
                            : isDone
                            ? 'text-zinc-200'
                            : 'text-zinc-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancellation Alert Banner */}
          {order.status === 'cancelado' && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-bold">Pedido Cancelado</strong>
                <p className="mt-0.5">Motivo: {order.cancellationReason || 'Não especificado'}</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Este pedido não é contabilizado no faturamento das vendas concluídas.
                </p>
              </div>
            </div>
          )}

          {/* Customer Information Card */}
          <div className="p-3.5 rounded-2xl bg-[#151922] border border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
                  Cliente
                </span>
                <h4 className="text-sm font-semibold text-white mt-0.5">
                  {order.customer.name}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  {formatPhoneMask(order.customer.phone)}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={buildWhatsAppUrl(order.customer.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={buildTelUrl(order.customer.phone)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl border border-zinc-700 transition-colors"
                  title="Ligar para cliente"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Delivery Address */}
            {order.type === 'delivery' && order.deliveryAddress && (
              <div className="mt-3 pt-3 border-t border-zinc-800/80">
                <div className="flex items-start gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-zinc-200 font-medium">
                      {order.deliveryAddress.street}, {order.deliveryAddress.number}
                      {order.deliveryAddress.complement &&
                        ` (${order.deliveryAddress.complement})`}
                    </p>
                    <p className="text-zinc-400 text-[11px]">
                      Bairro:{' '}
                      <strong className="text-zinc-200">
                        {order.deliveryAddress.neighborhood}
                      </strong>{' '}
                      - {order.deliveryAddress.city} - {order.deliveryAddress.state}
                      {order.deliveryAddress.zipCode &&
                        ` · CEP: ${order.deliveryAddress.zipCode}`}
                    </p>
                    {order.deliveryAddress.reference && (
                      <p className="text-zinc-400 text-[11px] mt-0.5 italic">
                        Ref: {order.deliveryAddress.reference}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Retirada notice */}
            {order.type === 'retirada' && (
              <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-300">
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Retirada no balcão do restaurante pelo próprio cliente.</span>
              </div>
            )}

            {/* General Notes */}
            {order.generalNotes && (
              <div className="mt-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{order.generalNotes}</span>
              </div>
            )}
          </div>

          {/* Order Items List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Itens do Pedido ({order.itemsCount})
              </span>
            </div>

            <div className="divide-y divide-zinc-850 rounded-2xl bg-[#14171F] border border-zinc-800/80 overflow-hidden">
              {order.items.map(item => (
                <div key={item.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold font-mono flex items-center justify-center shrink-0">
                        {item.quantity}x
                      </span>
                      <div>
                        <h5 className="text-sm font-medium text-white">{item.name}</h5>

                        {/* Modifiers / Add-ons */}
                        {item.modifiers.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.modifiers.map((mod, i) => (
                              <p key={i} className="text-xs text-orange-300/80 font-medium">
                                + {mod.quantity > 1 ? `${mod.quantity}x ` : ''}
                                {mod.groupName ? `${mod.groupName}: ` : ''}
                                {mod.name}
                                {mod.total > 0
                                  ? ` (${formatCurrency(mod.total)})`
                                  : ''}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Item notes */}
                        {item.notes && (
                          <p className="text-[11px] text-zinc-400 mt-1 italic">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-sm font-semibold font-mono text-zinc-200 shrink-0">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial & Payment Summary */}
          <div className="p-3.5 rounded-2xl bg-[#11141B] border border-zinc-850 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal dos itens</span>
              <span className="font-mono">{formatCurrency(order.subtotal)}</span>
            </div>

            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Taxa de Entrega</span>
                <span className="font-mono">{formatCurrency(order.deliveryFee)}</span>
              </div>
            )}

            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Desconto</span>
                <span className="font-mono">-{formatCurrency(order.discount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline text-white">
              <span className="font-semibold text-sm">Total a Receber</span>
              <span className="font-bold text-lg font-mono text-orange-400 tabular-nums">
                {formatCurrency(order.total)}
              </span>
            </div>

            {canConfirmPayment && (
              <div className="pt-3 border-t border-zinc-800 space-y-2">
                <p className="text-amber-300">
                  {waitingPrepaid
                    ? 'Pix antecipado: o preparo só pode começar depois que você conferir o crédito na conta da loja e confirmar aqui.'
                    : isPrepaid(order.paymentTiming) || order.paymentMethod === 'pix'
                    ? 'Confira o crédito na conta bancária da loja antes de confirmar.'
                    : `Pagamento ${order.type === 'delivery' ? 'na entrega' : 'na retirada'}: confirme somente depois de receber.`}
                </p>
                {paymentError && <p role="alert" className="text-rose-400">{paymentError}</p>}
                <Button variant="primary" size="sm" onClick={() => { setPaymentError(null); setConfirmingPayment(true); }}>{confirmLabel}</Button>
              </div>
            )}

            {/* Payment Method Badge */}
            <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">
                {paymentLabel}
              </span>
              <span className={`font-medium ${paymentInfo.colorClass}`}>
                {paymentInfo.label}
                {order.changeFor && ` (Troco para ${formatCurrency(order.changeFor)})`}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {confirmingPayment && order && (
        <Modal
          isOpen={confirmingPayment}
          onClose={() => { if (!paymentBusy) setConfirmingPayment(false); }}
          title={confirmLabel}
          subtitle={`Pedido ${order.displayId}`}
          maxWidth="sm"
          footer={<div className="flex gap-2 justify-end w-full"><Button variant="secondary" size="sm" onClick={() => setConfirmingPayment(false)} isLoading={false}>Voltar</Button><Button variant="primary" size="sm" onClick={handleConfirmPayment} isLoading={paymentBusy}>Confirmar pagamento recebido</Button></div>}
        >
          <p className="text-sm text-zinc-200">{confirmQuestion} Esta ação registra o pagamento como pago em seu nome e não pode ser desfeita pelo painel. O BITEO não verifica o recebimento automaticamente.</p>
          {paymentError && <p role="alert" className="text-sm text-rose-400 mt-2">{paymentError}</p>}
        </Modal>
      )}

      {/* Cancellation Reason Modal */}
      {isCancelling && (
        <Modal
          isOpen={isCancelling}
          onClose={() => setIsCancelling(false)}
          title="Cancelar Pedido"
          subtitle={`Selecione o motivo do cancelamento do pedido ${order.displayId}`}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-between gap-2.5 w-full">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setIsCancelling(false)}
              >
                Voltar
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleConfirmCancel}
              >
                Confirmar Cancelamento
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-zinc-200">
            <span className="font-semibold text-zinc-300 block">
              Qual o motivo do cancelamento?
            </span>

            {[
              'Cliente solicitou',
              'Item indisponível no cardápio',
              'Endereço fora da área de entrega',
              'Problema no pagamento',
              'Loja impossibilitada de atender no momento',
              'Outro',
            ].map(reason => (
              <label
                key={reason}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                  cancelReason === reason
                    ? 'border-rose-500 bg-rose-500/10 text-white font-medium'
                    : 'border-zinc-800 bg-[#0E1015] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="cancel_reason"
                  value={reason}
                  checked={cancelReason === reason}
                  onChange={() => setCancelReason(reason)}
                  className="text-rose-500 focus:ring-rose-500 bg-zinc-900 border-zinc-700"
                />
                <span>{reason}</span>
              </label>
            ))}

            {cancelReason === 'Outro' && (
              <div className="pt-1">
                <input
                  type="text"
                  value={customCancelReason}
                  onChange={e => setCustomCancelReason(e.target.value)}
                  placeholder="Especifique o motivo..."
                  className="w-full h-9 px-3 bg-[#0A0C0F] border border-zinc-800 text-xs rounded-xl text-white focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
