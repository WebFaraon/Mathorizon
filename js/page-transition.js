/* Smooth fade transition between full page navigations (nav links etc.) */
(function () {
  'use strict';

  function isTransitionable(a) {
    if (!a) return false;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;
    if (href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href) && href.indexOf(window.location.origin) !== 0) return false;
    return true;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a');
    if (!isTransitionable(a)) return;
    var href = a.getAttribute('href');
    if (a.href === window.location.href) { e.preventDefault(); return; }
    e.preventDefault();
    document.body.classList.add('page-fade-out');
    setTimeout(function () { window.location.href = href; }, 180);
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) document.body.classList.remove('page-fade-out');
  });
})();
