/**
 * Canonical money helpers.
 *
 * All critical arithmetic must run in integer cents to avoid float drift.
 * Real amounts (reais) are only used at the UI/input boundary.
 */

const CENTS_PER_UNIT = 100;

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * CENTS_PER_UNIT);
}

export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return cents / CENTS_PER_UNIT;
}

export function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(fromCents(cents));
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, value) => acc + toCents(value), 0);
}

/**
 * Parses user typed money input ("1.234,56", "1234.56", "1234,56", "R$ 12,00").
 */
export function parseMoneyInput(raw: string): number | null {
  const trimmed = (raw ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!trimmed) return null;

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  let normalized: string;
  if (hasComma && hasDot) {
    normalized =
      trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
        ? trimmed.replace(/\./g, '').replace(',', '.')
        : trimmed.replace(/,/g, '');
  } else if (hasComma) {
    normalized = trimmed.replace(',', '.');
  } else {
    normalized = trimmed;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}