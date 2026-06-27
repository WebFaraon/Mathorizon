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

  let classData  = null;
  let activeTab  = 'flux';
  let temeCache  = [];
  let wz         = null;

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
          .select('id')
          .eq('class_id', classId)
          .eq('student_id', BMAuth.user.id)
          .maybeSingle();
        if (!membership) { hardRedirect(); return; }
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
                  ${t.label}
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

  function _debouncedFlux() {
    clearTimeout(_reloadFluxTimer);
    _reloadFluxTimer = setTimeout(() => { if (activeTab === 'flux') loadFluxTab(); }, 350);
  }

  function _debouncedTeme() {
    clearTimeout(_reloadTemeTimer);
    _reloadTemeTimer = setTimeout(() => { if (activeTab === 'teme') loadTemeTab(); }, 350);
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

    const isTeacher = BMAuth.role === 'profesor';
    const placeholders = {
      simulari: {
        icon: '🎯', title: 'Simulări',
        desc: isTeacher ? 'Organizează simulări BAC pentru clasă.' : 'Simulări BAC organizate de profesor.'
      },
      membri: {
        icon: '👥', title: 'Membri',
        desc: isTeacher ? 'Elevii înscriși în clasă.' : 'Ceilalți elevi din clasă.'
      }
    };

    const p = placeholders[tabId];
    return `
      <div class="cd-placeholder">
        <div class="cd-placeholder__icon">${p.icon}</div>
        <h3 class="cd-placeholder__title">${p.title}</h3>
        <p class="cd-placeholder__desc">${p.desc}</p>
        <span class="cd-placeholder__badge">În curând</span>
      </div>
    `;
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
        BMAuth.supabase
          .from('class_members')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classData.id),
        reactionsQ
      ]);
      if (postsRes.error) throw postsRes.error;
      posts = postsRes.data || [];
      memberCount = membersRes.count ?? 0;

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

    if (!isTeacher) BMPush?.init(classData.id);
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
                  ? `<span class="teme-sub-badge teme-sub-badge--graded">⭐ Notă: ${a._subInfo.grade}</span>`
                  : `<span class="teme-sub-badge teme-sub-badge--done">✅ Predată</span>`
                : `<span class="teme-sub-badge teme-sub-badge--none">📤 Nepredată</span>`
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
      <div class="cd-info-card__sep"></div>
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
          <span class="cd-info-card__detail-val">${maxEl === 1 ? 'Individual' : `max ${maxEl} elevi`}</span>
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
          ${detailsHTML}
          <div class="cd-info-card__sep"></div>
          <div class="cd-info-card__stats">
            <div class="cd-info-card__stat">
              <span class="cd-info-card__stat-val">${postCount}</span>
              <span class="cd-info-card__stat-lbl">anunțuri</span>
            </div>
            <div class="cd-info-card__stat">
              <span class="cd-info-card__stat-val">${memberCount}</span>
              <span class="cd-info-card__stat-lbl">elevi</span>
            </div>
          </div>
          ${!isTeacher && ('Notification' in window) ? `
          <div class="cd-info-card__sep"></div>
          <button class="cd-notif-btn" id="cdNotifBtn" onclick="BMPush?.resubscribe('${classData.id}')">
            🔔 Gestionează notificările
          </button>` : ''}
        </div>
      </div>
    `;
  }

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
      const close = result => { overlay.remove(); resolve(result); };
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      overlay.querySelector('#cdConfirmNo').addEventListener('click',  () => close(false));
      overlay.querySelector('#cdConfirmYes').addEventListener('click', () => close(true));
      document.body.appendChild(overlay);
      overlay.querySelector('#cdConfirmNo').focus();
    });
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
