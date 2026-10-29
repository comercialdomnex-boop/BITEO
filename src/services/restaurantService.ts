import { DeliveryArea, RestaurantProfile, StoreConfig } from '../types';
import { evaluateSchedule } from '../utils/hours';

/**
 * The restaurant profile is a pure projection of the store configuration.
 * It has no identity of its own and it is never persisted: `isOpen` is always
 * recomputed from the schedule, the operational switch and the publication flag.
 */
export class RestaurantService {
  static buildProfile(
    config: StoreConfig,
    date: Date = new Date()
  ): RestaurantProfile {
    const scheduledOpen = evaluateSchedule(config.hours, date).isOpen;
    const acceptingOrders = config.operations.acceptingOrders;
    const published = config.online.isPublished;

    return {
      name: config.info.name,
      slogan: config.info.slogan,
      segment: config.info.category,
      phone: config.info.phone,
      whatsapp: config.info.whatsapp,
      address: [config.info.address, config.info.city, config.info.state]
        .filter(part => part && part.trim().length > 0)
        .join(' - '),
      scheduledOpen,
      acceptingOrders,
      published,
      isOpen: scheduledOpen && acceptingOrders && published,
      deliveryTimeEstimate: config.delivery.estimatedDeliveryTime,
      pickupTimeEstimate: config.delivery.estimatedPickupTime,
      autoAcceptOrders: config.operations.autoAcceptOrders,
      soundAlertsEnabled: config.operations.soundAlertsEnabled,
    };
  }

  /** Only active delivery areas can be selected or validated by the storefront. */
  static getActiveDeliveryAreas(config: StoreConfig): DeliveryArea[] {
    return config.delivery.areas.filter(area => area.isActive);
  }
}