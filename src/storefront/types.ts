import { PaymentMethod, PaymentTiming, CartItem, Cart } from '../types';

export type { CartItem, Cart };

export interface CustomerFormData {
  name: string;
  phone: string;
}

export interface AddressFormData {
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  reference: string;
  city: string;
  /** Brazilian federative unit (UF), kept separate from `city`. */
  state: string;
}

export interface PaymentFormData {
  method: PaymentMethod;
  timing: PaymentTiming;
  needChange: boolean;
  changeFor: string; // string input to avoid float quirks in inputs
}