/* ============================================================
   Mathorizon — Web Push Notifications
   ============================================================ */

(function () {
  'use strict';

  const VAPID_PUBLIC_KEY = 'BOzUBNVH3muLOiHvfL1OVytVvH71P_YYoulBIQI-JCPJjYB4wFRIm1FtNL73uZP39Xjs5PYi4QtznSb7VFBujr0';

  function _urlB64ToUint8(base64) {
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from([...atob(b64)].map(c => c.charCodeAt(0)));
  }

  async function _getReg() {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function _save(classId, sub) {
    if (!BMAuth.user || !BMAuth.supabase) return false;
    const { error } = await BMAuth.supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: BMAuth.user.id, class_id: classId, subscription: sub.toJSON() },
        { onConflict: 'user_id,class_id' }
      );
    if (error) console.warn('[Push] save error:', error.message);
    return !error;
  }

  async function init(classId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!BMAuth.user) return;

    try {
      const reg      = await _getReg();
      const existing = await reg.pushManager.getSubscription();

      if (existing) {
        /* Check if it's actually in DB — if not, re-save */
        const { data } = await BMAuth.supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', BMAuth.user.id)
          .eq('class_id', classId)
          .maybeSingle();

        if (!data) await _save(classId, existing);
        return;
      }

      /* No browser subscription — show prompt unless permanently dismissed */
      if (localStorage.getItem('push_dismissed_' + classId) === 'forever') return;
      _showPrompt(classId, reg);
    } catch (e) {
      console.warn('[Push] init error:', e);
    }
  }

  function _showPrompt(classId, reg) {
    if (document.getElementById('bmPushPrompt')) return;

    const bar = document.createElement('div');
    bar.id = 'bmPushPrompt';
    bar.className = 'push-prompt';
    bar.innerHTML = `
      <span class="push-prompt__icon">🔔</span>
      <span class="push-prompt__text">Primește notificări când profesorul postează ceva nou în această clasă</span>
      <div class="push-prompt__btns">
        <button class="push-prompt__yes">Activează</button>
        <button class="push-prompt__no">Nu acum</button>
      </div>
    `;
    document.body.appendChild(bar);

    bar.querySelector('.push-prompt__yes').onclick = () => _subscribe(classId, reg, bar);
    bar.querySelector('.push-prompt__no').onclick  = () => {
      bar.remove();
      /* Only "soft" dismiss — prompt will reappear next session */
      sessionStorage.setItem('push_dismissed_' + classId, '1');
    };
  }

  async function _subscribe(classId, reg, bar) {
    bar?.remove();
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        BM.toast('Permite notificările din setările browserului pentru a le activa.', 'info');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(VAPID_PUBLIC_KEY)
      });
      const ok = await _save(classId, sub);
      BM.toast(ok ? 'Notificările au fost activate!' : 'Eroare la salvarea notificărilor.', ok ? 'success' : 'error');
    } catch (e) {
      console.warn('[Push] subscribe error:', e);
      BM.toast('Notificările nu au putut fi activate.', 'error');
    }
  }

  /* Called from sidebar button */
  async function resubscribe(classId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!BMAuth.user) return;
    try {
      const reg = await _getReg();
      /* Unsubscribe existing first to get a fresh subscription */
      const old = await reg.pushManager.getSubscription();
      if (old) await old.unsubscribe();
      await _subscribe(classId, reg, null);
    } catch (e) {
      console.warn('[Push] resubscribe error:', e);
    }
  }

  async function sendClassPush(classId, type) {
    if (!BMAuth.supabase) return;
    try {
      await BMAuth.supabase.functions.invoke('send-class-push', {
        body: { class_id: classId, type, teacher_name: BMAuth.displayName() }
      });
    } catch (e) {
      console.warn('[Push] send error:', e);
    }
  }

  window.BMPush = { init, resubscribe, sendClassPush };
})();
