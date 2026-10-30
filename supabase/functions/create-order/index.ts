import { provisionPixForOrder } from '../_shared/provision-pix.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_BYTES = 32768;
const encoder = new TextEncoder();

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get('CHECKOUT_ALLOWED_ORIGINS') ?? '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  return {
    ...(origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function respond(status: number, data: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers });
}

async function readLimited(req: Request): Promise<string> {
  if (!req.body) throw new Error('empty_body');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error('too_large');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  const allowedOrigins = (Deno.env.get('CHECKOUT_ALLOWED_ORIGINS') ?? '').split(',').map(x => x.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return respond(403, { error: 'Origem não permitida.' }, headers);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond(405, { error: 'Método não permitido.' }, headers);

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !serviceKey || allowedOrigins.length === 0) {
    console.error('Checkout server configuration incomplete');
    return respond(503, { error: 'Checkout temporariamente indisponível.' }, headers);
  }

  try {
    const length = req.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) {
      return respond(413, { error: 'Pedido muito grande.' }, headers);
    }
    const raw = await readLimited(req);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return respond(400, { error: 'JSON inválido.' }, headers); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return respond(400, { error: 'Pedido inválido.' }, headers);
    const { turnstileToken, ...payload } = input as Record<string, unknown>;
    if (typeof turnstileToken !== 'string' || turnstileToken.length < 10 || turnstileToken.length > 2048) {
      return respond(400, { error: 'Verificação de segurança necessária.' }, headers);
    }
    const form = new FormData();
    form.set('secret', secret);
    form.set('response', turnstileToken);
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(7000) });
    if (!verify.ok) return respond(503, { error: 'Verificação temporariamente indisponível.' }, headers);
    const result = await verify.json() as { success?: boolean; hostname?: string };
    if (!result.success) return respond(403, { error: 'Verificação de segurança recusada.' }, headers);
    // Turnstile hostname should be restricted in Cloudflare dashboard to the actual storefront domain(s).
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.rpc('create_guest_order', { p_payload: payload });
    if (error) {
      console.error('create_guest_order failed', error.code);
      return respond(400, { error: 'Não foi possível finalizar o pedido. Confira os dados.' }, headers);
    }
    // The order is already committed. A PIX provider failure must never invite
    // the customer to resubmit the order and accidentally create duplicates.
    if (payload.paymentMethod === 'pix') {
      const receipt = data as { orderId: string; orderNumber: number; totalCents: number; status: string };
      const customer = payload.customer as { name?: string } | undefined;
      const pix = await provisionPixForOrder(
        supabase, receipt, String(payload.storeId), String(customer?.name ?? ''),
      );
      return respond(201, { ...receipt, pix }, headers);
    }
    return respond(201, data, headers);
  } catch (error) {
    if (error instanceof Error && error.message === 'too_large') return respond(413, { error: 'Pedido muito grande.' }, headers);
    console.error('create-order unexpected failure', error instanceof Error ? error.name : 'unknown');
    return respond(400, { error: 'Não foi possível processar o pedido.' }, headers);
  }
});
