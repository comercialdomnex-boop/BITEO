import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `export * from './src/utils/paymentRules'; export * from './src/services/orderService'; export * from './src/services/checkoutApi'; export * from './src/services/storeService';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
  define: {
    'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' }),
  },
  plugins: [{ name: 'test-client', setup(build) {
    build.onLoad({ filter: /[\\/]lib[\\/]supabase\.ts$/ }, () => ({ contents: `export const supabaseConfigError = 'Missing config'; export const getSupabase = () => globalThis.paymentTestClient;`, loader: 'ts' }));
  } }],
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const {
  getAvailablePaymentOptions, getPaymentLabel, canStartPreparation, isWaitingPrepaidPayment,
  canConfirmPaymentManually, getCustomerPaymentInstructions, onReceiptTiming, getConfirmationHeadline,
  OrderService, submitGuestOrder,
} = mod;

const allPayments = {
  acceptPixPrepaid: true, acceptPix: true, pixKey: 'pix@loja.com',
  acceptCash: true, cashNeedChange: true, acceptCreditCard: true, acceptDebitCard: true,
  cardPaymentOnDeliveryNote: '',
};

test('all six payment options are offered, with timing derived from delivery vs pickup', () => {
  const delivery = getAvailablePaymentOptions(allPayments, 'delivery').map(o => o.label);
  assert.deepEqual(delivery, [
    'Pix antecipado', 'Pix na entrega', 'Cartão de crédito na entrega',
    'Cartão de débito na entrega', 'Dinheiro na entrega',
  ]);
  const pickup = getAvailablePaymentOptions(allPayments, 'retirada');
  assert.deepEqual(pickup.map(o => o.label), [
    'Pix antecipado', 'Pix na retirada', 'Cartão de crédito na retirada',
    'Cartão de débito na retirada', 'Dinheiro na retirada',
  ]);
  assert.deepEqual(pickup.map(o => o.timing), ['antecipado', 'na_retirada', 'na_retirada', 'na_retirada', 'na_retirada']);
  assert.equal(onReceiptTiming('delivery'), 'na_entrega');
});

test('each store only offers the methods it enabled', () => {
  const onlyCash = { ...allPayments, acceptPixPrepaid: false, acceptPix: false, acceptCreditCard: false, acceptDebitCard: false };
  assert.deepEqual(getAvailablePaymentOptions(onlyCash, 'delivery').map(o => o.id), ['dinheiro:na_entrega']);
  const none = { ...onlyCash, acceptCash: false };
  assert.deepEqual(getAvailablePaymentOptions(none, 'retirada'), []);
  const prepaidOnly = { ...none, acceptPixPrepaid: true };
  assert.deepEqual(getAvailablePaymentOptions(prepaidOnly, 'retirada').map(o => o.id), ['pix:antecipado']);
});

test('Pix antecipado is hidden while the store has no Pix key', () => {
  for (const pixKey of [undefined, '', '   ']) {
    const ids = getAvailablePaymentOptions({ ...allPayments, pixKey }, 'delivery').map(o => o.id);
    assert.ok(!ids.includes('pix:antecipado'));
    assert.ok(ids.includes('pix:na_entrega'));
  }
});

test('Pix antecipado blocks preparation until paid; payment on receipt never blocks', () => {
  assert.equal(canStartPreparation({ paymentTiming: 'antecipado', paymentStatus: 'pendente' }), false);
  assert.equal(canStartPreparation({ paymentTiming: 'antecipado', paymentStatus: 'falhou' }), false);
  assert.equal(canStartPreparation({ paymentTiming: 'antecipado', paymentStatus: 'pago' }), true);
  for (const timing of ['na_entrega', 'na_retirada']) {
    assert.equal(canStartPreparation({ paymentTiming: timing, paymentStatus: 'pendente' }), true);
  }
  assert.equal(isWaitingPrepaidPayment({ status: 'aceito', paymentTiming: 'antecipado', paymentStatus: 'pendente' }), true);
  assert.equal(isWaitingPrepaidPayment({ status: 'aceito', paymentTiming: 'na_entrega', paymentStatus: 'pendente' }), false);
});

test('manual confirmation only from pending and never on cancelled orders', () => {
  assert.equal(canConfirmPaymentManually({ status: 'concluido', paymentTiming: 'na_entrega', paymentStatus: 'pendente' }), true);
  assert.equal(canConfirmPaymentManually({ status: 'novo', paymentTiming: 'antecipado', paymentStatus: 'pendente' }), true);
  assert.equal(canConfirmPaymentManually({ status: 'cancelado', paymentTiming: 'na_entrega', paymentStatus: 'pendente' }), false);
  assert.equal(canConfirmPaymentManually({ status: 'pronto', paymentTiming: 'na_entrega', paymentStatus: 'pago' }), false);
});

test('customer is told when and how to pay', () => {
  const prepaid = getCustomerPaymentInstructions({ paymentMethod: 'pix', paymentTiming: 'antecipado', paymentStatus: 'pendente', type: 'delivery' });
  assert.equal(prepaid.title, 'Pague agora com Pix');
  assert.match(prepaid.message, /só entra em preparo depois/);
  assert.equal(prepaid.showPixKey, true);

  const pixPickup = getCustomerPaymentInstructions({ paymentMethod: 'pix', paymentTiming: 'na_retirada', paymentStatus: 'pendente', type: 'retirada' });
  assert.equal(pixPickup.title, 'Pix na retirada');
  assert.match(pixPickup.message, /Não é preciso pagar agora/);

  const cash = getCustomerPaymentInstructions({ paymentMethod: 'dinheiro', paymentTiming: 'na_entrega', paymentStatus: 'pendente', type: 'delivery' });
  assert.equal(cash.title, 'Dinheiro na entrega');
  assert.equal(cash.showPixKey, false);

  const card = getCustomerPaymentInstructions({ paymentMethod: 'cartao_debito', paymentTiming: 'na_retirada', paymentStatus: 'pendente', type: 'retirada' });
  assert.match(card.message, /maquininha quando retirar/);

  const paid = getCustomerPaymentInstructions({ paymentMethod: 'pix', paymentTiming: 'antecipado', paymentStatus: 'pago', type: 'delivery' });
  assert.equal(paid.title, 'Pagamento confirmado');
  assert.equal(getPaymentLabel('cartao_credito', 'na_entrega'), 'Cartão de crédito na entrega');
});

test('confirmation headline never claims acceptance or payment without confirmation', () => {
  const h = (paymentMethod, paymentTiming, paymentStatus = 'pendente') => getConfirmationHeadline({ paymentMethod, paymentTiming, paymentStatus });
  assert.equal(h('pix', 'antecipado'), 'Pedido registrado! Aguardando confirmação do Pix.');
  assert.equal(h('pix', 'na_retirada'), 'Pedido recebido! Pague via Pix na retirada.');
  assert.equal(h('pix', 'na_entrega'), 'Pedido recebido! Pague via Pix na entrega.');
  for (const m of ['dinheiro', 'cartao_credito', 'cartao_debito']) {
    for (const t of ['na_entrega', 'na_retirada']) assert.equal(h(m, t), 'Pedido recebido! Pagamento na entrega ou retirada.');
  }
  for (const m of ['pix', 'dinheiro', 'cartao_credito']) {
    assert.doesNotMatch(h(m, m === 'pix' ? 'antecipado' : 'na_entrega'), /aceito|pago|aprovado/i);
  }
});

function order(overrides) {
  return {
    id: 'o1', displayId: '#1', customer: { id: 'c', name: 'A', phone: '+5511999999999' },
    items: [], itemsCount: 0, type: 'delivery', status: 'aceito',
    subtotal: 10, deliveryFee: 0, discount: 0, total: 10,
    paymentMethod: 'pix', paymentTiming: 'antecipado', paymentStatus: 'pendente',
    createdAt: new Date().toISOString(), statusHistory: [], ...overrides,
  };
}
function rpcRecorder() {
  const calls = [];
  return { calls, rpc: async (name, args) => { calls.push([name, args]); return { data: null, error: null }; } };
}

test('order service refuses to start preparing an unpaid Pix antecipado without calling the backend', async () => {
  const client = rpcRecorder();
  globalThis.paymentTestClient = client;
  OrderService.setStoreContext('pay-store-1', [order({})]);
  await assert.rejects(OrderService.updateOrderStatus('o1', 'em_preparo'), /aguarda a confirmação do Pix antecipado/);
  assert.equal(client.calls.length, 0);
  // Cancelling is still allowed while waiting for payment.
  const cancelled = await OrderService.updateOrderStatus('o1', 'cancelado', 'Cliente desistiu');
  assert.equal(cancelled.status, 'cancelado');
  assert.equal(cancelled.paymentStatus, 'pendente');
});

test('payment on delivery/pickup is accepted and prepared normally, staying pending', async () => {
  const client = rpcRecorder();
  globalThis.paymentTestClient = client;
  OrderService.setStoreContext('pay-store-2', [order({ status: 'novo', paymentMethod: 'dinheiro', paymentTiming: 'na_entrega' })]);
  await OrderService.updateOrderStatus('o1', 'aceito');
  const preparing = await OrderService.updateOrderStatus('o1', 'em_preparo');
  assert.equal(preparing.status, 'em_preparo');
  assert.equal(preparing.paymentStatus, 'pendente');
  assert.deepEqual(client.calls.map(c => c[1].p_target_status), ['aceito', 'em_preparo']);
});

test('paid Pix antecipado can start preparation', async () => {
  globalThis.paymentTestClient = rpcRecorder();
  OrderService.setStoreContext('pay-store-3', [order({ paymentStatus: 'pago' })]);
  const preparing = await OrderService.updateOrderStatus('o1', 'em_preparo');
  assert.equal(preparing.status, 'em_preparo');
});

test('checkout sends payment method and timing, never a payment status', async () => {
  const store = new Map();
  globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
  let sent;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ orderId: 'x', orderNumber: 7, totalCents: 1000, status: 'novo', paymentMethod: 'pix', paymentTiming: 'antecipado', paymentStatus: 'pendente' }), { status: 201 });
  };
  const receipt = await submitGuestOrder({
    storeId: 'store', customer: { name: 'Ana', phone: '11999999999', phoneNormalized: '+5511999999999' },
    type: 'retirada', paymentMethod: 'pix', paymentTiming: 'antecipado',
    cartItems: [{ id: 'l1', item: { id: 'p1' }, quantity: 1, modifierSelections: [] }],
    turnstileToken: 'token-1234567890',
  });
  assert.equal(sent.paymentMethod, 'pix');
  assert.equal(sent.paymentTiming, 'antecipado');
  assert.equal('paymentStatus' in sent, false);
  assert.equal(receipt.paymentStatus, 'pendente');
});

// Contract checks on the migration: the SQL suite (tests/rls) exercises it
// against Postgres; these guard the rules from being dropped by accident.
test('payment migration keeps the backend rules', () => {
  const sql = readFileSync('supabase/migrations/20261031120000_payment_timing_rules.sql', 'utf8');
  assert.match(sql, /revoke update \(payment_status\) on public\.orders from authenticated/);
  assert.match(sql, /p_target_status = 'em_preparo'\s+and v_order\.payment_timing = 'antecipado'\s+and v_order\.payment_status <> 'pago'/);
  assert.match(sql, /orders_prepaid_requires_pix check/);
  assert.match(sql, /orders_payment_timing_matches_fulfillment check/);
  assert.match(sql, /orders_paid_has_confirmation check/);
  assert.match(sql, /v_type,'novo',v_payment,v_timing,'pendente'/);
  assert.match(sql, /payment_method='pix' and payment_timing='antecipado'/);
  assert.doesNotMatch(sql, /grant update \([^)]*payment_status/);
  // Defense in depth: direct writes blocked by role even if UPDATE is re-granted.
  assert.match(sql, /create trigger orders_guard_payment_fields\s+before insert or update on public\.orders/);
  assert.match(sql, /security invoker[\s\S]*current_user not in \('authenticated', 'anon'\)/);
  for (const col of ['payment_status', 'payment_timing', 'payment_confirmed_at', 'payment_confirmed_by', 'payment_confirmation_source']) {
    assert.match(sql, new RegExp(`new\.${col} is distinct from old\.${col}`));
  }
  // Legacy Pix orders with a provider charge stay confirmable by the webhook.
  assert.match(sql, /set payment_timing = 'antecipado'[\s\S]*exists \(select 1 from public\.order_pix_payments p where p\.order_id = o\.id\)/);
  assert.doesNotMatch(sql, /grant execute on function public\.confirm_asaas_pix_payment[^;]*authenticated/);
});
