// Test de incarcare pentru partea "live" (tabla): cate conexiuni si cate mesaje pe secunda sustine proiectul.
//
// Cum seamana cu tabla reala: fiecare participant are propriul client si propria conexiune (ca un browser), intr-un canal de tip
// broadcast pe care profesorul trimite "stroke:point" la fiecare 40 ms cat timp scrie (ca js/whiteboard.js: BROADCAST_MS = 40).
// Se masoara: cati s-au conectat, cat dureaza, cat dureaza un mesaj de la profesor la elevi, cate mesaje se pierd, ce erori da serverul.
//
// Foloseste doar cheia publica (anon). Nu scrie nimic in baza de date. NU se ruleaza pe proiectul real.
//
//   SUPABASE_URL=https://<proiect-de-test>.supabase.co SUPABASE_ANON_KEY=... \
//   node scripts/load-test/realtime.mjs --steps 2,5,10,15 --students 20 --duration 90
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { parseArgs, num, need, assertNotProduction, sleep, summarize, fmt, table } from './lib.mjs';

const args = parseArgs();
const URL = need('SUPABASE_URL', args);
const KEY = need('SUPABASE_ANON_KEY', args);
assertNotProduction(URL);

const STUDENTS = num(args.students, 20);          // elevi pe clasa (fara profesor)
const DURATION = num(args.duration, 90);          // secunde pe pas
const RAMP = num(args.ramp, 20);                  // secunde in care se conecteaza toti
const DUTY = Math.min(1, Math.max(0.05, num(args.duty, 0.35)));   // cat din timp scrie profesorul (creionul pe tabla)
const STROKE_S = num(args['stroke-seconds'], 3);  // cat dureaza o linie scrisa
const WRITERS = Math.min(1, Math.max(0, num(args.writers, 0)));  // ce parte din elevi scriu si ei (de obicei 0: tabla e blocata)
const STOP_LOSS = num(args['stop-loss'], 5);      // opreste cresterea cand se pierd mai mult de atatea % din mesaje
const STOP_P95 = num(args['stop-p95'], 1500);     // sau cand p95 al intarzierii trece de atatea ms
const STEPS = String(args.steps || args.classes || 5).split(',').map((s) => Number(s.trim())).filter(Boolean);
const SEND_MS = 40;

function makeClient() {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function runStep(classes) {
  const runId = Math.random().toString(36).slice(2, 8);
  const stats = {
    classes, students: STUDENTS, people: classes * (STUDENTS + 1),
    joinOk: 0, joinFail: 0, joinMs: [], dropped: 0,
    sent: 0, sendFail: 0, expected: 0, received: 0, latency: [], sysMsgs: new Map(),
  };
  const all = [];       // { client, channel }
  const teachers = [];  // { channel, receivers: [..] }
  let stopping = false;

  async function joinOne(topic, onMessage, onSystem) {
    const t0 = Date.now();
    const client = makeClient();
    const channel = client.channel(topic, { config: { broadcast: { self: false } } });
    let joined = false;
    channel.on('broadcast', { event: 'stroke:point' }, (m) => onMessage && onMessage(m.payload));
    try { channel.on('system', {}, (p) => onSystem && onSystem(p)); } catch (_) { /* versiuni vechi */ }
    const status = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve('TIMED_OUT'), 20000);
      channel.subscribe((s) => {
        if (!joined && s === 'SUBSCRIBED') { joined = true; clearTimeout(timer); resolve(s); }
        else if (!joined && (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED')) { clearTimeout(timer); resolve(s); }
        else if (joined && !stopping && (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED')) stats.dropped++;
      });
    });
    if (status === 'SUBSCRIBED') { stats.joinOk++; stats.joinMs.push(Date.now() - t0); }
    else { stats.joinFail++; }
    const rec = { client, channel, ok: status === 'SUBSCRIBED' };
    all.push(rec);
    return rec;
  }

  const sys = (p) => { const k = String((p && (p.message || p.status || p.extension)) || 'system').slice(0, 90); stats.sysMsgs.set(k, (stats.sysMsgs.get(k) || 0) + 1); };

  // conectare esalonata pe durata RAMP
  const joins = [];
  let idx = 0;
  const total = classes * (STUDENTS + 1);
  for (let c = 0; c < classes; c++) {
    const topic = `lt-${runId}-${c}`;
    const room = { topic, teacher: null, students: [] };
    teachers.push(room);
    const members = [{ role: 't' }];
    for (let s = 0; s < STUDENTS; s++) members.push({ role: 's' });
    for (const m of members) {
      const delay = (idx++ / total) * RAMP * 1000;
      joins.push((async () => {
        await sleep(delay);
        const rec = await joinOne(topic, (p) => {
          if (p && p.t0) { stats.received++; stats.latency.push(Date.now() - p.t0); }
        }, sys);
        if (m.role === 't') room.teacher = rec; else room.students.push(rec);
      })());
    }
  }
  console.log(`  conectez ${total} participanti in ${RAMP}s ...`);
  await Promise.all(joins);
  console.log(`  conectati: ${stats.joinOk}, esuati: ${stats.joinFail}`);

  // scrierea: fiecare profesor (si o parte din elevi) scrie linii de STROKE_S secunde, cu pauze, astfel incat sa scrie DUTY din timp
  const t0 = Date.now();
  const end = t0 + DURATION * 1000;
  const writers = [];
  for (const room of teachers) {
    if (!room.teacher || !room.teacher.ok) continue;
    const recipients = [room.teacher, ...room.students].filter((m) => m && m.ok).length - 1;   // toti ceilalti din clasa
    const sources = [room.teacher, ...room.students.filter((s) => s.ok).slice(0, Math.round(room.students.length * WRITERS))];
    for (const src of sources) {
      writers.push((async () => {
        const gap = (STROKE_S * 1000) * (1 / DUTY - 1);
        await sleep(Math.random() * 2000);
        while (Date.now() < end && !stopping) {
          const strokeEnd = Math.min(end, Date.now() + STROKE_S * 1000);
          const strokeId = Math.random().toString(36).slice(2);
          while (Date.now() < strokeEnd && !stopping) {
            const payload = { strokeId, color: '#111', width: 3, opacity: 1, points: [{ x: Math.random() * 1400, y: Math.random() * 900, w: 2.5, t: Date.now() }, { x: Math.random() * 1400, y: Math.random() * 900, w: 2.5, t: Date.now() }], t0: Date.now() };
            stats.sent++;
            stats.expected += recipients;   // fiecare mesaj trebuie sa ajunga la ceilalti din clasa
            src.channel.send({ type: 'broadcast', event: 'stroke:point', payload }).then((r) => { if (r !== 'ok') stats.sendFail++; }).catch(() => { stats.sendFail++; });
            await sleep(SEND_MS);
          }
          await sleep(Math.min(gap * (0.5 + Math.random()), Math.max(0, end - Date.now())));
        }
      })());
    }
  }
  const tick = setInterval(() => {
    const s = Math.round((Date.now() - t0) / 1000);
    process.stdout.write(`\r  ${s}s / ${DURATION}s   trimise ${stats.sent}   primite ${stats.received}   cazute ${stats.dropped}   `);
  }, 1000);
  await Promise.all(writers);
  clearInterval(tick);
  process.stdout.write('\n');
  await sleep(3000);                                 // mesajele aflate pe drum
  stopping = true;

  for (const r of all) { try { await r.client.removeAllChannels(); } catch (_) {} }
  await sleep(500);

  const lat = summarize(stats.latency);
  const jn = summarize(stats.joinMs);
  const lossPct = stats.expected ? Math.max(0, (1 - stats.received / stats.expected) * 100) : 0;
  return {
    clase: classes, persoane: stats.people,
    conectati: `${stats.joinOk}/${stats.people}`, esuati: stats.joinFail, cazute_in_timp: stats.dropped,
    conectare_p95_ms: fmt(jn.p95), mesaje_trimise: stats.sent, trimise_pe_sec: fmt(stats.sent / DURATION, 1),
    primite: stats.received, primite_pe_sec: fmt(stats.received / DURATION, 0), pierdute_pct: fmt(lossPct, 1),
    intarziere_p50_ms: fmt(lat.p50), intarziere_p95_ms: fmt(lat.p95), intarziere_p99_ms: fmt(lat.p99),
    erori_server: [...stats.sysMsgs.entries()].map(([k, v]) => `${k} x${v}`).join('; ') || '-',
    _raw: { lossPct, p95: lat.p95, joinFail: stats.joinFail, sendFail: stats.sendFail },
  };
}

console.log(`Test tabla live pe ${URL}\n  elevi pe clasa: ${STUDENTS}, durata pe pas: ${DURATION}s, profesorul scrie ${Math.round(DUTY * 100)}% din timp, pasi (clase): ${STEPS.join(', ')}\n`);
const results = [];
let verdict = null;
for (const c of STEPS) {
  console.log(`Pasul: ${c} clase`);
  const r = await runStep(c);
  results.push(r);
  const bad = r._raw.lossPct > STOP_LOSS || (r._raw.p95 != null && r._raw.p95 > STOP_P95) || r._raw.joinFail > r.persoane * 0.02;
  if (bad) { verdict = c; console.log(`  -> limita atinsa la ${c} clase (${r.persoane} persoane)\n`); break; }
  console.log('  -> in regula\n');
  if (c !== STEPS[STEPS.length - 1]) await sleep(10000);
}

console.log('\nREZULTAT');
table(results, ['clase', 'persoane', 'conectati', 'esuati', 'cazute_in_timp', 'trimise_pe_sec', 'primite_pe_sec', 'pierdute_pct', 'intarziere_p50_ms', 'intarziere_p95_ms', 'intarziere_p99_ms']);
results.forEach((r) => { if (r.erori_server !== '-') console.log(`  ${r.clase} clase, erori de la server: ${r.erori_server}`); });
const lastOk = results.filter((r) => r._raw.lossPct <= STOP_LOSS && (r._raw.p95 == null || r._raw.p95 <= STOP_P95) && r._raw.joinFail <= r.persoane * 0.02).pop();
console.log(verdict
  ? `\nUltimul pas in regula: ${lastOk ? lastOk.clase + ' clase (' + lastOk.persoane + ' persoane)' : 'niciunul'}. Limita se vede la ${verdict} clase.`
  : `\nToti pasii au iesit in regula (pana la ${results[results.length - 1].clase} clase, ${results[results.length - 1].persoane} persoane). Limita e mai sus: mareste --steps.`);
const file = `scripts/load-test/rezultat-realtime-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
try { writeFileSync(file, JSON.stringify({ url: URL.replace(/^https?:\/\//, '').split('.')[0], students: STUDENTS, duration: DURATION, duty: DUTY, results: results.map(({ _raw, ...r }) => r) }, null, 2)); console.log('Salvat: ' + file); } catch (_) {}
process.exit(0);
