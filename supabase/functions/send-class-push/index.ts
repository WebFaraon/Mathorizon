import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT        = 'mailto:bivoldragos6@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ── VAPID JWT ─────────────────────────────────────────────────── */
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function makeVapidAuth(endpoint: string): Promise<string> {
  const url    = new URL(endpoint);
  const aud    = url.origin;
  const exp    = Math.floor(Date.now() / 1000) + 3600;

  const header  = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: VAPID_SUBJECT })));
  const data    = new TextEncoder().encode(`${header}.${payload}`);

  const keyBytes = b64urlDecode(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, data);
  return `vapid t=${header}.${payload}.${b64url(sig)}, k=${VAPID_PUBLIC_KEY}`;
}

/* ── Encrypt push payload (RFC 8291 / aes128gcm) ──────────────── */
async function encryptPayload(
  subscription: { keys: { p256dh: string; auth: string } },
  plaintext: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array }> {
  const encoder   = new TextEncoder();
  const salt      = crypto.getRandomValues(new Uint8Array(16));
  const authSecret = b64urlDecode(subscription.keys.auth);
  const clientPublicKey = b64urlDecode(subscription.keys.p256dh);

  /* Server ECDH key pair */
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  );
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  /* Import client public key */
  const clientKey = await crypto.subtle.importKey(
    'raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  /* Shared secret */
  const sharedBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeyPair.privateKey, 256)
  );

  /* PRK_key via HKDF */
  const ikm = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveBits']);
  const keyInfo = concat(encoder.encode('WebPush: info\x00'), clientPublicKey, serverPublicKeyRaw);
  const prkKey = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo }, ikm, 256
  ));

  /* CEK and nonce */
  const prkIkm = await crypto.subtle.importKey('raw', prkKey, 'HKDF', false, ['deriveBits']);
  const cekInfo   = encoder.encode('Content-Encoding: aes128gcm\x00');
  const nonceInfo = encoder.encode('Content-Encoding: nonce\x00');
  const cekBits   = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, prkIkm, 128
  ));
  const nonceBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkIkm, 96
  ));

  /* Encrypt */
  const contentKey = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const paddedPlain = concat(encoder.encode(plaintext), new Uint8Array([2])); // delimiter
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBits, tagLength: 128 }, contentKey, paddedPlain)
  );

  /* Build aes128gcm content-encoding header + ciphertext */
  const rs = 4096;
  const header = concat(
    salt,
    new Uint8Array([0, 0, 16, 0]),        // rs (big-endian) + keyid_len
    new Uint8Array([serverPublicKeyRaw.length]),
    serverPublicKeyRaw
  );
  return { ciphertext: concat(header, encrypted), salt };
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

/* ── Send one push notification ────────────────────────────────── */
async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<void> {
  const auth = await makeVapidAuth(subscription.endpoint);
  const { ciphertext } = await encryptPayload(subscription, payload);

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization':      auth,
      'Content-Encoding':   'aes128gcm',
      'Content-Type':       'application/octet-stream',
      'TTL':                '86400',
    },
    body: ciphertext,
  });

  if (!res.ok && res.status !== 201) {
    const text = await res.text().catch(() => '');
    throw new Error(`Push failed ${res.status}: ${text}`);
  }
}

/* ── Main handler ──────────────────────────────────────────────── */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405 });

  try {
    const { class_id, type, teacher_name } = await req.json();

    const messages: Record<string, { title: string; body: string }> = {
      announcement: { title: 'Anunț nou în clasă 📢', body: `${teacher_name} a publicat un anunț nou!` },
      assignment:   { title: 'Temă nouă primită 📚',  body: `${teacher_name} a adăugat o temă nouă!`  },
    };
    const msg     = messages[type] ?? messages.announcement;
    const payload = JSON.stringify({ ...msg, url: `/class.html?id=${class_id}` });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('subscription')
      .eq('class_id', class_id);

    if (error) throw error;
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const results = await Promise.allSettled(
      subs.map((row: { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } }) =>
        sendPush(row.subscription, payload)
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message);

    console.log(`[send-class-push] sent=${sent} errors=${JSON.stringify(errors)}`);
    return new Response(JSON.stringify({ sent, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[send-class-push] fatal:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
