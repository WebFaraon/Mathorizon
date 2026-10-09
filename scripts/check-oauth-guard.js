/* The rule of api/auth/oauth-guard.js: which Google sign-ins match the tab they were started from.
     node scripts/check-oauth-guard.js */
'use strict';
const { decide } = require('../api/auth/oauth-guard.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + m); } };
const now = Date.parse('2026-10-09T12:00:00Z');
const ago = s => new Date(now - s * 1000).toISOString();
const google = (age, extra) => ({ created_at: ago(age), identities: [{ provider: 'google' }].concat(extra || []) });

// a brand new Google account (made 5 s ago, no profile yet)
ok(decide({ user: google(5), hasProfile: false, intent: 'signup', now }).status === 'ok', 'new + Înregistrare: allowed');
const noAcc = decide({ user: google(5), hasProfile: false, intent: 'login', now });
ok(noAcc.status === 'no-account' && noAcc.remove === true, 'new + Conectare: refused and the account just made is removed');

// an account that exists (has a profile, or is older)
ok(decide({ user: google(86400 * 30), hasProfile: true, intent: 'login', now }).status === 'ok', 'existing + Conectare: allowed');
const ex = decide({ user: google(86400 * 30), hasProfile: true, intent: 'signup', now });
ok(ex.status === 'exists' && !ex.remove, 'existing + Înregistrare: refused, nothing removed');
ok(decide({ user: google(20), hasProfile: true, intent: 'signup', now }).status === 'exists', 'an account made 20 s ago but with a profile is not new');
ok(decide({ user: google(86400 * 3), hasProfile: false, intent: 'signup', now }).status === 'exists', 'an old account that never opened the site (no profile) is not new');
ok(decide({ user: google(86400 * 3), hasProfile: false, intent: 'login', now }).status === 'ok' && !decide({ user: google(86400 * 3), hasProfile: false, intent: 'login', now }).remove, 'an old account without a profile is never removed');

// a person who had an email account and linked Google: never mistaken for new, never removed
const linked = { created_at: ago(5), identities: [{ provider: 'email' }, { provider: 'google' }] };
ok(decide({ user: linked, hasProfile: false, intent: 'login', now }).status === 'ok', 'email account with Google linked + Conectare: allowed, not removed');
ok(!decide({ user: linked, hasProfile: false, intent: 'login', now }).remove, 'email account with Google linked is never removed');
ok(decide({ user: linked, hasProfile: false, intent: 'signup', now }).status === 'exists', 'email account with Google linked + Înregistrare: it exists');

// not a Google sign-in at all: nothing to guard
ok(decide({ user: { created_at: ago(5), identities: [{ provider: 'email' }] }, hasProfile: false, intent: 'login', now }).status === 'ok', 'a password account is not guarded');
ok(decide({ user: { created_at: ago(5), identities: [] }, hasProfile: false, intent: 'signup', now }).status === 'ok', 'no identities: not guarded');

// a window of exactly the limit is not new
ok(decide({ user: google(120), hasProfile: false, intent: 'login', now }).status === 'ok', 'two minutes old is no longer new');
ok(decide({ user: google(119), hasProfile: false, intent: 'login', now }).status === 'no-account', 'just under two minutes is still new');
ok(decide({ user: { created_at: 'nu e o data', identities: [{ provider: 'google' }] }, hasProfile: false, intent: 'login', now }).status === 'ok', 'a date that cannot be read: never removes anything');

console.log(`OAUTH-GUARD: ${pass} checks passed, ${fail} failed`);
if (fail) process.exit(1);
