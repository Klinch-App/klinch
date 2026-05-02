window.InterviewsPage = (() => {

  const STAGE_BADGE = {
    'Recruiter Screen':          'badge-recruiter',
    'Hiring Manager':            'badge-hiring',
    'Executive':                 'badge-executive',
    'Peer':                      'badge-peer',
    'Culture Fit':               'badge-culture',
    'Technical Screen':          'badge-technical',
    'Case Study / Presentation': 'badge-case-study',
    'Panel':                     'badge-panel',
    'Group':                     'badge-group',
    'Final Round':               'badge-final',
  };

  let _filter = { view: 'upcoming', company: '', stage: '', format: '', search: '' };

  function _el(id) { return document.getElementById(id); }
  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  // ── Data ──────────────────────────────────────────────────────────────────────

  function getAll() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  }

  function isCompleted(iv) {
    if (iv.status === 'completed') return true;
    if (!iv.scheduled_at) return false;
    return new Date(iv.scheduled_at) < new Date();
  }

  function isThisWeek(iv) {
    if (!iv.scheduled_at) return false;
    const d = new Date(iv.scheduled_at);
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    return d >= now && d <= end;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  function renderStats() {
    const all       = getAll();
    const upcoming  = all.filter(iv => !isCompleted(iv));
    const completed = all.filter(isCompleted);
    const thisWeek  = all.filter(iv => !isCompleted(iv) && isThisWeek(iv));

    _el('iv-stat-total').textContent     = all.length;
    _el('iv-stat-upcoming').textContent  = upcoming.length;
    _el('iv-stat-week').textContent      = thisWeek.length;
    _el('iv-stat-completed').textContent = completed.length;

    // Pipeline bars — upcoming interviews only, grouped by stage
    const stageCounts = {};
    upcoming.forEach(iv => {
      if (iv.stage) stageCounts[iv.stage] = (stageCounts[iv.stage] || 0) + 1;
    });
    const sorted   = Object.entries(stageCounts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] || 1;

    const pipelineEl = _el('iv-pipeline-bars');
    if (!sorted.length) {
      pipelineEl.innerHTML = '<div class="iv-pipeline-empty">No active pipeline</div>';
      return;
    }
    pipelineEl.innerHTML = sorted.map(([stage, count]) => {
      const pct = Math.round((count / maxCount) * 100);
      const cls = STAGE_BADGE[stage] || 'badge-recruiter';
      return `
        <div class="iv-pipeline-row">
          <div class="iv-pipeline-label">${_esc(stage)}</div>
          <div class="iv-pipeline-track">
            <div class="iv-pipeline-fill ${cls}" style="width:${pct}%"></div>
          </div>
          <div class="iv-pipeline-count">${count}</div>
        </div>`;
    }).join('');
  }

  // ── Mini-calendar ─────────────────────────────────────────────────────────────

  function renderCalendar() {
    const all = getAll();

    const interviewDates = new Set();
    all.forEach(iv => {
      if (!iv.scheduled_at) return;
      const d = new Date(iv.scheduled_at);
      interviewDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });

    // Start from Monday of current week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    const dow   = today.getDay();
    start.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAY_HDR    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const todayKey   = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    let html = '<div class="iv-cal-days">';
    DAY_HDR.forEach(d => { html += `<div class="iv-cal-day-hdr">${d}</div>`; });
    html += '</div><div class="iv-cal-grid">';

    for (let i = 0; i < 28; i++) {
      const d   = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

      const isToday       = key === todayKey;
      const hasInterview  = interviewDates.has(key);
      const isPast        = d < today;

      let cls = 'iv-cal-cell';
      if (isToday)      cls += ' is-today';
      if (hasInterview) cls += ' has-interview';
      if (isPast)       cls += ' is-past';

      const monthLabel = (d.getDate() === 1 || i === 0)
        ? `<span class="iv-cal-month">${MONTH_ABBR[d.getMonth()]}</span>`
        : '<span class="iv-cal-month"></span>';

      html += `<div class="${cls}">
        ${monthLabel}
        <span class="iv-cal-num">${d.getDate()}</span>
        ${hasInterview ? '<span class="iv-cal-dot"></span>' : '<span class="iv-cal-dot" style="visibility:hidden"></span>'}
      </div>`;
    }
    html += '</div>';

    _el('iv-calendar-grid').innerHTML = html;
  }

  // ── Company filter options ─────────────────────────────────────────────────────

  function updateCompanyFilter() {
    const all       = getAll();
    const companies = [...new Set(all.map(iv => iv.company?.name).filter(Boolean))].sort();
    const sel       = _el('iv-filter-company');
    const current   = sel.value;
    sel.innerHTML   = `<option value="">All Companies</option>` +
      companies.map(c => `<option value="${_esc(c)}"${c === current ? ' selected' : ''}>${_esc(c)}</option>`).join('');
  }

  // ── Card HTML ─────────────────────────────────────────────────────────────────

  function buildCardHTML(iv) {
    const dateObj = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
    const dateStr = dateObj
      ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD';
    const timeStr = (dateObj && iv.scheduled_at.includes('T'))
      ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const logoHtml = iv.company?.logo_url
      ? `<img src="${iv.company.logo_url}" class="icard-logo-img" alt="" data-fb="ivpg-logo-${iv.id}">
         <div class="icard-logo-fb" data-fb-id="ivpg-logo-${iv.id}" style="display:none">${(iv.company?.name || '?')[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb">${(iv.company?.name || '?')[0].toUpperCase()}</div>`;

    const interviewers    = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);
    const photoStackHtml  = interviewers.slice(0, 3).map((iw, i) => iw.photo_url
      ? `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)">
           <img src="${iw.photo_url}" class="icard-photo" alt="" data-fb="ivpg-photo-${iv.id}-${i}">
           <div class="icard-photo-fb" data-fb-id="ivpg-photo-${iv.id}-${i}" style="display:none">${(iw.name || '?')[0].toUpperCase()}</div>
         </div>`
      : `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)">
           <div class="icard-photo-fb">${(iw.name || '?')[0].toUpperCase()}</div>
         </div>`
    ).join('');

    const primaryName  = interviewers[0]?.name || '';
    const extraCount   = interviewers.length - 1;
    const iwNameHtml   = extraCount > 0
      ? `${_esc(primaryName)} <span style="color:var(--text-muted)">+${extraCount}</span>`
      : _esc(primaryName);

    const stageBadgeClass = STAGE_BADGE[iv.stage] || 'badge-recruiter';
    const formatBadgeHtml = iv.format
      ? `<span class="icard-format-badge ${iv.format === 'Virtual' ? 'badge-virtual' : 'badge-phone'}">${_esc(iv.format)}</span>`
      : '';

    const completed  = isCompleted(iv);
    const statusHtml = completed
      ? `<span class="icard-status-badge iv-status-done">Completed</span>`
      : `<span class="icard-status-badge">Upcoming</span>`;

    return `
      <div class="icard" data-id="${iv.id}">
        <button class="icard-delete-btn" aria-label="Delete interview">✕</button>
        <div class="icard-top">
          <div class="icard-logo-wrap" data-company-nav="${_esc(iv.company?.domain || iv.company?.name || '')}">${logoHtml}</div>
          <div class="icard-company-info">
            <div class="icard-company-name" data-company-nav="${_esc(iv.company?.domain || iv.company?.name || '')}">${_esc(iv.company?.name || 'Unknown Company')}</div>
            <div class="icard-role">${_esc(iv.jd?.structured?.role_title || 'Role TBD')}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
            <span class="icard-stage-badge ${stageBadgeClass}">${_esc(iv.stage)}</span>
            ${formatBadgeHtml}
          </div>
        </div>
        ${interviewers.length ? `
        <div class="icard-interviewer">
          <div class="icard-photo-stack">${photoStackHtml}</div>
          <div class="icard-interviewer-info">
            <div class="icard-interviewer-name">${iwNameHtml}</div>
            <div class="icard-interviewer-title">${_esc(interviewers[0]?.title || '')}</div>
          </div>
        </div>` : ''}
        <div class="icard-footer">
          <div class="icard-date">${dateStr}${timeStr ? ' · ' + timeStr : ''}</div>
          ${statusHtml}
        </div>
      </div>`;
  }

  // ── Feed ──────────────────────────────────────────────────────────────────────

  function renderFeed() {
    const feed  = _el('iv-feed');
    const empty = _el('iv-empty');

    let filtered = getAll().filter(iv => {
      if (_filter.view === 'upcoming'  && isCompleted(iv))  return false;
      if (_filter.view === 'completed' && !isCompleted(iv)) return false;
      if (_filter.company && iv.company?.name !== _filter.company) return false;
      if (_filter.stage   && iv.stage   !== _filter.stage)  return false;
      if (_filter.format  && iv.format  !== _filter.format) return false;
      if (_filter.search) {
        const q   = _filter.search.toLowerCase();
        const iws = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);
        if (!iv.company?.name?.toLowerCase().includes(q) &&
            !iws.some(iw => iw.name?.toLowerCase().includes(q))) return false;
      }
      return true;
    });

    // Upcoming: soonest first. Completed: most recent first.
    filtered.sort((a, b) => {
      const da = a.scheduled_at ? new Date(a.scheduled_at) : new Date(0);
      const db = b.scheduled_at ? new Date(b.scheduled_at) : new Date(0);
      return _filter.view === 'completed' ? db - da : da - db;
    });

    if (!filtered.length) {
      feed.innerHTML     = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    feed.innerHTML      = filtered.map(buildCardHTML).join('');
    if (window.wireImgFallbacks) window.wireImgFallbacks(feed);
  }

  // ── Detail modal ──────────────────────────────────────────────────────────────

  function openDetail(id) {
    const iv = getAll().find(x => x.id === id);
    if (!iv) return;

    const dateObj = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
    const dateStr = dateObj
      ? dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'Date TBD';
    const timeStr = (dateObj && iv.scheduled_at?.includes('T'))
      ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const interviewers    = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);
    const stageBadgeClass = STAGE_BADGE[iv.stage] || 'badge-recruiter';
    const completed       = isCompleted(iv);

    // Logo
    const logoEl = _el('ivd-logo-wrap');
    if (iv.company?.logo_url) {
      logoEl.innerHTML = `
        <img src="${iv.company.logo_url}" class="ivd-logo-img" alt="" data-fb="ivd-logo">
        <div class="icard-logo-fb ivd-logo-fb" data-fb-id="ivd-logo" style="display:none">${(iv.company?.name || '?')[0].toUpperCase()}</div>`;
    } else {
      logoEl.innerHTML = `<div class="icard-logo-fb ivd-logo-fb">${(iv.company?.name || '?')[0].toUpperCase()}</div>`;
    }

    _el('ivd-company').textContent = iv.company?.name || 'Unknown Company';
    _el('ivd-role').textContent    = iv.jd?.structured?.role_title || '';

    _el('ivd-stage').className   = `icard-stage-badge ${stageBadgeClass}`;
    _el('ivd-stage').textContent = iv.stage;

    const fmtEl = _el('ivd-format');
    if (iv.format) {
      fmtEl.className   = `icard-format-badge ${iv.format === 'Virtual' ? 'badge-virtual' : 'badge-phone'}`;
      fmtEl.textContent = iv.format;
      fmtEl.style.display = '';
    } else {
      fmtEl.style.display = 'none';
    }

    _el('ivd-status').textContent = completed ? 'Completed' : 'Upcoming';
    _el('ivd-status').className   = `icard-status-badge${completed ? ' iv-status-done' : ''}`;
    _el('ivd-date').textContent   = timeStr ? `${dateStr} · ${timeStr}` : dateStr;

    _el('ivd-interviewers').innerHTML = interviewers.length
      ? interviewers.map((iw, i) => {
          const photo = iw.photo_url
            ? `<img src="${iw.photo_url}" class="icard-photo" alt="" data-fb="ivd-iw-${i}">
               <div class="icard-photo-fb" data-fb-id="ivd-iw-${i}" style="display:none">${(iw.name || '?')[0].toUpperCase()}</div>`
            : `<div class="icard-photo-fb">${(iw.name || '?')[0].toUpperCase()}</div>`;
          return `
            <div class="ivd-iw-row">
              <div class="icard-photo-wrap ivd-iw-avatar">${photo}</div>
              <div>
                <div class="ivd-iw-name">${_esc(iw.name || '')}</div>
                <div class="ivd-iw-title">${_esc(iw.title || '')}</div>
              </div>
            </div>`;
        }).join('')
      : '<div style="color:var(--text-muted);font-size:13px">No interviewer added</div>';

    const summaryWrap = _el('ivd-summary-wrap');
    const summary     = iv.jd?.structured?.summary || '';
    if (summary) {
      _el('ivd-summary').textContent = summary;
      summaryWrap.style.display      = '';
    } else {
      summaryWrap.style.display = 'none';
    }

    if (window.wireImgFallbacks) window.wireImgFallbacks(_el('iv-detail-modal'));
    _el('iv-detail-modal').classList.add('visible');
  }

  function closeDetail() {
    _el('iv-detail-modal').classList.remove('visible');
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    // View toggle
    document.querySelectorAll('.iv-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.iv-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filter.view = btn.dataset.view;
        renderFeed();
      });
    });

    _el('iv-filter-company').addEventListener('change', e => { _filter.company = e.target.value; renderFeed(); });
    _el('iv-filter-stage'  ).addEventListener('change', e => { _filter.stage   = e.target.value; renderFeed(); });
    _el('iv-filter-format' ).addEventListener('change', e => { _filter.format  = e.target.value; renderFeed(); });
    _el('iv-search').addEventListener('input', e => { _filter.search = e.target.value.trim(); renderFeed(); });

    // Feed: delete → company nav → card detail
    _el('iv-feed').addEventListener('click', e => {
      const deleteBtn = e.target.closest('.icard-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        const card = deleteBtn.closest('.icard');
        const id   = card?.dataset.id;
        if (!id) return;
        const iv = getAll().find(x => x.id === id);
        if (window.openInterviewDeleteModal) {
          window.openInterviewDeleteModal(id, iv?.company?.name || 'this company');
        }
        return;
      }
      const navEl = e.target.closest('[data-company-nav]');
      if (navEl) {
        e.stopPropagation();
        const key = navEl.dataset.companyNav;
        if (key && window.navigateTo && window.CompaniesPage) {
          window.navigateTo('companies');
          window.CompaniesPage.openDetail(key);
        }
        return;
      }
      const card = e.target.closest('.icard');
      if (card) openDetail(card.dataset.id);
    });

    // Detail modal close
    _el('ivd-close').addEventListener('click', closeDetail);
    _el('iv-detail-modal').addEventListener('click', e => {
      if (e.target === _el('iv-detail-modal')) closeDetail();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _el('iv-detail-modal')?.classList.contains('visible')) closeDetail();
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  function refresh() {
    renderStats();
    renderCalendar();
    updateCompanyFilter();
    renderFeed();
  }

  init();
  return { refresh, openDetail };
})();
