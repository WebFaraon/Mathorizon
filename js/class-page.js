/* ============================================================
   Mathorizon — Class Detail Page
   Routing: class.html?id=<uuid>[#tab]
   Tabs: flux | teme | simulari | membri
   ============================================================ */

(function () {
  'use strict';

  const TABS = [
    { id: 'flux',     label: 'Flux',      icon: '📢' },
    { id: 'teme',     label: 'Teme',      icon: '📝' },
    { id: 'simulari', label: 'Simulări',  icon: '🎯' },
    { id: 'membri',   label: 'Membri',    icon: '👥' }
  ];

  // The "membri" tab has grown into a results/gradebook view that reads very
  // differently for each role — a full class roster for the teacher vs. just
  // your own progress for a student — so its tab label is role-aware even
  // though the id/hash stays "membri" for routing.
  function _tabLabel(t) {
    if (t.id === 'membri') return BMAuth.role === 'profesor' ? 'Catalog' : 'Cabinet Personal';
    return t.label;
  }

  let classData  = null;
  let activeTab  = 'flux';
  let temeCache  = [];
  let wz         = null;
  let simCache   = [];
  let simWiz     = null;
  let simPicker  = null;
  // Persists across loadMembriTab() reloads (e.g. realtime-triggered ones)
  // within the same visit so a teacher's chosen sort doesn't reset itself;
  // key is 'avg' or a simulation id, dir is 'desc' | 'asc' | null.
  let catalogSortState = { key: null, dir: null };

  /* ─── Bootstrap ─────────────────────────────────────────────────── */
  function init() {
    BM.initScrollTop();

    const classId = new URLSearchParams(location.search).get('id');
    if (!classId) { hardRedirect(); return; }

    if (window._bmAuthReady) {
      handleAuthReady(classId);
    } else {
      document.addEventListener('bmauth:ready', () => handleAuthReady(classId), { once: true });
    }
  }

  /* ─── Auth gate ─────────────────────────────────────────────────── */
  function handleAuthReady(classId) {
    if (!BMAuth.user) {
      window.location.replace(
        'auth.html?from=' + encodeURIComponent('class.html?id=' + classId)
      );
      return;
    }
    /* Role is set after bmauth:synced — may already be available */
    if (BMAuth.role) {
      checkAccess(classId);
    } else {
      showLoading('Se verifică accesul...');
      document.addEventListener('bmauth:synced', () => checkAccess(classId), { once: true });
    }
  }

  /* ─── Access control ────────────────────────────────────────────── */
  async function checkAccess(classId) {
    showLoading('Se verifică accesul...');

    /* 1. Fetch the class */
    let cls = null;
    try {
      const { data, error } = await BMAuth.supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .maybeSingle();
      if (error) throw error;
      cls = data;
    } catch (e) {
      hardRedirect();
      return;
    }

    if (!cls) { hardRedirect(); return; }

    /* 2. Role-based access check */
    if (BMAuth.role === 'profesor') {
      if (cls.teacher_id !== BMAuth.user.id) { hardRedirect(); return; }
    } else {
      /* Student: must be in class_members */
      try {
        const { data: membership } = await BMAuth.supabase
          .from('class_members')
          .select('id, student_name')
          .eq('class_id', classId)
          .eq('student_id', BMAuth.user.id)
          .maybeSingle();
        if (!membership) { hardRedirect(); return; }

        /* Self-heal: some older memberships predate the student_name column
           (or were added before BMAuth.displayName() was captured at join
           time) and show up as "Elev N" in the Membri catalog. Backfill it
           silently whenever a student with a missing name visits their class. */
        if (!membership.student_name) {
          BMAuth.supabase.from('class_members')
            .update({ student_name: BMAuth.displayName() })
            .eq('class_id', classId).eq('student_id', BMAuth.user.id)
            .then(() => {}, () => {});
        }
      } catch {
        hardRedirect();
        return;
      }
    }

    classData = cls;
    renderPage();
  }

  function hardRedirect() {
    window.location.replace('classes.html');
  }

  /* ─── Page render ───────────────────────────────────────────────── */
  function renderPage() {
    activeTab = (location.hash.replace('#', '') || 'flux');
    if (!TABS.find(t => t.id === activeTab)) activeTab = 'flux';

    const isTeacher = BMAuth.role === 'profesor';

    document.title = BM.esc(classData.name) + ' — Mathorizon';

    /* Split "Matematică · Miercuri · 15:30" into parts for richer display */
    const nameParts  = classData.name.split(' · ');
    const subject    = nameParts[0] || classData.name;
    const scheduleStr = nameParts.slice(1).join(' · ');

    document.getElementById('classRoot').innerHTML = `
      <div class="cd-wrap">

        <!-- ── Header ─────────────────────────────────────── -->
        <div class="cd-header">

          <!-- Ambient orbs -->
          <div class="cd-header-orbs" aria-hidden="true">
            <div class="cd-orb cd-orb--blue"></div>
            <div class="cd-orb cd-orb--violet"></div>
          </div>

          <!-- Decorative math symbols -->
          <div class="cd-header-deco" aria-hidden="true">
            <span style="--sz:120px;--t:0%;--l:68%">π</span>
            <span style="--sz:90px;--t:40%;--l:84%">∑</span>
            <span style="--sz:150px;--t:-20%;--l:80%">∫</span>
            <span style="--sz:70px;--t:50%;--l:62%">Δ</span>
            <span style="--sz:100px;--t:10%;--l:55%">∞</span>
            <span style="--sz:75px;--t:55%;--l:74%">α</span>
          </div>

          <div class="container" style="position:relative;z-index:1">
            <a class="cd-back" href="classes.html">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Clase
            </a>

            <div class="cd-header__body">
              <div class="cd-header__info">
                <div class="cd-subject-row">
                  <span class="cd-subject-chip">${BM.esc(subject)}</span>
                  ${isTeacher
                    ? `<span class="cd-meta__badge cd-meta__badge--teacher">Profesor</span>`
                    : `<span class="cd-meta__badge cd-meta__badge--student">Elev</span>`
                  }
                </div>
                <div class="cd-title-wrap">
                  <h1 class="cd-title">${BM.esc(classData.name)}</h1>
                </div>
                <div class="cd-meta">
                  <span class="cd-meta__teacher">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                    ${BM.esc(classData.teacher_name)}
                  </span>
                </div>
              </div>

              ${isTeacher ? `
                <div class="cd-invite">
                  <span class="cd-invite__label">Cod invitație</span>
                  <div class="cd-invite__row">
                    <span class="cd-invite__code">${classData.invite_code}</span>
                    <button class="cd-invite__copy" onclick="cdCopyCode('${classData.invite_code}')"
                            title="Copiază">⧉</button>
                  </div>
                  <div class="cd-invite__hint">Partajează cu elevii</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- ── Tab bar (sticky) ───────────────────────────── -->
        <div class="cd-tabs-wrap" id="cdTabsWrap">
          <div class="container">
            <nav class="cd-tabs" role="tablist">
              ${TABS.map(t => `
                <button class="cd-tab${t.id === activeTab ? ' cd-tab--active' : ''}"
                        data-tab="${t.id}" role="tab"
                        aria-selected="${t.id === activeTab}">
                  ${_tabLabel(t)}
                </button>
              `).join('')}
            </nav>
          </div>
        </div>

        <!-- ── Tab content ────────────────────────────────── -->
        <div class="container">
          <div class="cd-content" id="cdContent">
            ${renderTab(activeTab)}
          </div>
        </div>

      </div>
    `;

    /* Tab click handlers */
    document.querySelectorAll('.cd-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    _setupRealtime();
  }

  /* ─── Real-time subscriptions ───────────────────────────────────── */
  let _realtimeChannel = null;
  let _reloadFluxTimer = null;
  let _reloadTemeTimer = null;
  let _reloadMembriTimer = null;
  let _reloadSimulariTimer = null;

  function _debouncedFlux() {
    clearTimeout(_reloadFluxTimer);
    _reloadFluxTimer = setTimeout(() => { if (activeTab === 'flux') loadFluxTab(); }, 350);
  }

  function _debouncedTeme() {
    clearTimeout(_reloadTemeTimer);
    _reloadTemeTimer = setTimeout(() => { if (activeTab === 'teme') loadTemeTab(); }, 350);
  }

  function _debouncedMembri() {
    clearTimeout(_reloadMembriTimer);
    _reloadMembriTimer = setTimeout(() => { if (activeTab === 'membri') loadMembriTab(); }, 500);
  }

  function _debouncedSimulari() {
    clearTimeout(_reloadSimulariTimer);
    _reloadSimulariTimer = setTimeout(() => { if (activeTab === 'simulari' && !_simExamActive) loadSimulariTab(); }, 350);
  }

  function _setupRealtime() {
    if (_realtimeChannel) BMAuth.supabase.removeChannel(_realtimeChannel);

    _realtimeChannel = BMAuth.supabase
      .channel('class-live-' + classData.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'class_posts',
        filter: 'class_id=eq.' + classData.id
      }, _debouncedFlux)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'post_reactions'
      }, _debouncedFlux)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'assignments',
        filter: 'class_id=eq.' + classData.id
      }, _debouncedTeme)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'homework_submissions'
      }, e => { _debouncedTeme(); _debouncedMembri(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'class_members',
        filter: 'class_id=eq.' + classData.id
      }, _debouncedMembri)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'simulations',
        filter: 'class_id=eq.' + classData.id
      }, _debouncedSimulari)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'simulation_attempts'
      }, e => { _debouncedSimulari(); _debouncedMembri(); _debouncedSimLive(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'simulation_answers'
      }, e => { _debouncedSimulari(); _debouncedSimLive(); })
      .subscribe();

    window.addEventListener('beforeunload', () => {
      BMAuth.supabase.removeChannel(_realtimeChannel);
    }, { once: true });
  }

  /* Reîncarcă datele și reconectează realtime când pagina revine în prim-plan */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      _setupRealtime();
      if (activeTab === 'flux') loadFluxTab();
      else if (activeTab === 'teme') loadTemeTab();
      else if (activeTab === 'membri') loadMembriTab();
      else if (activeTab === 'simulari' && !_simExamActive) loadSimulariTab();
    }
  });

  /* ─── Tab switching ─────────────────────────────────────────────── */
  function switchTab(tabId) {
    if (tabId === activeTab) return;
    activeTab = tabId;

    history.replaceState(null, '', location.pathname + location.search + '#' + tabId);

    document.querySelectorAll('.cd-tab').forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle('cd-tab--active', active);
      btn.setAttribute('aria-selected', active);
    });

    const content = document.getElementById('cdContent');
    if (content) {
      content.classList.add('cd-content--switching');
      setTimeout(() => {
        content.innerHTML = renderTab(tabId);
        content.classList.remove('cd-content--switching');
      }, 120);
    }
  }

  /* ─── Tab content ───────────────────────────────────────────────── */
  function renderTab(tabId) {
    if (tabId === 'flux') {
      requestAnimationFrame(() => loadFluxTab());
      return `
        <div class="cd-tab-layout">
          <div id="fluxFeed" class="flux-feed">
            <div class="classes-loading">
              <div class="classes-spinner"></div>
              <p>Se încarcă anunțurile...</p>
            </div>
          </div>
          <aside class="cd-sidebar" id="fluxSidebar">
            <div class="cd-sidebar-shimmer">
              <div class="cd-sidebar-shimmer__block"></div>
              <div class="cd-sidebar-shimmer__block" style="height:80px"></div>
            </div>
          </aside>
        </div>`;
    }

    if (tabId === 'teme') {
      requestAnimationFrame(() => loadTemeTab());
      return `
        <div class="cd-tab-layout">
          <div id="temeFeed" class="teme-feed">
            <div class="classes-loading">
              <div class="classes-spinner"></div>
              <p>Se încarcă temele...</p>
            </div>
          </div>
          <aside class="cd-sidebar" id="temeSidebar">
            <div class="cd-sidebar-shimmer">
              <div class="cd-sidebar-shimmer__block"></div>
              <div class="cd-sidebar-shimmer__block" style="height:80px"></div>
            </div>
          </aside>
        </div>`;
    }

    if (tabId === 'membri') {
      requestAnimationFrame(() => loadMembriTab());
      return `<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă catalogul...</p></div>`;
    }

    requestAnimationFrame(() => loadSimulariTab());
    return `<div class="classes-loading"><div class="classes-spinner"></div><p>Se încarcă simulările...</p></div>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     FLUX TAB
  ═══════════════════════════════════════════════════════════════ */

  async function loadFluxTab() {
    const container = document.getElementById('fluxFeed');
    if (!container) return;

    const isTeacher = BMAuth.role === 'profesor';
    let posts = [];
    let memberCount = 0;
    let reactionsMap = {};

    try {
      const reactionsQ = isTeacher
        ? BMAuth.supabase.from('post_reactions').select('post_id, user_name')
        : BMAuth.supabase.from('post_reactions').select('post_id').eq('user_id', BMAuth.user.id);

      const [postsRes, membersRes, reactionsRes] = await Promise.all([
        BMAuth.supabase
          .from('class_posts')
          .select('*')
          .eq('class_id', classData.id)
          .order('created_at', { ascending: false }),
        BMAuth.supabase.rpc('get_class_member_count', { p_class_id: classData.id }),
        reactionsQ
      ]);
      if (postsRes.error) throw postsRes.error;
      posts = postsRes.data || [];
      memberCount = membersRes.data ?? 0;

      const reactions = reactionsRes.data || [];
      const postIdSet = new Set(posts.map(p => p.id));
      if (isTeacher) {
        reactions.forEach(r => {
          if (!postIdSet.has(r.post_id)) return;
          if (!reactionsMap[r.post_id]) reactionsMap[r.post_id] = { count: 0, names: [] };
          reactionsMap[r.post_id].count++;
          reactionsMap[r.post_id].names.push(r.user_name);
        });
      } else {
        reactions.forEach(r => { if (postIdSet.has(r.post_id)) reactionsMap[r.post_id] = { liked: true }; });
      }
    } catch (e) {
      container.innerHTML = `
        <div class="flux-empty">
          <div class="flux-empty__icon">⚠️</div>
          <h3>Eroare la încărcare</h3>
          <p>${BM.esc(e.message)}</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      ${isTeacher ? `
        <div class="flux-toolbar">
          <button class="btn btn--primary" id="newPostBtn">+ Anunț Nou</button>
        </div>
      ` : ''}
      <div class="flux-list${posts.length === 0 ? ' flux-list--empty' : ''}" id="fluxList">
        ${posts.length === 0
          ? fluxEmpty(isTeacher)
          : posts.map(p => fluxPostCard(p, isTeacher, reactionsMap[p.id] || null)).join('')}
      </div>
    `;

    document.getElementById('newPostBtn')?.addEventListener('click', openPostModal);
    container.querySelectorAll('.flux-post__delete').forEach(btn => {
      btn.addEventListener('click', () => deletePost(btn.dataset.id, btn.dataset.title));
    });

    const sidebar = document.getElementById('fluxSidebar');
    if (sidebar) sidebar.innerHTML = renderFluxSidebar(posts.length, memberCount, isTeacher);

    if (isTeacher) {
      BMAuth.supabase.from('push_subscriptions')
        .delete().eq('user_id', BMAuth.user.id).eq('class_id', classData.id)
        .then(() => {});
    } else {
      BMPush?.init(classData.id);
    }
  }

  function fluxEmpty(isTeacher) {
    return `
      <div class="flux-empty">
        <div class="flux-empty__icon">📢</div>
        <h3>Niciun anunț</h3>
        <p>${isTeacher
          ? 'Publicați primul anunț pentru elevii din clasă.'
          : 'Profesorul nu a publicat niciun anunț încă.'}</p>
      </div>
    `;
  }

  function fluxPostCard(post, isTeacher, reactionData) {
    const words    = post.author_name.trim().split(/\s+/);
    const initials = words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : post.author_name.slice(0, 2).toUpperCase();

    const date = new Date(post.created_at);
    const dateStr = date.toLocaleDateString('ro-RO', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('ro-RO', {
      hour: '2-digit', minute: '2-digit'
    });
    const contentHTML = BM.esc(post.content).replace(/\n/g, '<br>');

    let reactionBtn = '';
    if (isTeacher) {
      const count = reactionData?.count ?? 0;
      const label = count === 1 ? 'confirmare' : 'confirmări';
      const namesJson = BM.esc(JSON.stringify(reactionData?.names ?? []));
      reactionBtn = `
        <button class="flux-like-btn flux-like-btn--teacher"
                data-post-id="${post.id}"
                data-names="${namesJson}"
                onclick="fluxShowReaders(this)">
          👁 ${count} ${label}
        </button>`;
    } else {
      const liked = reactionData?.liked ?? false;
      reactionBtn = `
        <button class="flux-like-btn${liked ? ' flux-like-btn--active' : ''}"
                data-post-id="${post.id}"
                onclick="fluxToggleLike('${post.id}', this)">
          ${liked ? '✓ Citit' : '✓ Marchează citit'}
        </button>`;
    }

    return `
      <div class="flux-post">
        <div class="flux-post__topbar">
          <span class="flux-post__badge">📢 Anunț</span>
          <div class="flux-post__topbar-right">
            <span class="flux-post__date" title="${dateStr}, ${timeStr}">${dateStr}</span>
            ${isTeacher ? `
              <button class="flux-post__delete"
                      data-id="${post.id}"
                      data-title="${BM.esc(post.title)}"
                      title="Șterge anunțul">✕</button>
            ` : ''}
          </div>
        </div>
        <div class="flux-post__body">
          <h3 class="flux-post__title">${BM.esc(post.title)}</h3>
          <div class="flux-post__content">${contentHTML}</div>
        </div>
        <div class="flux-post__footer">
          <div class="flux-post__footer-left">
            <span class="flux-post__avatar">${initials}</span>
            <span class="flux-post__author">${BM.esc(post.author_name)}</span>
          </div>
          <div class="flux-post__footer-right">
            ${reactionBtn}
          </div>
        </div>
      </div>
    `;
  }

  /* ─── Create post modal ─────────────────────────────────────────── */
  function openPostModal() {
    document.getElementById('postModal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'classes-modal';
    modal.id = 'postModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="classes-modal__backdrop" id="postModalBackdrop"></div>
      <div class="classes-modal__dialog">
        <div class="classes-modal__head">
          <h3>Anunț Nou</h3>
          <button class="icon-btn" id="closePostModalBtn">✕</button>
        </div>
        <div class="classes-modal__body">
          <div class="cls-form-field">
            <label class="cls-form-label">Titlu *</label>
            <input type="text" id="postTitleInput" class="cls-form-input"
                   placeholder="ex: Temă pentru săptămâna viitoare…" maxlength="100">
          </div>
          <div class="cls-form-field">
            <label class="cls-form-label">Conținut *</label>
            <textarea id="postContentInput" class="cls-form-input cls-form-textarea"
                      placeholder="Scrieți anunțul pentru elevi…" rows="6"></textarea>
          </div>
        </div>
        <div class="classes-modal__foot">
          <button class="btn btn--surface" id="cancelPostBtn">Anulează</button>
          <button class="btn btn--primary" id="confirmPostBtn">Publică Anunțul</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const close = () => { modal.remove(); document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
    modal.querySelector('#closePostModalBtn').onclick  = close;
    modal.querySelector('#cancelPostBtn').onclick      = close;
    modal.querySelector('#postModalBackdrop').onclick  = close;
    modal.querySelector('#confirmPostBtn').onclick     = confirmCreatePost;
    modal.querySelector('#postTitleInput').focus();
  }

  async function confirmCreatePost() {
    const title   = document.getElementById('postTitleInput')?.value.trim();
    const content = document.getElementById('postContentInput')?.value.trim();

    if (!title) {
      BM.toast('Introduceți titlul anunțului.', 'error');
      document.getElementById('postTitleInput')?.focus();
      return;
    }
    if (!content) {
      BM.toast('Introduceți conținutul anunțului.', 'error');
      document.getElementById('postContentInput')?.focus();
      return;
    }

    const btn = document.getElementById('confirmPostBtn');
    btn.disabled    = true;
    btn.textContent = 'Se publică…';

    try {
      const { error } = await BMAuth.supabase
        .from('class_posts')
        .insert({
          class_id:    classData.id,
          author_id:   BMAuth.user.id,
          author_name: BMAuth.displayName(),
          title,
          content
        });
      if (error) throw error;
      document.getElementById('postModal')?.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      BM.toast('Anunțul a fost publicat!', 'success');
      BMPush?.sendClassPush(classData.id, 'announcement');
      await loadFluxTab();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
      btn.disabled    = false;
      btn.textContent = 'Publică Anunțul';
    }
  }

  async function deletePost(postId, postTitle) {
    const ok = await showConfirmDialog({
      icon:        '🗑️',
      title:       'Ștergi anunțul?',
      message:     '„' + postTitle + '" va fi șters definitiv.',
      confirmText: 'Șterge'
    });
    if (!ok) return;

    try {
      const { error } = await BMAuth.supabase
        .from('class_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
      BM.toast('Anunțul a fost șters.', 'info');
      await loadFluxTab();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TEME TAB
  ═══════════════════════════════════════════════════════════════ */

  const WZ_TYPES = [
    { id: 'text',      icon: '📝', label: 'Text',           desc: 'Instrucțiuni, explicații' },
    { id: 'pdf',       icon: '📄', label: 'PDF / Document',  desc: 'Fișă, manual, referat' },
    { id: 'image',     icon: '🖼️', label: 'Imagini',         desc: 'Poze, scheme, diagrame' },
    { id: 'link',      icon: '🔗', label: 'Link extern',     desc: 'Site, articol, resursă' },
    { id: 'exercise',  icon: '📚', label: 'Exerciții',       desc: 'Întrebări interactive', soon: true },
    { id: 'ai_import', icon: '🤖', label: 'Import AI',       desc: 'Din poză sau PDF', soon: true },
  ];

  async function loadTemeTab() {
    const container = document.getElementById('temeFeed');
    if (!container) return;

    const isTeacher = BMAuth.role === 'profesor';
    let assignments = [];

    try {
      const { data, error } = await BMAuth.supabase
        .from('assignments')
        .select('*')
        .eq('class_id', classData.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      assignments = data || [];

      if (assignments.length > 0) {
        const ids = assignments.map(a => a.id);
        const { data: blocksData } = await BMAuth.supabase
          .from('assignment_blocks')
          .select('*')
          .in('assignment_id', ids)
          .order('position', { ascending: true });

        const blocksMap = {};
        (blocksData || []).forEach(b => {
          if (!blocksMap[b.assignment_id]) blocksMap[b.assignment_id] = [];
          blocksMap[b.assignment_id].push(b);
        });
        assignments.forEach(a => { a._blocks = blocksMap[a.id] || []; });

        /* Fetch submission info pentru indicatorul de pe card */
        if (isTeacher) {
          const [{ data: subRows }, { count: memberCount }] = await Promise.all([
            BMAuth.supabase
              .from('homework_submissions')
              .select('assignment_id')
              .in('assignment_id', ids),
            BMAuth.supabase
              .from('class_members')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', classData.id)
          ]);
          const countMap = {};
          (subRows || []).forEach(s => {
            countMap[s.assignment_id] = (countMap[s.assignment_id] || 0) + 1;
          });
          assignments.forEach(a => {
            a._subInfo = { count: countMap[a.id] || 0, total: memberCount || 0 };
          });
        } else {
          const { data: mySubs } = await BMAuth.supabase
            .from('homework_submissions')
            .select('assignment_id, grade, grade_confirmed')
            .eq('student_id', BMAuth.user.id)
            .in('assignment_id', ids);
          const subMap = {};
          (mySubs || []).forEach(s => { subMap[s.assignment_id] = s; });
          assignments.forEach(a => { a._subInfo = subMap[a.id] || null; });
        }
      }
    } catch (e) {
      container.innerHTML = `
        <div class="teme-empty">
          <div class="teme-empty__icon">⚠️</div>
          <h3>Eroare la încărcare</h3>
          <p>${BM.esc(e.message)}</p>
        </div>`;
      return;
    }

    temeCache = assignments;

    container.innerHTML = `
      ${isTeacher ? `
        <div class="teme-toolbar">
          <button class="btn btn--primary" id="newAssignmentBtn">+ Temă Nouă</button>
        </div>
      ` : ''}
      <div class="teme-list${assignments.length === 0 ? ' teme-list--empty' : ''}" id="temeList">
        ${assignments.length === 0
          ? temeEmpty(isTeacher)
          : assignments.map(a => assignmentCard(a, a._blocks || [], isTeacher)).join('')}
      </div>
    `;

    document.getElementById('newAssignmentBtn')
      ?.addEventListener('click', () => openAssignmentWizard());

    container.querySelectorAll('.teme-assignment__edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = temeCache.find(x => x.id === btn.dataset.id);
        if (a) openAssignmentWizard(a);
      });
    });

    container.querySelectorAll('.teme-assignment__delete').forEach(btn => {
      btn.addEventListener('click', () =>
        deleteAssignment(btn.dataset.id, btn.dataset.title));
    });

    container.querySelector('#temeList')?.addEventListener('click', e => {
      if (e.target.closest('.teme-assignment__actions')) return;
      const card = e.target.closest('.teme-assignment--clickable');
      if (!card) return;
      const a = temeCache.find(x => x.id === card.dataset.id);
      if (a) openAssignmentView(a, a._blocks || []);
    });

    const sidebar = document.getElementById('temeSidebar');
    if (sidebar) sidebar.innerHTML = renderTemeSidebar(assignments);
  }

  function temeEmpty(isTeacher) {
    return `
      <div class="teme-empty">
        <div class="teme-empty__icon">📝</div>
        <h3>${isTeacher ? 'Nicio temă creată' : 'Nicio temă disponibilă'}</h3>
        <p>${isTeacher
          ? 'Adaugă prima temă pentru elevii din clasă.'
          : 'Profesorul nu a adăugat nicio temă încă.'}</p>
      </div>
    `;
  }

  function dueBadge(dueDateStr) {
    const [y, m, d] = dueDateStr.split('-').map(Number);
    const due  = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diff < 0)  return { text: 'Expirat',        cls: 'overdue' };
    if (diff === 0) return { text: 'Azi',            cls: 'urgent'  };
    if (diff === 1) return { text: 'Mâine',          cls: 'urgent'  };
    if (diff <= 3)  return { text: diff + ' zile',   cls: 'soon'    };
    return               { text: diff + ' zile',   cls: 'ok'      };
  }

  function assignmentCard(a, blocks, isTeacher) {
    const badge = dueBadge(a.due_date);
    const [y, m, d] = a.due_date.split('-').map(Number);
    const formattedRaw = new Date(y, m - 1, d).toLocaleDateString('ro-RO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const formatted = formattedRaw.charAt(0).toUpperCase() + formattedRaw.slice(1);

    const typeIconMap = { text:'📝', pdf:'📄', document:'📄', image:'🖼️',
                          video:'🎥', link:'🔗', exercise:'📚', ai_import:'🤖', file:'📂' };
    const blockChips = blocks.map(b => {
      const icon = typeIconMap[b.type] || '📌';
      let label;
      if (['pdf', 'image', 'file', 'document'].includes(b.type)) {
        const items = b.data?.items || [];
        if (items.length === 1) {
          label = items[0].filename;
        } else if (items.length > 1) {
          label = `${items[0].filename} +${items.length - 1}`;
        } else {
          label = (WZ_TYPES.find(t => t.id === b.type) || { label: b.type }).label;
        }
      } else if (b.type === 'link') {
        label = b.data?.title || b.data?.url || 'Link extern';
      } else {
        label = (WZ_TYPES.find(t => t.id === b.type) || { label: b.type }).label;
      }
      return `<span class="teme-block-chip" title="${BM.esc(label)}">${icon} ${BM.esc(label)}</span>`;
    }).join('');

    const desc = a.instructions || a.description || '';

    const typeIcon = typeIconMap[blocks[0]?.type] || '📋';

    return `
      <div class="teme-assignment teme-assignment--${badge.cls} teme-assignment--clickable"
           data-id="${a.id}">
        <div class="teme-assignment__main">
          <div class="teme-assignment__top">
            <h3 class="teme-assignment__title">${BM.esc(a.title)}</h3>
            <span class="teme-assignment__type-icon">${typeIcon}</span>
          </div>
          ${blockChips ? `<div class="teme-assignment__chips">${blockChips}</div>` : ''}
          ${desc ? `<p class="teme-assignment__desc">${BM.esc(desc).replace(/\n/g, '<br>')}</p>` : ''}
        </div>
        <div class="teme-assignment__footer teme-assignment__footer--${badge.cls}">
          <div class="teme-assignment__footer-left">
            <span class="teme-assignment__due teme-assignment__due--${badge.cls}">◷ ${badge.text}</span>
            <span class="teme-assignment__date">📅 ${formatted}</span>
            ${isTeacher
              ? `<span class="teme-sub-counter">📤 ${a._subInfo?.count ?? 0}/${a._subInfo?.total ?? 0} predate</span>`
              : a._subInfo
                ? a._subInfo.grade_confirmed
                  ? `<span class="teme-sub-badge teme-sub-badge--graded" data-sub-badge="${a.id}">⭐ Notă: ${a._subInfo.grade}</span>`
                  : `<span class="teme-sub-badge teme-sub-badge--done" data-sub-badge="${a.id}">✅ Predată</span>`
                : `<span class="teme-sub-badge teme-sub-badge--none" data-sub-badge="${a.id}">📤 Nepredată</span>`
            }
          </div>
          ${isTeacher ? `
            <div class="teme-assignment__actions">
              <button class="teme-assignment__edit" data-id="${a.id}" title="Editează">✎</button>
              <button class="teme-assignment__delete" data-id="${a.id}"
                      data-title="${BM.esc(a.title)}" title="Șterge">✕</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /* ─── Sidebar renderers ─────────────────────────────────────────── */
  function renderFluxSidebar(postCount, memberCount, isTeacher) {
    const nameParts = classData.name.split(' · ');
    const subject   = nameParts[0];
    const schedule  = nameParts.slice(1).join(' · ');

    const subjectIcons = { 'matematică': '📐', 'fizică': '⚛️', 'chimie': '🧪', 'biologie': '🌿', 'informatică': '💻', 'istorie': '📜', 'geografie': '🌍', 'limba română': '📖', 'română': '📖', 'limba engleză': '🇬🇧', 'engleză': '🇬🇧', 'franceză': '🇫🇷' };
    const icon = subjectIcons[subject.toLowerCase()] || '📚';

    const mathLevelMap = {
      '9-10': { label: 'Foarte bun', cls: 'cd-level--green' },
      '7-8':  { label: 'OK',         cls: 'cd-level--blue'  },
      '6-7':  { label: 'Așa și așa', cls: 'cd-level--amber' },
      '5-6':  { label: 'Slab',       cls: 'cd-level--red'   },
    };
    const lvl      = classData.math_level ? mathLevelMap[classData.math_level] : null;
    const maxEl    = classData.max_students;
    const grade    = classData.school_grade;

    const detailsHTML = (maxEl || grade || lvl) ? `
      <div class="cd-info-card__details">
        ${grade ? `
        <div class="cd-info-card__detail">
          <span class="cd-info-card__detail-icon">🎓</span>
          <span class="cd-info-card__detail-lbl">Clasa</span>
          <span class="cd-info-card__detail-val">${BM.esc(grade)}</span>
        </div>` : ''}
        ${maxEl ? `
        <div class="cd-info-card__detail">
          <span class="cd-info-card__detail-icon">👥</span>
          <span class="cd-info-card__detail-lbl">Mărime grupă</span>
          <span class="cd-info-card__detail-val">${maxEl === 1 ? 'Individual' : `${maxEl} elevi`}</span>
        </div>` : ''}
        ${lvl ? `
        <div class="cd-info-card__detail">
          <span class="cd-info-card__detail-icon">📊</span>
          <span class="cd-info-card__detail-lbl">Nivel</span>
          <span class="cd-level-badge ${lvl.cls}">${BM.esc(classData.math_level)} · ${lvl.label}</span>
        </div>` : ''}
      </div>` : '';

    return `
      <div class="cd-info-card">
        <div class="cd-info-card__strip"></div>
        <div class="cd-info-card__inner">
          <div class="cd-info-card__main">
            <div class="cd-info-card__icon">${icon}</div>
            <div class="cd-info-card__subject">${BM.esc(subject)}</div>
            ${schedule ? `<div class="cd-info-card__schedule">🗓 ${BM.esc(schedule)}</div>` : ''}
          </div>
          <div class="cd-info-card__stats">
            <div class="cd-info-card__stat">
              <span class="cd-info-card__stat-val">${postCount}</span>
              <span class="cd-info-card__stat-lbl">anunțuri</span>
            </div>
          </div>
          ${detailsHTML}
        </div>
      </div>
      ${!isTeacher && ('Notification' in window) ? `
      <button class="cd-notif-btn" onclick="cdOpenNotifInfo('${classData.id}')">
        🔔 Gestionează notificările
      </button>` : ''}
    `;
  }

  window.cdOpenNotifInfo = function (classId) {
    document.getElementById('notifInfoModal')?.remove();
    const blocked = ('Notification' in window) && Notification.permission === 'denied';
    const modal = document.createElement('div');
    modal.id = 'notifInfoModal';
    modal.className = 'classes-modal';
    modal.innerHTML = `
      <div class="classes-modal__backdrop"></div>
      <div class="classes-modal__dialog">
        <div class="classes-modal__head">
          <h3>🔔 Notificări pentru această clasă</h3>
          <button class="icon-btn" id="notifInfoCloseBtn">✕</button>
        </div>
        <div class="classes-modal__body">
          <p class="notif-info__p">Activând notificările, primești un mesaj pe telefon/calculator (chiar și cu site-ul închis) când profesorul:</p>
          <ul class="notif-info__list">
            <li>📢 postează un anunț nou în clasă</li>
            <li>📝 adaugă o temă nouă</li>
            <li>🎯 programează sau pornește o simulare</li>
          </ul>
          <p class="notif-info__p">Apasă butonul de mai jos <strong>doar dacă nu primești deja notificări</strong> — de exemplu dacă ai apăsat din greșeală „Refuză" la întrebarea browserului, sau dacă vrei să le activezi pe un dispozitiv nou.</p>
          ${blocked ? `
          <p class="notif-info__p notif-info__p--warn">⚠️ Browserul are notificările blocate pentru acest site. Trebuie mai întâi să le permiți din setările browserului (de obicei lângă bara de adrese, iconița 🔒/ⓘ), altfel butonul de mai jos nu va avea efect.</p>` : ''}
        </div>
        <div class="classes-modal__foot">
          <button class="btn btn--surface" id="notifInfoCancelBtn">Închide</button>
          <button class="btn btn--primary" id="notifInfoConfirmBtn">Activează notificările</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.classes-modal__backdrop').onclick = close;
    modal.querySelector('#notifInfoCloseBtn').onclick = close;
    modal.querySelector('#notifInfoCancelBtn').onclick = close;
    modal.querySelector('#notifInfoConfirmBtn').onclick = () => { close(); window.BMPush?.resubscribe(classId); };
  };

  function renderTemeSidebar(assignments) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue  = assignments.filter(a => {
      const [y, m, d] = a.due_date.split('-').map(Number);
      return new Date(y, m - 1, d) < today;
    }).length;
    const active = assignments.length - overdue;

    const next3 = assignments
      .filter(a => {
        const [y, m, d] = a.due_date.split('-').map(Number);
        return new Date(y, m - 1, d) >= today;
      })
      .slice(0, 3);

    return `
      <div class="cd-sidebar-widget">
        <div class="cd-sidebar-widget__title">Rezumat Teme</div>
        <div class="cd-sidebar-stat">
          <span class="cd-sidebar-stat__icon">📝</span>
          <span>${assignments.length} ${assignments.length === 1 ? 'temă' : 'teme'} total</span>
        </div>
        ${active > 0 ? `
          <div class="cd-sidebar-stat">
            <span class="cd-sidebar-stat__dot cd-sidebar-stat__dot--ok"></span>
            <span>${active} active</span>
          </div>
        ` : ''}
        ${overdue > 0 ? `
          <div class="cd-sidebar-stat">
            <span class="cd-sidebar-stat__dot cd-sidebar-stat__dot--overdue"></span>
            <span>${overdue} expirate</span>
          </div>
        ` : ''}
        ${assignments.length === 0 ? `
          <div class="cd-sidebar-stat" style="opacity:0.6">
            <span class="cd-sidebar-stat__icon">—</span>
            <span>Nicio temă adăugată</span>
          </div>
        ` : ''}
      </div>

      ${next3.length > 0 ? `
        <div class="cd-sidebar-widget">
          <div class="cd-sidebar-widget__title">Termene Apropiate</div>
          ${next3.map(a => {
            const badge = dueBadge(a.due_date);
            return `
              <div class="cd-sidebar-deadline">
                <span class="cd-sidebar-deadline__title">${BM.esc(a.title)}</span>
                <span class="teme-assignment__due teme-assignment__due--${badge.cls}"
                      style="font-size:0.72rem;padding:2px 8px">◷ ${badge.text}</span>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    `;
  }

  /* ═══════════════════════════════════════════════════════════════
     MEMBRI TAB — electronic gradebook catalog
  ═══════════════════════════════════════════════════════════════ */

  function _catalogInitials(name) {
    const parts = (name || '').split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name || '?').slice(0, 2).toUpperCase();
  }

  // Shared red/amber/green tiering for any displayed grade value (single
  // grade cells, per-student Medie, per-column Medie clasă) — one place so
  // the three tiers (and their thresholds) can't drift apart between them.
  function _catalogGradeTier(g) {
    if (g == null || isNaN(g)) return null;
    return g >= 7 ? 'hi' : g >= 5 ? 'mid' : 'lo';
  }

  async function loadMembriTab() {
    const content = document.getElementById('cdContent');
    if (!content) return;

    const isTeacher = BMAuth.role === 'profesor';

    // Settle any simulation whose time limit has already elapsed before
    // reading grades. A pg_cron job (see the "expiry_sweep_cron" migration)
    // already does this every minute regardless of any page being open —
    // this call is just a defensive fallback in case that job isn't
    // available on this Supabase plan. Best-effort: a failure here
    // shouldn't block loading whatever grades already exist.
    try { await BMAuth.supabase.rpc('run_simulation_expiry_sweep'); } catch (e) {}

    try {
      /* 1. Class members — try to include student_name (column may not exist yet) */
      let { data: members, error: memErr } = await BMAuth.supabase
        .from('class_members')
        .select('student_id, student_name, joined_at')
        .eq('class_id', classData.id)
        .order('joined_at', { ascending: true });
      if (memErr) {
        /* Fallback: column doesn't exist yet — select without it */
        ({ data: members, error: memErr } = await BMAuth.supabase
          .from('class_members')
          .select('student_id, joined_at')
          .eq('class_id', classData.id)
          .order('joined_at', { ascending: true }));
        if (memErr) throw memErr;
      }

      if (!members || members.length === 0) {
        content.innerHTML = `
          <div class="cd-placeholder">
            <div class="cd-placeholder__icon">👥</div>
            <h3 class="cd-placeholder__title">Niciun elev</h3>
            <p class="cd-placeholder__desc">Partajează codul de invitație pentru a adăuga elevi în clasă.</p>
          </div>`;
        return;
      }

      /* 2. Build nameMap — primary: class_members.student_name */
      const nameMap = {};
      members.forEach(m => { if (m.student_name) nameMap[m.student_id] = m.student_name; });

      const studentIds = members.map(m => m.student_id);

      /* Supplement from post_reactions (covers members who joined before student_name was stored) */
      const { data: classPosts } = await BMAuth.supabase
        .from('class_posts')
        .select('id')
        .eq('class_id', classData.id);
      if (classPosts && classPosts.length > 0) {
        const postIds = classPosts.map(p => p.id);
        const { data: reactions } = await BMAuth.supabase
          .from('post_reactions')
          .select('user_id, user_name')
          .in('post_id', postIds);
        (reactions || []).forEach(r => {
          if (!nameMap[r.user_id] && r.user_name) nameMap[r.user_id] = r.user_name;
        });
      }

      /* 3. Assignments for this class */
      const { data: rawAssign, error: aErr } = await BMAuth.supabase
        .from('assignments')
        .select('id, title, due_date, points')
        .eq('class_id', classData.id)
        .order('due_date', { ascending: true });
      if (aErr) throw aErr;
      const assignments = rawAssign || [];

      /* 4. All submissions */
      const subMatrix = {}; /* [studentId][assignmentId] */
      if (assignments.length > 0) {
        const aIds = assignments.map(a => a.id);
        const { data: subs } = await BMAuth.supabase
          .from('homework_submissions')
          .select('assignment_id, student_id, student_name, grade, grade_confirmed, submitted_at')
          .in('assignment_id', aIds);
        (subs || []).forEach(s => {
          if (!nameMap[s.student_id] && s.student_name) nameMap[s.student_id] = s.student_name;
          if (!subMatrix[s.student_id]) subMatrix[s.student_id] = {};
          subMatrix[s.student_id][s.assignment_id] = s;
        });
      }

      /* 5. Simulări — finished attempts merge into the same Medie averages */
      const { data: rawSims } = await BMAuth.supabase
        .from('simulations').select('id, title, created_at, started_at, scheduled_at').eq('class_id', classData.id)
        .order('created_at', { ascending: true });
      const sims = rawSims || [];

      const simMatrix = {}; /* [studentId][simulationId] — latest finalized attempt only */
      if (sims.length > 0) {
        const simIds = sims.map(s => s.id);
        // A student can have multiple finalized attempts for the same
        // simulation after a teacher reopens + they retake it — order
        // ascending so each forEach iteration below overwrites with a
        // newer row, leaving only the LATEST attempt per (student,
        // simulation) pair by the time the loop finishes. This is what
        // makes a retake's grade replace the old one in Catalog/averages
        // without ever deleting the older simulation_attempts row itself.
        const { data: simAttempts } = await BMAuth.supabase
          .from('simulation_attempts')
          .select('id, simulation_id, student_id, student_name, grade_10, status, earned_points, total_points, started_at')
          .eq('status', 'finalizata')
          .in('simulation_id', simIds)
          .order('started_at', { ascending: true });
        (simAttempts || []).forEach(a => {
          if (!nameMap[a.student_id] && a.student_name) nameMap[a.student_id] = a.student_name;
          if (!simMatrix[a.student_id]) simMatrix[a.student_id] = {};
          simMatrix[a.student_id][a.simulation_id] = a;
        });
      }

      /* Compute catalog-level stats */
      const allConfirmedGrades = [];
      members.forEach(m => {
        assignments.forEach(a => {
          const sub = (subMatrix[m.student_id] || {})[a.id];
          if (sub?.grade_confirmed) allConfirmedGrades.push(parseFloat(sub.grade));
        });
        sims.forEach(s => {
          const att = (simMatrix[m.student_id] || {})[s.id];
          if (att?.grade_10 != null) allConfirmedGrades.push(parseFloat(att.grade_10));
        });
      });
      const classAvg = allConfirmedGrades.length
        ? (allConfirmedGrades.reduce((t, g) => t + g, 0) / allConfirmedGrades.length).toFixed(1)
        : null;

      const catalogStats = {
        memberCount: members.length,
        assignmentCount: assignments.length,
        classAvg
      };

      const renderCatalog = () => {
        if (isTeacher) {
          content.innerHTML = renderCatalogTeacher(members, nameMap, assignments, subMatrix, catalogStats, sims, simMatrix, catalogSortState);
          content.querySelectorAll('[data-quick-view-attempt]').forEach(cell => {
            cell.addEventListener('click', () => openSimQuickView(cell.dataset.quickViewAttempt));
          });
          // Re-sorts by re-rendering from the SAME already-fetched data — no
          // refetch, and members/assignments/sims/simMatrix themselves are
          // never mutated, only the order rows are displayed in.
          content.querySelectorAll('[data-sort-key]').forEach(th => {
            th.addEventListener('click', () => {
              const key = th.dataset.sortKey;
              if (catalogSortState.key !== key) catalogSortState = { key, dir: 'desc' };
              else if (catalogSortState.dir === 'desc') catalogSortState = { key, dir: 'asc' };
              else catalogSortState = { key: null, dir: null };
              renderCatalog();
            });
          });
          _wireCatalogExport(members, nameMap, assignments, subMatrix, sims, simMatrix, catalogStats, catalogSortState);
        } else {
          content.innerHTML = renderCatalogStudent(assignments, subMatrix[BMAuth.user.id] || {}, nameMap[BMAuth.user.id], sims, simMatrix[BMAuth.user.id] || {});
          _wireCsSimViewToggle(content);
          _wireNotesChartTooltip(content);
          _finalizeNotesChart(content);
        }
      };
      renderCatalog();

    } catch (e) {
      content.innerHTML = `
        <div class="cd-placeholder">
          <div class="cd-placeholder__icon">⚠️</div>
          <h3 class="cd-placeholder__title">Eroare la încărcare</h3>
          <p class="cd-placeholder__desc">${BM.esc(e.message)}</p>
        </div>`;
    }
  }

  function _catalogSortArrow(key, sortState) {
    if (!sortState || sortState.key !== key) return '';
    return `<span class="catalog-th__sort-arrow">${sortState.dir === 'asc' ? '▲' : '▼'}</span>`;
  }

  // Shared by renderCatalogTeacher (on-screen) and the PDF/Excel export —
  // one source of truth for per-student averages and sort order, so an
  // export can never silently drift from what's actually on screen.
  function _catalogBuildRows(members, nameMap, assignments, sims, subMatrix, simMatrix) {
    return members.map((m, idx) => {
      const name = nameMap[m.student_id] || ('Elev ' + (idx + 1));
      const mySubs = subMatrix[m.student_id] || {};
      const mySims = simMatrix[m.student_id] || {};
      const myGrades = assignments
        .map(a => (mySubs[a.id]?.grade_confirmed ? parseFloat(mySubs[a.id].grade) : null))
        .filter(g => g !== null)
        .concat(sims.map(s => mySims[s.id]?.grade_10 != null ? parseFloat(mySims[s.id].grade_10) : null).filter(g => g !== null));
      const avgNum = myGrades.length ? myGrades.reduce((t, g) => t + g, 0) / myGrades.length : null;
      return { m, idx, name, mySubs, mySims, avgNum };
    });
  }

  function _catalogSortRows(rows, sortState) {
    if (!sortState?.key || !sortState.dir) return rows;
    const valueFor = row => sortState.key === 'avg'
      ? row.avgNum
      : (row.mySims[sortState.key]?.grade_10 != null ? parseFloat(row.mySims[sortState.key].grade_10) : null);
    // Stable: rows with no value for this column always sink to the bottom
    // (in either direction), ties otherwise keep their relative (original)
    // order.
    return rows
      .map((row, i) => ({ row, i, v: valueFor(row) }))
      .sort((a, b) => {
        if (a.v == null && b.v == null) return a.i - b.i;
        if (a.v == null) return 1;
        if (b.v == null) return -1;
        return sortState.dir === 'asc' ? a.v - b.v : b.v - a.v;
      })
      .map(x => x.row);
  }

  // Shared by renderCatalogTeacher and the export functions — the "Medie
  // clasă" row's per-column averages.
  function _catalogColumnStats(members, assignments, sims, subMatrix, simMatrix) {
    const aStats = {};
    assignments.forEach(a => {
      const grades = members
        .map(m => (subMatrix[m.student_id] || {})[a.id])
        .filter(s => s?.grade_confirmed)
        .map(s => parseFloat(s.grade));
      aStats[a.id] = grades.length
        ? (grades.reduce((t, g) => t + g, 0) / grades.length).toFixed(1)
        : '—';
    });
    const sStats = {};
    sims.forEach(s => {
      const grades = members
        .map(m => (simMatrix[m.student_id] || {})[s.id])
        .filter(a => a?.grade_10 != null)
        .map(a => parseFloat(a.grade_10));
      sStats[s.id] = grades.length
        ? (grades.reduce((t, g) => t + g, 0) / grades.length).toFixed(1)
        : '—';
    });
    return { aStats, sStats };
  }

  function renderCatalogTeacher(members, nameMap, assignments, subMatrix, stats = {}, sims = [], simMatrix = {}, sortState = {}) {
    const { aStats, sStats } = _catalogColumnStats(members, assignments, sims, subMatrix, simMatrix);

    const headerCells = assignments.map(a => {
      const [y, mo, d] = a.due_date.split('-').map(Number);
      const ds = new Date(y, mo - 1, d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
      return `
        <div class="catalog-th" title="${BM.esc(a.title)} — temă">
          <span class="catalog-th__title">📝 ${BM.esc(a.title)}</span>
          <span class="catalog-th__date">${ds}</span>
        </div>`;
    }).join('');

    const simHeaderCells = sims.map(s => {
      const ds = _simColDate(s);
      return `
        <div class="catalog-th catalog-th--sim catalog-th--sortable" data-sort-key="${s.id}" title="${BM.esc(s.title)} — simulare — click pentru sortare">
          <span class="catalog-th__title">🎯 ${BM.esc(s.title)}${_catalogSortArrow(s.id, sortState)}</span>
          <span class="catalog-th__date">${ds}</span>
        </div>`;
    }).join('');

    // Sorting only ever reorders this array — subMatrix/simMatrix/members
    // themselves are never touched, so nothing about the underlying data
    // changes, and PDF/Excel export reuses the exact same two calls to
    // guarantee it reflects the same order shown on screen.
    const rows = _catalogSortRows(
      _catalogBuildRows(members, nameMap, assignments, sims, subMatrix, simMatrix),
      sortState
    );

    const studentRows = rows.map(({ name, mySubs, mySims, avgNum }) => {
      const cells = assignments.map(a => {
        const sub = mySubs[a.id];
        if (!sub) return `<div class="catalog-td catalog-td--none" title="Nepredat">—</div>`;
        if (sub.grade_confirmed) {
          const g = parseFloat(sub.grade);
          const cls = _catalogGradeTier(g);
          return `<div class="catalog-td catalog-td--grade catalog-td--${cls}" title="Notă: ${sub.grade}">${sub.grade}</div>`;
        }
        return `<div class="catalog-td catalog-td--submitted" title="Predat, nenotat">✓</div>`;
      }).join('');

      const simCells = sims.map(s => {
        const att = mySims[s.id];
        // grade_10 can be null on a finalized attempt for a simulation that
        // ended up with 0 items (now fixed at creation time, but old/broken
        // rows can still exist) — falls back to the same dash as "didn't
        // take it" instead of literally printing "null".
        if (!att || att.grade_10 == null) return `<div class="catalog-td catalog-td--sim catalog-td--none" title="Neparticipat">—</div>`;
        const g = parseFloat(att.grade_10);
        const cls = _catalogGradeTier(g);
        return `<div class="catalog-td catalog-td--sim catalog-td--grade catalog-td--${cls} catalog-td--clickable" data-quick-view-attempt="${att.id}" title="Vezi detalii rapide">${att.grade_10}</div>`;
      }).join('');

      const avg = avgNum != null ? avgNum.toFixed(1) : '—';
      const avgTier = avgNum != null ? _catalogGradeTier(avgNum) : null;
      const avgCls = avgTier ? `catalog-td--tone-${avgTier}` : '';

      return `
        <div class="catalog-row">
          <div class="catalog-td catalog-td--name">
            <span class="catalog-avatar">${_catalogInitials(name)}</span>
            <span class="catalog-name-text">${BM.esc(name)}</span>
          </div>
          ${cells}
          ${simCells}
          <div class="catalog-td catalog-td--avg ${avgCls}">${avg}</div>
        </div>`;
    }).join('');

    const _statToneCls = val => {
      const tier = val !== '—' ? _catalogGradeTier(parseFloat(val)) : null;
      return tier ? ` catalog-td--tone-${tier}` : '';
    };
    const statsRow = `
      <div class="catalog-row catalog-row--stats">
        <div class="catalog-td catalog-td--name catalog-td--stats-lbl">Medie clasă</div>
        ${assignments.map(a => `<div class="catalog-td catalog-td--stat${_statToneCls(aStats[a.id])}">${aStats[a.id]}</div>`).join('')}
        ${sims.map(s => `<div class="catalog-td catalog-td--stat catalog-td--sim${_statToneCls(sStats[s.id])}">${sStats[s.id]}</div>`).join('')}
        <div class="catalog-td catalog-td--avg"></div>
      </div>`;

    return `
      <div class="catalog-wrap">
        <div class="catalog-statsbar">
          <div class="catalog-stat-card">
            <div class="catalog-stat-card__val">${stats.memberCount ?? members.length}</div>
            <div class="catalog-stat-card__lbl">Elevi</div>
          </div>
          <div class="catalog-stat-card">
            <div class="catalog-stat-card__val">${stats.assignmentCount ?? assignments.length}</div>
            <div class="catalog-stat-card__lbl">Teme</div>
          </div>
          <div class="catalog-stat-card ${stats.classAvg ? 'catalog-stat-card--avg' : ''}">
            <div class="catalog-stat-card__val">${stats.classAvg || '—'}</div>
            <div class="catalog-stat-card__lbl">Medie clasă</div>
          </div>
        </div>
        <div class="catalog-legend">
          <span class="catalog-legend-item"><span class="catalog-dot catalog-dot--grade"></span>Notat</span>
          <span class="catalog-legend-item"><span class="catalog-dot catalog-dot--submitted"></span>Predat, nenotat</span>
          <span class="catalog-legend-item"><span class="catalog-dot catalog-dot--none"></span>Nepredat</span>
          ${(assignments.length > 0 && sims.length > 0) ? `
          <span class="catalog-legend-item catalog-legend-item--sep">📝 Notă din temă · 🎯 Notă din simulare</span>` : ''}
        </div>
        <div class="catalog-scroll">
          <div class="catalog-table">
            <div class="catalog-head">
              <div class="catalog-th catalog-th--name">Elev</div>
              ${headerCells}
              ${simHeaderCells}
              <div class="catalog-th catalog-th--avg catalog-th--sortable" data-sort-key="avg" title="Click pentru sortare">Medie${_catalogSortArrow('avg', sortState)}</div>
            </div>
            <div class="catalog-body">
              ${studentRows}
              ${(assignments.length > 0 || sims.length > 0) ? statsRow : ''}
            </div>
          </div>
        </div>
        <div class="catalog-toolbar">
          <button class="btn btn--surface btn--sm" id="catalogExportPdfBtn">📄 Exportă PDF</button>
          <button class="btn btn--surface btn--sm" id="catalogExportXlsxBtn">📊 Exportă Excel</button>
        </div>
      </div>`;
  }

  /* ─── Catalog export (PDF / Excel) — reuses the exact same row-building
     and sorting as the on-screen table (_catalogBuildRows/_catalogSortRows)
     so an export can never show different numbers or a different order
     than what the teacher is currently looking at. jsPDF+autoTable and
     SheetJS (xlsx) are loaded via CDN <script> tags in class.html, matching
     how every other third-party library in this project is loaded (no npm
     bundling on the frontend) — nothing else in the codebase already does
     PDF/Excel export to reuse. ─── */
  function _catalogExportColumns(assignments, sims) {
    const cols = [{ label: 'Elev', kind: 'name' }];
    assignments.forEach(a => cols.push({ label: a.title, kind: 'assignment', id: a.id }));
    sims.forEach(s => cols.push({ label: s.title, kind: 'sim', id: s.id }));
    cols.push({ label: 'Medie', kind: 'avg' });
    return cols;
  }

  function _catalogExportCellValue(col, row) {
    if (col.kind === 'name') return row.name;
    if (col.kind === 'avg') return row.avgNum != null ? Number(row.avgNum.toFixed(1)) : '';
    if (col.kind === 'assignment') {
      const sub = row.mySubs[col.id];
      if (!sub) return '';
      return sub.grade_confirmed ? Number(parseFloat(sub.grade).toFixed(1)) : '✓';
    }
    const att = row.mySims[col.id];
    return att?.grade_10 != null ? Number(parseFloat(att.grade_10).toFixed(1)) : '';
  }

  function _wireCatalogExport(members, nameMap, assignments, subMatrix, sims, simMatrix, stats, sortState) {
    const pdfBtn  = document.getElementById('catalogExportPdfBtn');
    const xlsxBtn = document.getElementById('catalogExportXlsxBtn');
    if (!pdfBtn || !xlsxBtn) return;

    const cols = _catalogExportColumns(assignments, sims);
    const buildRows = () => _catalogSortRows(
      _catalogBuildRows(members, nameMap, assignments, sims, subMatrix, simMatrix),
      sortState
    );
    // Same "Medie clasă" row shown at the bottom of the on-screen table —
    // per-column averages, not just the single overall stat-card number.
    const buildStatsLine = () => {
      const { aStats, sStats } = _catalogColumnStats(members, assignments, sims, subMatrix, simMatrix);
      return cols.map(col => {
        if (col.kind === 'name') return 'Medie clasă';
        if (col.kind === 'assignment') return aStats[col.id] === '—' ? '' : Number(aStats[col.id]);
        if (col.kind === 'sim') return sStats[col.id] === '—' ? '' : Number(sStats[col.id]);
        return stats?.classAvg ? Number(stats.classAvg) : '';
      });
    };
    const fileBase = `Catalog - ${classData.name} - ${new Date().toLocaleDateString('ro-RO')}`.replace(/[\\/:*?"<>|]/g, '');

    pdfBtn.onclick = () => {
      const jsPDFCtor = window.jspdf?.jsPDF;
      if (!jsPDFCtor || !jsPDFCtor.API?.autoTable) {
        BM.toast('Exportul PDF nu s-a putut încărca — verifică conexiunea și încearcă din nou.', 'error');
        return;
      }
      const rows = buildRows();
      const doc = new jsPDFCtor({ orientation: cols.length > 6 ? 'landscape' : 'portrait' });

      doc.setFontSize(14);
      doc.text(classData.name, 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Catalog — generat pe ${new Date().toLocaleDateString('ro-RO')}`, 14, 22);

      doc.autoTable({
        startY: 28,
        head: [cols.map(c => c.label)],
        body: rows.map(row => cols.map(col => String(_catalogExportCellValue(col, row) ?? ''))),
        foot: [buildStatsLine().map(v => String(v ?? ''))],
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [58, 107, 173] },
        footStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold' } }
      });

      doc.save(`${fileBase}.pdf`);
    };

    xlsxBtn.onclick = () => {
      if (!window.XLSX) {
        BM.toast('Exportul Excel nu s-a putut încărca — verifică conexiunea și încearcă din nou.', 'error');
        return;
      }
      const rows = buildRows();
      const aoa = [cols.map(c => c.label)];
      rows.forEach(row => aoa.push(cols.map(col => _catalogExportCellValue(col, row))));
      aoa.push(buildStatsLine());
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = cols.map(c => ({ wch: c.kind === 'name' ? 22 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalog');
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
    };
  }

  // Persists across re-renders (realtime reloads, visibilitychange, tab
  // revisits) so switching to the chart view doesn't silently snap back to
  // the list the next time loadMembriTab() re-runs in the background.
  let _csNotesView = 'list';

  function _buildStudentNotes(assignments, mySubs, sims, mySimAttempts) {
    const notes = [];
    assignments.forEach(a => {
      const sub = mySubs[a.id];
      notes.push({
        type: 'tema', title: a.title, dateIso: a.due_date,
        grade: sub?.grade_confirmed ? parseFloat(sub.grade) : null,
        status: !sub ? 'none' : sub.grade_confirmed ? 'graded' : 'submitted'
      });
    });
    sims.forEach(s => {
      const att = mySimAttempts[s.id];
      notes.push({
        type: 'simulare', title: s.title, dateIso: s.started_at || s.scheduled_at || s.created_at,
        grade: att?.grade_10 != null ? parseFloat(att.grade_10) : null,
        points: att ? { earned: att.earned_points, total: att.total_points } : null,
        status: !att ? 'none' : att.grade_10 != null ? 'graded' : 'pending'
      });
    });
    return notes;
  }

  function renderCatalogStudent(assignments, mySubs, myName, sims = [], mySimAttempts = {}) {
    const notes = _buildStudentNotes(assignments, mySubs, sims, mySimAttempts);
    const gradedNotes = notes.filter(n => n.grade != null);
    const avg = gradedNotes.length
      ? (gradedNotes.reduce((t, n) => t + n.grade, 0) / gradedNotes.length).toFixed(1)
      : null;
    const submitted = Object.keys(mySubs).length;
    const graded    = gradedNotes.length;

    const sortedNotes = notes.slice().sort((a, b) => new Date(b.dateIso) - new Date(a.dateIso));

    const noteRows = sortedNotes.map(n => {
      const ds = new Date(n.dateIso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
      const icon = n.type === 'simulare' ? '🎯' : '📝';

      let gradeEl = '';
      if (n.status === 'none') {
        gradeEl = `<span class="cs-badge cs-badge--none">${n.type === 'simulare' ? 'Neparticipat' : 'Nepredat'}</span>`;
      } else if (n.status === 'submitted' || n.status === 'pending') {
        gradeEl = `<span class="cs-badge cs-badge--submitted">${n.type === 'simulare' ? 'În lucru' : 'Predat'}</span>`;
      } else {
        const cls = n.grade >= 9 ? 'hi' : n.grade >= 7 ? 'ok' : n.grade >= 5 ? 'mid' : 'lo';
        gradeEl = `
          <span class="cs-grade cs-grade--${cls}">${n.grade}<small>/10</small></span>
          ${n.points ? `<span class="cs-note-pts">${n.points.earned}/${n.points.total}p</span>` : ''}`;
      }

      return `
        <div class="cs-note-row">
          <span class="cs-note-row__icon" title="${n.type === 'simulare' ? 'Simulare' : 'Temă'}">${icon}</span>
          <div class="cs-info">
            <div class="cs-title">${BM.esc(n.title)}</div>
            <div class="cs-date">📅 ${ds}</div>
          </div>
          <div class="cs-grade-col">${gradeEl}</div>
        </div>`;
    }).join('');

    return `
      <div class="catalog-wrap">
        <div class="cs-stats">
          <div class="cs-stat">
            <div class="cs-stat__val${avg ? ' cs-stat__val--grade' : ''}">${avg || '—'}</div>
            <div class="cs-stat__lbl">Medie generală</div>
          </div>
          <div class="cs-stat">
            <div class="cs-stat__val">${submitted}<span class="cs-stat__total">/${assignments.length}</span></div>
            <div class="cs-stat__lbl">Teme predate</div>
          </div>
          <div class="cs-stat">
            <div class="cs-stat__val">${graded}</div>
            <div class="cs-stat__lbl">Note primite</div>
          </div>
        </div>
        <div class="cs-sim-section">
          <div class="cs-sim-section__head">
            <h4 class="cs-sim-section__title">Note curente</h4>
            ${notes.length > 0 ? `
            <div class="cs-view-toggle" id="csSimViewToggle">
              <button type="button" class="cs-view-toggle__btn${_csNotesView === 'list' ? ' cs-view-toggle__btn--active' : ''}" data-view="list">☰ Listă</button>
              <button type="button" class="cs-view-toggle__btn${_csNotesView === 'chart' ? ' cs-view-toggle__btn--active' : ''}" data-view="chart">📊 Grafic</button>
            </div>` : ''}
          </div>
          ${notes.length === 0
            ? '<p class="cs-empty">Profesorul nu a adăugat teme sau simulări încă.</p>'
            : `
              <div class="cs-list" id="csSimListView" style="${_csNotesView === 'chart' ? 'display:none' : ''}">${noteRows}</div>
              <div class="cs-sim-chart-wrap" id="csSimChartView" style="${_csNotesView === 'chart' ? '' : 'display:none'}">${renderNotesChart(notes)}</div>
            `}
        </div>
      </div>`;
  }

  function _wireCsSimViewToggle(content) {
    const toggle = content.querySelector('#csSimViewToggle');
    if (!toggle) return;
    const listView  = content.querySelector('#csSimListView');
    const chartView = content.querySelector('#csSimChartView');
    toggle.querySelectorAll('.cs-view-toggle__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _csNotesView = btn.dataset.view;
        toggle.querySelectorAll('.cs-view-toggle__btn').forEach(b => b.classList.remove('cs-view-toggle__btn--active'));
        btn.classList.add('cs-view-toggle__btn--active');
        const isChart = _csNotesView === 'chart';
        listView.style.display  = isChart ? 'none' : '';
        chartView.style.display = isChart ? '' : 'none';
        if (isChart) _finalizeNotesChart(content);
      });
    });
  }

  // Cached so the post-render width fix-up (below) can rebuild the chart
  // against a wider viewBox without re-fetching/recomputing the notes.
  let _lastChartNotes = [];

  // Single-hue bar chart (one measure — grade over time — so per dataviz
  // convention no legend is needed; temă vs simulare is called out with a
  // small icon + a custom tooltip instead of a second chart color).
  // Real pixel dimensions (not a stretched percent viewBox) so bars keep a
  // fixed width — but the gridlines/axis always span at least minTotalW
  // (the actual on-screen container width, filled in after insertion by
  // _finalizeNotesChart) so a handful of bars don't leave the right side of
  // the card looking empty; once there are enough bars to exceed that width
  // the wrapper scrolls horizontally instead of squeezing them.
  function renderNotesChart(notes, minTotalW) {
    _lastChartNotes = notes;
    const graded = notes
      .filter(n => n.grade != null)
      .sort((a, b) => new Date(a.dateIso) - new Date(b.dateIso));

    if (graded.length === 0) {
      return `<p class="cs-empty">Nicio notă primită încă.</p>`;
    }

    const H = 260, padTop = 36, padBottom = 44, padLeft = 34, padRight = 20;
    const bandW = 52, barW = 20;
    const plotH = H - padTop - padBottom;
    const contentW = padLeft + padRight + bandW * graded.length;
    const totalW = Math.max(contentW, minTotalW || 0);

    const gridLines = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => {
      const y = padTop + plotH - (v / 10) * plotH;
      return `
        <line x1="${padLeft}" y1="${y}" x2="${totalW - padRight}" y2="${y}" class="sim-chart-grid"/>
        <text x="${padLeft - 10}" y="${y + 4}" class="sim-chart-tick">${v}</text>`;
    }).join('');

    // Baseline (0) and y-axis get their own bolder, fully-opaque stroke so
    // they read as the chart's axes instead of blending into the gridlines —
    // and always stretch to totalW, not just to the last bar.
    const baselineY = padTop + plotH;
    const axisLines = `
      <line x1="${padLeft}" y1="${padTop - 8}" x2="${padLeft}" y2="${baselineY}" class="sim-chart-axis"/>
      <line x1="${padLeft}" y1="${baselineY}" x2="${totalW - padRight}" y2="${baselineY}" class="sim-chart-axis"/>
      <text x="${padLeft - 10}" y="${baselineY + 4}" class="sim-chart-tick">0</text>`;

    const bars = graded.map((n, i) => {
      const cx = padLeft + bandW * i + bandW / 2;
      const barH = Math.max((n.grade / 10) * plotH, 2);
      const y = baselineY - barH;
      const dateLabel = new Date(n.dateIso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
      const icon = n.type === 'simulare' ? '🎯' : '📝';
      return `
        <g class="sim-chart-bar-group" data-title="${BM.esc(n.title)}" data-date="${BM.esc(new Date(n.dateIso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }))}"
           data-grade="${n.grade}" data-pts="${n.points ? `${n.points.earned}/${n.points.total}p` : ''}" data-type="${n.type === 'simulare' ? 'Simulare' : 'Temă'}">
          <rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${barH}" rx="4" class="sim-chart-bar"></rect>
          <text x="${cx}" y="${Math.max(y - 10, 20)}" class="sim-chart-value">${n.grade}</text>
          <text x="${cx}" y="${H - 22}" class="sim-chart-icon">${icon}</text>
          <text x="${cx}" y="${H - 6}" class="sim-chart-label">${dateLabel}</text>
        </g>`;
    }).join('');

    return `
      <div class="sim-chart-scroll" data-content-w="${contentW}">
        <svg width="${totalW}" height="${H}" viewBox="0 0 ${totalW} ${H}" class="sim-chart" role="img" aria-label="Grafic note în timp">
          ${gridLines}
          ${axisLines}
          ${bars}
        </svg>
        <div class="sim-chart-tooltip" id="simChartTooltip"></div>
      </div>`;
  }

  // The chart is first built against its own content width (bars only take
  // as much room as they need); once it's actually in the DOM we know how
  // wide the card really is, so if there's spare room, rebuild once with the
  // gridlines/axis stretched to fill it instead of stopping short.
  function _finalizeNotesChart(content) {
    const chartWrapEl = content.querySelector('#csSimChartView');
    const scrollEl = chartWrapEl?.querySelector('.sim-chart-scroll');
    if (!chartWrapEl || !scrollEl) return;
    const contentW = Number(scrollEl.dataset.contentW || 0);
    const containerW = chartWrapEl.clientWidth;
    if (containerW > contentW) {
      chartWrapEl.innerHTML = renderNotesChart(_lastChartNotes, containerW);
      _wireNotesChartTooltip(content);
    }
  }

  function _wireNotesChartTooltip(content) {
    const wrap = content.querySelector('.sim-chart-scroll');
    const tip = content.querySelector('#simChartTooltip');
    if (!wrap || !tip) return;
    wrap.querySelectorAll('.sim-chart-bar-group').forEach(g => {
      g.addEventListener('mouseenter', () => {
        tip.innerHTML = `
          <div class="sim-chart-tooltip__type">${BM.esc(g.dataset.type)}</div>
          <div class="sim-chart-tooltip__title">${BM.esc(g.dataset.title)}</div>
          <div class="sim-chart-tooltip__date">${BM.esc(g.dataset.date)}</div>
          <div class="sim-chart-tooltip__grade">Notă: <strong>${g.dataset.grade}</strong>${g.dataset.pts ? ` · ${BM.esc(g.dataset.pts)}` : ''}</div>`;
        tip.classList.add('visible');
        const rect = g.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        tip.style.left = (rect.left - wrapRect.left + wrap.scrollLeft + rect.width / 2) + 'px';
        tip.style.top = (rect.top - wrapRect.top) + 'px';
      });
      g.addEventListener('mouseleave', () => tip.classList.remove('visible'));
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     ASSIGNMENT VIEW MODAL
  ═══════════════════════════════════════════════════════════════ */

  function openAssignmentView(a, blocks) {
    document.getElementById('assignmentView')?.remove();

    const isTeacher = BMAuth.role === 'profesor';
    const badge = dueBadge(a.due_date);
    const [y, m, d] = a.due_date.split('-').map(Number);
    const formattedRaw = new Date(y, m - 1, d).toLocaleDateString('ro-RO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const formatted = formattedRaw.charAt(0).toUpperCase() + formattedRaw.slice(1);
    const desc = a.instructions || a.description || '';

    const modal = document.createElement('div');
    modal.id = 'assignmentView';
    modal.className = 'classes-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="classes-modal__backdrop" id="avBackdrop"></div>
      <div class="classes-modal__dialog av-dialog">
        <div class="classes-modal__head">
          <h3>${BM.esc(a.title)}</h3>
          <button class="icon-btn" id="avCloseBtn">✕</button>
        </div>
        <div class="classes-modal__body av-body">
          ${blocks.length ? blocks.map(renderBlockView).join('') : '<p class="av-empty">Niciun conținut adăugat.</p>'}
          ${desc ? `
            <div class="av-section">
              <div class="av-section__label">Instrucțiuni</div>
              <p class="av-section__text">${BM.esc(desc).replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}
          <div class="av-submit-section" id="avSubmitSection">
            <div class="av-sub-loading">Se încarcă…</div>
          </div>
        </div>
        <div class="av-foot">
          <div class="av-foot__meta">
            <span class="teme-assignment__due teme-assignment__due--${badge.cls}" style="font-size:0.78rem">◷ ${badge.text}</span>
            <span class="av-foot__date">${formatted}</span>
          </div>
          <button class="btn btn--surface" id="avCloseFootBtn">Închide</button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    function _closeAv() {
      modal.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    modal.querySelector('#avBackdrop').onclick     = _closeAv;
    modal.querySelector('#avCloseBtn').onclick     = _closeAv;
    modal.querySelector('#avCloseFootBtn').onclick = _closeAv;

    modal.addEventListener('click', async e => {
      const btn = e.target.closest('.av-file-item__dl');
      if (!btn) return;
      const url = btn.dataset.url;
      const filename = btn.dataset.filename;
      try {
        btn.disabled = true;
        btn.textContent = 'Se descarcă…';
        const res = await fetch(url);
        const blob = await res.blob();
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      } catch {
        BM.toast('Descărcarea a eșuat.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '⬇ Descarcă';
      }
    });

    const section = modal.querySelector('#avSubmitSection');
    if (isTeacher) {
      _loadTeacherSubmissions(a.id, section);
    } else {
      _loadStudentSubmission(a.id, section);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     HOMEWORK SUBMISSIONS — STUDENT
  ═══════════════════════════════════════════════════════════════ */

  async function _loadStudentSubmission(assignmentId, section) {
    try {
      const { data: sub } = await BMAuth.supabase
        .from('homework_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', BMAuth.user.id)
        .maybeSingle();
      section.innerHTML = _renderStudentSubmitUI(sub);
      if (!sub?.grade_confirmed) _wireStudentSubmit(assignmentId, sub, section);
    } catch {
      section.innerHTML = '<p class="av-sub-err">Eroare la încărcarea secțiunii de predare.</p>';
    }
  }

  function _renderStudentSubmitUI(sub) {
    const confirmed = sub?.grade_confirmed;

    if (confirmed) {
      const filesHtml = (sub.files || []).map(f => `
        <div class="av-sub-file">
          <span class="av-sub-file__icon">📎</span>
          <span class="av-sub-file__name">${BM.esc(f.filename)}</span>
          <span class="av-sub-file__size">${_wzFmtSize(f.size)}</span>
        </div>`).join('');
      return `
        <div class="av-submit-section__inner">
          <div class="av-submit-section__title">📤 Tema predată</div>
          <div class="av-sub-files">${filesHtml || '<span class="av-sub-none">Niciun fișier</span>'}</div>
          <div class="av-sub-grade-result">
            <div class="av-sub-grade-result__badge">⭐ Nota ta: <strong>${sub.grade}</strong> / 10</div>
            ${sub.teacher_comment ? `
              <div class="av-sub-grade-result__comment">
                <span class="av-sub-grade-result__comment-label">💬 Comentariu profesor:</span>
                <p>${BM.esc(sub.teacher_comment)}</p>
              </div>` : ''}
          </div>
        </div>`;
    }

    const existingFilesHtml = sub ? (sub.files || []).map(f => `
      <div class="av-sub-file av-sub-file--existing">
        <span class="av-sub-file__icon">📎</span>
        <span class="av-sub-file__name">${BM.esc(f.filename)}</span>
        <span class="av-sub-file__size">${_wzFmtSize(f.size)}</span>
      </div>`).join('') : '';

    return `
      <div class="av-submit-section__inner">
        <div class="av-submit-section__title">${sub ? '📤 Actualizează tema predată' : '📤 Predă tema'}</div>
        ${sub && existingFilesHtml ? `
          <div class="av-sub-existing-label">Fișiere deja încărcate:</div>
          <div class="av-sub-files av-sub-files--existing">${existingFilesHtml}</div>` : ''}
        <div class="av-sub-drop" id="avSubDrop">
          <span class="av-sub-drop__icon">📎</span>
          <span class="av-sub-drop__text">${sub ? 'Adaugă fișiere noi (vor înlocui cele existente)' : 'Trage fișierele aici sau apasă pentru a alege'}</span>
          <input type="file" id="avSubInput" multiple accept="image/*,.pdf,.doc,.docx,.txt" style="display:none">
        </div>
        <div class="av-sub-pending" id="avSubPending"></div>
        <div class="av-submit-section__actions">
          <button class="btn btn--primary" id="avSubSubmitBtn" disabled>${sub ? 'Actualizează' : 'Predă tema'}</button>
        </div>
      </div>`;
  }

  function _wireStudentSubmit(assignmentId, existingSub, section) {
    const drop      = section.querySelector('#avSubDrop');
    const input     = section.querySelector('#avSubInput');
    const pending   = section.querySelector('#avSubPending');
    const submitBtn = section.querySelector('#avSubSubmitBtn');
    if (!drop) return;

    let pendingFiles = [];

    const updatePending = () => {
      pending.innerHTML = pendingFiles.map((f, i) => `
        <div class="av-sub-file">
          <span class="av-sub-file__icon">📎</span>
          <span class="av-sub-file__name">${BM.esc(f.name)}</span>
          <span class="av-sub-file__size">${_wzFmtSize(f.size)}</span>
          <button class="av-sub-file__remove" data-i="${i}">✕</button>
        </div>`).join('');
      submitBtn.disabled = pendingFiles.length === 0;
    };

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      pendingFiles = [...pendingFiles, ...Array.from(input.files)];
      input.value = '';
      updatePending();
    });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('av-sub-drop--over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('av-sub-drop--over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('av-sub-drop--over');
      pendingFiles = [...pendingFiles, ...Array.from(e.dataTransfer.files)];
      updatePending();
    });
    pending.addEventListener('click', e => {
      const btn = e.target.closest('.av-sub-file__remove');
      if (!btn) return;
      pendingFiles.splice(parseInt(btn.dataset.i), 1);
      updatePending();
    });

    submitBtn.addEventListener('click', async () => {
      if (!pendingFiles.length) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Se încarcă…';
      try {
        /* Șterge fișierele vechi din storage înainte de upload */
        if (existingSub?.files?.length) {
          const oldPaths = existingSub.files.map(f => f.storage_path).filter(Boolean);
          if (oldPaths.length) {
            await BMAuth.supabase.storage.from('assignment-files').remove(oldPaths);
          }
        }
        const uploadedItems = [];
        for (const file of pendingFiles) {
          const path = `submissions/${assignmentId}/${BMAuth.user.id}/${Date.now()}_${file.name}`;
          const { error } = await BMAuth.supabase.storage
            .from('assignment-files').upload(path, file, { upsert: true });
          if (error) throw error;
          uploadedItems.push({ filename: file.name, storage_path: path, size: file.size });
        }
        const { error } = await BMAuth.supabase
          .from('homework_submissions')
          .upsert({
            assignment_id: assignmentId,
            student_id:    BMAuth.user.id,
            student_name:  BMAuth.displayName(),
            files:         uploadedItems,
            updated_at:    new Date().toISOString()
          }, { onConflict: 'assignment_id,student_id' });
        if (error) throw error;
        BM.toast('Tema a fost predată!', 'success');
        const badge = document.querySelector(`[data-sub-badge="${assignmentId}"]`);
        if (badge) { badge.className = 'teme-sub-badge teme-sub-badge--done'; badge.textContent = '✅ Predată'; }
        _loadStudentSubmission(assignmentId, section);
      } catch (e) {
        BM.toast('Eroare: ' + e.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = existingSub ? 'Actualizează' : 'Predă tema';
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     HOMEWORK SUBMISSIONS — TEACHER
  ═══════════════════════════════════════════════════════════════ */

  async function _loadTeacherSubmissions(assignmentId, section) {
    try {
      const { data: subs, error } = await BMAuth.supabase
        .from('homework_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: true });
      if (error) throw error;

      if (!subs || subs.length === 0) {
        section.innerHTML = `
          <div class="av-submit-section__inner">
            <div class="av-submit-section__title">👥 Răspunsuri elevi</div>
            <p class="av-sub-none">Niciun elev nu a predat tema încă.</p>
          </div>`;
        return;
      }

      section.innerHTML = `
        <div class="av-submit-section__inner">
          <div class="av-submit-section__title">
            👥 Răspunsuri elevi
            <span class="av-sub-count">${subs.length}</span>
          </div>
          ${subs.map(s => _renderTeacherSubRow(s)).join('')}
        </div>`;

      section.querySelectorAll('.av-sub-confirm-btn').forEach(btn => {
        const row = btn.closest('.av-sub-row');
        const sub = subs.find(s => s.id === row.dataset.subId);
        if (!sub) return;
        btn.addEventListener('click', async () => {
          const grade = parseFloat(row.querySelector('.av-sub-grade-input').value);
          const comment = row.querySelector('.av-sub-comment').value.trim();
          if (!grade || grade < 1 || grade > 10) {
            BM.toast('Introduceți o notă între 1 și 10.', 'error'); return;
          }
          btn.disabled = true;
          btn.textContent = 'Se salvează…';
          try {
            const { error } = await BMAuth.supabase
              .from('homework_submissions')
              .update({
                grade,
                teacher_comment: comment || null,
                grade_confirmed: true,
                graded_at:       new Date().toISOString()
              })
              .eq('id', sub.id);
            if (error) throw error;
            BM.toast('Nota a fost confirmată!', 'success');
            _loadTeacherSubmissions(assignmentId, section);
          } catch (e) {
            BM.toast('Eroare: ' + e.message, 'error');
            btn.disabled = false;
            btn.textContent = '✓ Confirmă nota';
          }
        });
      });
    } catch {
      section.innerHTML = '<p class="av-sub-err">Eroare la încărcarea răspunsurilor.</p>';
    }
  }

  function _renderTeacherSubRow(sub) {
    const confirmed = sub.grade_confirmed;
    const date = new Date(sub.submitted_at).toLocaleDateString('ro-RO', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
    const filesHtml = (sub.files || []).map(f => {
      const { data: urlData } = BMAuth.supabase.storage
        .from('assignment-files').getPublicUrl(f.storage_path);
      return `
        <div class="av-sub-file">
          <span class="av-sub-file__icon">📎</span>
          <a class="av-sub-file__link" href="${BM.esc(urlData.publicUrl)}" target="_blank" rel="noopener">${BM.esc(f.filename)}</a>
          <span class="av-sub-file__size">${_wzFmtSize(f.size)}</span>
        </div>`;
    }).join('') || '<span class="av-sub-none">Niciun fișier</span>';

    if (confirmed) {
      return `
        <div class="av-sub-row av-sub-row--confirmed" data-sub-id="${sub.id}">
          <div class="av-sub-row__header">
            <span class="av-sub-row__name">👤 ${BM.esc(sub.student_name || 'Elev')}</span>
            <span class="av-sub-row__date">${date}</span>
            <span class="av-sub-row__badge--ok">✅ Notat</span>
          </div>
          <div class="av-sub-files">${filesHtml}</div>
          <div class="av-sub-row__locked">
            <span class="av-sub-row__locked-grade">⭐ Nota: <strong>${sub.grade}</strong> / 10</span>
            ${sub.teacher_comment ? `<p class="av-sub-row__locked-comment">💬 ${BM.esc(sub.teacher_comment)}</p>` : ''}
          </div>
        </div>`;
    }

    return `
      <div class="av-sub-row" data-sub-id="${sub.id}">
        <div class="av-sub-row__header">
          <span class="av-sub-row__name">👤 ${BM.esc(sub.student_name || 'Elev')}</span>
          <span class="av-sub-row__date">${date}</span>
        </div>
        <div class="av-sub-files">${filesHtml}</div>
        <div class="av-sub-row__form">
          <textarea class="av-sub-comment cls-form-input" placeholder="Comentariu pentru elev (opțional)…" rows="2">${BM.esc(sub.teacher_comment || '')}</textarea>
          <div class="av-sub-row__grade-row">
            <input type="number" class="av-sub-grade-input cls-form-input" min="1" max="10" step="0.5" placeholder="Notă 1–10" value="${sub.grade || ''}">
            <button class="btn btn--primary av-sub-confirm-btn">✓ Confirmă nota</button>
          </div>
        </div>
      </div>`;
  }

  function renderBlockView(block) {
    const typeLabel = WZ_TYPES.find(t => t.id === block.type)?.label || block.type;
    const typeIcon  = { text:'📝', pdf:'📄', document:'📄', image:'🖼️',
                        video:'🎥', link:'🔗', exercise:'📚', ai_import:'🤖', file:'📂' }[block.type] || '📌';
    let inner = '';

    if (block.type === 'text') {
      inner = `<div class="av-text">${BM.esc(block.data.content || '').replace(/\n/g, '<br>')}</div>`;

    } else if (block.type === 'link') {
      inner = `
        <a class="av-link" href="${BM.esc(block.data.url)}" target="_blank" rel="noopener noreferrer">
          ${block.data.title ? `<span class="av-link__title">${BM.esc(block.data.title)}</span>` : ''}
          <span class="av-link__url">${BM.esc(block.data.url)}</span>
          <span class="av-link__arrow">↗</span>
        </a>
        ${block.data.description ? `<p class="av-link__desc">${BM.esc(block.data.description)}</p>` : ''}`;

    } else if (block.type === 'video') {
      const { url = '', source, title } = block.data;
      let embed = '';
      if (source === 'youtube') {
        const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        if (m) embed = `<div class="av-video-wrap"><iframe src="https://www.youtube.com/embed/${m[1]}" allowfullscreen frameborder="0" loading="lazy"></iframe></div>`;
      } else if (source === 'vimeo') {
        const m = url.match(/vimeo\.com\/(\d+)/);
        if (m) embed = `<div class="av-video-wrap"><iframe src="https://player.vimeo.com/video/${m[1]}" allowfullscreen frameborder="0" loading="lazy"></iframe></div>`;
      }
      if (!embed) embed = `<a class="av-link" href="${BM.esc(url)}" target="_blank" rel="noopener"><span class="av-link__url">${BM.esc(url)}</span><span class="av-link__arrow">↗</span></a>`;
      inner = `${title ? `<p class="av-video-title">${BM.esc(title)}</p>` : ''}${embed}`;

    } else if (['pdf', 'image', 'file', 'document'].includes(block.type)) {
      const items = block.data.items || [];
      if (!items.length) {
        inner = `<p class="av-file-none">Niciun fișier atașat.</p>`;
      } else {
        inner = items.map(item => {
          if (item.storage_path) {
            const { data: urlData } = BMAuth.supabase.storage
              .from('assignment-files').getPublicUrl(item.storage_path);
            return `
              <div class="av-file-item">
                <span class="av-file-item__icon">${typeIcon}</span>
                <div class="av-file-item__info">
                  <span class="av-file-item__name">${BM.esc(item.filename)}</span>
                  <span class="av-file-item__size">${_wzFmtSize(item.size)}</span>
                </div>
                <div class="av-file-item__actions">
                  <a class="btn btn--outline av-file-item__view"
                     href="${BM.esc(urlData.publicUrl)}" target="_blank" rel="noopener">👁 Vizualizează</a>
                  <button class="btn btn--primary av-file-item__dl"
                          data-url="${BM.esc(urlData.publicUrl)}"
                          data-filename="${BM.esc(item.filename)}">⬇ Descarcă</button>
                </div>
              </div>`;
          } else {
            return `
              <div class="av-file-item av-file-item--error">
                <span class="av-file-item__icon">${typeIcon}</span>
                <div class="av-file-item__info">
                  <span class="av-file-item__name">${BM.esc(item.filename)}</span>
                  <span class="av-file-item__size">${_wzFmtSize(item.size)}</span>
                </div>
                <span class="av-file-item__note">Editează tema și reîncarcă fișierul</span>
              </div>`;
          }
        }).join('');
      }
    }

    return `
      <div class="av-block">
        <div class="av-block__type">${typeIcon} ${typeLabel}</div>
        <div class="av-block__inner">${inner}</div>
      </div>`;
  }

  /* ═══════════════════════════════════════════════════════════════
     ASSIGNMENT WIZARD
  ═══════════════════════════════════════════════════════════════ */

  async function openAssignmentWizard(existing = null) {
    document.getElementById('assignmentWizard')?.remove();

    let existingBlock = null;
    if (existing) {
      const { data } = await BMAuth.supabase
        .from('assignment_blocks').select('*')
        .eq('assignment_id', existing.id).order('position').limit(1).maybeSingle();
      existingBlock = data;
    }

    wz = {
      existingId:   existing?.id   || null,
      step:         1,
      type:         existingBlock?.type || null,
      blockData:    existingBlock?.data || {},
      title:        existing?.title        || '',
      instructions: existing?.instructions || existing?.description || '',
      dueDate:      existing?.due_date     || '',
      points:       existing?.points       ?? 10,
      visibility:   existing?.visibility   || 'published',
      _pendingFiles: [],
    };

    _wzShowModal();
  }

  function _wzShowModal() {
    const modal = document.createElement('div');
    modal.id = 'assignmentWizard';
    modal.className = 'wz-overlay';
    modal.innerHTML = `
      <div class="wz-backdrop" id="wzBackdrop"></div>
      <div class="wz-dialog" role="dialog">
        <div class="wz-head">
          <span class="wz-head__title">${wz.existingId ? 'Editează Tema' : 'Temă Nouă'}</span>
          <div class="wz-steps" id="wzSteps"></div>
          <button class="icon-btn" id="wzCloseBtn">✕</button>
        </div>
        <div class="wz-body" id="wzBody"></div>
        <div class="wz-foot">
          <button class="btn btn--surface" id="wzBackBtn">← Înapoi</button>
          <button class="btn btn--primary"  id="wzNextBtn">Continuă →</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    modal.querySelector('#wzBackdrop').onclick = _wzClose;
    modal.querySelector('#wzCloseBtn').onclick  = _wzClose;
    modal.querySelector('#wzBackBtn').onclick   = _wzBack;
    modal.querySelector('#wzNextBtn').onclick   = _wzNext;

    _wzRender();
  }

  function _wzClose() {
    document.getElementById('assignmentWizard')?.remove();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    wz = null;
  }

  function _wzRender() {
    const body    = document.getElementById('wzBody');
    const steps   = document.getElementById('wzSteps');
    const backBtn = document.getElementById('wzBackBtn');
    const nextBtn = document.getElementById('wzNextBtn');
    if (!body || !steps || !backBtn || !nextBtn) return;

    const labels = ['Tip', 'Conținut', 'Setări'];
    steps.innerHTML = labels.map((l, i) => `
      <div class="wz-step-item">
        <div class="wz-step-dot${i + 1 < wz.step ? ' wz-step-dot--done' : ''}${i + 1 === wz.step ? ' wz-step-dot--active' : ''}">
          ${i + 1 < wz.step ? '✓' : i + 1}
        </div>
        <span class="wz-step-label">${l}</span>
      </div>
      ${i < 2 ? '<div class="wz-step-line"></div>' : ''}
    `).join('');

    backBtn.style.visibility = wz.step === 1 ? 'hidden' : '';
    nextBtn.textContent = wz.step === 3
      ? (wz.existingId ? 'Salvează' : 'Publică Tema')
      : 'Continuă →';

    if (wz.step === 1) body.innerHTML = _wzStep1();
    if (wz.step === 2) body.innerHTML = _wzStep2();
    if (wz.step === 3) { body.innerHTML = _wzStep3(); _initWzDatePicker(); }

    if (wz.step === 1) {
      body.querySelectorAll('.wz-type-card:not([disabled])').forEach(card => {
        card.addEventListener('click', () => {
          body.querySelectorAll('.wz-type-card').forEach(c => c.classList.remove('wz-type-card--selected'));
          card.classList.add('wz-type-card--selected');
          wz.type = card.dataset.type;
        });
        card.addEventListener('dblclick', () => {
          body.querySelectorAll('.wz-type-card').forEach(c => c.classList.remove('wz-type-card--selected'));
          card.classList.add('wz-type-card--selected');
          wz.type = card.dataset.type;
          _wzNext();
        });
      });
    }

    if (wz.step === 2 && ['pdf', 'image', 'file'].includes(wz.type)) {
      const fi = body.querySelector('#wzFileInput');
      const fl = body.querySelector('#wzFileList');
      if (fi && fl) {
        fi.addEventListener('change', () => {
          wz._pendingFiles = Array.from(fi.files);
          fl.innerHTML = wz._pendingFiles.map(f => `
            <div class="wz-file-item">
              <span class="wz-file-item__name">${BM.esc(f.name)}</span>
              <span class="wz-file-item__size">${_wzFmtSize(f.size)}</span>
            </div>`).join('');
        });
      }
    }
  }

  function _wzStep1() {
    return `
      <p class="wz-subtitle">Alege tipul principal de conținut al temei:</p>
      <div class="wz-type-grid">
        ${WZ_TYPES.map(t => `
          <button class="wz-type-card${wz.type === t.id ? ' wz-type-card--selected' : ''}${t.soon ? ' wz-type-card--soon' : ''}"
                  data-type="${t.id}" ${t.soon ? 'disabled' : ''}>
            <span class="wz-type-card__icon">${t.icon}</span>
            <span class="wz-type-card__label">${t.label}</span>
            <span class="wz-type-card__desc">${t.desc}</span>
            ${t.soon ? '<span class="wz-type-card__badge">În curând</span>' : ''}
          </button>`).join('')}
      </div>`;
  }

  function _wzStep2() {
    const label = WZ_TYPES.find(t => t.id === wz.type)?.label || wz.type;

    const textCfg = () => `
      <div class="cls-form-field">
        <label class="cls-form-label">Conținut *</label>
        <textarea id="wzTextContent" class="cls-form-input cls-form-textarea" rows="10"
                  placeholder="Scrieți exercițiile, instrucțiunile sau conținutul temei…"
                  >${BM.esc(wz.blockData.content || '')}</textarea>
      </div>`;

    const linkCfg = () => `
      <div class="cls-form-field">
        <label class="cls-form-label">URL *</label>
        <input type="url" id="wzLinkUrl" class="cls-form-input"
               placeholder="https://…" value="${BM.esc(wz.blockData.url || '')}">
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Titlu link (opțional)</label>
        <input type="text" id="wzLinkTitle" class="cls-form-input"
               placeholder="ex: Articol despre fotosinteza"
               value="${BM.esc(wz.blockData.title || '')}">
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Descriere (opțional)</label>
        <input type="text" id="wzLinkDesc" class="cls-form-input"
               placeholder="Context sau instrucțiuni"
               value="${BM.esc(wz.blockData.description || '')}">
      </div>`;

    const videoCfg = () => `
      <div class="cls-form-field">
        <label class="cls-form-label">URL Video *</label>
        <input type="url" id="wzVideoUrl" class="cls-form-input"
               placeholder="https://youtube.com/… sau https://vimeo.com/…"
               value="${BM.esc(wz.blockData.url || '')}">
        <span class="cls-form-hint">YouTube, Vimeo sau orice link video</span>
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Titlu video (opțional)</label>
        <input type="text" id="wzVideoTitle" class="cls-form-input"
               placeholder="ex: Lecție cap. 5 — Ecuații"
               value="${BM.esc(wz.blockData.title || '')}">
      </div>`;

    const fileCfg = (accept, multiple, hint) => {
      const existing = wz.blockData.items || [];
      return `
        <div class="wz-upload-zone">
          <input type="file" id="wzFileInput" class="wz-file-input"
                 accept="${accept}" ${multiple ? 'multiple' : ''}>
          <label for="wzFileInput" class="wz-upload-drop">
            <span class="wz-upload-drop__icon">⬆</span>
            <span class="wz-upload-drop__main">Trage fișierul aici sau <u>alege din calculator</u></span>
            <span class="wz-upload-drop__hint">${hint}</span>
          </label>
          <div class="wz-file-list" id="wzFileList">
            ${existing.map(f => `
              <div class="wz-file-item">
                <span class="wz-file-item__name">${BM.esc(f.filename)}</span>
                <span class="wz-file-item__size">${_wzFmtSize(f.size)}</span>
              </div>`).join('')}
          </div>
        </div>`;
    };

    const cfg = {
      text:      textCfg,
      link:      linkCfg,
      video:     videoCfg,
      pdf:       () => fileCfg('.pdf,.doc,.docx', false, 'PDF, DOC, DOCX · Max 20MB'),
      image:     () => fileCfg('image/*',         true,  'JPG, PNG, GIF, WebP · Max 10MB per fișier'),
      file:      () => fileCfg('*',               true,  'Orice tip de fișier · Max 50MB'),
    };

    const content = cfg[wz.type]
      ? cfg[wz.type]()
      : `<div class="wz-soon-msg">
           <span>🚧</span>
           <p>Acest tip de conținut este în curs de dezvoltare.</p>
         </div>`;

    return `
      <p class="wz-subtitle">Configurează conținutul — <strong>${label}</strong></p>
      ${content}`;
  }

  function _initWzDatePicker() {
    const el = document.getElementById('wzDueDate');
    if (!el || !window.flatpickr) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    flatpickr(el, {
      locale: window.flatpickr.l10ns?.ro || 'default',
      dateFormat: 'Y-m-d',
      minDate: wz.existingId ? null : 'today',
      defaultDate: wz.dueDate || null,
      disableMobile: true,
      allowInput: false,
      theme: isDark ? 'dark' : 'light',
      onChange(selectedDates, dateStr) { wz.dueDate = dateStr; }
    });
  }

  function _wzStep3() {
    const today = new Date().toISOString().split('T')[0];
    return `
      <div class="cls-form-field">
        <label class="cls-form-label">Titlu *</label>
        <input type="text" id="wzTitle" class="cls-form-input"
               placeholder="ex: Fișă recapitulativă cap. 5" maxlength="150"
               value="${BM.esc(wz.title)}">
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Instrucțiuni pentru elevi</label>
        <textarea id="wzInstructions" class="cls-form-input cls-form-textarea" rows="3"
                  placeholder="Rezolvați toate exercițiile și predați până la data limită…"
                  >${BM.esc(wz.instructions)}</textarea>
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Termen limită *</label>
        <input type="date" id="wzDueDate" class="cls-form-input"
               ${!wz.existingId ? `min="${today}"` : ''}
               value="${BM.esc(wz.dueDate)}">
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Vizibilitate</label>
        <div class="wz-vis-row">
          <label class="wz-radio">
            <input type="radio" name="wzVis" value="published" ${wz.visibility !== 'draft' ? 'checked' : ''}>
            <span class="wz-radio__dot"></span>
            <span>Publică — elevii o văd imediat</span>
          </label>
          <label class="wz-radio">
            <input type="radio" name="wzVis" value="draft" ${wz.visibility === 'draft' ? 'checked' : ''}>
            <span class="wz-radio__dot"></span>
            <span>Draft — salvată, invizibilă elevilor</span>
          </label>
        </div>
      </div>`;
  }

  function _wzNext() {
    if (wz.step === 1) {
      if (!wz.type) { BM.toast('Alege un tip de conținut.', 'error'); return; }
      wz.step = 2; _wzRender(); return;
    }
    if (wz.step === 2) {
      if (!_wzCollect()) return;
      wz.step = 3; _wzRender(); return;
    }
    if (wz.step === 3) _wzSave();
  }

  function _wzBack() {
    if (wz.step > 1) { wz.step--; _wzRender(); }
  }

  function _wzCollect() {
    if (wz.type === 'text') {
      const c = document.getElementById('wzTextContent')?.value.trim();
      if (!c) { BM.toast('Introduceți conținutul textului.', 'error'); return false; }
      wz.blockData = { content: c, format: 'markdown' };
      return true;
    }
    if (wz.type === 'link') {
      const url = document.getElementById('wzLinkUrl')?.value.trim();
      if (!url) { BM.toast('Introduceți URL-ul.', 'error'); return false; }
      wz.blockData = {
        url,
        title:       document.getElementById('wzLinkTitle')?.value.trim() || '',
        description: document.getElementById('wzLinkDesc')?.value.trim()  || ''
      };
      return true;
    }
    if (wz.type === 'video') {
      const url = document.getElementById('wzVideoUrl')?.value.trim();
      if (!url) { BM.toast('Introduceți URL-ul video.', 'error'); return false; }
      let src = 'other';
      if (url.includes('youtube.com') || url.includes('youtu.be')) src = 'youtube';
      else if (url.includes('vimeo.com')) src = 'vimeo';
      wz.blockData = { url, source: src, title: document.getElementById('wzVideoTitle')?.value.trim() || '' };
      return true;
    }
    if (['pdf', 'image', 'file'].includes(wz.type)) {
      if (wz._pendingFiles.length > 0) {
        wz.blockData = {
          items: wz._pendingFiles.map(f => ({
            filename: f.name, size: f.size, mime_type: f.type, storage_path: null
          }))
        };
      } else if (!wz.blockData.items) {
        wz.blockData = { items: [] };
      }
      return true;
    }
    wz.blockData = {};
    return true;
  }

  async function _wzSave() {
    const title        = document.getElementById('wzTitle')?.value.trim();
    const instructions = document.getElementById('wzInstructions')?.value.trim() || '';
    const dueDate      = document.getElementById('wzDueDate')?.value;
    const points       = 10;
    const visibility   = document.querySelector('input[name="wzVis"]:checked')?.value || 'published';

    if (!title)   { BM.toast('Introduceți titlul temei.', 'error');    document.getElementById('wzTitle')?.focus();   return; }
    if (!dueDate) { BM.toast('Selectați termenul limită.', 'error');   document.getElementById('wzDueDate')?.focus(); return; }

    const btn = document.getElementById('wzNextBtn');
    btn.disabled = true; btn.textContent = 'Se salvează…';

    try {
      let aid = wz.existingId;

      if (wz.existingId) {
        const { error } = await BMAuth.supabase.from('assignments')
          .update({ title, instructions, due_date: dueDate, points, visibility,
                    updated_at: new Date().toISOString() })
          .eq('id', wz.existingId);
        if (error) throw error;
        await BMAuth.supabase.from('assignment_blocks').delete().eq('assignment_id', wz.existingId);
      } else {
        const { data, error } = await BMAuth.supabase.from('assignments')
          .insert({ class_id: classData.id, created_by: BMAuth.user.id,
                    title, instructions, due_date: dueDate, points, visibility })
          .select('id').single();
        if (error) throw error;
        aid = data.id;
      }

      /* Upload fișiere în Supabase Storage (dacă există) */
      if (['pdf', 'image', 'file', 'document'].includes(wz.type) && wz._pendingFiles?.length > 0) {
        btn.textContent = 'Se urcă fișierele…';
        const uploadedItems = [];
        for (const file of wz._pendingFiles) {
          const ext  = file.name.split('.').pop();
          const slug = Math.random().toString(36).slice(2, 8);
          const path = `${aid}/${slug}.${ext}`;
          const { error: upErr } = await BMAuth.supabase.storage
            .from('assignment-files').upload(path, file, { upsert: false });
          if (upErr) throw new Error('Upload fișier: ' + upErr.message);
          uploadedItems.push({ filename: file.name, size: file.size,
                               mime_type: file.type, storage_path: path });
        }
        wz.blockData = { items: uploadedItems };
        btn.textContent = 'Se salvează…';
      }

      if (wz.type && Object.keys(wz.blockData).length > 0) {
        const { error } = await BMAuth.supabase.from('assignment_blocks')
          .insert({ assignment_id: aid, type: wz.type, position: 0, data: wz.blockData });
        if (error) throw error;
      }

      BM.toast(wz.existingId ? 'Tema a fost actualizată!' : 'Tema a fost publicată!', 'success');
      if (!wz.existingId) BMPush?.sendClassPush(classData.id, 'assignment');
      _wzClose();
      await loadTemeTab();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = wz.existingId ? 'Salvează' : 'Publică Tema';
    }
  }

  function _wzFmtSize(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  async function deleteAssignment(assignmentId, assignmentTitle) {
    const ok = await showConfirmDialog({
      icon:        '🗑️',
      title:       'Ștergi tema?',
      message:     '„' + assignmentTitle + '" va fi ștearsă definitiv.',
      confirmText: 'Șterge'
    });
    if (!ok) return;

    try {
      const { error } = await BMAuth.supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
      BM.toast('Tema a fost ștearsă.', 'info');
      await loadTemeTab();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    }
  }

  /* ─── Confirm dialog (reused pattern) ──────────────────────────── */
  function showConfirmDialog({ title, message, confirmText = 'Confirmă', icon = '⚠️' }) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <div class="confirm-dialog__body">
            <div class="confirm-dialog__icon">${icon}</div>
            <div class="confirm-dialog__title">${title}</div>
            ${message ? `<p class="confirm-dialog__msg">${message}</p>` : ''}
          </div>
          <div class="confirm-dialog__foot">
            <button class="btn btn--surface" id="cdConfirmNo">Anulează</button>
            <button class="btn btn--danger"  id="cdConfirmYes">${confirmText}</button>
          </div>
        </div>
      `;
      const close = result => { overlay.remove(); document.body.style.overflow = ''; resolve(result); };
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      overlay.querySelector('#cdConfirmNo').addEventListener('click',  () => close(false));
      overlay.querySelector('#cdConfirmYes').addEventListener('click', () => close(true));
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);
      overlay.querySelector('#cdConfirmNo').focus();
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SIMULĂRI TAB
  ═══════════════════════════════════════════════════════════════ */

  const SIM_STATUS_LABEL = { programata: 'Programată', activa: 'Activă', incheiata: 'Încheiată' };

  // classData.school_grade is a free string like "a 5-a" / "a 9-a" / "a 12-a"
  // (see classes-page.js's grade <select>); custom_exercises.grade uses short
  // codes '5'..'12'/'bac'. 12th grade maps to 'bac' since that's the existing
  // convention for the whole BAC-chapter exercise pool (BM.CATEGORIES has no
  // separate "grade 12" track — it IS the BAC track).
  function _gradeCodeFromSchoolGrade(schoolGrade) {
    const m = /(\d+)/.exec(schoolGrade || '');
    if (!m) return null;
    return m[1] === '12' ? 'bac' : m[1];
  }

  function simStatusBadge(status) {
    return `<span class="sim-badge sim-badge--${status}">${SIM_STATUS_LABEL[status] || status}</span>`;
  }

  function formatSimDateTime(iso) {
    if (!iso) return 'Fără dată programată';
    const d = new Date(iso);
    return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) +
           ' · ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  // Short "d mon" label for a catalog column header — prefers the date the
  // simulation actually ran (started_at), falling back to when it was
  // scheduled for, then to when it was created.
  function _simColDate(s) {
    const iso = s.started_at || s.scheduled_at || s.created_at;
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }

  function _fmtDuration(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSec / 60), s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function loadSimulariTab() {
    const content = document.getElementById('cdContent');
    if (!content) return;
    const isTeacher = BMAuth.role === 'profesor';

    // Defensive fallback — the pg_cron sweep already closes expired
    // simulations every minute regardless of any page being open.
    try { await BMAuth.supabase.rpc('run_simulation_expiry_sweep'); } catch (e) {}

    try {
      const { data: sims, error } = await BMAuth.supabase
        .from('simulations').select('*').eq('class_id', classData.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const simList = sims || [];
      const simIds  = simList.map(s => s.id);

      let attemptsBySim = {};
      let myAttempts    = {};
      let memberCount   = 0;

      if (simIds.length > 0) {
        if (isTeacher) {
          const [{ data: attempts }, { data: members }] = await Promise.all([
            BMAuth.supabase.from('simulation_attempts')
              .select('simulation_id, student_id, student_name, status, grade_10, started_at')
              .in('simulation_id', simIds).order('started_at', { ascending: true }),
            BMAuth.supabase.from('class_members').select('student_id, student_name').eq('class_id', classData.id)
          ]);
          memberCount = (members || []).length;
          // A retake after reopen means a student can have several rows for
          // the same simulation — keep only the latest per (simulation,
          // student) so "x/y finalizat" counts students, not attempts, and
          // the card shows current status/grade, not a stale one.
          const latestBySimStudent = {};
          (attempts || []).forEach(a => {
            (latestBySimStudent[a.simulation_id] = latestBySimStudent[a.simulation_id] || {})[a.student_id] = a;
          });
          Object.keys(latestBySimStudent).forEach(simId => {
            attemptsBySim[simId] = Object.values(latestBySimStudent[simId]);
          });
        } else {
          const { data: mine } = await BMAuth.supabase.from('simulation_attempts')
            .select('*').eq('student_id', BMAuth.user.id).in('simulation_id', simIds)
            .order('started_at', { ascending: true });
          (mine || []).forEach(a => { myAttempts[a.simulation_id] = a; });
        }
      }

      simCache = simList;
      const visible = isTeacher ? simList : simList.filter(s => s.status !== 'programata');

      content.innerHTML = `
        ${isTeacher ? `
          <div class="teme-toolbar sim-toolbar">
            <button class="btn btn--primary" id="newSimBtn">+ Simulare Nouă</button>
            <button class="btn btn--surface" id="simFromTemplateBtn">📋 Din șablon</button>
          </div>` : ''}
        <div class="sim-list${visible.length === 0 ? ' sim-list--empty' : ''}">
          ${visible.length === 0
            ? simEmpty(isTeacher)
            : visible.map(s => isTeacher
                ? simCardTeacher(s, attemptsBySim[s.id] || [], memberCount)
                : simCardStudent(s, myAttempts[s.id] || null)
              ).join('')}
        </div>`;

      document.getElementById('newSimBtn')?.addEventListener('click', () => openSimulationWizard());
      document.getElementById('simFromTemplateBtn')?.addEventListener('click', () => openSimTemplatePicker());

      if (isTeacher) {
        content.querySelectorAll('[data-sim-start]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); startSimulation(btn.dataset.simStart); }));
        content.querySelectorAll('[data-sim-end]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); endSimulation(btn.dataset.simEnd); }));
        content.querySelectorAll('[data-sim-reopen]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); reopenSimulation(btn.dataset.simReopen); }));
        content.querySelectorAll('[data-sim-edit]').forEach(btn => btn.addEventListener('click', e => {
          e.stopPropagation();
          const s = simCache.find(x => x.id === btn.dataset.simEdit);
          if (s) openSimulationWizard(s);
        }));
        content.querySelectorAll('[data-sim-delete]').forEach(btn => btn.addEventListener('click', e => {
          e.stopPropagation();
          deleteSimulation(btn.dataset.simDelete, btn.dataset.simTitle);
        }));
        content.querySelectorAll('[data-sim-save-template]').forEach(btn => btn.addEventListener('click', e => {
          e.stopPropagation();
          const s = simCache.find(x => x.id === btn.dataset.simSaveTemplate);
          if (s) openSaveTemplateModal(s);
        }));
        content.querySelectorAll('.csim-card--clickable').forEach(card => card.addEventListener('click', () => {
          const s = simCache.find(x => x.id === card.dataset.id);
          if (s) openSimulationLiveView(s);
        }));
      } else {
        content.querySelectorAll('[data-sim-begin]').forEach(btn => btn.addEventListener('click', () => _openSimForStudent(btn.dataset.simBegin)));
        content.querySelectorAll('[data-sim-results]').forEach(btn => btn.addEventListener('click', () => _openSimForStudent(btn.dataset.simResults)));
      }
    } catch (e) {
      content.innerHTML = `
        <div class="cd-placeholder">
          <div class="cd-placeholder__icon">⚠️</div>
          <h3 class="cd-placeholder__title">Eroare la încărcare</h3>
          <p class="cd-placeholder__desc">${BM.esc(e.message)}</p>
        </div>`;
    }
  }

  function simEmpty(isTeacher) {
    return `
      <div class="teme-empty">
        <div class="teme-empty__icon">🎯</div>
        <h3>${isTeacher ? 'Nicio simulare creată' : 'Nicio simulare disponibilă'}</h3>
        <p>${isTeacher ? 'Creează prima simulare pentru clasă.' : 'Profesorul nu a pornit nicio simulare încă.'}</p>
      </div>`;
  }

  function simCardTeacher(s, attempts, memberCount) {
    const finishedCount = attempts.filter(a => a.status === 'finalizata').length;
    return `
      <div class="csim-card csim-card--clickable" data-id="${s.id}">
        <div class="csim-card__row">
          <h3 class="csim-card__title">${BM.esc(s.title)}</h3>
          ${simStatusBadge(s.status)}
          <span class="csim-card__meta-item">📅 ${formatSimDateTime(s.scheduled_at)}</span>
          <span class="csim-card__meta-item">⏱ ${s.time_limit_minutes} min</span>
          <span class="csim-card__meta-item">👥 ${finishedCount}/${memberCount} finalizat</span>
          <div class="csim-card__actions">
            ${s.status === 'programata' ? `<button class="btn btn--primary btn--sm" data-sim-start="${s.id}">▶ Pornește acum</button>` : ''}
            ${s.status === 'activa'     ? `<button class="btn btn--surface btn--sm" data-sim-end="${s.id}">■ Încheie</button>` : ''}
            ${s.status === 'incheiata'  ? `<button class="btn btn--surface btn--sm" data-sim-reopen="${s.id}">↻ Redeschide</button>` : ''}
            ${s.status === 'programata' ? `<button class="teme-assignment__edit" data-sim-edit="${s.id}" title="Editează">✎</button>` : ''}
            <button class="teme-assignment__edit" data-sim-save-template="${s.id}" title="Salvează ca șablon">📋</button>
            <button class="teme-assignment__delete" data-sim-delete="${s.id}" data-sim-title="${BM.esc(s.title)}" title="Șterge">✕</button>
          </div>
        </div>
      </div>`;
  }

  function simCardStudent(s, attempt) {
    let action;
    if (attempt?.status === 'finalizata') {
      action = `<button class="btn btn--surface btn--sm" data-sim-results="${s.id}">📊 Vezi rezultatul</button>`;
    } else if (attempt?.status === 'in_progres') {
      action = `<button class="btn btn--primary btn--sm" data-sim-begin="${s.id}">▶ Continuă</button>`;
    } else if (s.status === 'activa') {
      action = `<button class="btn btn--primary btn--sm" data-sim-begin="${s.id}">▶ Începe simularea</button>`;
    } else {
      action = `<span class="sim-badge sim-badge--locked">Nu ai participat</span>`;
    }
    return `
      <div class="csim-card" data-id="${s.id}">
        <div class="csim-card__row">
          <h3 class="csim-card__title">${BM.esc(s.title)}</h3>
          ${simStatusBadge(s.status)}
          <span class="csim-card__meta-item">⏱ ${s.time_limit_minutes} min</span>
          ${attempt?.status === 'finalizata' ? `<span class="csim-card__meta-item csim-card__meta-item--grade">⭐ Nota: ${attempt.grade_10 ?? '—'}</span>` : ''}
          <div class="csim-card__actions">${action}</div>
        </div>
      </div>`;
  }

  let _simExamActive = false;

  async function _openSimForStudent(simId) {
    const sim = simCache.find(s => s.id === simId);
    if (!sim) return;
    _simExamActive = true;
    window.onSimulareExamClosed = () => { _simExamActive = false; loadSimulariTab(); };
    await window.SimulareExam.start(sim);
  }

  /* ─── Teacher actions ────────────────────────────────────────────── */
  async function startSimulation(id) {
    try {
      const { error } = await BMAuth.supabase.from('simulations')
        .update({ status: 'activa', started_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      const sim = simCache.find(s => s.id === id);
      window.BMPush?.sendClassPush(classData.id, 'simulare_started', { sim_title: sim?.title || '' });
      BM.toast('Simularea a fost pornită!', 'success');
      await loadSimulariTab();
    } catch (e) { BM.toast('Eroare: ' + e.message, 'error'); }
  }

  async function endSimulation(id) {
    const ok = await showConfirmDialog({
      icon: '■', title: 'Încheie simularea?',
      message: 'Elevii care nu au început nu vor mai putea participa (poți redeschide oricând).',
      confirmText: 'Încheie'
    });
    if (!ok) return;
    try {
      const { error } = await BMAuth.supabase.from('simulations').update({ status: 'incheiata' }).eq('id', id);
      if (error) throw error;
      BM.toast('Simularea a fost încheiată.', 'info');
      await loadSimulariTab();
    } catch (e) { BM.toast('Eroare: ' + e.message, 'error'); }
  }

  async function reopenSimulation(id) {
    try {
      // Resetting started_at (not just status) matters for two reasons:
      // 1. The pg_cron expiry sweep closes any 'activa' simulation once
      //    started_at + time_limit_minutes has passed — without this, an
      //    old simulation reopened days after its original deadline would
      //    get auto-closed again within the next minute.
      // 2. simulare-exam.js's start() uses "did my last finalized attempt
      //    finish before this reopen?" (finished_at vs started_at) to
      //    decide whether a student gets a fresh retake or just sees their
      //    existing results — that comparison only works if started_at
      //    actually reflects the reopen time.
      const { error } = await BMAuth.supabase.from('simulations')
        .update({ status: 'activa', started_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      BM.toast('Simularea a fost redeschisă — elevii care au finalizat-o deja o pot relua.', 'success');
      await loadSimulariTab();
    } catch (e) { BM.toast('Eroare: ' + e.message, 'error'); }
  }

  async function deleteSimulation(id, title) {
    const ok = await showConfirmDialog({
      icon: '🗑️', title: 'Ștergi simularea?',
      message: '„' + title + '" va fi ștearsă definitiv, împreună cu toate rezultatele elevilor.',
      confirmText: 'Șterge'
    });
    if (!ok) return;
    try {
      const { error } = await BMAuth.supabase.from('simulations').delete().eq('id', id);
      if (error) throw error;
      BM.toast('Simularea a fost ștearsă.', 'info');
      await loadSimulariTab();
    } catch (e) { BM.toast('Eroare: ' + e.message, 'error'); }
  }

  /* ─── Teacher live view ──────────────────────────────────────────── */
  let _openLiveSimId = null;
  let _reloadSimLiveTimer = null;

  function _debouncedSimLive() {
    if (!_openLiveSimId) return;
    clearTimeout(_reloadSimLiveTimer);
    _reloadSimLiveTimer = setTimeout(() => _refreshSimLiveBody(_openLiveSimId), 350);
  }

  function _closeSimLiveModal() {
    document.getElementById('simLiveModal')?.remove();
    _openLiveSimId = null;
  }

  async function openSimulationLiveView(s) {
    _closeSimLiveModal();
    _openLiveSimId = s.id;

    const modal = document.createElement('div');
    modal.id = 'simLiveModal';
    modal.className = 'classes-modal';
    modal.innerHTML = `
      <div class="classes-modal__backdrop"></div>
      <div class="classes-modal__dialog sim-live-dialog">
        <div class="classes-modal__head">
          <h3>🎯 ${BM.esc(s.title)}</h3>
          <button class="icon-btn" id="simLiveCloseBtn">✕</button>
        </div>
        <div class="classes-modal__body" id="simLiveBody">
          <div class="classes-loading"><div class="classes-spinner"></div></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.classes-modal__backdrop').onclick = _closeSimLiveModal;
    modal.querySelector('#simLiveCloseBtn').onclick = _closeSimLiveModal;

    await _refreshSimLiveBody(s.id);
  }

  async function _refreshSimLiveBody(simId) {
    const body = document.getElementById('simLiveBody');
    if (!body) return;

    // Defensive fallback — the pg_cron sweep already closes expired
    // simulations every minute regardless of any page being open.
    try { await BMAuth.supabase.rpc('run_simulation_expiry_sweep'); } catch (e) {}

    const sim = simCache.find(s => s.id === simId);
    const [{ data: members }, { data: attempts }] = await Promise.all([
      BMAuth.supabase.from('class_members').select('student_id, student_name').eq('class_id', classData.id),
      // Ascending order + overwrite-on-forEach below means attemptMap ends
      // up holding only each student's LATEST attempt — relevant once a
      // reopen + retake can leave a student with more than one row here.
      BMAuth.supabase.from('simulation_attempts').select('*').eq('simulation_id', simId).order('started_at', { ascending: true })
    ]);
    const attemptMap = {};
    (attempts || []).forEach(a => { attemptMap[a.student_id] = a; });

    let flagMap = {};
    if (sim?.supervised && attempts?.length) {
      const { data: flags } = await BMAuth.supabase
        .from('simulation_attempt_flags').select('*').in('attempt_id', attempts.map(a => a.id));
      (flags || []).forEach(f => { flagMap[f.attempt_id] = f.tab_switch_count; });
    }

    const rows = (members || []).map((m, idx) => {
      const a = attemptMap[m.student_id];
      const name = m.student_name || a?.student_name || ('Elev ' + (idx + 1));

      let statusBadge, statsHtml = '', violationHtml = '';
      if (!a) {
        statusBadge = `<span class="sim-badge sim-badge--locked">Nepornit</span>`;
      } else if (a.status === 'in_progres') {
        statusBadge = `<span class="sim-badge sim-badge--activa">În lucru</span>`;
      } else {
        const dur = _fmtDuration(new Date(a.finished_at) - new Date(a.started_at));
        statusBadge = `<span class="sim-badge sim-badge--incheiata">Finalizat</span>`;
        statsHtml = `
          <span class="sim-live-row__stat" title="Timp de rezolvare">⏱ ${dur}</span>
          <span class="sim-live-row__stat" title="Puncte obținute">🎯 ${a.earned_points}/${a.total_points}p</span>
          <span class="sim-live-row__stat sim-live-row__stat--grade" title="Notă">⭐ ${a.grade_10 ?? '—'}</span>`;
      }
      const violations = flagMap[a?.id];
      if (violations > 0) {
        violationHtml = `<span class="sim-violation-badge" title="Mod supravegheat">⚠ A părăsit fereastra de ${violations} ori</span>`;
      }

      return `
        <div class="sim-live-row${a?.status === 'finalizata' ? ' sim-live-row--clickable' : ''}" ${a?.status === 'finalizata' ? `data-attempt-id="${a.id}"` : ''}>
          <span class="sim-live-row__name">${BM.esc(name)}</span>
          <div class="sim-live-row__right">
            ${violationHtml}
            ${statsHtml}
            ${statusBadge}
          </div>
        </div>`;
    }).join('');

    body.innerHTML = `<div class="sim-live-list">${rows || '<p>Niciun elev în clasă.</p>'}</div>`;
    body.querySelectorAll('[data-attempt-id]').forEach(row => {
      row.addEventListener('click', () => openSimStudentDetail(row.dataset.attemptId));
    });
  }

  // options[itemId] = [{id, label, position}, ...] — mirrors the same helper
  // in simulare-exam.js (small enough not to worth sharing across modules).
  async function _simFetchOptionsFor(items) {
    const itemIds = items.filter(it => it.answer_type === 'grila').map(it => it.id);
    if (!itemIds.length) return {};
    const { data } = await BMAuth.supabase
      .from('simulation_item_options').select('*').in('simulation_item_id', itemIds).order('position');
    const byItem = {};
    (data || []).forEach(o => { (byItem[o.simulation_item_id] = byItem[o.simulation_item_id] || []).push(o); });
    return byItem;
  }

  /* ─── Catalog quick view: compact per-exercise summary, no full enunț ───
     Opened from a Catalog grade cell — a fast lookup, not a review tool.
     Deliberately skips fetching simulation_items.statement (no KaTeX render
     needed) and skips the feedback-editing UI from openSimStudentDetail —
     "Vezi detaliat" below hands off to that full view for anything beyond
     a quick glance. */
  async function openSimQuickView(attemptId) {
    document.getElementById('simQvModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'simQvModal';
    modal.className = 'classes-modal';
    modal.innerHTML = `
      <div class="classes-modal__backdrop"></div>
      <div class="classes-modal__dialog sim-qv-dialog">
        <div class="classes-modal__head">
          <h3 id="simQvTitle">Se încarcă…</h3>
          <button class="icon-btn" id="simQvCloseBtn">✕</button>
        </div>
        <div class="classes-modal__body" id="simQvBody">
          <div class="classes-loading"><div class="classes-spinner"></div></div>
        </div>
        <div class="classes-modal__foot">
          <button class="btn btn--surface btn--sm" id="simQvDetailBtn">Vezi detaliat →</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const closeModal = () => {
      modal.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
    modal.querySelector('.classes-modal__backdrop').onclick = closeModal;
    modal.querySelector('#simQvCloseBtn').onclick = closeModal;
    modal.querySelector('#simQvDetailBtn').onclick = () => { closeModal(); openSimStudentDetail(attemptId); };

    const { data: attempt } = await BMAuth.supabase.from('simulation_attempts').select('*').eq('id', attemptId).single();
    if (!attempt) { closeModal(); return; }
    const { data: sim } = await BMAuth.supabase.from('simulations').select('title, supervised').eq('id', attempt.simulation_id).single();

    // No `statement` in the select — this view never renders the enunț.
    const { data: items } = await BMAuth.supabase
      .from('simulation_items').select('id, position, title, points, answer_type')
      .eq('simulation_id', attempt.simulation_id).order('position');
    const itemIds = (items || []).map(i => i.id);

    const [{ data: keys }, { data: answers }, flagRow] = await Promise.all([
      BMAuth.supabase.from('simulation_answer_keys').select('*').in('simulation_item_id', itemIds),
      BMAuth.supabase.from('simulation_answers').select('*').eq('attempt_id', attemptId),
      sim?.supervised
        ? BMAuth.supabase.from('simulation_attempt_flags').select('*').eq('attempt_id', attemptId).maybeSingle()
        : Promise.resolve({ data: null })
    ]);
    const options = await _simFetchOptionsFor(items || []);

    const keyMap = {}; (keys || []).forEach(k => { keyMap[k.simulation_item_id] = k.correct_answer; });
    const answerMap = {}; (answers || []).forEach(a => { answerMap[a.simulation_item_id] = a; });
    const optLabel = (itemId, optionId) => (options[itemId] || []).find(o => o.id === optionId)?.label || '—';

    document.getElementById('simQvTitle').textContent = `${attempt.student_name || 'Elev'} — ${sim?.title || ''}`;

    const violations = flagRow?.data?.tab_switch_count || 0;
    const dur = attempt.finished_at ? _fmtDuration(new Date(attempt.finished_at) - new Date(attempt.started_at)) : '—';
    const grade = attempt.grade_10 != null ? parseFloat(attempt.grade_10) : null;
    const gradeCls = grade == null ? '' : grade >= 9 ? 'hi' : grade >= 7 ? 'ok' : grade >= 5 ? 'mid' : 'lo';

    const rows = (items || []).map((it, idx) => {
      const a = answerMap[it.id];
      const correct = !!a?.is_correct;
      const isGrila = it.answer_type === 'grila';
      const yourAnswer = isGrila ? (a?.answer_text ? optLabel(it.id, a.answer_text) : '(fără răspuns)') : (a?.answer_text || '(fără răspuns)');
      const correctAnswer = isGrila ? optLabel(it.id, keyMap[it.id]) : (keyMap[it.id] || '—');
      const compareLbl = isGrila ? 'Alese' : 'Al tău';
      return `
        <div class="sim-qv-row sim-qv-row--${correct ? 'ok' : 'no'}">
          <div class="sim-qv-row__top">
            <span class="sim-qv-row__idx">${idx + 1}. ${BM.esc(it.title || '')}</span>
            <span class="sim-qv-row__mark">${correct ? '✓' : '✗'}</span>
            <span class="sim-qv-row__pts">${a?.points_earned ?? 0}/${it.points}p</span>
          </div>
          <div class="sim-qv-row__ans">${compareLbl}: ${BM.esc(yourAnswer)} — Corect: ${BM.esc(correctAnswer)}</div>
          ${a?.feedback_text ? `<div class="sim-qv-row__fb">💬 ${BM.esc(a.feedback_text)}</div>` : ''}
        </div>`;
    }).join('');

    const body = document.getElementById('simQvBody');
    body.innerHTML = `
      <div class="sim-qv-summary">
        <div class="sim-qv-grade sim-qv-grade--${gradeCls}">${attempt.grade_10 ?? '—'}</div>
        <div class="sim-qv-meta">
          <span class="sim-qv-meta__item">🎯 ${attempt.earned_points}/${attempt.total_points}p</span>
          <span class="sim-qv-meta__item">⏱ ${dur}</span>
          ${violations > 0 ? `<span class="sim-violation-badge">⚠ A părăsit fereastra de ${violations} ori</span>` : ''}
        </div>
      </div>
      <div class="sim-qv-list">${rows || '<p class="cs-empty">Niciun exercițiu.</p>'}</div>`;
  }

  /* ─── Per-student detail: per-exercise breakdown + teacher feedback ─── */
  async function openSimStudentDetail(attemptId) {
    document.getElementById('simDetailModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'simDetailModal';
    modal.className = 'classes-modal';
    modal.innerHTML = `
      <div class="classes-modal__backdrop"></div>
      <div class="classes-modal__dialog sim-live-dialog">
        <div class="classes-modal__head">
          <h3 id="simDetailTitle">Se încarcă…</h3>
          <button class="icon-btn" id="simDetailCloseBtn">✕</button>
        </div>
        <div class="classes-modal__body" id="simDetailBody">
          <div class="classes-loading"><div class="classes-spinner"></div></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const closeModal = () => {
      modal.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
    modal.querySelector('.classes-modal__backdrop').onclick = closeModal;
    modal.querySelector('#simDetailCloseBtn').onclick = closeModal;

    const { data: attempt } = await BMAuth.supabase.from('simulation_attempts').select('*').eq('id', attemptId).single();
    if (!attempt) { closeModal(); return; }
    const sim = simCache.find(s => s.id === attempt.simulation_id);

    const { data: items } = await BMAuth.supabase
      .from('simulation_items').select('*').eq('simulation_id', attempt.simulation_id).order('position');
    const itemIds = (items || []).map(i => i.id);

    const [{ data: keys }, { data: answers }, flagRow] = await Promise.all([
      BMAuth.supabase.from('simulation_answer_keys').select('*').in('simulation_item_id', itemIds),
      BMAuth.supabase.from('simulation_answers').select('*').eq('attempt_id', attemptId),
      sim?.supervised
        ? BMAuth.supabase.from('simulation_attempt_flags').select('*').eq('attempt_id', attemptId).maybeSingle()
        : Promise.resolve({ data: null })
    ]);
    const options = await _simFetchOptionsFor(items || []);

    const keyMap = {}; (keys || []).forEach(k => { keyMap[k.simulation_item_id] = k.correct_answer; });
    const answerMap = {}; (answers || []).forEach(a => { answerMap[a.simulation_item_id] = a; });
    const optLabel = (itemId, optionId) => (options[itemId] || []).find(o => o.id === optionId)?.label || '—';

    document.getElementById('simDetailTitle').textContent = `${attempt.student_name || 'Elev'} — ${sim?.title || ''}`;

    const violations = flagRow?.data?.tab_switch_count || 0;
    const rows = (items || []).map((it, idx) => {
      const a = answerMap[it.id];
      const correct = !!a?.is_correct;
      const isGrila = it.answer_type === 'grila';
      const yourAnswer = isGrila ? (a?.answer_text ? optLabel(it.id, a.answer_text) : '(fără răspuns)') : (a?.answer_text || '(fără răspuns)');
      const correctAnswer = isGrila ? optLabel(it.id, keyMap[it.id]) : (keyMap[it.id] || '—');
      const fb = a?.feedback_text || '';
      return `
        <div class="sim-result-card sim-result-card--${correct ? 'ok' : 'no'}">
          <div class="sim-result-card__head">
            <span class="sim-result-card__idx">${idx + 1}</span>
            <span class="sim-result-card__pts">${a?.points_earned ?? 0}/${it.points}p</span>
            <span class="sim-result-card__mark">${correct ? '✓' : '✕'}</span>
          </div>
          <div class="sim-result-card__statement math-content" id="simDetailStatement${idx}"></div>
          <div class="sim-result-card__answers">
            <div class="sim-result-answer">
              <span class="sim-result-answer__lbl">Răspunsul elevului</span>
              <span class="sim-result-answer__val">${BM.esc(yourAnswer)}</span>
            </div>
            <div class="sim-result-answer sim-result-answer--correct">
              <span class="sim-result-answer__lbl">Răspuns corect</span>
              <span class="sim-result-answer__val">${BM.esc(correctAnswer)}</span>
            </div>
          </div>
          ${a ? `
          <div class="sim-detail-feedback" data-answer-id="${a.id}">
            <div class="sim-detail-feedback__view" style="${fb ? '' : 'display:none'}">
              💬 <span class="sim-detail-feedback__text">${BM.esc(fb)}</span>
              <button type="button" class="sim-detail-feedback__editbtn" data-fb-edit="${a.id}">✎ Editează</button>
            </div>
            <button type="button" class="btn btn--surface btn--sm" data-fb-add="${a.id}" style="${fb ? 'display:none' : ''}">+ Adaugă feedback</button>
            <div class="sim-detail-feedback__form" data-fb-form="${a.id}" style="display:none">
              <textarea class="cls-form-input cls-form-textarea" rows="2" data-fb-input="${a.id}" placeholder="ex: Ai uitat să verifici domeniul de definiție">${BM.esc(fb)}</textarea>
              <button type="button" class="btn btn--primary btn--sm" data-fb-save="${a.id}">Salvează</button>
            </div>
          </div>` : ''}
        </div>`;
    }).join('');

    const body = document.getElementById('simDetailBody');
    body.innerHTML = `
      ${violations > 0 ? `<div class="sim-violation-badge" style="margin-bottom:14px;display:inline-block">⚠ A părăsit fereastra de ${violations} ori</div>` : ''}
      <div class="sim-result-summary" style="margin-bottom:16px">
        <div class="sim-result-summary__stat">
          <div class="sim-result-summary__val">${attempt.grade_10 ?? '—'}</div>
          <div class="sim-result-summary__lbl">Notă</div>
        </div>
        <div class="sim-result-summary__divider"></div>
        <div class="sim-result-summary__stat">
          <div class="sim-result-summary__val">${attempt.earned_points}<span class="sim-result-summary__val-sep">/</span>${attempt.total_points}</div>
          <div class="sim-result-summary__lbl">Punctaj</div>
        </div>
      </div>
      <div class="sim-result-list">${rows}</div>`;

    (items || []).forEach((it, idx) => {
      const el = document.getElementById('simDetailStatement' + idx);
      if (!el) return;
      el.innerHTML = BM.trustedNl2br(it.statement || '');
      BM.renderMath(el);
    });

    _wireSimDetailFeedback(body);
  }

  function _wireSimDetailFeedback(body) {
    body.querySelectorAll('[data-fb-add], [data-fb-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.fbAdd || btn.dataset.fbEdit;
        const wrap = body.querySelector(`.sim-detail-feedback[data-answer-id="${id}"]`);
        wrap.querySelector('.sim-detail-feedback__view')?.style.setProperty('display', 'none');
        wrap.querySelector('[data-fb-add]')?.style.setProperty('display', 'none');
        wrap.querySelector(`[data-fb-form="${id}"]`).style.display = '';
      });
    });
    body.querySelectorAll('[data-fb-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.fbSave;
        const textarea = body.querySelector(`[data-fb-input="${id}"]`);
        const text = textarea.value.trim();
        btn.disabled = true;
        const { error } = await BMAuth.supabase.from('simulation_answers').update({ feedback_text: text || null }).eq('id', id);
        btn.disabled = false;
        if (error) { BM.toast('Eroare: ' + error.message, 'error'); return; }
        const wrap = body.querySelector(`.sim-detail-feedback[data-answer-id="${id}"]`);
        const viewEl = wrap.querySelector('.sim-detail-feedback__view');
        wrap.querySelector('.sim-detail-feedback__text').textContent = text;
        wrap.querySelector(`[data-fb-form="${id}"]`).style.display = 'none';
        if (text) {
          viewEl.style.display = '';
          wrap.querySelector('[data-fb-add]').style.display = 'none';
        } else {
          viewEl.style.display = 'none';
          wrap.querySelector('[data-fb-add]').style.display = '';
        }
        BM.toast('Feedback salvat.', 'success');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     SIMULATION TEMPLATES — reusable across any of the teacher's classes
     (scoped by created_by, not class_id). Fully teacher-only data, never
     read by a student, so correct answers can be stored inline.
  ═══════════════════════════════════════════════════════════════ */

  async function openSaveTemplateModal(sim) {
    document.getElementById('simSaveTplModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'simSaveTplModal';
    modal.className = 'classes-modal';
    modal.innerHTML = `
      <div class="classes-modal__backdrop"></div>
      <div class="classes-modal__dialog">
        <div class="classes-modal__head">
          <h3>📋 Salvează ca șablon</h3>
          <button class="icon-btn" id="simSaveTplCloseBtn">✕</button>
        </div>
        <div class="classes-modal__body">
          <div class="cls-form-field">
            <label class="cls-form-label">Denumire șablon *</label>
            <input type="text" id="simSaveTplTitle" class="cls-form-input" value="${BM.esc(sim.title)}">
            <span class="cls-form-hint">Salvează exercițiile, timpul limită și modul supravegheat — reutilizabil la orice altă clasă.</span>
          </div>
          <button class="btn btn--primary" id="simSaveTplConfirmBtn">Salvează</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const closeModal = () => {
      modal.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
    modal.querySelector('.classes-modal__backdrop').onclick = closeModal;
    modal.querySelector('#simSaveTplCloseBtn').onclick = closeModal;
    modal.querySelector('#simSaveTplConfirmBtn').onclick = () => _saveAsTemplate(sim, modal);
  }

  async function _saveAsTemplate(sim, modal) {
    const title = document.getElementById('simSaveTplTitle').value.trim();
    if (!title) { BM.toast('Introdu o denumire.', 'error'); return; }
    const btn = document.getElementById('simSaveTplConfirmBtn');
    btn.disabled = true; btn.textContent = 'Se salvează…';
    try {
      const { data: dupe } = await BMAuth.supabase.from('simulation_templates')
        .select('id').eq('created_by', BMAuth.user.id).ilike('title', title).maybeSingle();
      if (dupe) {
        BM.toast('Ai deja un șablon cu această denumire — alege alta.', 'error');
        btn.disabled = false; btn.textContent = 'Salvează';
        return;
      }

      const { data: items } = await BMAuth.supabase.from('simulation_items').select('*').eq('simulation_id', sim.id).order('position');
      const itemIds = (items || []).map(i => i.id);
      const [{ data: keys }, { data: opts }] = await Promise.all([
        BMAuth.supabase.from('simulation_answer_keys').select('*').in('simulation_item_id', itemIds),
        BMAuth.supabase.from('simulation_item_options').select('*').in('simulation_item_id', itemIds).order('position')
      ]);
      const keyMap = {}; (keys || []).forEach(k => { keyMap[k.simulation_item_id] = k.correct_answer; });
      const optsByItem = {}; (opts || []).forEach(o => { (optsByItem[o.simulation_item_id] = optsByItem[o.simulation_item_id] || []).push(o); });

      const { data: tpl, error: tplErr } = await BMAuth.supabase.from('simulation_templates').insert({
        created_by: BMAuth.user.id, title, time_limit_minutes: sim.time_limit_minutes, supervised: !!sim.supervised
      }).select('id').single();
      if (tplErr) throw tplErr;

      for (let idx = 0; idx < (items || []).length; idx++) {
        const it = items[idx];
        const isGrila = it.answer_type === 'grila';
        const itemOpts = optsByItem[it.id] || [];
        const correctOptId = keyMap[it.id];
        // For grilă items, correct_answer is only an informational label here
        // (never graded directly off a template) — the real correctness flag
        // lives on simulation_template_options.is_correct, restored via
        // _useTemplate when this template later seeds a real simulation.
        const correctAnswerCol = isGrila
          ? (itemOpts.find(o => o.id === correctOptId)?.label || '')
          : (correctOptId || '');

        const { data: tplItem, error: tiErr } = await BMAuth.supabase.from('simulation_template_items').insert({
          template_id: tpl.id, position: idx,
          exercise_source: it.exercise_source, source_exercise_id: it.source_exercise_id,
          title: it.title, statement: it.statement, difficulty: it.difficulty, points: it.points,
          answer_type: it.answer_type, correct_answer: correctAnswerCol
        }).select('id').single();
        if (tiErr) throw tiErr;

        if (isGrila && itemOpts.length) {
          const rows = itemOpts.map(o => ({
            template_item_id: tplItem.id, label: o.label, position: o.position, is_correct: o.id === correctOptId
          }));
          const { error: toErr } = await BMAuth.supabase.from('simulation_template_options').insert(rows);
          if (toErr) throw toErr;
        }
      }
      BM.toast('Șablon salvat!', 'success');
      modal.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    } catch (e) {
      // 23505 = unique_violation — the pre-check above already covers the
      // common case, this is the final guard against a race between two
      // near-simultaneous saves (e.g. two tabs) slipping past it.
      const msg = e.code === '23505' || /duplicate key/i.test(e.message || '')
        ? 'Ai deja un șablon cu această denumire — alege alta.'
        : 'Eroare: ' + e.message;
      BM.toast(msg, 'error');
      btn.disabled = false; btn.textContent = 'Salvează';
    }
  }

  async function openSimTemplatePicker() {
    document.getElementById('simTemplateModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'simTemplateModal';
    modal.className = 'classes-modal';
    modal.innerHTML = `
      <div class="classes-modal__backdrop"></div>
      <div class="classes-modal__dialog">
        <div class="classes-modal__head">
          <h3>📋 Șabloane salvate</h3>
          <button class="icon-btn" id="simTplCloseBtn">✕</button>
        </div>
        <div class="classes-modal__body" id="simTplBody">
          <div class="classes-loading"><div class="classes-spinner"></div></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const closeModal = () => {
      modal.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
    modal.querySelector('.classes-modal__backdrop').onclick = closeModal;
    modal.querySelector('#simTplCloseBtn').onclick = closeModal;

    const { data: templates } = await BMAuth.supabase
      .from('simulation_templates').select('*').eq('created_by', BMAuth.user.id).order('created_at', { ascending: false });
    const body = document.getElementById('simTplBody');
    if (!templates || !templates.length) {
      body.innerHTML = `<p class="wz-subtitle">Nu ai niciun șablon salvat încă. Folosește butonul 📋 de pe o simulare existentă pentru a o salva ca șablon reutilizabil.</p>`;
      return;
    }
    body.innerHTML = `<div class="sim-tpl-list">${templates.map(t => `
      <div class="sim-tpl-row" data-tpl-id="${t.id}">
        <span class="sim-tpl-row__title">${BM.esc(t.title)}</span>
        <span class="sim-tpl-row__meta">${t.time_limit_minutes} min${t.supervised ? ' · 👁 supravegheat' : ''}</span>
      </div>`).join('')}</div>`;
    body.querySelectorAll('[data-tpl-id]').forEach(row => row.addEventListener('click', () => _useTemplate(row.dataset.tplId)));
  }

  async function _useTemplate(templateId) {
    const [{ data: tpl }, { data: tplItems }] = await Promise.all([
      BMAuth.supabase.from('simulation_templates').select('*').eq('id', templateId).single(),
      BMAuth.supabase.from('simulation_template_items').select('*').eq('template_id', templateId).order('position')
    ]);
    if (!tpl) return;
    const itemIds = (tplItems || []).map(i => i.id);
    let optsByItem = {};
    if (itemIds.length) {
      const { data: opts } = await BMAuth.supabase
        .from('simulation_template_options').select('*').in('template_item_id', itemIds).order('position');
      (opts || []).forEach(o => { (optsByItem[o.template_item_id] = optsByItem[o.template_item_id] || []).push(o); });
    }

    const items = (tplItems || []).map(i => {
      const base = {
        exercise_source: i.exercise_source, source_exercise_id: i.source_exercise_id,
        title: i.title, statement: i.statement, difficulty: i.difficulty, points: i.points,
        answer_type: i.answer_type
      };
      if (i.answer_type === 'grila') {
        base.options = (optsByItem[i.id] || []).map(o => ({ label: o.label, isCorrect: o.is_correct }));
      } else {
        base.correct_answer = i.correct_answer;
      }
      return base;
    });

    document.getElementById('simTemplateModal')?.remove();
    simWiz = {
      existingId: null, step: 1, title: tpl.title, scheduledAt: '',
      timeLimitMinutes: tpl.time_limit_minutes, supervised: tpl.supervised,
      startMode: 'schedule', items
    };
    BM.toast('Șablon încărcat — revizuiește detaliile și exercițiile înainte de a salva.', 'success');
    _simWzShowModal();
  }

  /* ═══════════════════════════════════════════════════════════════
     SIMULATION-BUILDER WIZARD
  ═══════════════════════════════════════════════════════════════ */

  async function openSimulationWizard(existing = null) {
    document.getElementById('simWizard')?.remove();

    let items = [];
    if (existing) {
      const { data: simItems } = await BMAuth.supabase
        .from('simulation_items').select('*').eq('simulation_id', existing.id).order('position');
      if (simItems?.length) {
        const ids = simItems.map(i => i.id);
        const [{ data: keys }, { data: opts }] = await Promise.all([
          BMAuth.supabase.from('simulation_answer_keys').select('*').in('simulation_item_id', ids),
          BMAuth.supabase.from('simulation_item_options').select('*').in('simulation_item_id', ids).order('position')
        ]);
        const keyMap = {};
        (keys || []).forEach(k => { keyMap[k.simulation_item_id] = k.correct_answer; });
        const optsByItem = {};
        (opts || []).forEach(o => { (optsByItem[o.simulation_item_id] = optsByItem[o.simulation_item_id] || []).push(o); });

        items = simItems.map(i => {
          const base = {
            exercise_source: i.exercise_source, source_exercise_id: i.source_exercise_id,
            title: i.title, statement: i.statement, difficulty: i.difficulty, points: i.points,
            answer_type: i.answer_type || 'liber'
          };
          if (i.answer_type === 'grila') {
            const correctId = keyMap[i.id];
            base.options = (optsByItem[i.id] || []).map(o => ({ label: o.label, isCorrect: o.id === correctId }));
          } else {
            base.correct_answer = keyMap[i.id] || '';
          }
          return base;
        });
      }
    }

    simWiz = {
      existingId: existing?.id || null,
      step: 1,
      title: existing?.title || '',
      scheduledAt: existing?.scheduled_at || '',
      timeLimitMinutes: existing?.time_limit_minutes || 30,
      supervised: existing?.supervised || false,
      startMode: existing?.status === 'activa' ? 'now' : 'schedule',
      items
    };
    _simWzShowModal();
  }

  function _simWzShowModal() {
    const modal = document.createElement('div');
    modal.id = 'simWizard';
    modal.className = 'wz-overlay';
    modal.innerHTML = `
      <div class="wz-backdrop" id="simWzBackdrop"></div>
      <div class="wz-dialog" role="dialog">
        <div class="wz-head">
          <span class="wz-head__title">${simWiz.existingId ? 'Editează Simularea' : 'Simulare Nouă'}</span>
          <div class="wz-steps" id="simWzSteps"></div>
          <button class="icon-btn" id="simWzCloseBtn">✕</button>
        </div>
        <div class="wz-body" id="simWzBody"></div>
        <div class="wz-foot">
          <button class="btn btn--surface" id="simWzBackBtn">← Înapoi</button>
          <button class="btn btn--primary" id="simWzNextBtn">Continuă →</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    modal.querySelector('#simWzBackdrop').onclick = _simWzClose;
    modal.querySelector('#simWzCloseBtn').onclick  = _simWzClose;
    modal.querySelector('#simWzBackBtn').onclick   = _simWzBack;
    modal.querySelector('#simWzNextBtn').onclick   = _simWzNext;

    _simWzRender();
  }

  function _simWzClose() {
    document.getElementById('simWizard')?.remove();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    simWiz = null;
  }

  function _simWzRender() {
    const body    = document.getElementById('simWzBody');
    const steps   = document.getElementById('simWzSteps');
    const backBtn = document.getElementById('simWzBackBtn');
    const nextBtn = document.getElementById('simWzNextBtn');
    if (!body || !steps || !backBtn || !nextBtn) return;

    const labels = ['Detalii', 'Exerciții', 'Revizuire'];
    steps.innerHTML = labels.map((l, i) => `
      <div class="wz-step-item">
        <div class="wz-step-dot${i + 1 < simWiz.step ? ' wz-step-dot--done' : ''}${i + 1 === simWiz.step ? ' wz-step-dot--active' : ''}">
          ${i + 1 < simWiz.step ? '✓' : i + 1}
        </div>
        <span class="wz-step-label">${l}</span>
      </div>
      ${i < 2 ? '<div class="wz-step-line"></div>' : ''}
    `).join('');

    backBtn.style.visibility = simWiz.step === 1 ? 'hidden' : '';
    nextBtn.textContent = simWiz.step === 3 ? (simWiz.existingId ? 'Salvează' : 'Salvează Simularea') : 'Continuă →';

    if (simWiz.step === 1) { body.innerHTML = _simWzStep1(); _simWzBindStep1(body); }
    if (simWiz.step === 2) { body.innerHTML = _simWzStep2(); _simWzBindStep2(body); }
    if (simWiz.step === 3) { body.innerHTML = _simWzStep3(); }
  }

  function _simWzStep1() {
    return `
      <div class="cls-form-field">
        <label class="cls-form-label">Titlu simulare *</label>
        <input type="text" id="simWzTitle" class="cls-form-input" maxlength="150"
               placeholder="ex: Simulare Logaritmi - Noiembrie" value="${BM.esc(simWiz.title)}">
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Timp limită (minute) *</label>
        <input type="number" id="simWzTimeLimit" class="cls-form-input" min="1" style="max-width:140px" value="${BM.esc(simWiz.timeLimitMinutes)}">
      </div>
      <div class="cls-form-field">
        <label class="cls-form-label">Pornire</label>
        <div class="wz-vis-row">
          <label class="wz-radio">
            <input type="radio" name="simWzStart" value="schedule" ${simWiz.startMode !== 'now' ? 'checked' : ''}>
            <span class="wz-radio__dot"></span>
            <span>Programează pentru mai târziu</span>
          </label>
          <label class="wz-radio">
            <input type="radio" name="simWzStart" value="now" ${simWiz.startMode === 'now' ? 'checked' : ''}>
            <span class="wz-radio__dot"></span>
            <span>Pornește imediat ce salvez</span>
          </label>
        </div>
      </div>
      <div class="cls-form-field" id="simWzScheduleField" style="${simWiz.startMode === 'now' ? 'display:none' : ''}">
        <label class="cls-form-label">Data și ora programată</label>
        <input type="text" id="simWzScheduledAt" class="cls-form-input" placeholder="Alege data și ora">
      </div>
      <div class="cls-form-field">
        <label class="wz-toggle">
          <input type="checkbox" id="simWzSupervised" ${simWiz.supervised ? 'checked' : ''}>
          <span class="wz-toggle__track"><span class="wz-toggle__thumb"></span></span>
          <span>Mod supravegheat</span>
        </label>
        <span class="cls-form-hint">Înregistrează silențios de câte ori elevul părăsește fereastra/ecranul complet în timpul simulării — vizibil doar pentru tine, la rezultate. Elevul nu este blocat sau anunțat.</span>
      </div>`;
  }

  function _simWzBindStep1(body) {
    body.querySelector('#simWzTitle').oninput      = e => { simWiz.title = e.target.value; };
    body.querySelector('#simWzTimeLimit').oninput  = e => { simWiz.timeLimitMinutes = e.target.value; };
    body.querySelector('#simWzSupervised').onchange = e => { simWiz.supervised = e.target.checked; };
    body.querySelectorAll('input[name="simWzStart"]').forEach(r => {
      r.onchange = e => {
        simWiz.startMode = e.target.value;
        const field = document.getElementById('simWzScheduleField');
        if (field) field.style.display = simWiz.startMode === 'now' ? 'none' : '';
      };
    });

    const dateEl = body.querySelector('#simWzScheduledAt');
    if (dateEl && window.flatpickr) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      flatpickr(dateEl, {
        locale: window.flatpickr.l10ns?.ro || 'default',
        enableTime: true,
        dateFormat: 'Y-m-d H:i',
        defaultDate: simWiz.scheduledAt || null,
        disableMobile: true,
        allowInput: false,
        theme: isDark ? 'dark' : 'light',
        onChange(selectedDates) { simWiz.scheduledAt = selectedDates[0] ? selectedDates[0].toISOString() : ''; }
      });
    }
  }

  function _simWzStep2() {
    const totalPoints = simWiz.items.reduce((s, i) => s + (Number(i.points) || 0), 0);
    return `
      <p class="wz-subtitle">Exerciții adăugate (${simWiz.items.length}) — total ${totalPoints} puncte</p>
      <div class="sim-wz-item-list">
        ${simWiz.items.length === 0
          ? `<div class="wz-soon-msg"><span>📚</span><p>Niciun exercițiu adăugat încă.</p></div>`
          : simWiz.items.map((it, idx) => `
            <div class="sim-wz-item" data-idx="${idx}">
              <span class="sim-wz-item__idx">${idx + 1}</span>
              <div class="sim-wz-item__body">
                <div class="sim-wz-item__title">${BM.esc(it.title)}</div>
                <div class="sim-wz-item__meta">${it.points}p ${it.difficulty ? '· ' + BM.diffBadge(it.difficulty) : ''} ${it.answer_type === 'grila' ? '· 🔘 Grilă' : ''}</div>
                <div class="sim-wz-item__answer">Răspuns corect: <strong>${BM.esc(it.answer_type === 'grila' ? ((it.options || []).find(o => o.isCorrect)?.label || '—') : (it.correct_answer || '—'))}</strong></div>
              </div>
              <div class="sim-wz-item__actions">
                <button type="button" class="dc-tool-btn" data-move-up="${idx}" ${idx === 0 ? 'disabled' : ''} title="Mută sus">▲</button>
                <button type="button" class="dc-tool-btn" data-move-down="${idx}" ${idx === simWiz.items.length - 1 ? 'disabled' : ''} title="Mută jos">▼</button>
                <button type="button" class="dc-tool-btn" data-remove-item="${idx}" title="Elimină">✕</button>
              </div>
            </div>`).join('')}
      </div>
      <button class="btn btn--surface" id="simWzAddExerciseBtn" style="margin-top:14px">+ Adaugă exercițiu</button>`;
  }

  function _simWzBindStep2(body) {
    body.querySelectorAll('[data-move-up]').forEach(btn => btn.onclick = () => {
      const i = Number(btn.dataset.moveUp);
      if (i > 0) { [simWiz.items[i - 1], simWiz.items[i]] = [simWiz.items[i], simWiz.items[i - 1]]; _simWzRender(); }
    });
    body.querySelectorAll('[data-move-down]').forEach(btn => btn.onclick = () => {
      const i = Number(btn.dataset.moveDown);
      if (i < simWiz.items.length - 1) { [simWiz.items[i + 1], simWiz.items[i]] = [simWiz.items[i], simWiz.items[i + 1]]; _simWzRender(); }
    });
    body.querySelectorAll('[data-remove-item]').forEach(btn => btn.onclick = () => {
      simWiz.items.splice(Number(btn.dataset.removeItem), 1);
      _simWzRender();
    });
    body.querySelector('#simWzAddExerciseBtn').onclick = () => openSimExercisePicker();
  }

  function _simWzStep3() {
    const totalPoints = simWiz.items.reduce((s, i) => s + (Number(i.points) || 0), 0);
    return `
      <h3 style="font-size:1.1rem;font-weight:700;color:var(--text);margin-bottom:14px">${BM.esc(simWiz.title || '(fără titlu)')}</h3>
      <p class="wz-subtitle">${simWiz.items.length} exerciții · ${totalPoints} puncte · ${simWiz.timeLimitMinutes} minute</p>
      <p class="wz-subtitle">${simWiz.startMode === 'now' ? 'Va porni imediat ce salvezi.' : ('Programată pentru: ' + (simWiz.scheduledAt ? formatSimDateTime(simWiz.scheduledAt) : 'nespecificat'))}</p>`;
  }

  function _simWzBack() { if (simWiz.step > 1) { simWiz.step--; _simWzRender(); } }

  function _simWzNext() {
    if (simWiz.step === 1) {
      if (!simWiz.title.trim()) { BM.toast('Introdu titlul simulării.', 'error'); return; }
      if (!Number(simWiz.timeLimitMinutes) || Number(simWiz.timeLimitMinutes) <= 0) { BM.toast('Introdu un timp limită valid.', 'error'); return; }
      if (simWiz.startMode === 'schedule' && !simWiz.scheduledAt) { BM.toast('Alege data și ora programată, sau alege pornire imediată.', 'error'); return; }
      simWiz.step = 2; _simWzRender(); return;
    }
    if (simWiz.step === 2) {
      if (simWiz.items.length === 0) { BM.toast('Adaugă cel puțin un exercițiu.', 'error'); return; }
      simWiz.step = 3; _simWzRender(); return;
    }
    if (simWiz.step === 3) _simWzSave();
  }

  async function _simWzSave() {
    const btn = document.getElementById('simWzNextBtn');
    btn.disabled = true; btn.textContent = 'Se salvează…';
    try {
      const wantsActive = simWiz.startMode === 'now';
      // simulation_items/simulation_answer_keys can only be inserted/edited/
      // deleted while the parent simulation is still 'programata' (see
      // sim_items_teacher_insert/update/delete RLS, added to stop a teacher
      // from wiping items out from under students mid-exam) — so ALWAYS
      // create/update the simulation row as 'programata' first, do every
      // item/key write, and only THEN flip it to 'activa' as its own final
      // step once the items actually exist. Doing it in the original order
      // (status='activa' up front) made the very first item insert violate
      // that same policy, silently producing an empty, unsolvable simulation
      // whenever "Pornește imediat ce salvez" was chosen.
      const payload = {
        class_id: classData.id,
        title: simWiz.title.trim(),
        time_limit_minutes: Number(simWiz.timeLimitMinutes),
        status: 'programata',
        supervised: !!simWiz.supervised,
        scheduled_at: wantsActive ? null : (simWiz.scheduledAt || null),
        started_at: null
      };

      let simId = simWiz.existingId;
      if (simId) {
        const { error } = await BMAuth.supabase.from('simulations').update(payload).eq('id', simId);
        if (error) throw error;
        await BMAuth.supabase.from('simulation_items').delete().eq('simulation_id', simId);
      } else {
        const { data, error } = await BMAuth.supabase.from('simulations')
          .insert(Object.assign({ created_by: BMAuth.user.id }, payload))
          .select('id').single();
        if (error) throw error;
        simId = data.id;
      }

      // Inserted sequentially (not a single bulk insert) so each item's
      // returned id can be paired with its own answer key without relying
      // on the order of a multi-row INSERT ... RETURNING matching input order.
      for (let idx = 0; idx < simWiz.items.length; idx++) {
        const it = simWiz.items[idx];
        const { data: itemRow, error: itemErr } = await BMAuth.supabase.from('simulation_items').insert({
          simulation_id: simId, position: idx,
          exercise_source: it.exercise_source, source_exercise_id: it.source_exercise_id || null,
          title: it.title, statement: it.statement, difficulty: it.difficulty || null,
          points: Number(it.points) || 1,
          answer_type: it.answer_type === 'grila' ? 'grila' : 'liber'
        }).select('id').single();
        if (itemErr) throw itemErr;

        let correctAnswer = it.correct_answer;
        if (it.answer_type === 'grila') {
          // The options themselves carry no correctness info (students can
          // read this table) — the correct option's own id becomes the
          // answer key, same column already used for free-text answers.
          const optionRows = it.options.map((o, i) => ({
            simulation_item_id: itemRow.id, label: o.label, position: i
          }));
          const { data: insertedOpts, error: optErr } = await BMAuth.supabase
            .from('simulation_item_options').insert(optionRows).select('id, position');
          if (optErr) throw optErr;
          const correctIdx = it.options.findIndex(o => o.isCorrect);
          const correctRow = insertedOpts.find(o => o.position === correctIdx);
          correctAnswer = correctRow.id;
        }

        const { error: keyErr } = await BMAuth.supabase.from('simulation_answer_keys').insert({
          simulation_item_id: itemRow.id, correct_answer: String(correctAnswer || '').trim()
        });
        if (keyErr) throw keyErr;
      }

      // All items/keys exist now — safe to flip the simulation live.
      if (wantsActive) {
        const { error: activateErr } = await BMAuth.supabase.from('simulations')
          .update({ status: 'activa', started_at: new Date().toISOString() }).eq('id', simId);
        if (activateErr) throw activateErr;
      }

      if (!simWiz.existingId) {
        window.BMPush?.sendClassPush(classData.id, wantsActive ? 'simulare_started' : 'simulare_scheduled', {
          sim_title: payload.title,
          when: wantsActive ? '' : formatSimDateTime(payload.scheduled_at)
        });
      }

      BM.toast(simWiz.existingId ? 'Simularea a fost actualizată!' : 'Simularea a fost creată!', 'success');
      _simWzClose();
      await loadSimulariTab();
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = simWiz.existingId ? 'Salvează' : 'Salvează Simularea';
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     NESTED EXERCISE PICKER — "Din bancă" / "Adaugă exercițiu nou din poză"
  ═══════════════════════════════════════════════════════════════ */

  function openSimExercisePicker() {
    document.getElementById('simPickerModal')?.remove();
    const gradeCode = _gradeCodeFromSchoolGrade(classData.school_grade);
    const useBacTaxonomy = gradeCode === '9' || gradeCode === 'bac';

    simPicker = { tab: 'bank', gradeCode, useBacTaxonomy, categoryId: '', subcategoryId: '', query: '', difficulty: '', results: [], photo: {} };

    const modal = document.createElement('div');
    modal.id = 'simPickerModal';
    modal.className = 'wz-overlay';
    modal.innerHTML = `
      <div class="wz-backdrop" id="simPickerBackdrop"></div>
      <div class="wz-dialog sim-picker-dialog" role="dialog">
        <div class="wz-head">
          <span class="wz-head__title">Adaugă exercițiu</span>
          <button class="icon-btn" id="simPickerCloseBtn">✕</button>
        </div>
        <div class="wz-body">
          <div class="sim-picker-tabs">
            <button type="button" class="sim-picker-tab sim-picker-tab--active" data-picker-tab="bank">Din bancă</button>
            <button type="button" class="sim-picker-tab" data-picker-tab="photo">Adaugă exercițiu nou din poză</button>
          </div>
          <div id="simPickerBody"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#simPickerBackdrop').onclick = _simPickerClose;
    modal.querySelector('#simPickerCloseBtn').onclick  = _simPickerClose;
    modal.querySelectorAll('.sim-picker-tab').forEach(btn => btn.onclick = () => {
      simPicker.tab = btn.dataset.pickerTab;
      modal.querySelectorAll('.sim-picker-tab').forEach(b => b.classList.toggle('sim-picker-tab--active', b === btn));
      _simPickerRenderBody();
    });

    _simPickerRenderBody();
  }

  function _simPickerClose() {
    document.getElementById('simPickerModal')?.remove();
    simPicker = null;
  }

  function _simPickerRenderBody() {
    const body = document.getElementById('simPickerBody');
    if (!body) return;
    if (simPicker.tab === 'bank') { body.innerHTML = _simPickerBankHtml(); _simPickerBindBank(body); }
    else                          { body.innerHTML = _simPickerPhotoHtml(); _simPickerBindPhoto(body); }
  }

  const SIM_DIFF_CHIPS = [
    { id: 'usor',    label: 'Ușor' },
    { id: 'mediu',   label: 'Mediu' },
    { id: 'dificil', label: 'Greu' }
  ];

  function _simDiffChipsHtml() {
    return `
      <div class="cls-form-field">
        <label class="cls-form-label">Dificultate</label>
        <div class="sim-diff-chips">
          ${SIM_DIFF_CHIPS.map(d => `
            <button type="button" class="diff-chip diff-chip--${d.id} ${simPicker.difficulty === d.id ? 'diff-chip--active' : ''}" data-diff-chip="${d.id}">${d.label}</button>`).join('')}
        </div>
      </div>`;
  }

  /* ─── Shared "Tip răspuns" (liber / grilă) builder ───────────────────
     Used by both confirm panels (bank-pick and photo-scan) — only one is
     ever open at a time, so a single module-level state is safe. */
  let _simOptBuilder = null;

  function _simOptBuilderInit() {
    _simOptBuilder = { answerType: 'liber', options: [{ label: '', isCorrect: true }, { label: '', isCorrect: false }] };
  }

  // Swaps which of the two answer-type fields is visible, fading the one
  // that appears in instead of an abrupt display:none jump-cut.
  function _simSwapAnswerType(type, answerWrap, optionsWrap) {
    const showEl = type === 'grila' ? optionsWrap : answerWrap;
    const hideEl = type === 'grila' ? answerWrap  : optionsWrap;
    hideEl.style.display = 'none';
    showEl.style.display = '';
    showEl.classList.remove('sim-answer-fade-in');
    void showEl.offsetWidth; // restart the animation if it's already run once
    showEl.classList.add('sim-answer-fade-in');
  }

  function _simAnswerTypeRadioHtml(prefix) {
    return `
      <div class="cls-form-field">
        <label class="cls-form-label">Tip răspuns</label>
        <div class="wz-vis-row">
          <label class="wz-radio">
            <input type="radio" name="${prefix}AnswerType" value="liber" ${_simOptBuilder.answerType === 'liber' ? 'checked' : ''}>
            <span class="wz-radio__dot"></span><span>Răspuns liber</span>
          </label>
          <label class="wz-radio">
            <input type="radio" name="${prefix}AnswerType" value="grila" ${_simOptBuilder.answerType === 'grila' ? 'checked' : ''}>
            <span class="wz-radio__dot"></span><span>Grilă (variante multiple)</span>
          </label>
        </div>
      </div>`;
  }

  function _simOptBuilderRowsHtml() {
    const letters = 'ABCDEFGH';
    return `
      <div class="cls-form-field">
        <label class="cls-form-label">Variante de răspuns *</label>
        <div class="sim-opt-list">
          ${_simOptBuilder.options.map((o, i) => `
            <div class="sim-opt-row" data-opt-idx="${i}">
              <span class="sim-opt-row__letter">${letters[i] || i + 1}</span>
              <input type="radio" name="simOptCorrect" class="sim-opt-row__radio" data-opt-correct="${i}" ${o.isCorrect ? 'checked' : ''} title="Marchează ca răspuns corect">
              <input type="text" class="cls-form-input sim-opt-row__input" data-opt-label="${i}" value="${BM.esc(o.label)}" placeholder="Text variantă ${letters[i] || i + 1}">
              <button type="button" class="dc-tool-btn" data-opt-remove="${i}" ${_simOptBuilder.options.length <= 2 ? 'disabled' : ''} title="Elimină">✕</button>
            </div>`).join('')}
        </div>
        <button type="button" class="btn btn--surface btn--sm" id="simOptAddBtn" ${_simOptBuilder.options.length >= 6 ? 'disabled' : ''} style="margin-top:8px">+ Adaugă variantă</button>
        <span class="cls-form-hint">Marchează cu butonul din stânga variantei care este corectă.</span>
      </div>`;
  }

  function _simOptBuilderBind(container) {
    container.querySelectorAll('[data-opt-label]').forEach(inp => {
      inp.oninput = () => { _simOptBuilder.options[Number(inp.dataset.optLabel)].label = inp.value; };
    });
    container.querySelectorAll('[data-opt-correct]').forEach(radio => {
      radio.onchange = () => {
        _simOptBuilder.options.forEach((o, i) => { o.isCorrect = i === Number(radio.dataset.optCorrect); });
      };
    });
    container.querySelectorAll('[data-opt-remove]').forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.optRemove);
        const wasCorrect = _simOptBuilder.options[i].isCorrect;
        _simOptBuilder.options.splice(i, 1);
        if (wasCorrect && _simOptBuilder.options[0]) _simOptBuilder.options[0].isCorrect = true;
        _simOptBuilderRerender(container);
      };
    });
    container.querySelector('#simOptAddBtn').onclick = () => {
      _simOptBuilder.options.push({ label: '', isCorrect: false });
      _simOptBuilderRerender(container);
    };
  }

  function _simOptBuilderRerender(container) {
    container.innerHTML = _simOptBuilderRowsHtml();
    _simOptBuilderBind(container);
  }

  function _simValidateOptions() {
    const opts = _simOptBuilder.options.map(o => ({ label: o.label.trim(), isCorrect: o.isCorrect }));
    if (opts.some(o => !o.label)) { BM.toast('Completează textul tuturor variantelor.', 'error'); return null; }
    if (!opts.some(o => o.isCorrect)) { BM.toast('Marchează varianta corectă.', 'error'); return null; }
    return opts;
  }

  function _simPickerBankHtml() {
    const confirmPlaceholder = `<div id="simPickConfirm"><p class="sim-picker-confirm-placeholder">Selectează un exercițiu din listă pentru a-l previzualiza aici.</p></div>`;
    if (simPicker.useBacTaxonomy) {
      const cat  = BM.getCategoryById(simPicker.categoryId);
      const subs = cat ? cat.subcategories : [];
      return `
        <div class="sim-picker-bank-grid">
          <div class="sim-picker-bank-col">
            <div class="cls-form-field">
              <label class="cls-form-label">Capitol</label>
              <select id="simPickCategory" class="cls-form-input cls-form-select">
                <option value="">Toate capitolele</option>
                ${BM.CATEGORIES.map(c => `<option value="${c.id}" ${simPicker.categoryId === c.id ? 'selected' : ''}>${BM.esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="cls-form-field">
              <label class="cls-form-label">Subcapitol</label>
              <select id="simPickSubcategory" class="cls-form-input cls-form-select" ${!cat ? 'disabled' : ''}>
                <option value="">Toate subcapitolele</option>
                ${subs.map(s => `<option value="${s.id}" ${simPicker.subcategoryId === s.id ? 'selected' : ''}>${BM.esc(s.name)}</option>`).join('')}
              </select>
            </div>
            ${_simDiffChipsHtml()}
            <div id="simPickResults" class="sim-picker-results"></div>
          </div>
          <div class="sim-picker-bank-col sim-picker-bank-col--confirm">${confirmPlaceholder}</div>
        </div>`;
    }
    return `
      <div class="sim-picker-bank-grid">
        <div class="sim-picker-bank-col">
          <div class="cls-form-field">
            <label class="cls-form-label">Caută exercițiu</label>
            <input type="text" id="simPickSearch" class="cls-form-input" placeholder="Caută după titlu…">
          </div>
          ${_simDiffChipsHtml()}
          <div id="simPickResults" class="sim-picker-results"></div>
        </div>
        <div class="sim-picker-bank-col sim-picker-bank-col--confirm">${confirmPlaceholder}</div>
      </div>`;
  }

  async function _simPickerBindBank(body) {
    const catSel  = body.querySelector('#simPickCategory');
    const subSel  = body.querySelector('#simPickSubcategory');
    const searchInput = body.querySelector('#simPickSearch');

    if (catSel) {
      catSel.onchange = e => {
        simPicker.categoryId = e.target.value;
        simPicker.subcategoryId = '';
        _simPickerRenderBody();
      };
    }
    if (subSel) subSel.onchange = e => { simPicker.subcategoryId = e.target.value; _simPickerRunBankSearch(); };
    body.querySelectorAll('[data-diff-chip]').forEach(chip => {
      chip.onclick = () => {
        const id = chip.dataset.diffChip;
        simPicker.difficulty = simPicker.difficulty === id ? '' : id;
        body.querySelectorAll('[data-diff-chip]').forEach(c => {
          c.classList.toggle('diff-chip--active', c.dataset.diffChip === simPicker.difficulty);
        });
        _simPickerRunBankSearch();
      };
    });
    if (searchInput) searchInput.oninput = BM.debounce(e => { simPicker.query = e.target.value; _simPickerRunBankSearch(); }, 300);

    BM.initCustomSelects(body);
    await _simPickerRunBankSearch();
  }

  async function _simPickerRunBankSearch() {
    const resultsEl = document.getElementById('simPickResults');
    if (!resultsEl) return;

    // Bac-taxonomy view spans hundreds of exercises across every chapter —
    // dumping an arbitrary slice of them (always the same first chapter)
    // before the user has picked anything is more confusing than helpful.
    // Wait for at least a Capitol before querying.
    if (simPicker.useBacTaxonomy && !simPicker.categoryId) {
      simPicker.results = [];
      resultsEl.innerHTML = `<p class="sim-picker-confirm-placeholder">Alege un capitol pentru a vedea exercițiile disponibile.</p>`;
      return;
    }

    resultsEl.innerHTML = `<div class="classes-loading"><div class="classes-spinner"></div></div>`;

    let results = [];
    if (simPicker.useBacTaxonomy) {
      const staticMatches = (BM.EXERCISES || []).filter(ex => {
        if (ex.categoryId !== simPicker.categoryId) return false;
        if (simPicker.subcategoryId && ex.subcategoryId !== simPicker.subcategoryId) return false;
        if (simPicker.difficulty && ex.difficulty !== simPicker.difficulty) return false;
        return true;
      }).slice(0, 40);

      let customQuery = BMAuth.supabase.from('custom_exercises').select('*').eq('grade', simPicker.gradeCode)
        .eq('category_id', simPicker.categoryId);
      if (simPicker.subcategoryId) customQuery = customQuery.eq('subcategory_id', simPicker.subcategoryId);
      if (simPicker.difficulty)    customQuery = customQuery.eq('difficulty', simPicker.difficulty);
      const { data: customMatches } = await customQuery.limit(40);

      results = [
        ...staticMatches.map(ex => Object.assign({}, ex, { _source: 'bank' })),
        ...(customMatches || []).map(row => ({
          id: row.id, categoryId: row.category_id, subcategoryId: row.subcategory_id,
          difficulty: row.difficulty, title: row.title, statement: row.statement, solution: row.solution,
          puncteTotal: row.punctaj_total, _source: 'custom'
        }))
      ];
    } else {
      let q = BMAuth.supabase.from('custom_exercises').select('*').eq('grade', simPicker.gradeCode);
      if (simPicker.query)      q = q.ilike('title', `%${simPicker.query}%`);
      if (simPicker.difficulty) q = q.eq('difficulty', simPicker.difficulty);
      const { data } = await q.limit(40);
      results = (data || []).map(row => ({
        id: row.id, categoryId: row.category_id, subcategoryId: row.subcategory_id,
        difficulty: row.difficulty, title: row.title, statement: row.statement, solution: row.solution,
        puncteTotal: row.punctaj_total, _source: 'custom'
      }));
    }

    simPicker.results = results;
    resultsEl.innerHTML = results.length === 0
      ? `<p class="wz-subtitle">Niciun exercițiu găsit.</p>`
      : results.map((ex, idx) => `
          <div class="sim-picker-result" data-idx="${idx}">
            <span class="sim-picker-result__title">${BM.esc(ex.title)}</span>
            ${ex.difficulty ? BM.diffBadge(ex.difficulty) : ''}
          </div>`).join('');

    resultsEl.querySelectorAll('.sim-picker-result').forEach(row => {
      row.onclick = () => _simPickerSelectExercise(simPicker.results[Number(row.dataset.idx)]);
    });
  }

  function _simPickerSelectExercise(ex) {
    // extractBoxedAnswer pulls the raw LaTeX out of the solution (e.g.
    // "\frac{3}{2}") — converted here into the plain/Unicode form a student
    // would actually type with the answer toolbar (e.g. "3/2"), since exact
    // grading compares literal text, not LaTeX meaning.
    const suggested = BM.latexToPlain(BM.extractBoxedAnswer(ex.solution) || '');
    const confirmEl = document.getElementById('simPickConfirm');
    if (!confirmEl) return;
    const defaultPoints = ex.puncteTotal || (ex.barem || []).reduce((s, p) => s + (p.puncte_maxime || 0), 0) || 5;
    _simOptBuilderInit();

    confirmEl.innerHTML = `
      <div class="sim-picker-confirm">
        <div class="sim-picker-confirm__statement math-content" id="simPickStatementPreview"></div>
        <div class="cls-form-field">
          <label class="cls-form-label">Punctaj *</label>
          <input type="number" id="simPickPoints" class="cls-form-input" min="1" style="max-width:120px" value="${defaultPoints}">
        </div>
        ${_simAnswerTypeRadioHtml('simPick')}
        <div id="simPickAnswerWrap" class="cls-form-field">
          <label class="cls-form-label">Răspuns corect *</label>
          <input type="text" id="simPickAnswer" class="cls-form-input" value="${BM.esc(suggested)}" placeholder="ex: -1, x=3, {1,2}">
          <span class="cls-form-hint">${suggested ? 'Extras automat din soluție — verifică înainte de a confirma.' : 'Nu am putut extrage automat un răspuns — introdu-l manual.'} Scrie-l cum l-ar tasta elevul (cu simbolurile ∈ √ etc.), nu cod LaTeX — altfel nu se va potrivi la corectare. Dacă răspunsul are mai multe valori (ex: două rădăcini), scrie-le mereu în aceeași ordine — corectarea compară text exact, nu recunoaște "2, 3" ca fiind identic cu "3, 2".</span>
        </div>
        <div id="simPickOptionsWrap" style="display:none">${_simOptBuilderRowsHtml()}</div>
        <button class="btn btn--primary" id="simPickConfirmBtn">+ Adaugă la simulare</button>
      </div>`;

    const stEl = document.getElementById('simPickStatementPreview');
    stEl.innerHTML = BM.trustedNl2br(ex.statement || '');
    BM.renderMath(stEl);

    const answerWrap  = document.getElementById('simPickAnswerWrap');
    const optionsWrap = document.getElementById('simPickOptionsWrap');
    _simOptBuilderBind(optionsWrap);
    confirmEl.querySelectorAll('input[name="simPickAnswerType"]').forEach(r => r.onchange = e => {
      _simOptBuilder.answerType = e.target.value;
      _simSwapAnswerType(e.target.value, answerWrap, optionsWrap);
    });

    document.getElementById('simPickConfirmBtn').onclick = () => {
      const points = Number(document.getElementById('simPickPoints').value) || 1;
      const base = {
        exercise_source: ex._source === 'custom' ? 'custom' : 'bank',
        source_exercise_id: String(ex.id),
        title: ex.title, statement: ex.statement, difficulty: ex.difficulty || null, points
      };
      if (_simOptBuilder.answerType === 'grila') {
        const opts = _simValidateOptions();
        if (!opts) return;
        simWiz.items.push(Object.assign({}, base, { answer_type: 'grila', options: opts }));
      } else {
        const answer = document.getElementById('simPickAnswer').value.trim();
        if (!answer) { BM.toast('Introdu răspunsul corect.', 'error'); return; }
        simWiz.items.push(Object.assign({}, base, { answer_type: 'liber', correct_answer: answer }));
      }
      BM.toast('Exercițiu adăugat.', 'success');
      _simPickerClose();
      _simWzRender();
    };
  }

  function _simPickerPhotoHtml() {
    const photo = simPicker.photo || {};
    return `
      <p class="wz-subtitle">Încarcă o fotografie a exercițiului din culegere.</p>
      <div class="wz-upload-zone">
        <input type="file" id="simPickFileInput" class="wz-file-input" accept="image/jpeg,image/png,image/heic,image/heif">
        ${photo.previewUrl
          ? `<img src="${photo.previewUrl}" alt="Previzualizare" style="max-width:100%;max-height:280px;border-radius:10px;border:1px solid var(--border);display:block;margin:0 auto">`
          : `<label for="simPickFileInput" class="wz-upload-drop">
               <span class="wz-upload-drop__icon">⬆</span>
               <span class="wz-upload-drop__main">Trage fotografia aici sau <u>alege din calculator</u></span>
               <span class="wz-upload-drop__hint">JPG, PNG, HEIC</span>
             </label>`}
      </div>
      ${photo.previewUrl ? `
        <div class="sim-picker-photo-actions">
          <button class="btn btn--surface btn--sm" id="simPickReplacePhoto">Schimbă fotografia</button>
          ${!photo.aiResult ? `<button class="btn btn--primary" id="simPickAnalyzeBtn">Analizează cu AI →</button>` : ''}
        </div>` : ''}
      <div id="simPickPhotoResult"></div>`;
  }

  function _simPickerBindPhoto(body) {
    const fi = body.querySelector('#simPickFileInput');
    fi.onchange = () => { if (fi.files[0]) _simPickerLoadPhoto(fi.files[0]); };
    body.querySelector('#simPickReplacePhoto')?.addEventListener('click', () => {
      simPicker.photo = {};
      _simPickerRenderBody();
    });
    body.querySelector('#simPickAnalyzeBtn')?.addEventListener('click', () => _simPickerAnalyzePhoto());
    // Restores the review fields after any full re-render (tab switch, or
    // right after a fresh analysis) without re-spending an AI call.
    if (simPicker.photo?.aiResult) _simPickerRenderPhotoReview(simPicker.photo.aiResult);
  }

  function _simPickerLoadPhoto(file) {
    const reader = new FileReader();
    reader.onload = () => {
      simPicker.photo = {
        file, mimeType: file.type,
        previewUrl: reader.result,
        imageBase64: String(reader.result).split(',')[1] || '',
        aiResult: null
      };
      _simPickerRenderBody();
    };
    reader.readAsDataURL(file);
  }

  async function _simPickerAnalyzePhoto() {
    const resultEl = document.getElementById('simPickPhotoResult');
    resultEl.innerHTML = `<div class="classes-loading"><div class="classes-spinner"></div><p>AI-ul analizează exercițiul…</p></div>`;
    try {
      const { data: { session } } = await BMAuth.supabase.auth.getSession();
      const cat = BM.getCategoryById(simPicker.categoryId);
      const res = await fetch('/api/class/generate-simulation-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session?.access_token,
          imageBase64: simPicker.photo.imageBase64,
          mimeType: simPicker.photo.mimeType,
          context: { grade: simPicker.gradeCode, categoryName: cat?.name }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare AI');
      simPicker.photo.aiResult = data;
      // Full re-render (not just the result box) so the "Analizează cu AI"
      // button disappears now that this photo has already been analyzed.
      _simPickerRenderBody();
    } catch (e) {
      resultEl.innerHTML = `<p style="color:#ef4444">Eroare: ${BM.esc(e.message)}</p>`;
    }
  }

  function _simPickerRenderPhotoReview(r) {
    const resultEl = document.getElementById('simPickPhotoResult');
    _simOptBuilderInit();
    resultEl.innerHTML = `
      <div class="sim-picker-photo-review">
        ${r.verificat === false ? `
        <div style="padding:12px 14px;border:1px solid #ef4444;border-radius:10px;background:rgba(239,68,68,0.08);color:#ef4444;margin-bottom:16px;font-size:0.88rem">
          ⚠️ AI-ul nu și-a putut confirma singur rezultatul la verificare — recalculează manual înainte de a confirma.
        </div>` : ''}
        ${r.verificare_numerica ? `
        <div class="cls-form-hint" style="margin-bottom:14px">🔍 Verificare AI: ${BM.esc(r.verificare_numerica)}</div>` : ''}
        <div class="cls-form-field">
          <label class="cls-form-label">Titlu</label>
          <input type="text" id="simPickAiTitle" class="cls-form-input" value="${BM.esc(r.titlu || '')}">
        </div>
        <div class="cls-form-field">
          <label class="cls-form-label">Enunț</label>
          <textarea id="simPickAiStatement" class="cls-form-input cls-form-textarea" rows="3">${BM.esc(r.enunt_katex || '')}</textarea>
          <span class="cls-form-hint">Poți edita textul (ex: șterge numărul exercițiului sau litera subpunctului preluate din poză). Mai jos vezi exact cum va apărea elevului.</span>
          <div class="ae-preview-box" id="simPickAiStatementPreview" style="margin-top:8px"></div>
        </div>
        <div class="cls-form-field">
          <label class="cls-form-label">Punctaj *</label>
          <input type="number" id="simPickAiPoints" class="cls-form-input" min="1" style="max-width:120px" value="5">
        </div>
        ${_simAnswerTypeRadioHtml('simPickAi')}
        <div id="simPickAiAnswerWrap" class="cls-form-field">
          <label class="cls-form-label">Răspuns final</label>
          <input type="text" id="simPickAiAnswer" class="cls-form-input" value="${BM.esc(BM.latexToPlain(r.raspuns_final || ''))}">
          <span class="cls-form-hint">Gemini întoarce LaTeX brut — l-am convertit în text simplu (√, ∈, etc.), dar verifică-l înainte de a confirma. Dacă răspunsul are mai multe valori (ex: două rădăcini), scrie-le mereu în aceeași ordine — corectarea compară text exact.</span>
        </div>
        <div id="simPickAiOptionsWrap" style="display:none">${_simOptBuilderRowsHtml()}</div>
        <button class="btn btn--primary" id="simPickAiConfirmBtn">+ Adaugă la simulare</button>
      </div>`;

    const preview = document.getElementById('simPickAiStatementPreview');
    const statementInput = document.getElementById('simPickAiStatement');
    const updatePreview = () => {
      preview.innerHTML = BM.trustedNl2br(statementInput.value || '');
      BM.renderMath(preview);
    };
    updatePreview();
    statementInput.addEventListener('input', BM.debounce(updatePreview, 200));

    const answerWrap  = document.getElementById('simPickAiAnswerWrap');
    const optionsWrap = document.getElementById('simPickAiOptionsWrap');
    _simOptBuilderBind(optionsWrap);
    resultEl.querySelectorAll('input[name="simPickAiAnswerType"]').forEach(rad => rad.onchange = e => {
      _simOptBuilder.answerType = e.target.value;
      _simSwapAnswerType(e.target.value, answerWrap, optionsWrap);
    });

    document.getElementById('simPickAiConfirmBtn').onclick = () => _simPickerConfirmAdhoc();
  }

  async function _simPickerConfirmAdhoc() {
    const title     = document.getElementById('simPickAiTitle').value.trim();
    const statement = document.getElementById('simPickAiStatement').value.trim();
    const points    = Number(document.getElementById('simPickAiPoints').value) || 1;
    const isGrila   = _simOptBuilder.answerType === 'grila';

    let answer = '', opts = null;
    if (isGrila) {
      opts = _simValidateOptions();
      if (!opts) return;
    } else {
      answer = document.getElementById('simPickAiAnswer').value.trim();
      if (!answer) { BM.toast('Introdu răspunsul corect.', 'error'); return; }
    }
    if (!title || !statement) { BM.toast('Completează toate câmpurile.', 'error'); return; }

    const btn = document.getElementById('simPickAiConfirmBtn');
    btn.disabled = true; btn.textContent = 'Se salvează…';

    // Persist to custom_exercises for reuse in future simulations — best-effort,
    // adding to THIS simulation must still succeed even if this insert fails.
    // Grilă items aren't persisted here (custom_exercises has no options
    // concept) — only free-text ones round-trip through the shared bank.
    let savedId = null;
    if (!isGrila) {
      try {
        const { data, error } = await BMAuth.supabase.from('custom_exercises').insert({
          grade: simPicker.gradeCode,
          category_id: simPicker.categoryId || null,
          subcategory_id: simPicker.subcategoryId || null,
          difficulty: 'mediu',
          source: `Profesor — ${classData.name}`,
          title, statement,
          solution: `$$\\boxed{${answer}}$$`,
          barem: null, barem_estimat: false,
          punctaj_total: points
        }).select('id').single();
        if (!error) savedId = data.id;
      } catch { /* best-effort */ }
    }

    const base = { exercise_source: 'adhoc', source_exercise_id: savedId, title, statement, difficulty: null, points };
    simWiz.items.push(isGrila
      ? Object.assign({}, base, { answer_type: 'grila', options: opts })
      : Object.assign({}, base, { answer_type: 'liber', correct_answer: answer }));
    BM.toast('Exercițiu adăugat.', 'success');
    _simPickerClose();
    _simWzRender();
  }

  /* ─── Helpers ───────────────────────────────────────────────────── */
  function showLoading(msg) {
    document.getElementById('classRoot').innerHTML = `
      <div class="classes-loading">
        <div class="classes-spinner"></div>
        <p>${msg || 'Se încarcă...'}</p>
      </div>
    `;
  }

  window.fluxToggleLike = async function (postId, btn) {
    if (!BMAuth.user) return;
    btn.disabled = true;
    const wasActive = btn.classList.contains('flux-like-btn--active');
    try {
      if (wasActive) {
        await BMAuth.supabase.from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', BMAuth.user.id);
        btn.classList.remove('flux-like-btn--active');
        btn.textContent = '✓ Marchează citit';
      } else {
        await BMAuth.supabase.from('post_reactions')
          .upsert({ post_id: postId, user_id: BMAuth.user.id, user_name: BMAuth.displayName() },
                  { onConflict: 'post_id,user_id' });
        btn.classList.add('flux-like-btn--active');
        btn.textContent = '✓ Citit';
      }
    } catch (e) {
      BM.toast('Eroare: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  };

  window.fluxShowReaders = function (btn) {
    document.querySelectorAll('.flux-readers-popover').forEach(p => p.remove());
    const wrapper = btn.closest('.flux-post__footer-right');
    let names = [];
    try { names = JSON.parse(btn.dataset.names || '[]'); } catch {}

    const popover = document.createElement('div');
    popover.className = 'flux-readers-popover';
    if (names.length === 0) {
      popover.innerHTML = `<div class="flux-readers-popover__empty">Niciun elev nu a confirmat încă.</div>`;
    } else {
      const items = names.map(n => `<div class="flux-readers-popover__item">✓ ${BM.esc(n)}</div>`).join('');
      popover.innerHTML = `<div class="flux-readers-popover__title">Au confirmat (${names.length})</div>${items}`;
    }
    wrapper.appendChild(popover);

    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!wrapper.contains(e.target)) { popover.remove(); document.removeEventListener('click', close); }
      });
    }, 0);
  };

  window.cdCopyCode = function (code) {
    navigator.clipboard.writeText(code)
      .then(() => BM.toast('Codul ' + code + ' a fost copiat!', 'success'))
      .catch(() => BM.toast('Codul este: ' + code, 'info'));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
