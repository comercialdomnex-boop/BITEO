// Meta WhatsApp Cloud API webhook. Server-only; do not deploy without approval.
// Supabase Edge Function must be deployed with --no-verify-jwt because Meta
// does not send Supabase JWTs. POST requests are HMAC verified instead.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

async function verifySignature(rawBody: ArrayBuffer, signature: string | null, appSecret: string): Promise<boolean> {
  if (!signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, rawBody));
  const hex = signature.slice(7);
  const actual = new Uint8Array(hex.match(/.{2}/g)!.map(part => parseInt(part, 16)));
  return constantTimeEqual(expected, actual);
}

const allowedStatuses = new Set(['sent', 'delivered', 'read', 'failed']);

Deno.serve(async (request: Request): Promise<Response> => {
  const verifyToken = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN');
  const appSecret = Deno.env.get('META_APP_SECRET');
  if (request.method === 'GET') {
    if (!verifyToken) return new Response('Not configured', { status: 503 });
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === verifyToken && challenge !== null) {
      return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appSecret) return json({ error: 'Webhook not configured' }, 503);
  const raw = await request.arrayBuffer();
  if (raw.byteLength > 1024 * 1024) return json({ error: 'Payload too large' }, 413);
  if (!(await verifySignature(raw, request.headers.get('x-hub-signature-256'), appSecret))) {
    return json({ error: 'Invalid signature' }, 401);
  }

  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(raw)); }
  catch { return json({ error: 'Invalid JSON' }, 400); }
  if (payload?.object !== 'whatsapp_business_account') return json({ received: true });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Database not configured' }, 503);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        if (typeof phoneNumberId !== 'string') continue;
        const { data: connection, error: connectionError } = await db
          .from('store_whatsapp_connections')
          .select('store_id')
          .eq('phone_number_id', phoneNumberId)
          .eq('waba_id', String(entry.id))
          .eq('status', 'connected')
          .maybeSingle();
        if (connectionError) throw connectionError;
        if (!connection) continue;

        for (const statusEvent of change.value?.statuses ?? []) {
          const metaId = statusEvent?.id;
          const status = statusEvent?.status;
          if (typeof metaId !== 'string' || !allowedStatuses.has(status)) continue;
          // Status is scoped by store AND Meta message ID; no cross-tenant updates.
          // Avoid downgrading already read/delivered messages on out-of-order webhooks.
          const { data: existing, error: lookupError } = await db
            .from('order_whatsapp_outbox')
            .select('id,status')
            .eq('store_id', connection.store_id)
            .eq('meta_message_id', metaId)
            .maybeSingle();
          if (lookupError) throw lookupError;
          if (!existing) continue;
          const current = existing.status;
          const next = status === 'sent' ? 'accepted' : status;
          const rank: Record<string, number> = { pending: 0, processing: 0, retry: 0, accepted: 1, delivered: 2, read: 3 };
          if (current === 'failed' || current === 'skipped') continue;
          if (next !== 'failed' && (rank[next] ?? 0) <= (rank[current] ?? 0)) continue;
          if (next === 'failed' && (rank[current] ?? 0) >= 2) continue;
          const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
          if (next === 'failed') {
            patch.last_error_code = String(statusEvent.errors?.[0]?.code ?? 'meta_failed').slice(0, 100);
            patch.last_error_at = new Date().toISOString();
          }
          const { error: updateError } = await db
            .from('order_whatsapp_outbox')
            .update(patch)
            .eq('id', existing.id)
            .eq('store_id', connection.store_id)
            .eq('status', current);
          if (updateError) throw updateError;
        }
      }
    }
    return json({ received: true });
  } catch (error) {
    console.error('WhatsApp webhook processing failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Processing failed' }, 500);
  }
});
