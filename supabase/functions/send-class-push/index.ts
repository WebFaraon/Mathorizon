import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT        = 'mailto:bivoldragos6@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ── Helpers ───────────────────────────────────────────────────── */
function b64url(buf: Uint8Array | ArrayBuffer): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of arrays) { out.set(a, i); i += a.length; }
  return out;
}

/* ── VAPID JWT (ES256) ─────────────────────────────────────────── */
async function vapidAuth(endpoint: string): Promise<string> {
  const { origin } = new URL(endpoint);
  const hdr = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const pld = b64url(new TextEncoder().encode(JSON.stringify({
    aud: origin, exp: Math.floor(Date.now() / 1000) + 3600, sub: VAPID_SUBJECT,
  })));

  // Import private key via JWK — works with raw base64url P-256 key from web-push CLI
  const pub = b64urlDecode(VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256',
    d: VAPID_PRIVATE_KEY,
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    ext: true, key_ops: ['sign'],
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key,
      new TextEncoder().encode(`${hdr}.${pld}`))
  );
  return `vapid t=${hdr}.${pld}.${b64url(sig)},k=${VAPID_PUBLIC_KEY}`;
}

/* ── AES-128-GCM payload encryption (RFC 8291) ─────────────────── */
async function encrypt(
  sub: { keys: { auth: string; p256dh: string } },
  plaintext: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const authSecret  = b64urlDecode(sub.keys.auth);
  const receiverPub = b64urlDecode(sub.keys.p256dh);

  const senderKP     = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKP.publicKey));
  const receiverKey  = await crypto.subtle.importKey('raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhBits     = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, senderKP.privateKey, 256));

  // PRK_key
  const ecdhKey = await crypto.subtle.importKey('raw', ecdhBits, 'HKDF', false, ['deriveBits']);
  const keyInfo = concat(enc.encode('WebPush: info\x00'), receiverPub, senderPubRaw);
  const prk     = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo }, ecdhKey, 256,
  ));

  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const prkKey  = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);

  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\x00') }, prkKey, 128,
  ));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\x00') }, prkKey, 96,
  ));

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct     = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey,
    concat(enc.encode(plaintext), new Uint8Array([2])),
  ));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  return concat(salt, rs, new Uint8Array([senderPubRaw.length]), senderPubRaw, ct);
}

/* ── Send one push ─────────────────────────────────────────────── */
async function sendPush(
  sub: { endpoint: string; keys: { auth: string; p256dh: string } },
  payload: string,
): Promise<void> {
  const [auth, body] = await Promise.all([vapidAuth(sub.endpoint), encrypt(sub, payload)]);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    auth,
      'Content-Encoding': 'aes128gcm',
      'Content-Type':     'application/octet-stream',
      'TTL':              '86400',
    },
    body,
  });
  if (!res.ok && res.status !== 201) {
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
}

/* ── Handler ───────────────────────────────────────────────────── */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405 });

  try {
    const { class_id, type, teacher_name } = await req.json();

    const labels: Record<string, { title: string; body: string }> = {
      announcement: { title: 'Anunț nou 📢', body: `${teacher_name} a publicat un anunț nou!` },
      assignment:   { title: 'Temă nouă 📚', body: `${teacher_name} a adăugat o temă nouă!`  },
    };
    const msg = labels[type] ?? labels.announcement;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: subs, error } = await sb
      .from('push_subscriptions').select('subscription').eq('class_id', class_id);
    if (error) throw error;

    const results = await Promise.allSettled(
      (subs ?? []).map((r: { subscription: { endpoint: string; keys: { auth: string; p256dh: string } } }) =>
        sendPush(r.subscription, JSON.stringify({ ...msg, url: `/class.html?id=${class_id}` }))
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const errors = (results.filter(r => r.status === 'rejected') as PromiseRejectedResult[])
      .map(r => r.reason?.message);

    console.log(`[push] sent=${sent}`, errors.length ? JSON.stringify(errors) : 'no errors');
    return new Response(JSON.stringify({ sent, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[push] fatal:', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
