/* The teacher's Google Meet link: typed once in the register (tab "Disponibilitate", the box next to "Link Google Meet", D16:H16) and shown to the students of the
   teacher's groups in the platform. Pure and shared (Deno function, Node tests).
   The cell is free text, and the link opens a door to a lesson, so only a real Meet address is accepted: https://meet.google.com/abc-defg-hij, a /lookup/ link or a
   nickname path. Everything else (another host, a "new meeting" address that would open a fresh room on every click, a script) is refused and reported. The
   address is stored without its query and fragment. */

const REFUSED_PATHS = new Set(['new', 'landing', 'whoops', 'tel', 'calling', 'call', 'sign_in', 'signin']);

/* -> { raw, url, why }: url is the clean address or null; why is 'missing' | 'invalid' | 'new' when there is no url */
export function normalizeMeet(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return { raw: '', url: null, why: 'missing' };
  let s = text.replace(/\s+/g, '');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch (e) { return { raw: text, url: null, why: 'invalid' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { raw: text, url: null, why: 'invalid' };
  if (u.username || u.password || u.port) return { raw: text, url: null, why: 'invalid' };
  if (u.hostname.toLowerCase() !== 'meet.google.com') return { raw: text, url: null, why: 'invalid' };
  const path = u.pathname.replace(/\/+$/, '');
  const first = path.split('/')[1] || '';
  if (!first) return { raw: text, url: null, why: 'invalid' };
  if (REFUSED_PATHS.has(first.toLowerCase())) return { raw: text, url: null, why: first.toLowerCase() === 'new' ? 'new' : 'invalid' };
  const code = /^\/(?:meet\/)?[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(path);                  // meet.google.com/abc-defg-hij, and the form with /meet/ in front that Meet also gives
  const lookup = /^\/lookup\/[A-Za-z0-9_-]{4,40}$/.test(path);
  const nick = /^\/[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(path);
  if ((first.toLowerCase() === 'lookup' && !lookup) || (first.toLowerCase() === 'meet' && !code)) return { raw: text, url: null, why: 'invalid' };
  if (!code && !lookup && !nick) return { raw: text, url: null, why: 'invalid' };
  return { raw: text, url: 'https://meet.google.com' + (code ? path.toLowerCase() : path), why: null };
}

export const MEET_WHY = {
  missing: 'nu e completat',
  invalid: 'nu e o adresă Google Meet (trebuie să înceapă cu meet.google.com)',
  new: 'e adresa „întâlnire nouă" (meet.google.com/new), care deschide o sală nouă la fiecare click; folosește linkul unei întâlniri create pentru mai târziu'
};
