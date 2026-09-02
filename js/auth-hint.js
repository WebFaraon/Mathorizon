/* ============================================================
   Mathorizon — Auth Hint
   Loaded first in <head> (right after theme.js) to avoid a flash of
   the authenticated navbar (tokens/favorite/istoric) or protected
   content for a signed-out visitor. Supabase persists its session
   under a fixed localStorage key — this checks for that key
   synchronously, before anything paints, and stamps a best-guess
   class on <html>. js/auth.js confirms the real session shortly
   after (async, via bmauth:ready) and corrects the guess if it was
   wrong (e.g. a stale/expired token was still present).

   This is a best-effort guess, not a real auth check — there is no
   backend session validation in a static site. It eliminates the
   flash for the common case (no token at all = never signed in, or
   signed out) and leaves only a narrow, rare gap (a present but
   expired token) where content can briefly show before the
   bmauth:ready correction fires.
   ============================================================ */
(function () {
  'use strict';

  var SESSION_KEY = 'sb-tfflpivehrrzmklvcyhe-auth-token';

  function hasLikelySession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return !!(parsed && parsed.access_token);
    } catch (e) {
      return false;
    }
  }

  function stamp(authed) {
    var root = document.documentElement;
    root.classList.toggle('bm-authed', authed);
    root.classList.toggle('bm-guest', !authed);
  }

  var initialGuess = hasLikelySession();
  stamp(initialGuess);

  // "authed" from the hint alone isn't confirmed yet — a protected page
  // (capitole.html) stays behind a neutral veil (its own markup/CSS, see
  // there) until bmauth:ready settles it one way or the other, instead of
  // painting real content that a stale token might immediately invalidate.
  // Guests don't need this: requireAuthOrRedirect() below sends them away
  // before anything renders, hint or no hint.
  if (initialGuess) document.documentElement.classList.add('bm-auth-pending');

  window.BM = window.BM || {};

  /* Call from a protected page's <head>, right after this script, to
     redirect signed-out visitors before first paint. Saves the page
     they were trying to reach so auth.html can send them back after
     login (see js/auth-page.js's _getFrom). */
  window.BM.requireAuthOrRedirect = function () {
    if (document.documentElement.classList.contains('bm-guest')) {
      var dest = location.pathname + location.search;
      location.replace('/?from=' + encodeURIComponent(dest));
      return false;
    }
    return true;
  };

  /* Correct the guess once the real session is known. Only pages that
     called requireAuthOrRedirect() above re-check here — a wrong
     "authed" guess (stale token) means BM.__protectedRoute pages must
     still bounce the visitor once truth catches up. */
  document.addEventListener('bmauth:ready', function (e) {
    var reallyAuthed = !!(e.detail && e.detail.user);
    var hintWasWrong = !reallyAuthed && document.documentElement.classList.contains('bm-authed');
    stamp(reallyAuthed);
    document.documentElement.classList.remove('bm-auth-pending');

    // A present-but-invalid/expired token can outlive the SDK's own
    // cleanup (confirmed: a malformed token is left in localStorage
    // untouched after getSession() rejects it) — left alone, the next
    // page load's synchronous hint makes the exact same wrong "authed"
    // guess, which on a page that redirects on that guess alone (the
    // landing page, see index.html) becomes an infinite bounce between
    // "/" and the protected route. Clearing it here, the moment it's
    // confirmed stale, is what breaks that loop.
    if (hintWasWrong) {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    }

    if (!reallyAuthed && window.BM.__protectedRoute) {
      var dest = location.pathname + location.search;
      location.replace('/?from=' + encodeURIComponent(dest));
    }
  });
})();
