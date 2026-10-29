/**
 * Canonical phone helpers (Brazil).
 *
 * The canonical storage format is E.164 without separators: "+5511999999999".
 * Presentation masks are UI-only and never stored as identity.
 */

const BRAZIL_COUNTRY_CODE = '55';
const BRAZIL_DEFAULT_AREA_CODE = '11';
const MOBILE_WITH_DDD_LENGTH = 11; // 2 digit DDD + 9 digits
const LANDLINE_WITH_DDD_LENGTH = 10; // 2 digit DDD + 8 digits
const LOCAL_WITHOUT_DDD_LENGTHS = [9, 8]; // mobile/landline typed without the DDD

export function digitsOnly(value: string | undefined | null): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Normalizes any Brazilian phone variant to the canonical E.164 representation.
 * "+5511999999999", "5511999999999", "(11) 99999-9999" and "11999999999" all
 * resolve to "+5511999999999". Numbers typed without a DDD fall back to DDD 11,
 * but a number that already carries its DDD is never prefixed twice.
 */
export function normalizePhone(value: string | undefined | null): string {
  const digits = digitsOnly(value);
  if (digits.length === 0) return '';

  const hasCountryCode =
    digits.startsWith(BRAZIL_COUNTRY_CODE) &&
    (digits.length === MOBILE_WITH_DDD_LENGTH + BRAZIL_COUNTRY_CODE.length ||
      digits.length === LANDLINE_WITH_DDD_LENGTH + BRAZIL_COUNTRY_CODE.length);

  if (hasCountryCode) return `+${digits}`;
  if (digits.length === MOBILE_WITH_DDD_LENGTH) {
    return `+${BRAZIL_COUNTRY_CODE}${digits}`;
  }
  if (digits.length === LANDLINE_WITH_DDD_LENGTH) {
    // Already includes the DDD: "+55" + DDD + landline number.
    return `+${BRAZIL_COUNTRY_CODE}${digits}`;
  }
  if (LOCAL_WITHOUT_DDD_LENGTHS.includes(digits.length)) {
    return `+${BRAZIL_COUNTRY_CODE}${BRAZIL_DEFAULT_AREA_CODE}${digits}`;
  }
  return `+${digits}`;
}

export function phoneIdentity(value: string | undefined | null): string {
  return normalizePhone(value);
}

/** "11999999999" / "+5511999999999" -> "5511999999999" (no plus, country code kept). */
export function phoneDigitsWithCountryCode(value: string | undefined | null): string {
  return digitsOnly(normalizePhone(value));
}

export function formatPhoneMask(value: string | undefined | null): string {
  const digits = digitsOnly(value);
  const local = digits.startsWith(BRAZIL_COUNTRY_CODE)
    ? digits.slice(BRAZIL_COUNTRY_CODE.length)
    : digits;

  if (local.length === MOBILE_WITH_DDD_LENGTH) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === LANDLINE_WITH_DDD_LENGTH) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  if (local.length > 6) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return local;
}

export function buildWhatsAppUrl(value: string | undefined | null): string {
  const digits = phoneDigitsWithCountryCode(value);
  return digits ? `https://wa.me/${digits}` : '';
}

export function buildTelUrl(value: string | undefined | null): string {
  const digits = phoneDigitsWithCountryCode(value);
  return digits ? `tel:+${digits}` : '';
}