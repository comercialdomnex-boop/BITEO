import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAsaasPayment } from '../_shared/asaas-sandbox.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const token = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
  if (!token || token.length < 32 || request.headers.get('asaas-access-token') !== token) {
    return new Response('Unauthorized', { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > 16000) return new Response('Too large', { status: 413 });
  let body: { event?: string; payment?: { id?: string } };
  try { body = JSON.parse(raw); } catch { return new Response('Bad request', { status: 400 }); }
  if (!['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(body.event ?? '')) {
    return new Response('Ignored', { status: 200 });
  }
  const paymentId = body.payment?.id;
  if (!paymentId || !/^pay_[a-zA-Z0-9]+$/.test(paymentId)) return new Response('Invalid payment', { status: 400 });
  try {
    const payment = await getAsaasPayment(paymentId);
    if (!['CONFIRMED','RECEIVED'].includes(payment.status)) return new Response('Not settled', { status: 202 });
    const orderId = payment.externalReference;
    const amount = Math.round(payment.value * 100);
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId) || !Number.isSafeInteger(amount) ||
        amount <= 0 || Math.abs(payment.value * 100 - amount) > 0.00001) {
      return new Response('Invalid provider payment', { status: 422 });
    }
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return new Response('Unavailable', { status: 503 });
    const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const { data: confirmed, error } = await client.rpc('confirm_asaas_pix_payment', {
      p_provider_payment_id: payment.id, p_order_id: orderId,
      p_amount_cents: amount, p_event: body.event,
    });
    if (error) return new Response('Unable to confirm', { status: 503 });
    if (typeof confirmed !== 'boolean') return new Response('Unexpected RPC result', { status: 503 });
    return new Response(confirmed ? 'Confirmed' : 'Already confirmed');
  } catch {
    return new Response('Retry later', { status: 503 });
  }
});
