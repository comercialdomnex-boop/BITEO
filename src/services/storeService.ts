import {
  StoreConfig,
  StoreTheme,
  StoreInfo,
  BusinessHours,
  DayOfWeek,
  StoreOperations,
  DeliverySettings,
  DeliveryArea,
  PaymentMethods,
  StoreOnlineSettings,
} from '../types';

function cloneConfig(config: StoreConfig): StoreConfig {
  return JSON.parse(JSON.stringify(config));
}

const DAY_LABELS: Array<{ day: DayOfWeek; label: string }> = [
  { day: 'segunda', label: 'Segunda-feira' },
  { day: 'terca', label: 'Terça-feira' },
  { day: 'quarta', label: 'Quarta-feira' },
  { day: 'quinta', label: 'Quinta-feira' },
  { day: 'sexta', label: 'Sexta-feira' },
  { day: 'sabado', label: 'Sábado' },
  { day: 'domingo', label: 'Domingo' },
];

/**
 * Every day closed. This is the absence of data, not a sample schedule: the
 * merchant defines the real hours in Minha Loja -> Horários.
 */
export function createDefaultBusinessHours(): BusinessHours {
  return {
    schedule: DAY_LABELS.map(({ day, label }) => ({
      day,
      label,
      isOpen: false,
      periods: [],
    })),
  };
}

/**
 * The real empty state of a store: no name, no address, no menu, no orders,
 * nothing published. Used before a store exists and never as a data fallback.
 */
export function createEmptyStoreConfig(id = ''): StoreConfig {
  return {
    id,
    theme: {
      primaryColor: '#FF5500',
      secondaryColor: '#1A1D24',
      visualStyle: 'moderno',
    },
    info: {
      name: '',
      slogan: '',
      description: '',
      category: '',
      phone: '',
      whatsapp: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      averagePrepTimeMin: 0,
      averageDeliveryTimeMin: '',
    },
    hours: createDefaultBusinessHours(),
    operations: {
      acceptingOrders: false,
      autoAcceptOrders: false,
      soundAlertsEnabled: false,
    },
    delivery: {
      allowDelivery: true,
      allowPickup: true,
      fixedFee: 0,
      estimatedDeliveryTime: '',
      estimatedPickupTime: '',
      minimumOrderValue: 0,
      areas: [],
    },
    payments: {
      acceptPixPrepaid: false,
      acceptPix: false,
      acceptCash: false,
      cashNeedChange: false,
      acceptCreditCard: false,
      acceptDebitCard: false,
      cardPaymentOnDeliveryNote: '',
    },
    online: {
      isPublished: false,
      slug: '',
    },
  };
}

/**
 * Store settings are strictly scoped per store. Every read/write requires an
 * explicit `storeId`, so switching stores can never leak configuration across
 * tenants.
 */
export class StoreService {
  private static storeConfigs: Map<string, StoreConfig> = new Map();

  static registerStore(storeId: string, config: StoreConfig): void {
    this.storeConfigs.set(storeId, cloneConfig(config));
  }

  private static requireConfig(storeId: string): StoreConfig {
    const existing = this.storeConfigs.get(storeId);
    if (!existing) {
      throw new Error(`Store ${storeId} não possui configuração carregada.`);
    }
    return existing;
  }

  static async getStoreConfig(storeId: string): Promise<StoreConfig> {
    return cloneConfig(this.requireConfig(storeId));
  }

  private static applyUpdate(
    storeId: string,
    updates: Partial<StoreConfig>
  ): StoreConfig {
    const current = this.requireConfig(storeId);
    const next: StoreConfig = { ...current, ...updates, id: current.id };
    this.storeConfigs.set(storeId, next);
    return cloneConfig(next);
  }

  static async updateStoreConfig(
    storeId: string,
    updates: Partial<StoreConfig>
  ): Promise<StoreConfig> {
    return this.applyUpdate(storeId, updates);
  }

  static async updateTheme(
    storeId: string,
    themeUpdates: Partial<StoreTheme>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      theme: { ...current.theme, ...themeUpdates },
    });
  }

  static async updateInfo(
    storeId: string,
    infoUpdates: Partial<StoreInfo>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      info: { ...current.info, ...infoUpdates },
    });
  }

  static async updateHours(
    storeId: string,
    hoursUpdates: BusinessHours
  ): Promise<StoreConfig> {
    return this.applyUpdate(storeId, { hours: hoursUpdates });
  }

  static async updateOperations(
    storeId: string,
    operationsUpdates: Partial<StoreOperations>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      operations: { ...current.operations, ...operationsUpdates },
    });
  }

  static async updateDelivery(
    storeId: string,
    deliveryUpdates: Partial<DeliverySettings>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      delivery: { ...current.delivery, ...deliveryUpdates },
    });
  }

  static async addDeliveryArea(
    storeId: string,
    area: Omit<DeliveryArea, 'id'>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    const newArea: DeliveryArea = {
      ...area,
      id: `area_${Date.now()}`,
    };
    return this.applyUpdate(storeId, {
      delivery: {
        ...current.delivery,
        areas: [...current.delivery.areas, newArea],
      },
    });
  }

  static async updateDeliveryArea(
    storeId: string,
    id: string,
    updates: Partial<DeliveryArea>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      delivery: {
        ...current.delivery,
        areas: current.delivery.areas.map(area =>
          area.id === id ? { ...area, ...updates } : area
        ),
      },
    });
  }

  static async deleteDeliveryArea(storeId: string, id: string): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      delivery: {
        ...current.delivery,
        areas: current.delivery.areas.filter(area => area.id !== id),
      },
    });
  }

  static async toggleDeliveryArea(storeId: string, id: string): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      delivery: {
        ...current.delivery,
        areas: current.delivery.areas.map(area =>
          area.id === id ? { ...area, isActive: !area.isActive } : area
        ),
      },
    });
  }

  static async updatePayments(
    storeId: string,
    paymentsUpdates: Partial<PaymentMethods>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      payments: { ...current.payments, ...paymentsUpdates },
    });
  }

  static async updateOnline(
    storeId: string,
    onlineUpdates: Partial<StoreOnlineSettings>
  ): Promise<StoreConfig> {
    const current = this.requireConfig(storeId);
    return this.applyUpdate(storeId, {
      online: { ...current.online, ...onlineUpdates },
    });
  }
}