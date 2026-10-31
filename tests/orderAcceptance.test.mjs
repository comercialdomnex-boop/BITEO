import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: `export * from './src/services/orderService'; export * from './src/services/orderAcceptancePersistence'; export * from './src/services/restaurantService'; export * from './src/services/storeService'; export * from './src/merchant/components/OrderAcceptanceControl';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'test-client', setup(build) {
    build.onLoad({ filter: /[\\/]lib[\\/]supabase\.ts$/ }, () => ({ contents: `export const supabaseConfigError = 'Missing config'; export const getSupabase = () => globalThis.acceptanceTestClient;`, loader: 'ts' }));
  } }],
});
const { OrderService, StoreService, saveOrderAcceptance, RestaurantService, createEmptyStoreConfig, OrderAcceptanceControl, orderAvailabilityLabel } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const mondayNoon = new Date(2026, 9, 26, 12);
function config(published, accepting, open) {
  const c = createEmptyStoreConfig('store');
  c.online.isPublished = published;
  c.operations.acceptingOrders = accepting;
  c.hours.schedule[0] = { ...c.hours.schedule[0], isOpen: open, periods: [{ id: 'period', open: '11:00', close: '14:00' }] };
  return c;
}
test('all eight publication/schedule/switch combinations require all three gates', () => {
  for (const p of [false, true]) for (const a of [false, true]) for (const h of [false, true]) {
    const profile = RestaurantService.buildProfile(config(p, a, h), mondayNoon);
    assert.equal(profile.isOpen, p && a && h);
    assert.equal(profile.acceptingOrders, a);
    assert.equal(profile.scheduledOpen, h);
  }
});
test('effective status changes at the configured closing time without changing the switch', () => {
  const c = config(true, true, true);
  assert.equal(RestaurantService.buildProfile(c, mondayNoon).isOpen, true);
  const closed = RestaurantService.buildProfile(c, new Date(2026, 9, 26, 14));
  assert.equal(closed.isOpen, false);
  assert.equal(closed.acceptingOrders, true);
  assert.match(orderAvailabilityLabel(closed), /fora do horário/);
});
test('shared header/sidebar/mobile control shows the switch separately from actual status', () => {
  const profile = RestaurantService.buildProfile(config(false, true, true), mondayNoon);
  const tree = OrderAcceptanceControl({ restaurant: profile, onToggle() {}, saving: true });
  const [button, status] = tree.props.children;
  assert.equal(button.props.role, 'switch');
  assert.equal(button.props['aria-checked'], true);
  assert.equal(button.props.disabled, true);
  assert.match(status.props.children, /não publicada/);
  const readOnly = OrderAcceptanceControl({ restaurant: profile, onToggle() {}, disabled: true });
  assert.equal(readOnly.props.children[0].props.disabled, true);
});
function fakeClient(response) {
  const calls = [];
  const q = {
    update(v) { calls.push(['update', v]); return q; },
    eq(k, v) { calls.push(['eq', k, v]); return q; },
    select(v) { calls.push(['select', v]); return q; },
    async single() { return response; },
  };
  return { calls, from(t) { calls.push(['from', t]); return q; } };
}
test('authenticated persistence updates only the requested store switch and returns confirmed DB state', async () => {
  const db = fakeClient({ data: { id: 'store', is_accepting_orders: true }, error: null });
  globalThis.acceptanceTestClient = db;
  assert.equal(await saveOrderAcceptance('store', true), true);
  assert.deepEqual(db.calls, [['from', 'stores'], ['update', { is_accepting_orders: true }], ['eq', 'id', 'store'], ['select', 'id, is_accepting_orders']]);
  globalThis.acceptanceTestClient = fakeClient({ data: { id: 'store', is_accepting_orders: false }, error: null });
  assert.equal(await saveOrderAcceptance('store', false), false);
});
test('RLS denial, invisible row, wrong store, missing client and empty ID are failures', async () => {
  for (const response of [
    { data: null, error: new Error('RLS denied') },
    { data: null, error: null },
    { data: { id: 'other', is_accepting_orders: true }, error: null },
  ]) {
    globalThis.acceptanceTestClient = fakeClient(response);
    await assert.rejects(saveOrderAcceptance('store', true));
  }
  globalThis.acceptanceTestClient = null;
  await assert.rejects(saveOrderAcceptance('store', true), /Missing config/);
  globalThis.acceptanceTestClient = fakeClient({});
  await assert.rejects(saveOrderAcceptance('', true), /Nenhuma loja/);
});

test('checkout order service rejects paused, unpublished and out-of-hours stores before creating orders', async () => {
  for (const [published, accepting, open] of [[true, false, true], [false, true, true], [true, true, false]]) {
    const c = config(published, accepting, open);
    StoreService.registerStore(c.id, c);
    OrderService.setStoreContext(c.id);
    const before = (await OrderService.getOrders()).length;
    await assert.rejects(OrderService.createOrder({}), /não está recebendo/);
    assert.equal((await OrderService.getOrders()).length, before);
  }
});
test('checkout order service accepts a published, enabled store in its configured window', async () => {
  const c = config(true, true, true);
  c.hours.schedule = c.hours.schedule.map(day => ({ ...day, isOpen: true, periods: [{ id: day.day, open: '00:00', close: '23:59' }] }));
  // Overnight coverage ensures the test does not depend on the execution clock.
  c.hours.schedule.forEach(day => day.periods.push({ id: day.day + '-night', open: '23:58', close: '00:01' }));
  StoreService.registerStore(c.id, c);
  OrderService.setStoreContext(c.id);
  const order = await OrderService.createOrder({ customer: { name: 'Teste' }, items: [], total: 0 });
  assert.equal(order.status, 'novo');
});
