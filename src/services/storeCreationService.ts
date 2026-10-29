import { getSupabase, supabaseConfigError } from '../lib/supabase';
import { StoreInstance, StoreVisualTheme } from '../types';
import { normalizePhone } from '../utils/phone';
import { createEmptyStoreConfig } from './storeService';

/**
 * Real registration of the merchant's first store through the transactional
 * Postgres RPC public.create_first_store (migration
 * 20261006090000_create_first_store.sql). There is no local/fictitious creation
 * path: the store only exists after the database confirms it, and everything the
 * UI shows afterwards comes from the row the database returned.
 *
 * The RPC accepts only the fields below and always reads the owner from
 * auth.uid() — it never takes user_id, owner_id or role from the client. Identity
 * extras (colors, logo, banner, visual style) and delivery settings are NOT RPC
 * parameters here; the store is born with the schema defaults and those are
 * edited later inside Minha Loja.
 */

/** Slug contract shared with the RPC (stores_slug_format, 7B.1): 3..63 chars. */
export const STORE_SLUG_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';
export const STORE_SLUG_REGEX = new RegExp(STORE_SLUG_PATTERN);
export const STORE_SLUG_MIN_LENGTH = 3;
export const STORE_SLUG_MAX_LENGTH = 63;

/** The 13 arguments of public.create_first_store, in the order the RPC declares. */
export interface CreateFirstStoreInput {
  name: string;
  slug: string;
  category: string;
  addressStreet: string;
  addressNumber: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}

/** Row returned by public.create_first_store: a full public.stores record. */
export interface CreatedStoreRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  slogan: string | null;
  primary_color: string;
  secondary_color: string;
  visual_style: string;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  address_street: string;
  address_number: string;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string;
  address_state: string;
  address_zip_code: string;
  timezone: string;
  is_published: boolean;
  is_accepting_orders: boolean;
  custom_domain: string | null;
  created_at: string;
}

/** '' and blank strings become NULL, matching the RPC's nullif(btrim(...)). */
function optional(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Calls the RPC and returns the created store row. Throws the raw Supabase error
 * on failure so the caller can map it to a friendly pt-BR message.
 */
export async function createFirstStore(
  input: CreateFirstStoreInput
): Promise<CreatedStoreRow> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }

  const { data, error } = await supabase.rpc('create_first_store', {
    p_name: input.name.trim(),
    p_slug: input.slug.trim().toLowerCase(),
    p_category: input.category.trim(),
    p_address_street: input.addressStreet.trim(),
    p_address_number: input.addressNumber.trim(),
    p_address_city: input.addressCity.trim(),
    p_address_state: input.addressState.trim(),
    p_address_zip_code: input.addressZipCode.trim(),
    p_address_complement: optional(input.addressComplement),
    p_address_neighborhood: optional(input.addressNeighborhood),
    p_description: optional(input.description),
    // Canonical E.164 storage; empty stays null.
    p_phone: optional(normalizePhone(input.phone)),
    p_whatsapp: optional(normalizePhone(input.whatsapp)),
  });

  if (error) throw error;
  if (!data) {
    throw new Error('A loja não foi retornada pelo banco de dados.');
  }

  return data as CreatedStoreRow;
}

function toVisualStyle(value: string): StoreVisualTheme {
  return value === 'minimalista' || value === 'vibrante' ? value : 'moderno';
}

/**
 * Projects the real stores row into the in-memory StoreInstance the app uses.
 * Only fields the database actually returned are filled; everything the RPC does
 * not persist starts from the documented empty state (no invented merchant data).
 */
export function buildStoreInstanceFromRow(row: CreatedStoreRow): StoreInstance {
  const base = createEmptyStoreConfig(row.id);
  const address = [
    [row.address_street, row.address_number].filter(Boolean).join(', '),
    row.address_complement,
    row.address_neighborhood,
  ]
    .filter(part => Boolean(part && String(part).trim()))
    .join(' - ');

  const config: StoreInstance['config'] = {
    ...base,
    id: row.id,
    theme: {
      ...base.theme,
      primaryColor: row.primary_color || base.theme.primaryColor,
      secondaryColor: row.secondary_color || base.theme.secondaryColor,
      visualStyle: toVisualStyle(row.visual_style),
      logoUrl: row.logo_url ?? undefined,
      bannerUrl: row.banner_url ?? undefined,
    },
    info: {
      ...base.info,
      name: row.name,
      slogan: row.slogan ?? '',
      description: row.description ?? '',
      category: row.category,
      phone: row.phone ?? '',
      whatsapp: row.whatsapp ?? '',
      address,
      city: row.address_city,
      state: row.address_state,
      zipCode: row.address_zip_code,
    },
    operations: {
      ...base.operations,
      acceptingOrders: row.is_accepting_orders,
    },
    online: {
      ...base.online,
      isPublished: row.is_published,
      slug: row.slug,
      customDomain: row.custom_domain ?? undefined,
    },
  };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    config,
    // A store born from the RPC has no menu and no orders yet.
    orders: [],
    categories: [],
    items: [],
    createdAt: row.created_at,
  };
}
