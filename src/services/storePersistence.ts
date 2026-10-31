import { getSupabase, supabaseConfigError } from '../lib/supabase';
import { StoreConfig, StoreInfo, BusinessHours, DayOfWeek, DeliveryArea, PaymentMethods } from '../types';
import { fromCents, toCents } from '../utils/money';
import { normalizePhone } from '../utils/phone';

/**
 * Real Supabase persistence for the merchant's store profile.
 */
export interface StoreSettingsRow {
  store_id: string;
  allow_delivery: boolean;
  allow_pickup: boolean;
  fixed_delivery_fee_cents: number;
  free_delivery_threshold_cents: number | null;
  minimum_order_cents: number;
  prep_time_min: number;
  delivery_time_min_minutes: number | null;
  delivery_time_max_minutes: number | null;
  pickup_time_min_minutes: number | null;
  pickup_time_max_minutes: number | null;
  accept_pix: boolean;
  accept_pix_prepaid: boolean;
  pix_key: string | null;
  accept_cash: boolean;
  cash_change_available: boolean;
  accept_credit_card: boolean;
  accept_debit_card: boolean;
  card_payment_note: string | null;
  auto_accept_orders: boolean;
  sound_alerts_enabled: boolean;
}

const SETTINGS_SELECT =
  'store_id, allow_delivery, allow_pickup, fixed_delivery_fee_cents, free_delivery_threshold_cents, minimum_order_cents, prep_time_min, delivery_time_min_minutes, delivery_time_max_minutes, pickup_time_min_minutes, pickup_time_max_minutes, accept_pix, accept_pix_prepaid, pix_key, accept_cash, cash_change_available, accept_credit_card, accept_debit_card, card_payment_note, auto_accept_orders, sound_alerts_enabled';

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseAddressLine(address: string): {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
} {
  const tokens = (address ?? '')
    .split(' - ')
    .map(token => token.trim())
    .filter(token => token.length > 0);

  const head = tokens[0] ?? '';
  const commaIdx = head.indexOf(',');
  const street = (commaIdx >= 0 ? head.slice(0, commaIdx) : head).trim();
  const number = (commaIdx >= 0 ? head.slice(commaIdx + 1) : '').trim();

  const complement = tokens.length >= 3 ? tokens[1] : '';
  const neighborhood = tokens.length >= 2 ? tokens[tokens.length - 1] : '';

  return { street, number, complement, neighborhood };
}

export function parseDeliveryWindow(
  value: string
): { min: number; max: number | null } | null {
  const numbers = (value ?? '').match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const min = parseInt(numbers[0], 10);
  const max = numbers.length > 1 ? parseInt(numbers[1], 10) : null;
  if (!Number.isFinite(min)) return null;
  if (max != null && (!Number.isFinite(max) || max < min)) return { min, max: min };
  return { min, max };
}

export function parseMinutes(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function dayToWeekday(day: DayOfWeek): number {
  switch (day) {
    case 'domingo':
      return 0;
    case 'segunda':
      return 1;
    case 'terca':
      return 2;
    case 'quarta':
      return 3;
    case 'quinta':
      return 4;
    case 'sexta':
      return 5;
    case 'sabado':
      return 6;
    default:
      return 1;
  }
}

export function weekdayToDay(w: number): DayOfWeek {
  switch (w) {
    case 0:
      return 'domingo';
    case 1:
      return 'segunda';
    case 2:
      return 'terca';
    case 3:
      return 'quarta';
    case 4:
      return 'quinta';
    case 5:
      return 'sexta';
    case 6:
      return 'sabado';
    default:
      return 'segunda';
  }
}

export function formatDeliveryWindow(
  min: number | null,
  max: number | null
): string {
  if (min == null) return '';
  if (max == null || max === min) return `${min} min`;
  return `${min} - ${max} min`;
}

export function applyStoreSettingsToConfig(
  config: StoreConfig,
  row: StoreSettingsRow
): StoreConfig {
  return {
    ...config,
    info: {
      ...config.info,
      averagePrepTimeMin: row.prep_time_min ?? config.info.averagePrepTimeMin,
      averageDeliveryTimeMin: formatDeliveryWindow(
        row.delivery_time_min_minutes,
        row.delivery_time_max_minutes
      ),
    },
    operations: {
      ...config.operations,
      autoAcceptOrders: row.auto_accept_orders,
      soundAlertsEnabled: row.sound_alerts_enabled,
    },
    delivery: {
      ...config.delivery,
      allowDelivery: row.allow_delivery,
      allowPickup: row.allow_pickup,
      fixedFee: fromCents(row.fixed_delivery_fee_cents ?? 0),
      freeDeliveryThreshold:
        row.free_delivery_threshold_cents == null
          ? undefined
          : fromCents(row.free_delivery_threshold_cents),
      minimumOrderValue: fromCents(row.minimum_order_cents ?? 0),
      estimatedDeliveryTime: formatDeliveryWindow(
        row.delivery_time_min_minutes,
        row.delivery_time_max_minutes
      ),
      estimatedPickupTime: formatDeliveryWindow(
        row.pickup_time_min_minutes,
        row.pickup_time_max_minutes
      ),
    },
    payments: {
      ...config.payments,
      acceptPix: row.accept_pix,
      acceptPixPrepaid: row.accept_pix_prepaid ?? false,
      pixKey: row.pix_key ?? undefined,
      acceptCash: row.accept_cash,
      cashNeedChange: row.cash_change_available,
      acceptCreditCard: row.accept_credit_card,
      acceptDebitCard: row.accept_debit_card,
      cardPaymentOnDeliveryNote: row.card_payment_note ?? '',
    },
  };
}

export async function fetchStoreSettings(
  storeIds: string[]
): Promise<Map<string, StoreSettingsRow>> {
  const map = new Map<string, StoreSettingsRow>();
  if (storeIds.length === 0) return map;

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('store_settings')
    .select(SETTINGS_SELECT)
    .in('store_id', storeIds);

  if (error) throw error;

  for (const row of (data ?? []) as unknown as StoreSettingsRow[]) {
    map.set(row.store_id, row);
  }
  return map;
}

export async function saveStoreInfo(
  storeId: string,
  info: StoreInfo
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }
  if (!storeId) {
    throw new Error('Nenhuma loja ativa na sessão para salvar.');
  }

  const address = parseAddressLine(info.address);

  const storePayload = {
    name: info.name.trim(),
    description: blankToNull(info.description),
    category: info.category.trim(),
    slogan: blankToNull(info.slogan),
    phone: blankToNull(normalizePhone(info.phone)),
    whatsapp: blankToNull(normalizePhone(info.whatsapp)),
    address_street: address.street,
    address_number: address.number,
    address_complement: blankToNull(address.complement),
    address_neighborhood: blankToNull(address.neighborhood),
    address_city: info.city.trim(),
    address_state: info.state.trim(),
    address_zip_code: info.zipCode.trim(),
  };

  const { data: storeRows, error: storeError } = await supabase
    .from('stores')
    .update(storePayload)
    .eq('id', storeId)
    .select('id');

  if (storeError) throw storeError;
  if (!storeRows || storeRows.length === 0) {
    throw new Error(
      'Nenhuma loja foi atualizada. Verifique sua permissão sobre esta loja.'
    );
  }

  const settingsPayload: Record<string, unknown> = {};
  const prepMinutes = Math.round(info.averagePrepTimeMin);
  if (prepMinutes > 0) {
    settingsPayload.prep_time_min = prepMinutes;
  }
  const window = parseDeliveryWindow(info.averageDeliveryTimeMin);
  if (window && window.min > 0) {
    settingsPayload.delivery_time_min_minutes = window.min;
    settingsPayload.delivery_time_max_minutes =
      window.max != null && window.max > 0 ? window.max : null;
  }

  if (Object.keys(settingsPayload).length > 0) {
    const { data: settingsRows, error: settingsError } = await supabase
      .from('store_settings')
      .update(settingsPayload)
      .eq('store_id', storeId)
      .select('store_id');

    if (settingsError) throw settingsError;
    if (!settingsRows || settingsRows.length === 0) {
      throw new Error(
        'Não foi possível salvar os tempos da loja. Verifique sua permissão.'
      );
    }
  }
}

export async function saveBusinessHours(
  storeId: string,
  hours: BusinessHours
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }
  if (!storeId) {
    throw new Error('Nenhuma loja ativa na sessão para salvar.');
  }

  for (let i = 0; i < hours.schedule.length; i++) {
    const day = hours.schedule[i];
    const weekday = dayToWeekday(day.day);

    const { error: bhError } = await supabase
      .from('business_hours')
      .upsert(
        {
          store_id: storeId,
          weekday,
          is_open: day.isOpen,
        },
        {
          onConflict: 'store_id,weekday',
        }
      );

    if (bhError) throw bhError;

    // Keep saved times even when the day is closed. Upsert the unique position
    // instead of delete + insert (which can race with another autosave).
    if (day.periods.length > 0) {
      const periodsToSave = day.periods.map((period, idx) => ({
        store_id: storeId,
        weekday,
        opens_at: `${period.open}:00`,
        closes_at: `${period.close}:00`,
        sort_order: idx,
      }));

      const { error: periodError } = await supabase
        .from('business_hour_periods')
        .upsert(periodsToSave, { onConflict: 'store_id,weekday,sort_order' });

      if (periodError) throw periodError;

      // Only remove superseded legacy periods after the replacement succeeded.
      const { error: cleanupError } = await supabase
        .from('business_hour_periods')
        .delete()
        .eq('store_id', storeId)
        .eq('weekday', weekday)
        .gte('sort_order', periodsToSave.length);

      if (cleanupError) throw cleanupError;
    }
  }
}

export async function saveDeliverySettings(
  storeId: string,
  delivery: any
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }
  if (!storeId) {
    throw new Error('Nenhuma loja ativa na sessão para salvar.');
  }

  const settingsPayload: Record<string, unknown> = {
    allow_delivery: delivery.allowDelivery,
    allow_pickup: delivery.allowPickup,
    fixed_delivery_fee_cents: toCents(delivery.fixedFee),
    minimum_order_cents: toCents(delivery.minimumOrderValue),
  };

  if (delivery.freeDeliveryThreshold != null && delivery.freeDeliveryThreshold > 0) {
    settingsPayload.free_delivery_threshold_cents = toCents(delivery.freeDeliveryThreshold);
  } else {
    settingsPayload.free_delivery_threshold_cents = null;
  }

  const estDel = parseDeliveryWindow(delivery.estimatedDeliveryTime);
  if (estDel && estDel.min > 0) {
    settingsPayload.delivery_time_min_minutes = estDel.min;
    settingsPayload.delivery_time_max_minutes =
      estDel.max != null && estDel.max > 0 ? estDel.max : null;
  } else {
    settingsPayload.delivery_time_min_minutes = null;
    settingsPayload.delivery_time_max_minutes = null;
  }

  const estPick = parseDeliveryWindow(delivery.estimatedPickupTime);
  if (estPick && estPick.min > 0) {
    settingsPayload.pickup_time_min_minutes = estPick.min;
    settingsPayload.pickup_time_max_minutes =
      estPick.max != null && estPick.max > 0 ? estPick.max : null;
  } else {
    settingsPayload.pickup_time_min_minutes = null;
    settingsPayload.pickup_time_max_minutes = null;
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from('store_settings')
    .update(settingsPayload)
    .eq('store_id', storeId)
    .select('store_id');

  if (settingsError) throw settingsError;
  if (!settingsRows || settingsRows.length === 0) {
    throw new Error(
      'Não foi possível salvar as configurações de entrega. Verifique sua permissão.'
    );
  }
}

export async function saveDeliveryAreas(
  storeId: string,
  areas: DeliveryArea[]
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }
  if (!storeId) {
    throw new Error('Nenhuma loja ativa na sessão para salvar.');
  }

  const { error: delError } = await supabase
    .from('delivery_areas')
    .delete()
    .eq('store_id', storeId);

  if (delError) throw delError;

  if (areas.length > 0) {
    const areasToInsert = areas.map((area, idx) => ({
      store_id: storeId,
      name: area.name.trim(),
      kind: 'neighborhood' as const,
      fee_cents: toCents(area.fee),
      estimated_minutes: area.estimatedMinutes && area.estimatedMinutes > 0 ? area.estimatedMinutes : null,
      is_active: area.isActive,
      sort_order: idx,
    }));

    const { error: insError } = await supabase
      .from('delivery_areas')
      .insert(areasToInsert);

    if (insError) throw insError;
  }
}

export async function savePaymentMethods(
  storeId: string,
  payments: PaymentMethods
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }
  if (!storeId) {
    throw new Error('Nenhuma loja ativa na sessão para salvar.');
  }

  const settingsPayload: Record<string, unknown> = {
    accept_pix: payments.acceptPix,
    accept_pix_prepaid: payments.acceptPixPrepaid,
    pix_key: blankToNull(payments.pixKey),
    accept_cash: payments.acceptCash,
    cash_change_available: payments.cashNeedChange,
    accept_credit_card: payments.acceptCreditCard,
    accept_debit_card: payments.acceptDebitCard,
    card_payment_note: blankToNull(payments.cardPaymentOnDeliveryNote),
  };

  const { data: settingsRows, error: settingsError } = await supabase
    .from('store_settings')
    .update(settingsPayload)
    .eq('store_id', storeId)
    .select('store_id');

  if (settingsError) throw settingsError;
  if (!settingsRows || settingsRows.length === 0) {
    throw new Error(
      'Não foi possível salvar as formas de pagamento. Verifique sua permissão.'
    );
  }
}

export async function fetchDeliveryAreas(
  storeId: string
): Promise<DeliveryArea[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  if (!storeId) return [];

  const { data, error } = await supabase
    .from('delivery_areas')
    .select('id, name, fee_cents, estimated_minutes, is_active, sort_order')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const areas: any[] = [];
  for (const row of (data ?? []) as any) {
    areas.push({
      id: row.id,
      name: row.name,
      fee: fromCents(row.fee_cents ?? 0),
      estimatedMinutes: row.estimated_minutes ?? undefined,
      isActive: row.is_active,
    });
  }
  return areas;
}

export async function fetchBusinessHours(
  storeId: string
): Promise<any> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase não está configurado.');
  }
  if (!storeId) {
    throw new Error('Nenhuma loja ativa na sessão para salvar.');
  }

  const { data: bhData, error: bhError } = await supabase
    .from('business_hours')
    .select('store_id, weekday, is_open')
    .eq('store_id', storeId);

  if (bhError) throw bhError;

  const { data: pData, error: pError } = await supabase
    .from('business_hour_periods')
    .select('id, weekday, opens_at, closes_at, sort_order')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: true });

  if (pError) throw pError;

  const DAY_LABELS: Array<{ day: DayOfWeek; label: string }> = [
    { day: 'segunda', label: 'Segunda-feira' },
    { day: 'terca', label: 'Terça-feira' },
    { day: 'quarta', label: 'Quarta-feira' },
    { day: 'quinta', label: 'Quinta-feira' },
    { day: 'sexta', label: 'Sexta-feira' },
    { day: 'sabado', label: 'Sábado' },
    { day: 'domingo', label: 'Domingo' },
  ];

  const schedule = DAY_LABELS.map(({ day, label }) => ({
    day,
    label,
    isOpen: false,
    periods: [] as Array<{ id: string; open: string; close: string }>,
  }));

  const bhMap = new Map<number, boolean>();
  for (const bh of (bhData ?? []) as any) {
    bhMap.set(bh.weekday, bh.is_open);
  }

  for (const period of (pData ?? []) as any) {
    const wd = period.weekday;
    const day = weekdayToDay(wd);
    const sched = schedule.find(s => s.day === day);
    if (sched) {
      sched.isOpen = bhMap.get(wd) ?? sched.isOpen;
      sched.periods.push({
        id: period.id,
        open: (period.opens_at || '').substring(0, 5),
        close: (period.closes_at || '').substring(0, 5),
      });
    }
  }

  return { schedule };
}
