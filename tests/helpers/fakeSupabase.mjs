/**
 * In-memory stand-in for the Supabase/PostgREST client used by MenuService.
 *
 * It emulates what matters for the menu:
 * - RLS from 20261005130000_rls_and_permissions.sql: members read, only
 *   OWNER/ADMIN/MANAGER write; UPDATE silently skips rows outside the policy;
 *   INSERT outside the policy fails with 42501; anon has no table grant (42501).
 * - Check/unique/FK constraints of the catalog tables (23514/23505/23503).
 * - Invalid uuid literals (22P02) and .single() cardinality (PGRST116).
 * - Expired JWT (PGRST303) and network failure ("Failed to fetch").
 *
 * The data lives in `db`, separate from any MenuService module instance, so a
 * fresh import of the service simulates a page reload against the same database.
 */
import { randomUUID } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANAGE = new Set(['OWNER', 'ADMIN', 'MANAGER']);

export function createFakeSupabase() {
  const db = { stores: [], categories: [], products: [], product_modifier_groups: [], modifier_options: [] };
  const memberships = new Map(); // userId -> Map(storeId -> role)
  const state = { userId: null, jwtExpired: false, offline: false, calls: [] };
  let clock = Date.parse('2026-10-01T00:00:00Z');
  const stamp = () => new Date((clock += 1000)).toISOString();

  const roleIn = (storeId) => (state.userId ? memberships.get(state.userId)?.get(storeId) : undefined);
  const canRead = (table, row) => Boolean(roleIn(table === 'stores' ? row.id : row.store_id));
  const canManage = (row) => MANAGE.has(roleIn(row.store_id) || '');

  const err = (code, message) => ({ data: null, error: { code, message, details: null, hint: null }, count: null });

  function checkConstraints(table, row) {
    const blank = (v) => typeof v !== 'string' || v.trim() === '';
    if (['categories', 'products', 'product_modifier_groups', 'modifier_options'].includes(table) && blank(row.name)) {
      return err('23514', `new row for relation "${table}" violates check constraint "${table}_name_not_blank"`);
    }
    if (table === 'categories') {
      const dup = db.categories.find(c => c.id !== row.id && c.store_id === row.store_id && !c.deleted_at && !row.deleted_at &&
        c.name.toLowerCase() === row.name.toLowerCase());
      if (dup) return err('23505', 'duplicate key value violates unique constraint "categories_store_name_key"');
    }
    if (table === 'products') {
      if (!Number.isInteger(row.price_cents) || row.price_cents < 0) return err('23514', 'violates check constraint "products_price_non_negative"');
      if (row.promotional_price_cents != null && (row.promotional_price_cents < 0 || row.promotional_price_cents >= row.price_cents)) {
        return err('23514', 'violates check constraint "products_promotional_price_below_price"');
      }
      if (row.category_id && !db.categories.some(c => c.id === row.category_id && c.store_id === row.store_id)) {
        return err('23503', 'violates foreign key constraint "products_category_tenant_fk"');
      }
    }
    if (table === 'product_modifier_groups') {
      if (!db.products.some(p => p.id === row.product_id && p.store_id === row.store_id)) {
        return err('23503', 'violates foreign key constraint "product_modifier_groups_product_tenant_fk"');
      }
      if (row.min_select < 0 || row.max_select < 1 || row.max_select < row.min_select) {
        return err('23514', 'violates check constraint "product_modifier_groups_max_select_gte_min"');
      }
    }
    if (table === 'modifier_options') {
      if (!db.product_modifier_groups.some(g => g.id === row.group_id && g.store_id === row.store_id)) {
        return err('23503', 'violates foreign key constraint "modifier_options_group_tenant_fk"');
      }
      if (!Number.isInteger(row.price_cents) || row.price_cents < 0) return err('23514', 'violates check constraint "modifier_options_price_non_negative"');
    }
    return null;
  }

  const DEFAULTS = {
    categories: { description: null, icon: null, is_active: true, sort_order: 0 },
    products: { category_id: null, description: null, promotional_price_cents: null, is_available: true, image_url: null,
      preparation_time_minutes: null, highlight_badge: null, sort_order: 0 },
    product_modifier_groups: { is_required: false, min_select: 0, max_select: 1, sort_order: 0, is_active: true },
    modifier_options: { price_cents: 0, is_available: true, sort_order: 0 },
    stores: { is_published: false },
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.filters = [];
      this.orders = [];
      this.wantRows = false;
      this.singleRow = false;
      this.limitN = null;
      this.countMode = null;
      this.head = false;
    }
    select(_cols, opts = {}) {
      if (this.op === 'select') this.wantRows = true;
      else this.wantRows = true;
      if (opts.count) this.countMode = opts.count;
      if (opts.head) this.head = true;
      return this;
    }
    insert(values) { this.op = 'insert'; this.values = Array.isArray(values) ? values : [values]; return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(col, val) { this.filters.push({ kind: 'eq', col, val }); return this; }
    is(col, val) { this.filters.push({ kind: 'is', col, val }); return this; }
    in(col, vals) { this.filters.push({ kind: 'in', col, val: vals }); return this; }
    order(col, opts = {}) { this.orders.push({ col, asc: opts.ascending !== false }); return this; }
    limit(n) { this.limitN = n; return this; }
    single() { this.singleRow = true; this.wantRows = true; return this; }
    then(resolve, reject) {
      try { resolve(this.execute()); } catch (e) { reject(e); }
    }

    invalidUuid() {
      for (const f of this.filters) {
        const vals = f.kind === 'in' ? f.val : f.kind === 'eq' ? [f.val] : [];
        if ((f.col === 'id' || f.col.endsWith('_id')) && vals.some(v => typeof v === 'string' && !UUID_RE.test(v))) return true;
      }
      return false;
    }
    matches(row) {
      return this.filters.every(f => {
        if (f.kind === 'eq') return row[f.col] === f.val;
        if (f.kind === 'is') return (row[f.col] ?? null) === f.val;
        if (f.kind === 'in') return f.val.includes(row[f.col]);
        return true;
      });
    }
    finish(rows) {
      if (this.singleRow) {
        if (rows.length !== 1) return err('PGRST116', 'JSON object requested, multiple (or no) rows returned');
        return { data: { ...rows[0] }, error: null, count: null };
      }
      return { data: this.wantRows ? rows.map(r => ({ ...r })) : null, error: null, count: null };
    }

    execute() {
      state.calls.push({ table: this.table, op: this.op });
      if (state.offline) return err('', 'TypeError: Failed to fetch');
      if (state.jwtExpired) return err('PGRST303', 'JWT expired');
      if (!state.userId) return err('42501', `permission denied for table ${this.table}`);
      if (this.invalidUuid()) return err('22P02', 'invalid input syntax for type uuid');
      const table = db[this.table];

      if (this.op === 'select') {
        let rows = table.filter(r => canRead(this.table, r) && this.matches(r));
        for (const o of [...this.orders].reverse()) {
          rows = [...rows].sort((a, b) => {
            const x = a[o.col], y = b[o.col];
            if (x === y) return 0;
            return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
          });
        }
        if (this.limitN != null) rows = rows.slice(0, this.limitN);
        if (this.head) return { data: null, error: null, count: rows.length };
        return this.finish(rows);
      }

      if (this.op === 'insert') {
        const created = [];
        for (const value of this.values) {
          const row = { ...DEFAULTS[this.table], id: randomUUID(), created_at: stamp(), updated_at: null, deleted_at: null, ...value };
          if (!canManage(row)) return err('42501', `new row violates row-level security policy for table "${this.table}"`);
          const violation = checkConstraints(this.table, row);
          if (violation) return violation;
          created.push(row);
        }
        table.push(...created);
        return this.finish(created);
      }

      if (this.op === 'update') {
        // USING clause: rows outside the policy are simply not touched.
        const targets = table.filter(r => canRead(this.table, r) && canManage(r) && this.matches(r));
        const next = targets.map(r => ({ ...r, ...this.patch, updated_at: stamp() }));
        for (const row of next) {
          const violation = checkConstraints(this.table, row);
          if (violation) return violation;
        }
        for (const row of next) table[table.findIndex(r => r.id === row.id)] = row;
        return this.finish(next);
      }

      if (this.op === 'delete') {
        const targets = table.filter(r => canManage(r) && this.matches(r));
        db[this.table] = table.filter(r => !targets.includes(r));
        return this.finish(targets);
      }
      throw new Error(`unsupported op ${this.op}`);
    }
  }

  return {
    db,
    state,
    client: { from: (table) => new Query(table) },
    signIn(userId) { state.userId = userId; state.jwtExpired = false; },
    signOut() { state.userId = null; },
    addMember(userId, storeId, role) {
      if (!memberships.has(userId)) memberships.set(userId, new Map());
      memberships.get(userId).set(storeId, role);
    },
    /** Rows written straight into the database (e.g. via SQL editor), bypassing RLS. */
    seed(table, row) {
      const full = { ...DEFAULTS[table], id: randomUUID(), created_at: stamp(), updated_at: null, deleted_at: null, ...row };
      db[table].push(full);
      return full;
    },
  };
}
