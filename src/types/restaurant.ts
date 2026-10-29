/**
 * Read-only projection of a store, derived from `StoreConfig`.
 *
 * It carries no independent identity (`storeId` lives on the store itself) and
 * cannot be persisted: `isOpen` is always the result of
 * `schedule open AND operations.acceptingOrders AND online.isPublished`.
 */
export interface RestaurantProfile {
  name: string;
  slogan: string;
  segment: string;
  phone: string;
  whatsapp: string;
  address: string;
  /** Result of the business hours schedule only. */
  scheduledOpen: boolean;
  /** Persisted operational switch. */
  acceptingOrders: boolean;
  /** Persisted publication flag. */
  published: boolean;
  /** scheduledOpen && acceptingOrders && published */
  isOpen: boolean;
  deliveryTimeEstimate: string;
  pickupTimeEstimate: string;
  autoAcceptOrders: boolean;
  soundAlertsEnabled: boolean;
}