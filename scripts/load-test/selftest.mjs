// Verifica ca scripturile de test functioneaza, fara niciun proiect Supabase: porneste un server fals (Realtime + cereri) pe calculatorul tau
// si ruleaza ambele teste scurt impotriva lui. Cifrele NU spun nimic despre Supabase, doar ca instrumentele masoara corect.
//   node scripts/load-test/selftest.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rooms = new Map();   // topic -> Set(socket)
let wsMsgs = 0, httpReqs = 0;

const server = http.createServer((req, res) => {
  httpReqs++;
  let body = [];
  req.on('data', (c) => body.push(c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.includes('award_xp')) return res.end(JSON.stringify({ total: 10, awarded: 10 }));
    if (req.url.includes('bump_streak')) return res.end(JSON.stringify({ count: 1, last_date: '2026-11-25', grew: true }));
    if (req.method === 'POST') { res.statusCode = 201; return res.end(''); }
    res.end('[]');
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  const mine = new Set();
  let buf = Buffer.alloc(0);
  const send = (arr) => {
    const data = Buffer.from(JSON.stringify(arr));
    let head;
    if (data.length < 126) head = Buffer.from([0x81, data.length]);
    else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
    if (!socket.destroyed) socket.write(Buffer.concat([head, data]));
  };
  const frame = (op, data) => {
    let head;
    if (data.length < 126) head = Buffer.from([op, data.length]);
    else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = op; head[1] = 126; head.writeUInt16BE(data.length, 2); }
    else { head = Buffer.alloc(10); head[0] = op; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
    if (!socket.destroyed) socket.write(Buffer.concat([head, data]));
  };
  socket.__send = send;
  socket.__bin = (data) => frame(0x82, data);
  // mesaj de difuzare trimis de un client (cadru binar, tipul 3) -> se retrimite celorlalti ca tipul 4, ca pe serverul real
  const onBinary = (b) => {
    wsMsgs++;
    if (b[0] !== 3) return;
    const [jl, rl, tl, el, ml, enc] = [b[1], b[2], b[3], b[4], b[5], b[6]];
    let o = 7 + jl + rl;
    const topic = b.subarray(o, o + tl).toString(); o += tl;
    const ev = b.subarray(o, o + el); o += el;
    const meta = b.subarray(o, o + ml); o += ml;
    const payload = b.subarray(o);
    const topicB = Buffer.from(topic);
    const out = Buffer.concat([Buffer.from([4, tl, el, ml, enc]), topicB, ev, meta, payload]);
    for (const s of rooms.get(topic) || []) if (s !== socket) s.__bin(out);
  };
  const onMessage = (text) => {
    wsMsgs++; if (process.env.LT_DEBUG) console.log('[srv]', text.slice(0, 160));
    let m; try { m = JSON.parse(text); } catch { return; }
    const [joinRef, ref, topic, event, payload] = m;
    if (event === 'phx_join') {
      if (!rooms.has(topic)) rooms.set(topic, new Set());
      rooms.get(topic).add(socket); mine.add(topic);
      send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } }]);
    } else if (event === 'heartbeat') send([null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]);
    else if (event === 'phx_leave') { rooms.get(topic)?.delete(socket); send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]); }
    else if (event === 'broadcast') { for (const s of rooms.get(topic) || []) if (s !== socket) s.__send([null, null, topic, 'broadcast', payload]); }
  };
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f; let len = buf[1] & 0x7f; let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const masked = (buf[1] & 0x80) !== 0;
      const mask = masked ? buf.subarray(off, off + 4) : null; if (masked) off += 4;
      if (buf.length < off + len) return;
      const payload = Buffer.from(buf.subarray(off, off + len));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      buf = buf.subarray(off + len);
      if (op === 0x8) { socket.end(); return; }
      if (op === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (op === 0x1) onMessage(payload.toString('utf8'));
      else if (op === 0x2) onBinary(payload);
    }
  });
  const gone = () => { for (const t of mine) rooms.get(t)?.delete(socket); };
  socket.on('close', gone); socket.on('error', gone);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const env = { ...process.env, SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_ANON_KEY: 'selftest-key' };
const run = (file, a, extra = {}) => new Promise((resolve) => {
  const p = spawn(process.execPath, [new URL(file, import.meta.url).pathname, ...a], { env: { ...env, ...extra }, stdio: 'inherit' });
  p.on('close', (c) => resolve(c));
});

console.log('== Test 1: tabla live (server fals) ==');
const c1 = await run('./realtime.mjs', ['--steps', '2,4', '--students', '4', '--duration', '6', '--ramp', '2']);
console.log('\n== Test 2: cereri (server fals) ==');
const dir = mkdtempSync(join(tmpdir(), 'lt-'));
const tf = join(dir, 'tokens.json');
writeFileSync(tf, JSON.stringify({ at: Date.now(), tokens: Array.from({ length: 5 }, (_, i) => ({ uid: `00000000-0000-0000-0000-00000000000${i}`, token: 'fake' })) }));
const c2 = await run('./rest.mjs', ['--steps', '3,6', '--duration', '6', '--think', '0.02'], { LT_TOKENS_FILE: tf });
rmSync(dir, { recursive: true, force: true });
console.log(`\nServerul fals a primit ${wsMsgs} mesaje live si ${httpReqs} cereri.`);
console.log(c1 === 0 && c2 === 0 && wsMsgs > 100 && httpReqs > 20 ? 'SELFTEST: OK' : 'SELFTEST: ESUAT');
server.close();
process.exit(c1 === 0 && c2 === 0 && wsMsgs > 100 && httpReqs > 20 ? 0 : 1);
