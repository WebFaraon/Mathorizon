/* ============================================================
   Mathorizon — Web Push Notifications
   Handles SW registration, push subscription, and prompt UI.
   ============================================================ */

(function () {
  'use strict';

  /* ── Paste here the public key from: npx web-push generate-vapid-keys ── */
  const VAPID_PUBLIC_KEY = 'BOzUBNVH3muLOiHvfL1OVytVvH71P_YYoulBIQI-JCPJjYB4wFRIm1FtNL73uZP39Xjs5PYi4QtznSb7VFBujr0';

  function _urlB64ToUint8(base64) {
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function init(classId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!BMAuth.user) return;

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await _save(classId, existing);
        return;
      }

      if (localStorage.getItem('push_dismissed_' + classId)) return;

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

    bar.querySelector('.push-prompt__yes').onclick = async () => {
      bar.remove();
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          localStorage.setItem('push_dismissed_' + classId, '1');
          BM.toast('Notificările nu au fost permise. Le poți activa din setările browserului.', 'info');
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: _urlB64ToUint8(VAPID_PUBLIC_KEY)
        });
        await _save(classId, sub);
        BM.toast('Notificările au fost activate pentru această clasă!', 'success');
      } catch (e) {
        console.warn('[Push] subscribe error:', e);
      }
    };

    bar.querySelector('.push-prompt__no').onclick = () => {
      bar.remove();
      localStorage.setItem('push_dismissed_' + classId, '1');
    };
  }

  async function _save(classId, sub) {
    if (!BMAuth.user || !BMAuth.supabase) return;
    await BMAuth.supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: BMAuth.user.id, class_id: classId, subscription: sub.toJSON() },
        { onConflict: 'user_id,class_id' }
      )
      .catch(() => {});
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

  window.BMPush = { init, sendClassPush };
})();
