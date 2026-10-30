/**
 * BITEO — cliente HTTP do checkout público.
 * O navegador nunca calcula preços autoritativos e nunca recebe service_role.
 * Requer token Cloudflare Turnstile gerado no CheckoutModal.
 */
import type { CartItem } from '../storefront/types';

export interface CheckoutInput {
  storeId: string;
  customer: { name: string; phone: string; phoneNormalized: string; email?: string };
  type: 'delivery' | 'retirada';
  deliveryAddress?: {
    street: string; number: string; neighborhood: string;
    complement?: string; reference?: string; city: string; state: string; zipCode?: string;
  };
  deliveryAreaId?: string;
  paymentMethod: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';
  changeForCents?: number;
  notes?: string;
  cartItems: CartItem[];
  turnstileToken: string;
}

export type PixCheckoutResult =
  | { status: 'awaiting_payment'; payload: string; encodedImage: string; expirationDate?: string }
  | { status: 'unavailable' };

export interface CreatedOrderResponse {
  pix?: PixCheckoutResult;
  orderId: string;
  orderNumber: number;
  totalCents: number;
  status: 'novo';
}

export async function submitGuestOrder(input: CheckoutInput): Promise<CreatedOrderResponse> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) throw new Error('Supabase não está configurado.');
  if (!input.turnstileToken) throw new Error('Conclua a verificação de segurança.');
  if (!input.cartItems.length) throw new Error('A sacola está vazia.');

  const body = {
    storeId: input.storeId,
    customer: input.customer,
    type: input.type,
    deliveryAddress: input.type === 'delivery' ? input.deliveryAddress : undefined,
    deliveryAreaId: input.type === 'delivery' ? input.deliveryAreaId : undefined,
    paymentMethod: input.paymentMethod,
    changeForCents: input.paymentMethod === 'dinheiro' ? input.changeForCents : undefined,
    notes: input.notes,
    items: input.cartItems.map((line) => ({
      productId: line.item.id,
      quantity: line.quantity,
      notes: line.notes,
      // O SQL valida opções pelo ID e recalcula preços; nunca confiar nos preços do carrinho.
      options: line.modifierSelections.map((selection) => ({ optionId: selection.optionId })),
    })),
    turnstileToken: input.turnstileToken,
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Confira sua internet e tente novamente.');
  }

  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error : 'Não foi possível finalizar o pedido.';
    throw new Error(message);
  }
  if (!result || typeof result !== 'object' ||
      !('orderId' in result) || typeof result.orderId !== 'string' ||
      !('orderNumber' in result) || typeof result.orderNumber !== 'number' ||
      !('totalCents' in result) || typeof result.totalCents !== 'number') {
    throw new Error('O servidor retornou uma confirmação inválida. Consulte a loja antes de tentar novamente.');
  }
  return result as CreatedOrderResponse;
}
