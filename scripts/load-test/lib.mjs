// Ajutoare comune pentru testele de incarcare. Nu ruleaza niciodata pe proiectul real: vezi assertNotProduction.
export const PROD_REF = 'tfflpivehrrzmklvcyhe';

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k] = true;
    else { out[k] = next; i++; }
  }
  return out;
}

export function num(v, d) { const n = Number(v); return Number.isFinite(n) && v !== undefined && v !== true ? n : d; }

export function assertNotProduction(...urls) {
  for (const u of urls) {
    if (u && String(u).includes(PROD_REF)) {
      console.error('\nOPRIT: adresa tine de proiectul REAL (' + PROD_REF + ').\nTestul de incarcare se ruleaza doar pe un proiect Supabase separat, facut pentru test.\n');
      process.exit(2);
    }
  }
}

export function need(name, args) {
  const v = args[name.toLowerCase().replace(/_/g, '-')] || process.env[name];
  if (!v || v === true) { console.error('Lipseste ' + name + ' (variabila de mediu sau --' + name.toLowerCase().replace(/_/g, '-') + ').'); process.exit(1); }
  return String(v);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

export function summarize(values) {
  const s = Float64Array.from(values).sort();
  return { n: s.length, p50: pct(s, 50), p95: pct(s, 95), p99: pct(s, 99), max: s.length ? s[s.length - 1] : null };
}

export function fmt(v, d = 0) { return v == null ? '-' : Number(v).toFixed(d); }

export function table(rows, cols) {
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(cols));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  rows.forEach((r) => console.log(line(cols.map((c) => r[c] ?? ''))));
}
