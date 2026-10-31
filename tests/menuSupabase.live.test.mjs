/**
 * Opt-in, READ-ONLY check against a real Supabase project, with RLS active and
 * the publishable (anon) key only. Skipped unless these variables are set:
 *
 *   BITEO_TEST_SUPABASE_URL, BITEO_TEST_SUPABASE_ANON_KEY,
 *   BITEO_TEST_EMAIL, BITEO_TEST_PASSWORD, BITEO_TEST_STORE_ID
 *   optional: BITEO_TEST_OTHER_STORE_ID (a store this user is NOT a member of)
 *   optional: BITEO_TEST_EXPECT_MIN_PRODUCTS (e.g. 2)
 *
 * Nothing is written: it only proves the Merchant/Storefront read path returns
 * the rows that exist in public.products for the signed-in member.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const env = process.env;
const ready = ['BITEO_TEST_SUPABASE_URL', 'BITEO_TEST_SUPABASE_ANON_KEY', 'BITEO_TEST_EMAIL', 'BITEO_TEST_PASSWORD', 'BITEO_TEST_STORE_ID']
  .every(k => env[k]);
const skip = ready ? false : 'set BITEO_TEST_* variables to run against a real Supabase project';

async function load() {
  const bundle = await build({
    stdin: {
      contents: `
        import { createClient } from '@supabase/supabase-js';
        export const client = createClient(${JSON.stringify(env.BITEO_TEST_SUPABASE_URL ?? '')}, ${JSON.stringify(env.BITEO_TEST_SUPABASE_ANON_KEY ?? '')}, { auth: { persistSession: false } });
        globalThis.menuLiveClient = client;
        export * from './src/services/menuService';`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: [{ name: 'live-client', setup(b) {
      b.onLoad({ filter: /[\\/]lib[\\/]supabase\.ts$/ }, () => ({
        contents: `export const supabaseConfigError = null; export const getSupabase = () => globalThis.menuLiveClient;`,
        loader: 'ts',
      }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}

test('live: anon cannot read the menu (error, not empty)', { skip }, async () => {
  const { MenuService } = await load();
  await assert.rejects(MenuService.getMenu(env.BITEO_TEST_STORE_ID), e => e.kind === 'permission' || e.kind === 'auth');
});

test('live: signed-in member reads the persisted products of the store', { skip }, async () => {
  const { MenuService, client } = await load();
  const { error } = await client.auth.signInWithPassword({ email: env.BITEO_TEST_EMAIL, password: env.BITEO_TEST_PASSWORD });
  assert.equal(error, null, error?.message);
  const menu = await MenuService.getMenu(env.BITEO_TEST_STORE_ID);
  const min = Number(env.BITEO_TEST_EXPECT_MIN_PRODUCTS || 0);
  assert.ok(menu.items.length >= min, `expected at least ${min} products, got ${menu.items.length}`);
  for (const item of menu.items) assert.ok(Number.isFinite(item.price) && item.price >= 0);
  if (env.BITEO_TEST_OTHER_STORE_ID) {
    assert.deepEqual(await MenuService.getItems(env.BITEO_TEST_OTHER_STORE_ID), []);
    await assert.rejects(MenuService.getMenu(env.BITEO_TEST_OTHER_STORE_ID), e => e.kind === 'permission');
  }
  await client.auth.signOut();
});
