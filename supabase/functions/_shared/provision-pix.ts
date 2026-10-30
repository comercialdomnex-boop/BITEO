import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createAsaasCustomer, createAsaasPixPayment, getAsaasPixQrCode } from './asaas-sandbox.ts';

type OrderReceipt = { orderId: string; orderNumber: number; totalCents: number; status: string };
type PixResult = { status: 'awaiting_payment'; payload: string; encodedImage: string; expirationDate?: string } |
  { status: 'unavailable' };

/**
 * Called only after a server-side order has been committed.
 * Claim once in DB before contacting Asaas. Never create a second charge on retries.
 * Failed/incomplete provisioning requires operator reconciliation; do not retry blindly.
 */
export async function provisionPixForOrder(
  db: SupabaseClient, receipt: OrderReceipt, storeId: string, customerName: string,
): Promise<PixResult> {
  const { data: claim, error: claimError } = await db.from('order_pix_payments').insert({
    order_id: receipt.orderId,
    store_id: storeId,
    amount_cents: receipt.totalCents,
    status: 'creating',
  }).select('id').single();

  if (claimError || !claim) {
    // Unique order_id prevents a second Asaas charge for the same order.
    console.error('PIX claim unavailable', claimError?.code);
    return { status: 'unavailable' };
  }
  try {
    const customer = await createAsaasCustomer(customerName, receipt.orderId);
    const { data: customerRow, error: customerError } = await db.from('order_pix_payments')
      .update({ provider_customer_id: customer.id, updated_at: new Date().toISOString() })
      .eq('id', claim.id).eq('status', 'creating').select('id').single();
    if (customerError || !customerRow) throw new Error('Could not persist Asaas customer');

    // Due date is calculated on the server (UTC). Sandbox only.
    const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0,10);
    const payment = await createAsaasPixPayment(customer.id, receipt.orderId, receipt.totalCents, due);
    const { data: paymentRow, error: paymentError } = await db.from('order_pix_payments')
      .update({
        provider_payment_id: payment.id, status: 'awaiting_payment',
        updated_at: new Date().toISOString(),
      }).eq('id', claim.id).eq('status', 'creating').select('id').single();
    if (paymentError || !paymentRow) throw new Error('Could not persist Asaas payment');
    const qr = await getAsaasPixQrCode(payment.id);
    if (!qr.payload || !qr.encodedImage) return { status: 'unavailable' };
    return { status: 'awaiting_payment', payload: qr.payload,
      encodedImage: qr.encodedImage, expirationDate: qr.expirationDate };
  } catch (error) {
    // Keep 'creating' if an external charge may have been created.
    // Do not create another charge automatically; reconcile against Asaas first.
    console.error('PIX provisioning requires reconciliation', error instanceof Error ? error.message : 'unknown');
    return { status: 'unavailable' };
  }
}
