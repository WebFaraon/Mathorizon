// Test de incarcare pentru cererile obisnuite (lecții, XP, clasament, progres): cat de repede raspunde baza de date cand sunt multi elevi in acelasi timp.
//
// Pasul 1 (o singura data), cu cheia de serviciu a proiectului DE TEST: face conturi de test si salveaza jetoanele:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... node scripts/load-test/rest.mjs --seed 100
// Pasul 2: ruleaza testul (nu mai are nevoie de cheia de serviciu):
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/load-test/rest.mjs --steps 25,50,100,200 --duration 60
//
// Fiecare elev virtual face ce face un elev real: deschide pagina (profil, progres, clasament), termina lectii (award_xp + progres), cere clasamentul.
// Are nevoie ca migrarile din supabase/migrations sa fie aplicate pe proiectul de test. NU se ruleaza pe proiectul real.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs, num, need, assertNotProduction, sleep, summarize, fmt, table } from './lib.mjs';

const args = parseArgs();
const URL = need('SUPABASE_URL', args);
const KEY = need('SUPABASE_ANON_KEY', args);
assertNotProduction(URL);
const TOKENS_FILE = process.env.LT_TOKENS_FILE || 'scripts/load-test/.tokens.json';
const PASSWORD = 'LoadTest-' + 'x9Kq2mVz';

async function seed(n) {
  const SERVICE = need('SUPABASE_SERVICE_KEY', args);
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const tokens = [];
  console.log(`Fac ${n} conturi de test pe ${URL} ...`);
  for (let i = 1; i <= n; i++) {
    const email = `lt-${i}@loadtest.invalid`;
    let uid = null;
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Elev Test ${i}`, role: 'elev' } });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) { console.error('createUser:', created.error.message); process.exit(1); }
    const client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    let session = null;
    for (let attempt = 0; attempt < 8 && !session; attempt++) {
      const r = await client.auth.signInWithPassword({ email, password: PASSWORD });
      if (r.error) { await sleep(2000 * (attempt + 1)); continue; }
      session = r.data.session; uid = r.data.user.id;
    }
    if (!session) { console.error('Nu m-am putut conecta ca ' + email + ' (limita de conectari a Supabase?). Reia cu --seed ' + n + ' dupa cateva minute.'); process.exit(1); }
    await admin.from('user_profiles').upsert({ user_id: uid, role: 'elev', status: 'active', display_name: `Elev Test ${i}` }, { onConflict: 'user_id' });
    tokens.push({ uid, token: session.access_token });
    if (i % 10 === 0) console.log(`  ${i}/${n}`);
    await sleep(350);   // sub limita de conectari a Supabase
  }
  writeFileSync(TOKENS_FILE, JSON.stringify({ at: Date.now(), tokens }));
  console.log('Gata. Jetoanele (valabile cam o ora) sunt in scripts/load-test/.tokens.json (nu intra in git).');
}

if (args.seed) { await seed(num(args.seed, 100)); process.exit(0); }

if (!existsSync(TOKENS_FILE)) { console.error('Nu exista .tokens.json. Ruleaza intai cu --seed 100.'); process.exit(1); }
const saved = JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
if (Date.now() - saved.at > 55 * 60 * 1000) { console.error('Jetoanele sunt mai vechi de 55 de minute. Ruleaza din nou --seed.'); process.exit(1); }
const USERS = saved.tokens;

const STEPS = String(args.steps || 25).split(',').map(Number).filter(Boolean);
const DURATION = num(args.duration, 60);
const THINK = num(args.think, 1);          // 1 = ritm normal, 0.5 = de doua ori mai des
const STOP_P95 = num(args['stop-p95'], 1500);
const STOP_ERR = num(args['stop-err'], 2);

async function call(u, kind, path, opts, rec) {
  const t0 = performance.now();
  let status = 0;
  try {
    const res = await fetch(URL + '/rest/v1/' + path, { ...opts, headers: { apikey: KEY, Authorization: 'Bearer ' + u.token, 'Content-Type': 'application/json', Accept: 'application/json', ...(opts && opts.headers) } });
    status = res.status;
    await res.arrayBuffer();
  } catch (e) { status = -1; }
  const ms = performance.now() - t0;
  const r = rec[kind] || (rec[kind] = { ms: [], err: 0, n: 0, codes: {} });
  r.n++; r.ms.push(ms); r.codes[status] = (r.codes[status] || 0) + 1;
  if (status < 200 || status >= 300) r.err++;
}
const rpc = (u, kind, fn, body, rec) => call(u, kind, 'rpc/' + fn, { method: 'POST', body: JSON.stringify(body || {}) }, rec);

// Ce face un elev: deschide pagina, apoi o sesiune de lectii cu pauze.
async function student(u, idx, until, rec) {
  let lesson = 0;
  await sleep(Math.random() * 5000);
  while (Date.now() < until) {
    // deschiderea unei pagini: profilul, progresul, clasamentul (de doua ori, ca pe site)
    await Promise.all([
      rpc(u, 'profil', 'my_student_profile', {}, rec),
      call(u, 'progres', `parcurs_progress?select=lesson_id,best_pct&user_id=eq.${u.uid}`, { method: 'GET' }, rec),
      rpc(u, 'clasament', 'get_xp_leaderboard', { p_limit: 500 }, rec),
    ]);
    // 3 lectii pe pagina deschisa, cate 40-80 s fiecare (la ritm normal)
    for (let k = 0; k < 3 && Date.now() < until; k++) {
      await sleep((40000 + Math.random() * 40000) * THINK);
      if (Date.now() >= until) break;
      lesson++;
      const ref = `r7.lt${idx}.l${lesson}.${Date.now().toString(36)}`;
      await Promise.all([
        rpc(u, 'xp', 'award_xp', { p_amount: 10, p_source: 'lectie', p_ref: ref }, rec),
        call(u, 'progres_scris', 'parcurs_progress?on_conflict=user_id,lesson_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: u.uid, lesson_id: ref.slice(0, 60), best_pct: 100, plays: 1, xp: 10 }) }, rec),
        rpc(u, 'serie', 'bump_streak', {}, rec),
      ]);
    }
  }
}

console.log(`Test cereri pe ${URL}\n  conturi de test: ${USERS.length}, durata pe pas: ${DURATION}s, pasi (elevi in acelasi timp): ${STEPS.join(', ')}\n`);
const results = [];
let limit = null;
for (const n of STEPS) {
  console.log(`Pasul: ${n} elevi in acelasi timp`);
  const rec = {};
  const until = Date.now() + DURATION * 1000;
  const workers = [];
  for (let i = 0; i < n; i++) workers.push(student(USERS[i % USERS.length], i, until, rec));
  const tick = setInterval(() => { const done = Object.values(rec).reduce((a, r) => a + r.n, 0); process.stdout.write(`\r  cereri facute: ${done}   `); }, 1000);
  await Promise.all(workers);
  clearInterval(tick); process.stdout.write('\n');
  const all = Object.values(rec);
  const total = all.reduce((a, r) => a + r.n, 0);
  const errs = all.reduce((a, r) => a + r.err, 0);
  const allMs = all.flatMap((r) => r.ms);
  const sAll = summarize(allMs);
  const clas = summarize(rec.clasament ? rec.clasament.ms : []);
  const codes = {}; all.forEach((r) => Object.entries(r.codes).forEach(([c, v]) => { if (c < 200 || c >= 300) codes[c] = (codes[c] || 0) + v; }));
  const row = { elevi: n, cereri: total, pe_secunda: fmt(total / DURATION, 1), erori_pct: fmt(total ? (errs / total) * 100 : 0, 1), p50_ms: fmt(sAll.p50), p95_ms: fmt(sAll.p95), p99_ms: fmt(sAll.p99), clasament_p95_ms: fmt(clas.p95), coduri_eroare: Object.entries(codes).map(([c, v]) => `${c} x${v}`).join(' ') || '-' };
  results.push(row);
  const bad = Number(row.erori_pct) > STOP_ERR || (sAll.p95 != null && sAll.p95 > STOP_P95);
  if (bad) { limit = n; console.log(`  -> limita atinsa la ${n} elevi\n`); break; }
  console.log('  -> in regula\n');
  if (n !== STEPS[STEPS.length - 1]) await sleep(8000);
}
console.log('\nREZULTAT');
table(results, ['elevi', 'cereri', 'pe_secunda', 'erori_pct', 'p50_ms', 'p95_ms', 'p99_ms', 'clasament_p95_ms', 'coduri_eroare']);
console.log(limit ? `\nLimita se vede la ${limit} elevi in acelasi timp.` : `\nToti pasii au iesit in regula (pana la ${results[results.length - 1].elevi} elevi). Limita e mai sus: mareste --steps.`);
console.log('Nota: un elev virtual cere ~6 cereri pe minut, ca un elev real intr-o lectie. Cu "--think 0.25" ritmul e de 4 ori mai des (test de stres).');
try { writeFileSync(`scripts/load-test/rezultat-cereri-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, JSON.stringify({ url: URL.replace(/^https?:\/\//, '').split('.')[0], duration: DURATION, results }, null, 2)); } catch (_) {}
process.exit(0);
