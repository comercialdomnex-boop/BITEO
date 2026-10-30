/**
 * BITEO — Asaas Sandbox server-only adapter.
 * Import exclusively from Supabase Edge Functions. NEVER from src/ (browser).
 * This module does not create charges on its own.
 */
const BASE_URL = 'https://api-sandbox.asaas.com/v3';

export interface AsaasCustomer { id: string }
export interface AsaasPayment { id: string; status: string; value: number; externalReference?: string }
export interface AsaasPixQrCode { encodedImage: string; payload: string; expirationDate?: string }

function asaasKey(): string {
  const key = Deno.env.get('ASAAS_API_KEY');
  if (!key) throw new Error('ASAAS_API_KEY not configured');
  return key;
}

async function asaasRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.includes('..')) throw new Error('Invalid Asaas path');
  const response = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      accept: 'application/json',
      access_token: asaasKey(),
      'User-Agent': 'BITEO/1.0',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    // Never leak provider response: it may include personal/payment data.
    console.error('Asaas request failed', response.status, path.split('?')[0]);
    throw new Error('Payment provider temporarily unavailable');
  }
  return await response.json() as T;
}

export async function createAsaasCustomer(name: string, externalReference: string): Promise<AsaasCustomer> {
  if (!name.trim() || !/^[0-9a-f-]{36}$/i.test(externalReference)) throw new Error('Invalid customer input');
  return asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), externalReference, notificationDisabled: true }),
  });
}

export async function createAsaasPixPayment(
  customerId: string, orderId: string, totalCents: number, dueDate: string,
): Promise<AsaasPayment> {
  if (!/^cus_[a-zA-Z0-9]+$/.test(customerId) || !/^[0-9a-f-]{36}$/i.test(orderId) ||
      !Number.isSafeInteger(totalCents) || totalCents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error('Invalid payment input');
  }
  return asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId, billingType: 'PIX', value: totalCents / 100,
      dueDate, externalReference: orderId, description: 'Pedido BITEO',
    }),
  });
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId)) throw new Error('Invalid payment ID');
  return asaasRequest<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId)) throw new Error('Invalid payment ID');
  return asaasRequest<AsaasPayment>(`/payments/${paymentId}`);
}
