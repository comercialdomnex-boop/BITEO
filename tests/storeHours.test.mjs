import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: `export * from './src/services/storePersistence'; export * from './src/merchant/views/store/HoursTab';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'test-client', setup(build) {
    build.onLoad({ filter: /\/lib\/supabase\.ts$/ }, () => ({ contents: `export const supabaseConfigError = null; export const getSupabase = () => globalThis.hoursTestClient;`, loader: 'ts' }));
  } }],
});
const { saveBusinessHours, HoursTab } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const day = (periods, isOpen = true) => ({ day: 'segunda', label: 'Segunda-feira', isOpen, periods });
const first = { id: 'one', open: '18:00', close: '02:00' };
const second = { id: 'two', open: '11:00', close: '14:00' };
function client(initial = [], fail = false) {
  const rows = structuredClone(initial);
  const calls = [];
  return { rows, calls, from(table) {
    let op, payload, options;
    const filters = [];
    const q = {
      upsert(p, o) { op = 'upsert'; payload = p; options = o; return q; },
      delete() { op = 'delete'; return q; },
      eq(k, v) { filters.push(r => r[k] === v); return q; },
      gte(k, v) { filters.push(r => r[k] >= v); return q; },
      then(resolve) {
        calls.push({ table, op, payload, options });
        if (table === 'business_hour_periods') {
          if (fail && op === 'upsert') return Promise.resolve({ error: new Error('denied') }).then(resolve);
          if (op === 'upsert') {
            assert.equal(options.onConflict, 'store_id,weekday,sort_order');
            for (const row of payload) {
              const old = rows.find(r => r.store_id === row.store_id && r.weekday === row.weekday && r.sort_order === row.sort_order);
              if (old) Object.assign(old, row); else rows.push({ ...row });
            }
          } else {
            for (let i = rows.length - 1; i >= 0; i--) if (filters.every(f => f(rows[i]))) rows.splice(i, 1);
          }
        }
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return q;
  } };
}
const row = (store_id, sort_order, opens_at = '18:00:00') => ({ store_id, weekday: 1, sort_order, opens_at, closes_at: '02:00:00' });
test('repeated/concurrent saves update the unique position and scope cleanup to the store/day', async () => {
  const db = client([row('store', 0), row('store', 1), row('other', 1), { ...row('store', 1), weekday: 2 }]);
  globalThis.hoursTestClient = db;
  await Promise.all([saveBusinessHours('store', { schedule: [day([first])] }), saveBusinessHours('store', { schedule: [day([first])] })]);
  assert.equal(db.rows.length, 3);
  assert.equal(db.rows.find(r => r.store_id === 'store' && r.weekday === 1).opens_at, '18:00:00');
  assert.equal(db.calls[1].op, 'upsert');
});
test('closed days and untouched legacy periods keep their times', async () => {
  const db = client(); globalThis.hoursTestClient = db;
  await saveBusinessHours('store', { schedule: [day([first, second], false)] });
  assert.equal(db.rows.length, 2);
  assert.equal(db.calls[0].payload.is_open, false);
  assert.equal(db.rows[1].opens_at, '11:00:00');
});
test('a failed replacement never deletes existing periods', async () => {
  const db = client([row('store', 0), row('store', 1)], true); globalThis.hoursTestClient = db;
  await assert.rejects(saveBusinessHours('store', { schedule: [day([first])] }), /denied/);
  assert.equal(db.rows.length, 2);
  assert.ok(!db.calls.some(c => c.op === 'delete'));
});
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)];
}
test('screen exposes one pair of inputs; editing replaces legacy periods without mutating the config', () => {
  const hours = { schedule: [day([first, second])] };
  const before = structuredClone(hours); let updated;
  const tree = HoursTab({ config: { hours }, onUpdateHours: h => { updated = h; }, onSaveNotice() {} });
  const inputs = elements(tree).filter(n => n.type === 'input');
  assert.equal(inputs.length, 2);
  inputs[0].props.onChange({ target: { value: '19:00' } });
  assert.deepEqual(hours, before);
  assert.deepEqual(updated.schedule[0].periods, [{ ...first, open: '19:00' }]);
  assert.equal(elements(tree).filter(n => n.type === 'button').length, 1);
});
