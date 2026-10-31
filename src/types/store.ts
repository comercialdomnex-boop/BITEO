export type StoreVisualTheme = 'moderno' | 'minimalista' | 'vibrante';

export interface StoreTheme {
  primaryColor: string; // Hex color for brand
  secondaryColor: string;
  visualStyle: StoreVisualTheme;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface StoreInfo {
  name: string;
  slogan: string;
  description: string;
  category: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  averagePrepTimeMin: number;
  averageDeliveryTimeMin: string;
}

export interface TimePeriod {
  id: string;
  open: string; // e.g. "11:00"
  close: string; // e.g. "14:00" (equal or lower than `open` crosses midnight)
}

export type DayOfWeek =
  | 'segunda'
  | 'terca'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sabado'
  | 'domingo';

export interface DaySchedule {
  day: DayOfWeek;
  label: string;
  isOpen: boolean;
  periods: TimePeriod[];
}

export interface BusinessHours {
  schedule: DaySchedule[];
}

/**
 * Operational switches owned by the store. They are the only writable source
 * for availability — the open/closed badge is always derived from these plus the
 * schedule and the publication flag.
 */
export interface StoreOperations {
  acceptingOrders: boolean;
  autoAcceptOrders: boolean;
  soundAlertsEnabled: boolean;
}

export interface DeliveryArea {
  id: string;
  name: string;
  fee: number;
  estimatedMinutes?: number;
  isActive: boolean;
}

export interface DeliverySettings {
  allowDelivery: boolean;
  allowPickup: boolean;
  fixedFee: number;
  freeDeliveryThreshold?: number; // e.g. Free above R$ 80
  estimatedDeliveryTime: string; // e.g. "35 - 50 min"
  estimatedPickupTime: string; // e.g. "20 - 30 min"
  /** Canonical minimum order value. This is the single source of truth. */
  minimumOrderValue: number;
  areas: DeliveryArea[];
}

export interface PaymentMethods {
  /** Pix paid before preparation. Orders wait for confirmed payment. */
  acceptPixPrepaid: boolean;
  /** Pix paid on delivery or at pickup. Does not block preparation. */
  acceptPix: boolean;
  pixKey?: string;
  acceptCash: boolean;
  cashNeedChange: boolean;
  acceptCreditCard: boolean;
  acceptDebitCard: boolean;
  cardPaymentOnDeliveryNote: string;
}

export interface StoreOnlineSettings {
  isPublished: boolean;
  slug: string; // e.g. "minha-loja"
  customDomain?: string;
}

export interface StoreConfig {
  id: string;
  theme: StoreTheme;
  info: StoreInfo;
  hours: BusinessHours;
  operations: StoreOperations;
  delivery: DeliverySettings;
  payments: PaymentMethods;
  online: StoreOnlineSettings;
}
export type StoreSettings = StoreConfig;