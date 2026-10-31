/**
 * MenuService against an emulated Supabase (tests/helpers/fakeSupabase.mjs).
 * Runs the real src/services/menuService.ts and src/utils/menuRules.ts code.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createFakeSupabase } from './helpers/fakeSupabase.mjs';

const bundle = await build({
  stdin: {
    contents: `export * from './src/services/menuService'; export * from './src/utils/menuRules'; export * from './src/utils/money';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'test-client', setup(b) {
    b.onLoad({ filter: /[\\/]lib[\\/]supabase\.ts$/ }, () => ({
      contents: `export const supabaseConfigError = null; export const getSupabase = () => globalThis.menuTestClient;`,
      loader: 'ts',
    }));
  } }],
});
const code = bundle.outputFiles[0].text;
let instance = 0;
/** A fresh module instance: same database, no in-memory state carried over (like a page reload). */
const freshModule = () =>
  import(`data:text/javascript;base64,${Buffer.from(`${code}\n// instance ${++instance}`).toString('base64')}`);

const STORE_A = '10000000-0000-4000-8000-00000000000a';
const STORE_B = '10000000-0000-4000-8000-00000000000b';
const OWNER_A = 'owner-a', OWNER_B = 'owner-b', ATTENDANT_A = 'attendant-a';

let fake, M;
beforeEach(async () => {
  fake = createFakeSupabase();
  globalThis.menuTestClient = fake.client;
  fake.seed('stores', { id: STORE_A, name: 'Loja A' });
  fake.seed('stores', { id: STORE_B, name: 'Loja B' });
  fake.addMember(OWNER_A, STORE_A, 'OWNER');
  fake.addMember(OWNER_B, STORE_B, 'OWNER');
  fake.addMember(ATTENDANT_A, STORE_A, 'ATTENDANT');
  fake.signIn(OWNER_A);
  M = await freshModule();
});

/** The situation reported in production: rows created directly in the database. */
function seedExistingMenu() {
  const lanches = fake.seed('categories', { store_id: STORE_A, name: 'Lanches' });
  const burger = fake.seed('products', { store_id: STORE_A, category_id: lanches.id, name: 'X-Burger', price_cents: 2590 });
  const fritas = fake.seed('products', { store_id: STORE_A, category_id: lanches.id, name: 'Batata', price_cents: 1500, promotional_price_cents: 1290 });
  const group = fake.seed('product_modifier_groups', { store_id: STORE_A, product_id: burger.id, name: 'Extras', min_select: 0, max_select: 2 });
  const bacon = fake.seed('modifier_options', { store_id: STORE_A, group_id: group.id, name: 'Bacon', price_cents: 450 });
  const otherCat = fake.seed('categories', { store_id: STORE_B, name: 'Pizzas' });
  fake.seed('products', { store_id: STORE_B, category_id: otherCat.id, name: 'Pizza B', price_cents: 5000 });
  return { lanches, burger, fritas, group, bacon };
}

const newProduct = (categoryId, extra = {}) => ({
  categoryId, name: 'Combo', description: 'Lanche + bebida', price: 39.9, isAvailable: true, ...extra,
});

// ---------------------------------------------------------------------------
test('reads products that already exist in the database (prices converted from cents)', async () => {
  const { burger, fritas, bacon } = seedExistingMenu();
  const menu = await M.MenuService.getMenu(STORE_A);
  assert.equal(menu.items.length, 2);
  assert.equal(menu.categories.length, 1);
  assert.equal(menu.categories[0].itemCount, 2);
  const b = menu.items.find(i => i.id === burger.id);
  assert.equal(b.price, 25.9);
  assert.equal(b.modifierGroups[0].options[0].id, bacon.id);
  assert.equal(b.modifierGroups[0].options[0].price, 4.5);
  const f = menu.items.find(i => i.id === fritas.id);
  assert.equal(f.promotionalPrice, 12.9);
});

test('store isolation: never reads or writes another store', async () => {
  seedExistingMenu();
  const items = await M.MenuService.getItems(STORE_A);
  assert.ok(items.every(i => i.name !== 'Pizza B'));
  // Store B is invisible to owner A: reported as an access error, not as an empty menu.
  await assert.rejects(M.MenuService.getMenu(STORE_B), e => e.kind === 'permission');
  const catB = fake.db.categories.find(c => c.store_id === STORE_B);
  await assert.rejects(M.MenuService.createCategory(STORE_B, { name: 'Invasão' }), e => e.kind === 'permission');
  await assert.rejects(M.MenuService.createItem(STORE_B, newProduct(catB.id)), e => e.kind === 'permission');
  // A product of store B addressed through store A's id is not found and stays untouched.
  const pizza = fake.db.products.find(p => p.store_id === STORE_B);
  await assert.rejects(M.MenuService.updateItem(STORE_A, pizza.id, { price: 1 }), e => e.kind === 'not_found');
  await assert.rejects(M.MenuService.deleteItem(STORE_A, pizza.id), e => e.kind === 'not_found');
  assert.equal(fake.db.products.find(p => p.id === pizza.id).price_cents, 5000);
  assert.equal(fake.db.products.find(p => p.id === pizza.id).deleted_at, null);
  // A category of store B cannot be attached to a product of store A.
  await assert.rejects(M.MenuService.createItem(STORE_A, newProduct(catB.id)), e => e.kind === 'validation');
  // Every query carries the store filter on top of RLS.
  fake.signIn(OWNER_B);
  const bItems = await M.MenuService.getItems(STORE_B);
  assert.deepEqual(bItems.map(i => i.name), ['Pizza B']);
});

test('create and edit are persisted and survive a reload', async () => {
  const { lanches } = seedExistingMenu();
  const created = await M.MenuService.createItem(STORE_A, newProduct(lanches.id, { promotionalPrice: 34.9 }));
  const row = fake.db.products.find(p => p.id === created.id);
  assert.equal(row.price_cents, 3990);
  assert.equal(row.promotional_price_cents, 3490);
  assert.equal(row.store_id, STORE_A);

  await M.MenuService.updateItem(STORE_A, created.id, { ...created, name: 'Combo Grande', price: 45, promotionalPrice: undefined });
  const reloaded = await freshModule();
  const after = (await reloaded.MenuService.getItems(STORE_A)).find(i => i.id === created.id);
  assert.equal(after.name, 'Combo Grande');
  assert.equal(after.price, 45);
  assert.equal(after.promotionalPrice, undefined);
});

test('pause, duplicate, logical delete and category ordering are persisted', async () => {
  const { burger, lanches } = seedExistingMenu();
  const paused = await M.MenuService.toggleItemAvailability(STORE_A, burger.id);
  assert.equal(paused.isAvailable, false);
  assert.equal(fake.db.products.find(p => p.id === burger.id).is_available, false);

  const copy = await M.MenuService.duplicateItem(STORE_A, burger.id);
  assert.notEqual(copy.id, burger.id);
  assert.equal(copy.name, 'X-Burger (Cópia)');
  assert.notEqual(copy.modifierGroups[0].id, (await M.MenuService.getItemById(STORE_A, burger.id)).modifierGroups[0].id);

  assert.equal(await M.MenuService.deleteItem(STORE_A, copy.id), true);
  const deletedRow = fake.db.products.find(p => p.id === copy.id);
  assert.ok(deletedRow, 'logical delete keeps the row');
  assert.ok(deletedRow.deleted_at);
  assert.ok(!(await M.MenuService.getItems(STORE_A)).some(i => i.id === copy.id));

  await assert.rejects(M.MenuService.deleteCategory(STORE_A, lanches.id), new RegExp(M.CATEGORY_HAS_ITEMS_ERROR));
  const bebidas = await M.MenuService.createCategory(STORE_A, { name: 'Bebidas' });
  await assert.rejects(M.MenuService.createCategory(STORE_A, { name: 'bebidas' }), e => e.kind === 'conflict');
  const ordered = await M.MenuService.moveCategoryOrder(STORE_A, bebidas.id, 'up');
  assert.deepEqual(ordered.map(c => c.name), ['Bebidas', 'Lanches']);
  assert.equal(await M.MenuService.deleteCategory(STORE_A, bebidas.id), true);
  assert.ok(fake.db.categories.find(c => c.id === bebidas.id).deleted_at);
});

test('reordering works for rows created in the database with the same sort_order', async () => {
  const { burger, fritas } = seedExistingMenu(); // both sort_order 0
  const before = (await M.MenuService.getItems(STORE_A)).map(i => i.id);
  assert.deepEqual(before, [burger.id, fritas.id]);
  const after = (await M.MenuService.moveItemOrder(STORE_A, fritas.id, 'up')).map(i => i.id);
  assert.deepEqual(after, [fritas.id, burger.id]);
  const reloaded = await freshModule();
  assert.deepEqual((await reloaded.MenuService.getItems(STORE_A)).map(i => i.id), [fritas.id, burger.id]);
});

test('modifiers: ids survive edits, removed ones are soft-deleted, new ones are inserted', async () => {
  const { burger, group, bacon } = seedExistingMenu();
  const item = await M.MenuService.getItemById(STORE_A, burger.id);
  const groups = [{
    ...item.modifierGroups[0],
    name: 'Adicionais',
    options: [
      { ...item.modifierGroups[0].options[0], name: 'Bacon crocante', price: 5 },
      { id: `opt_${Date.now()}`, name: 'Cheddar', price: 3.5 },
    ],
  }, {
    id: `group_${Date.now()}`, name: 'Ponto da carne', isRequired: true, minQuantity: 1, maxQuantity: 1,
    options: [{ id: 'opt_x', name: 'Ao ponto', price: 0 }, { id: 'opt_y', name: 'Bem passado', price: 0 }],
  }];
  const updated = await M.MenuService.updateItem(STORE_A, burger.id, { modifierGroups: groups });
  assert.equal(updated.modifierGroups.length, 2);
  assert.equal(updated.modifierGroups[0].id, group.id, 'existing group keeps its UUID');
  assert.equal(updated.modifierGroups[0].name, 'Adicionais');
  assert.equal(updated.modifierGroups[0].options[0].id, bacon.id, 'existing option keeps its UUID');
  assert.equal(fake.db.modifier_options.find(o => o.id === bacon.id).price_cents, 500);
  const cheddar = updated.modifierGroups[0].options[1];
  assert.match(cheddar.id, /^[0-9a-f-]{36}$/);
  assert.equal(fake.db.modifier_options.find(o => o.id === cheddar.id).price_cents, 350);
  assert.equal(updated.modifierGroups[1].isRequired, true);

  // Remove bacon and the second group.
  await M.MenuService.updateItem(STORE_A, burger.id, {
    modifierGroups: [{ ...updated.modifierGroups[0], options: [cheddar] }],
  });
  assert.ok(fake.db.modifier_options.find(o => o.id === bacon.id).deleted_at, 'removed option is soft-deleted');
  assert.ok(fake.db.product_modifier_groups.find(g => g.id === updated.modifierGroups[1].id).deleted_at);
  const reloaded = await (await freshModule()).MenuService.getItemById(STORE_A, burger.id);
  assert.deepEqual(reloaded.modifierGroups.map(g => g.options.map(o => o.name)), [['Cheddar']]);
});

test('invalid add-ons are rejected before anything is written', async () => {
  const { lanches } = seedExistingMenu();
  const productsBefore = fake.db.products.length;
  const bad = newProduct(lanches.id, {
    modifierGroups: [{ id: 'g', name: 'Molhos', isRequired: true, minQuantity: 3, maxQuantity: 2, options: [{ id: 'o', name: 'Barbecue', price: 0 }] }],
  });
  await assert.rejects(M.MenuService.createItem(STORE_A, bad), e => e.name === 'MenuValidationError');
  assert.equal(fake.db.products.length, productsBefore);
  await assert.rejects(M.MenuService.createItem(STORE_A, newProduct(lanches.id, { price: 0 })), /preço válido/);
  await assert.rejects(M.MenuService.createItem(STORE_A, newProduct(lanches.id, { promotionalPrice: 50 })), /menor que o preço/);
  await assert.rejects(M.MenuService.createItem(STORE_A, newProduct('')), /categoria/);
});

test('money: reais <-> cents without float drift', () => {
  assert.equal(M.toCents(19.99), 1999);
  assert.equal(M.toCents(0.1 + 0.2), 30);
  assert.equal(M.toCents(1234.565), 123457);
  assert.equal(M.fromCents(2590), 25.9);
  assert.equal(M.parseMoneyInput('1.234,56'), 1234.56);
  assert.equal(M.parseMoneyInput('R$ 12,50'), 12.5);
  assert.equal(M.effectiveUnitPriceCents({ price: 15, promotionalPrice: 12.9 }), 1290);
  assert.equal(M.effectiveUnitPriceCents({ price: 15, promotionalPrice: undefined }), 1500);
});

test('auth and RLS failures are reported as errors, never as an empty menu', async () => {
  seedExistingMenu();
  fake.signOut(); // anon: no table grant
  await assert.rejects(M.MenuService.getMenu(STORE_A), e => e.kind === 'permission' && /Sem permissão/.test(e.message));

  fake.signIn(OWNER_A);
  fake.state.jwtExpired = true;
  await assert.rejects(M.MenuService.getItems(STORE_A), e => e.kind === 'auth' && /sessão expirou/.test(e.message));

  fake.state.jwtExpired = false;
  fake.state.offline = true;
  await assert.rejects(M.MenuService.getCategories(STORE_A), e => e.kind === 'network');

  fake.state.offline = false;
  fake.signIn(ATTENDANT_A); // can read, cannot write
  assert.equal((await M.MenuService.getItems(STORE_A)).length, 2);
  const cat = fake.db.categories.find(c => c.store_id === STORE_A);
  await assert.rejects(M.MenuService.createItem(STORE_A, newProduct(cat.id)), e => e.kind === 'permission');
  const burger = fake.db.products.find(p => p.name === 'X-Burger');
  await assert.rejects(M.MenuService.toggleItemAvailability(STORE_A, burger.id), e => e.kind === 'not_found');
  await assert.rejects(M.MenuService.deleteItem(STORE_A, burger.id), e => e.kind === 'not_found');
  assert.equal(fake.db.products.find(p => p.id === burger.id).deleted_at, null);

  await assert.rejects(M.MenuService.getItems('loja-123'), e => e.kind === 'validation');
});

test('an empty menu of a readable store is a real empty state', async () => {
  const menu = await M.MenuService.getMenu(STORE_A);
  assert.deepEqual(menu, { categories: [], items: [] });
});

test('storefront shows only what the checkout accepts', async () => {
  const { lanches, burger, fritas, bacon } = seedExistingMenu();
  const sobremesas = fake.seed('categories', { store_id: STORE_A, name: 'Sobremesas', is_active: false });
  fake.seed('products', { store_id: STORE_A, category_id: sobremesas.id, name: 'Pudim', price_cents: 900 });
  fake.seed('products', { store_id: STORE_A, category_id: lanches.id, name: 'Esgotado', price_cents: 900, is_available: false });
  const molhos = fake.seed('product_modifier_groups', { store_id: STORE_A, product_id: fritas.id, name: 'Molho', is_required: true, min_select: 0, max_select: 1 });
  fake.seed('modifier_options', { store_id: STORE_A, group_id: molhos.id, name: 'Cheddar', price_cents: 300, is_available: false });
  fake.seed('modifier_options', { store_id: STORE_A, group_id: (await M.MenuService.getItemById(STORE_A, burger.id)).modifierGroups[0].id, name: 'Ovo', price_cents: 200, is_available: false });

  const menu = await M.MenuService.getStorefrontMenu(STORE_A);
  // Pudim (paused category), Esgotado (paused product) and Batata (required group without available options) are hidden.
  assert.deepEqual(menu.items.map(i => i.name), ['X-Burger']);
  assert.deepEqual(menu.items[0].modifierGroups[0].options.map(o => o.id), [bacon.id]);
  assert.deepEqual(menu.categories.map(c => c.name), ['Lanches']);
});

test('required selections follow create_guest_order: greatest(min_select, required ? 1 : 0)', () => {
  assert.equal(M.requiredSelectionCount({ isRequired: true, minQuantity: 0 }), 1);
  assert.equal(M.requiredSelectionCount({ isRequired: false, minQuantity: 2 }), 2);
  assert.equal(M.requiredSelectionCount({ isRequired: false, minQuantity: 0 }), 0);
});

test('saved cart is re-bound to the persisted menu after reload', async () => {
  const { burger, bacon, fritas } = seedExistingMenu();
  const menu = await M.MenuService.getStorefrontMenu(STORE_A);
  const burgerItem = menu.items.find(i => i.id === burger.id);
  const line = (item, selections, qty = 1) => ({
    id: `cart_${item.id}`, item, quantity: qty, basePrice: 1, unitPrice: 1, totalPrice: 1,
    selectedModifiers: {}, modifierSelections: selections, notes: undefined,
  });
  const stale = [
    line(burgerItem, [{ groupId: burgerItem.modifierGroups[0].id, groupName: 'x', optionId: bacon.id, name: 'x', unitPrice: 0, quantity: 1, total: 0 }], 2),
    line({ ...burgerItem, id: fritas.id }, []),
    line(burgerItem, [{ groupId: burgerItem.modifierGroups[0].id, groupName: 'x', optionId: 'opt_123', name: 'velho', unitPrice: 1, quantity: 1, total: 1 }]),
  ];
  // Merchant pauses Batata after the cart was saved.
  await M.MenuService.toggleItemAvailability(STORE_A, fritas.id);
  const fresh = await (await freshModule()).MenuService.getStorefrontMenu(STORE_A);
  const { cart, removed } = M.reconcileCart(stale, fresh.items);
  assert.equal(removed.length, 2);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].unitPrice, 30.4); // 25.90 + 4.50 from the database
  assert.equal(cart[0].totalPrice, 60.8);
  assert.equal(cart[0].modifierSelections[0].name, 'Bacon');
});

test('database errors are translated into actionable messages', () => {
  assert.equal(M.toMenuError({ code: '42501', message: 'new row violates row-level security policy' }, 'salvar').kind, 'permission');
  assert.equal(M.toMenuError({ code: 'PGRST301', message: 'JWT expired' }, 'salvar').kind, 'auth');
  assert.equal(M.toMenuError({ code: '', message: 'TypeError: Failed to fetch' }, 'salvar').kind, 'network');
  assert.equal(M.toMenuError({ code: '23505', message: 'duplicate key' }, 'salvar').kind, 'conflict');
  assert.match(M.toMenuError({ code: 'XX000', message: 'boom' }, 'salvar').message, /Falha ao salvar: boom/);
});
