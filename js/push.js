/* ============================================================
   Teorema — Web Push Notifications
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
        { user_id: BMAuth.user.id, class_id: classId, endpoint: sub.endpoint, subscription: sub.toJSON() },
        { onConflict: 'user_id,class_id,endpoint' }
      );
    if (error) console.warn('[Push] save error:', error.message);
    return !error;
  }

  /* opts.prompt: ask once, the first time this person opens this class on this device (students). Whatever the answer, it is not asked again: the bell key in the
     class header turns the notifications on and off from then on. */
  async function init(classId, opts) {
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

      /* No browser subscription: ask once (never when the browser blocks notifications for the site, a prompt could not work) */
      if (opts && opts.prompt === false) return;
      if ('Notification' in window && Notification.permission === 'denied') return;
      const asked = 'push_asked_' + BMAuth.user.id + '_' + classId;
      if (localStorage.getItem(asked)) return;
      localStorage.setItem(asked, '1');
      setTimeout(() => _showPrompt(classId, reg), 900);
    } catch (e) {
      console.warn('[Push] init error:', e);
    }
  }

  /* The one-time question: a small dialog in the middle of the page, like the other dialogs of the class. */
  function _showPrompt(classId, reg) {
    if (document.getElementById('bmPushPrompt') || document.querySelector('.classes-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'bmPushPrompt';
    modal.className = 'classes-modal';
    modal.innerHTML = `
      <div class="classes-modal__backdrop"></div>
      <div class="classes-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="bmPushPromptT">
        <div class="classes-modal__head">
          <h3 id="bmPushPromptT">${icon('bell', { size: 20 })} Vrei notificări pentru această clasă?</h3>
          <button class="icon-btn" data-no aria-label="Închide">${icon('x', { size: 16 })}</button>
        </div>
        <div class="classes-modal__body">
          <p class="notif-info__p">Primești un mesaj pe telefon sau pe calculator, chiar și cu site-ul închis, când:</p>
          <ul class="notif-info__list">
            <li>${icon('message-circle', { size: 16 })} cineva din clasă trimite un mesaj nou</li>
            <li>${icon('file-text', { size: 16 })} apare o temă nouă</li>
            <li>${icon('target', { size: 16 })} se programează sau pornește o simulare</li>
          </ul>
          <p class="notif-info__p">Le poți porni sau opri oricând din butonul „Notificări” din antetul clasei.</p>
        </div>
        <div class="classes-modal__foot">
          <button class="btn btn--surface" data-no>Nu acum</button>
          <button class="btn btn--primary" data-yes>Activează</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    modal.querySelector('.classes-modal__backdrop').onclick = close;
    modal.querySelectorAll('[data-no]').forEach(b => { b.onclick = close; });
    modal.querySelector('[data-yes]').onclick = () => { close(); _subscribe(classId, reg); };
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
      document.dispatchEvent(new CustomEvent('bmpush:changed'));
    } catch (e) {
      console.warn('[Push] subscribe error:', e);
      BM.toast('Notificările nu au putut fi activate.', 'error');
    }
  }

  async function isSubscribed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) {
      return false;
    }
  }

  async function unsubscribe(classId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (!BMAuth.user) return false;
    try {
      const reg = await _getReg();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await BMAuth.supabase
          .from('push_subscriptions')
          .delete().eq('user_id', BMAuth.user.id).eq('class_id', classId).eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      document.dispatchEvent(new CustomEvent('bmpush:changed'));
      return true;
    } catch (e) {
      console.warn('[Push] unsubscribe error:', e);
      return false;
    }
  }

  /* Called from sidebar button */
  async function resubscribe(classId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!BMAuth.user) return;
    try {
      const reg = await _getReg();
      const old = await reg.pushManager.getSubscription();
      if (old) {
        /* Remove old endpoint from DB before unsubscribing browser */
        await BMAuth.supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', BMAuth.user.id)
          .eq('class_id', classId)
          .eq('endpoint', old.endpoint);
        await old.unsubscribe();
      }
      await _subscribe(classId, reg, null);
    } catch (e) {
      console.warn('[Push] resubscribe error:', e);
    }
  }

  async function sendClassPush(classId, type, extra) {
    if (!BMAuth.supabase) return;
    try {
      await BMAuth.supabase.functions.invoke('send-class-push', {
        body: { class_id: classId, type, teacher_name: BMAuth.displayName(), exclude_user_id: BMAuth.user?.id, extra }
      });
    } catch (e) {
      console.warn('[Push] send error:', e);
    }
  }

  window.BMPush = { init, resubscribe, unsubscribe, isSubscribed, sendClassPush };
})();
