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
  let _layer  = 'list'; // 'list' | 'detail'

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

  function saveAll(list) {
    localStorage.setItem('klinch_interviews', JSON.stringify(list));
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

    filtered.sort((a, b) => {
      const da = a.scheduled_at ? new Date(a.scheduled_at) : new Date(0);
      const db = b.scheduled_at ? new Date(b.scheduled_at) : new Date(0);
      return _filter.view === 'completed' ? db - da : da - db;
    });

    if (!filtered.length) {
      feed.innerHTML      = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    feed.innerHTML      = filtered.map(buildCardHTML).join('');
    if (window.wireImgFallbacks) window.wireImgFallbacks(feed);
  }

  // ── Detail page ───────────────────────────────────────────────────────────────

  function showInterviewDetail(id) {
    const iv = getAll().find(x => x.id === id);
    if (!iv) return;

    _layer = 'detail';
    _el('iv-list-view').style.display  = 'none';
    _el('iv-detail-page').style.display = '';
    _renderDetail(iv);
  }

  function hideDetail() {
    _layer = 'list';
    _el('iv-detail-page').style.display = 'none';
    _el('iv-list-view').style.display   = '';
    _el('iv-detail-page').innerHTML     = '';
  }

  function _renderDetail(iv) {
    const dateObj          = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
    const dateStr          = dateObj
      ? dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'Date TBD';
    const timeStr          = (dateObj && iv.scheduled_at?.includes('T'))
      ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';
    const interviewers     = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);
    const stageBadgeClass  = STAGE_BADGE[iv.stage] || 'badge-recruiter';
    const completed        = isCompleted(iv);
    const roleTitle        = iv.jd?.structured?.role_title || 'Role TBD';
    const companyName      = iv.company?.name || 'Unknown Company';

    const logoHtml = iv.company?.logo_url
      ? `<img src="${iv.company.logo_url}" class="ivdp-logo-img" alt="" data-fb="ivdp-logo-${iv.id}">
         <div class="icard-logo-fb ivdp-logo-fb" data-fb-id="ivdp-logo-${iv.id}" style="display:none">${companyName[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb ivdp-logo-fb">${companyName[0].toUpperCase()}</div>`;

    // ── Section 2: Role Intel ──────────────────────────────────────────────────
    const jd = iv.jd?.structured;
    let roleIntelHtml;
    if (!jd) {
      roleIntelHtml = `
        <div class="ivdp-empty-state">
          <div class="ivdp-empty-icon">📄</div>
          <div class="ivdp-empty-title">No job description added</div>
          <div class="ivdp-empty-sub">Edit this interview to paste in the JD and unlock role intel.</div>
        </div>`;
    } else {
      const mustHave   = jd.must_have   || [];
      const niceHave   = jd.nice_to_have || [];
      const mustHtml   = mustHave.length
        ? mustHave.map(r => `<li>${_esc(r)}</li>`).join('')
        : '<li class="ivdp-list-empty">None listed</li>';
      const niceHtml   = niceHave.length
        ? niceHave.map(r => `<li>${_esc(r)}</li>`).join('')
        : '<li class="ivdp-list-empty">None listed</li>';
      const rawJd      = iv.jd?.raw || '';

      roleIntelHtml = `
        <div class="ivdp-role-grid">
          <div class="ivdp-role-col">
            <div class="ivdp-col-label">Must-Haves</div>
            <ul class="ivdp-req-list ivdp-must">${mustHtml}</ul>
          </div>
          <div class="ivdp-role-col">
            <div class="ivdp-col-label">Nice-to-Haves</div>
            <ul class="ivdp-req-list ivdp-nice">${niceHtml}</ul>
          </div>
        </div>
        ${jd.location || jd.salary ? `
        <div class="ivdp-meta-row">
          ${jd.location ? `<span class="ivdp-meta-chip">📍 ${_esc(jd.location)}</span>` : ''}
          ${jd.salary   ? `<span class="ivdp-meta-chip">💰 ${_esc(jd.salary)}</span>`   : ''}
        </div>` : ''}
        ${rawJd ? `
        <details class="ivdp-raw-jd">
          <summary>View full job description</summary>
          <pre class="ivdp-raw-text">${_esc(rawJd)}</pre>
        </details>` : ''}`;
    }

    // ── Section 3: Candidate Fit (placeholder) ────────────────────────────────
    const fitHtml = `
      <div class="ivdp-fit-locked">
        <div class="ivdp-fit-score-row">
          <div class="ivdp-fit-score-circle">
            <svg viewBox="0 0 36 36" class="ivdp-fit-donut">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--primary)" stroke-width="3"
                stroke-dasharray="84 100" stroke-dashoffset="25" stroke-linecap="round"/>
            </svg>
            <div class="ivdp-fit-pct">84%</div>
          </div>
          <div class="ivdp-fit-cols">
            <div class="ivdp-fit-col ivdp-fit-match">
              <div class="ivdp-fit-col-label">Strengths</div>
              <div class="ivdp-fit-item">Leadership experience</div>
              <div class="ivdp-fit-item">SaaS background</div>
              <div class="ivdp-fit-item">Quota attainment</div>
            </div>
            <div class="ivdp-fit-col ivdp-fit-gap">
              <div class="ivdp-fit-col-label">Gaps</div>
              <div class="ivdp-fit-item">Enterprise sales cycle</div>
              <div class="ivdp-fit-item">Technical product exp.</div>
            </div>
            <div class="ivdp-fit-col ivdp-fit-talk">
              <div class="ivdp-fit-col-label">Talking Points</div>
              <div class="ivdp-fit-item">Frame SDR mgmt as pipeline builder</div>
              <div class="ivdp-fit-item">Highlight cross-functional wins</div>
            </div>
          </div>
        </div>
        <div class="ivdp-fit-banner">
          <span class="ivdp-fit-lock-icon">🔒</span>
          <span>Upload your resume to unlock Candidate Fit analysis — <span style="color:var(--text-muted);font-size:12px">coming soon</span></span>
        </div>
      </div>`;

    // ── Section 4: Interview Panel ─────────────────────────────────────────────
    const panelHtml = _buildPanelHtml(iv, interviewers);

    // ── Section 5: Session History ─────────────────────────────────────────────
    const sessions   = iv.sessions || [];
    const sessHtml   = sessions.length
      ? sessions.map(s => `
          <div class="ivdp-session-card">
            <div class="ivdp-session-date">${_esc(s.date || '')}</div>
            <div class="ivdp-session-notes">${_esc(s.notes || '')}</div>
            <!-- TODO: wire transcript data -->
          </div>`).join('')
      : `<div class="ivdp-empty-state">
           <div class="ivdp-empty-icon">🎙️</div>
           <div class="ivdp-empty-title">No sessions yet</div>
           <div class="ivdp-empty-sub">Start a Klinch Ear session before your interview to capture a live transcript and coaching notes.</div>
         </div>`;

    // ── Section 6 & 7: Coach + Context (cached) ────────────────────────────────
    const coachCached   = iv.coach_analysis  || null;
    const contextCached = iv.context_summary || null;

    const coachHtml = coachCached
      ? `<div class="ivdp-ai-body">${_renderMarkdownish(coachCached)}</div>
         <button class="ivdp-refresh-btn" data-action="refresh-coach" data-iv-id="${iv.id}">↺ Refresh</button>`
      : `<div class="ivdp-ai-skeleton" id="ivdp-coach-skeleton">
           <div class="ivdp-skel-line w80"></div>
           <div class="ivdp-skel-line w60"></div>
           <div class="ivdp-skel-line w70"></div>
           <div class="ivdp-skel-line w50"></div>
         </div>
         <div class="ivdp-ai-body" id="ivdp-coach-body" style="display:none"></div>
         <button class="ivdp-refresh-btn" id="ivdp-coach-refresh" data-action="refresh-coach" data-iv-id="${iv.id}" style="display:none">↺ Refresh</button>`;

    const contextHtml = contextCached
      ? `<div class="ivdp-ai-body">${_renderMarkdownish(contextCached)}</div>
         <button class="ivdp-refresh-btn" data-action="refresh-context" data-iv-id="${iv.id}">↺ Refresh</button>`
      : `<div class="ivdp-ai-skeleton" id="ivdp-context-skeleton">
           <div class="ivdp-skel-line w80"></div>
           <div class="ivdp-skel-line w60"></div>
           <div class="ivdp-skel-line w70"></div>
           <div class="ivdp-skel-line w50"></div>
         </div>
         <div class="ivdp-ai-body" id="ivdp-context-body" style="display:none"></div>
         <button class="ivdp-refresh-btn" id="ivdp-context-refresh" data-action="refresh-context" data-iv-id="${iv.id}" style="display:none">↺ Refresh</button>`;

    // ── Assemble full page ─────────────────────────────────────────────────────
    const container = _el('iv-detail-page');
    container.innerHTML = `
      <!-- Breadcrumb -->
      <div class="ivdp-breadcrumb">
        <button class="ivdp-bc-link" id="ivdp-back">Interviews</button>
        <span class="ivdp-bc-sep">›</span>
        <span class="ivdp-bc-current">${_esc(companyName)} — ${_esc(roleTitle)}</span>
      </div>

      <!-- Section 1: Hero -->
      <div class="ivdp-hero">
        <div class="ivdp-logo-wrap">${logoHtml}</div>
        <div class="ivdp-hero-info">
          <div class="ivdp-hero-company">${_esc(companyName)}</div>
          <div class="ivdp-hero-role">${_esc(roleTitle)}</div>
          <div class="ivdp-hero-badges">
            <span class="icard-stage-badge ${stageBadgeClass}">${_esc(iv.stage || '')}</span>
            ${iv.format ? `<span class="icard-format-badge ${iv.format === 'Virtual' ? 'badge-virtual' : 'badge-phone'}">${_esc(iv.format)}</span>` : ''}
            <span class="icard-status-badge${completed ? ' iv-status-done' : ''}">${completed ? 'Completed' : 'Upcoming'}</span>
          </div>
          <div class="ivdp-hero-date">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/>
              <path d="M5 1v3M11 1v3M1.5 6.5h13"/>
            </svg>
            ${_esc(timeStr ? `${dateStr} · ${timeStr}` : dateStr)}
          </div>
        </div>
      </div>

      <!-- Section 2: Role Intel -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Role Intel</div>
        </div>
        <div class="ivdp-section-body">${roleIntelHtml}</div>
      </div>

      <!-- Section 3: Candidate Fit -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Candidate Fit</div>
          <span class="ivdp-coming-soon">coming soon</span>
        </div>
        <div class="ivdp-section-body">${fitHtml}</div>
      </div>

      <!-- Section 4: Interview Panel -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Interview Panel</div>
          <button class="ivdp-add-btn" id="ivdp-add-interviewer" data-iv-id="${iv.id}">+ Add Interviewer</button>
        </div>
        <div class="ivdp-section-body" id="ivdp-panel-body">${panelHtml}</div>
      </div>

      <!-- Section 5: Session History -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Session History</div>
        </div>
        <div class="ivdp-section-body">${sessHtml}</div>
      </div>

      <!-- Section 6: Coach -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Coach</div>
        </div>
        <div class="ivdp-section-body">${coachHtml}</div>
      </div>

      <!-- Section 7: Context -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Context &amp; Prep</div>
        </div>
        <div class="ivdp-section-body">${contextHtml}</div>
      </div>

      <!-- Add Interviewer modal -->
      <div class="ivdp-iw-modal-backdrop" id="ivdp-iw-modal" style="display:none">
        <div class="ivdp-iw-modal-card">
          <div class="ivdp-iw-modal-header">
            <div class="ivdp-iw-modal-title">Add Interviewer</div>
            <button class="ivdp-iw-modal-close" id="ivdp-iw-close">✕</button>
          </div>
          <div class="ivdp-iw-field">
            <label class="ivdp-iw-label">Name</label>
            <input class="ivdp-iw-input" id="ivdp-iw-name" type="text" placeholder="e.g. Sarah Chen">
          </div>
          <div class="ivdp-iw-field">
            <label class="ivdp-iw-label">Title</label>
            <input class="ivdp-iw-input" id="ivdp-iw-title" type="text" placeholder="e.g. VP of Sales">
          </div>
          <div class="ivdp-iw-field">
            <label class="ivdp-iw-label">LinkedIn URL</label>
            <input class="ivdp-iw-input" id="ivdp-iw-linkedin" type="url" placeholder="https://linkedin.com/in/…">
          </div>
          <div class="ivdp-iw-field">
            <label class="ivdp-iw-label">Notes</label>
            <textarea class="ivdp-iw-input ivdp-iw-textarea" id="ivdp-iw-notes" placeholder="Anything worth knowing about this person…"></textarea>
          </div>
          <div class="ivdp-iw-actions">
            <button class="ivdp-iw-cancel" id="ivdp-iw-cancel">Cancel</button>
            <button class="ivdp-iw-save" id="ivdp-iw-save" data-iv-id="${iv.id}">Save</button>
          </div>
        </div>
      </div>
    `;

    if (window.wireImgFallbacks) window.wireImgFallbacks(container);
    _wireDetailEvents(iv.id);

    // Fire Coach + Context API calls in parallel if not yet cached
    if (!coachCached || !contextCached) {
      _fireAIAnalysis(iv);
    }
  }

  function _buildPanelHtml(iv, interviewers) {
    if (!interviewers.length) {
      return `<div class="ivdp-empty-state">
        <div class="ivdp-empty-icon">👥</div>
        <div class="ivdp-empty-title">No interviewers added</div>
        <div class="ivdp-empty-sub">Add the people you'll be meeting with to prepare targeted questions.</div>
      </div>`;
    }
    return interviewers.map((iw, i) => {
      const avatar = iw.photo_url
        ? `<img src="${iw.photo_url}" class="icard-photo" alt="" data-fb="ivdp-iw-${i}">
           <div class="icard-photo-fb" data-fb-id="ivdp-iw-${i}" style="display:none">${(iw.name || '?')[0].toUpperCase()}</div>`
        : `<div class="icard-photo-fb">${(iw.name || '?')[0].toUpperCase()}</div>`;

      const linkedInBtn = iw.linkedin_url
        ? `<button class="ivdp-iw-linkedin-btn" data-href="${_esc(iw.linkedin_url)}">View LinkedIn</button>`
        : '';

      return `
        <div class="ivdp-iw-card" data-iw-index="${i}">
          <div class="icard-photo-wrap ivdp-iw-avatar">${avatar}</div>
          <div class="ivdp-iw-info">
            <div class="ivdp-iw-name">${_esc(iw.name || '')}</div>
            <div class="ivdp-iw-title-text">${_esc(iw.title || '')}</div>
            ${iw.notes ? `<div class="ivdp-iw-notes-text">${_esc(iw.notes)}</div>` : ''}
          </div>
          <div class="ivdp-iw-actions-right">${linkedInBtn}</div>
        </div>`;
    }).join('');
  }

  function _wireDetailEvents(ivId) {
    // Breadcrumb back
    const backBtn = _el('ivdp-back');
    if (backBtn) backBtn.addEventListener('click', hideDetail);

    // Escape key
    document.addEventListener('keydown', _onDetailEscape);

    // Add Interviewer modal
    const addBtn   = _el('ivdp-add-interviewer');
    const modal    = _el('ivdp-iw-modal');
    const closeBtn = _el('ivdp-iw-close');
    const cancelBtn= _el('ivdp-iw-cancel');
    const saveBtn  = _el('ivdp-iw-save');

    if (addBtn) addBtn.addEventListener('click', () => { modal.style.display = ''; });
    if (closeBtn) closeBtn.addEventListener('click', _closeIwModal);
    if (cancelBtn) cancelBtn.addEventListener('click', _closeIwModal);
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) _closeIwModal(); });

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const name     = _el('ivdp-iw-name').value.trim();
        const title    = _el('ivdp-iw-title').value.trim();
        const linkedin = _el('ivdp-iw-linkedin').value.trim();
        const notes    = _el('ivdp-iw-notes').value.trim();
        if (!name) { _el('ivdp-iw-name').focus(); return; }

        const all = getAll();
        const idx = all.findIndex(x => x.id === ivId);
        if (idx < 0) return;
        if (!all[idx].interviewers) all[idx].interviewers = [];
        all[idx].interviewers.push({ name, title, linkedin_url: linkedin || null, notes: notes || null });
        saveAll(all);
        _closeIwModal();
        // Re-render panel
        const panelBody = _el('ivdp-panel-body');
        if (panelBody) {
          panelBody.innerHTML = _buildPanelHtml(all[idx], all[idx].interviewers);
          if (window.wireImgFallbacks) window.wireImgFallbacks(panelBody);
          _wirePanelLinkedIn(panelBody);
        }
      });
    }

    // LinkedIn buttons in panel
    const panelBody = _el('ivdp-panel-body');
    if (panelBody) _wirePanelLinkedIn(panelBody);

    // Refresh AI buttons
    const detailPage = _el('iv-detail-page');
    if (detailPage) {
      detailPage.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id     = btn.dataset.ivId;
        if (!id) return;
        const iv = getAll().find(x => x.id === id);
        if (!iv) return;
        if (action === 'refresh-coach') {
          iv.coach_analysis = null;
          _patchIv(id, { coach_analysis: null });
          _fireAIAnalysis(iv, 'coach');
        }
        if (action === 'refresh-context') {
          iv.context_summary = null;
          _patchIv(id, { context_summary: null });
          _fireAIAnalysis(iv, 'context');
        }
      });
    }
  }

  function _wirePanelLinkedIn(container) {
    container.querySelectorAll('.ivdp-iw-linkedin-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.href;
        if (url) window.klinch?.invoke('shell:open-external', { url });
      });
    });
  }

  function _closeIwModal() {
    const modal = _el('ivdp-iw-modal');
    if (modal) modal.style.display = 'none';
    ['ivdp-iw-name','ivdp-iw-title','ivdp-iw-linkedin','ivdp-iw-notes'].forEach(id => {
      const el = _el(id);
      if (el) el.value = '';
    });
  }

  function _onDetailEscape(e) {
    if (e.key !== 'Escape') return;
    const modal = _el('ivdp-iw-modal');
    if (modal && modal.style.display !== 'none') { _closeIwModal(); return; }
    if (_layer === 'detail') hideDetail();
    document.removeEventListener('keydown', _onDetailEscape);
  }

  function _patchIv(id, patch) {
    const all = getAll();
    const idx = all.findIndex(x => x.id === id);
    if (idx < 0) return;
    Object.assign(all[idx], patch);
    saveAll(all);
  }

  function _renderMarkdownish(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h4 class="ivdp-ai-h4">$1</h4>')
      .replace(/^## (.+)$/gm,  '<h3 class="ivdp-ai-h3">$1</h3>')
      .replace(/^- (.+)$/gm,   '<li>$1</li>')
      .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hul])(.+)$/gm, (m, p) => p ? `<p>${p}</p>` : '')
      .replace(/<p><\/p>/g, '');
  }

  async function _fireAIAnalysis(iv, only) {
    const roleTitle   = iv.jd?.structured?.role_title || 'this role';
    const company     = iv.company?.name || 'this company';
    const stage       = iv.stage || 'interview';
    const mustHave    = (iv.jd?.structured?.must_have || []).join(', ') || 'not specified';
    const niceHave    = (iv.jd?.structured?.nice_to_have || []).join(', ') || 'not specified';
    const interviewers= (iv.interviewers || []).map(iw => `${iw.name || 'Unknown'} (${iw.title || 'Unknown title'})`).join(', ') || 'unknown';

    const coachPrompt = `You are an expert interview coach. The candidate has a ${stage} at ${company} for the role of ${roleTitle}.

Must-have qualifications: ${mustHave}
Nice-to-have qualifications: ${niceHave}
Interviewers: ${interviewers}

Provide concise, actionable coaching advice for this interview. Include:
## Key Focus Areas
## Likely Questions to Prepare For
## How to Position Yourself

Keep it practical and specific to this stage and company. Be direct and confident in your guidance.`;

    const contextPrompt = `You are an expert interview researcher. The candidate has a ${stage} at ${company} for the role of ${roleTitle}.

Interviewers: ${interviewers}

Provide a research brief to help them prepare. Include:
## About the Company
## Role Context
## Questions to Ask Them

Keep it concise and actionable. Focus on what's most useful for interview prep.`;

    const needCoach   = !only || only === 'coach';
    const needContext = !only || only === 'context';

    const coachSkel   = _el('ivdp-coach-skeleton');
    const coachBody   = _el('ivdp-coach-body');
    const coachRefresh= _el('ivdp-coach-refresh');
    const ctxSkel     = _el('ivdp-context-skeleton');
    const ctxBody     = _el('ivdp-context-body');
    const ctxRefresh  = _el('ivdp-context-refresh');

    try {
      const calls = [];
      if (needCoach)   calls.push(_callClaude(coachPrompt));
      if (needContext) calls.push(_callClaude(contextPrompt));
      const results = await Promise.all(calls);

      let ri = 0;
      if (needCoach && results[ri] !== undefined) {
        const text = results[ri++];
        _patchIv(iv.id, { coach_analysis: text });
        if (coachSkel)    coachSkel.style.display    = 'none';
        if (coachBody)  { coachBody.innerHTML = _renderMarkdownish(text); coachBody.style.display = ''; }
        if (coachRefresh) coachRefresh.style.display = '';
      }
      if (needContext && results[ri] !== undefined) {
        const text = results[ri];
        _patchIv(iv.id, { context_summary: text });
        if (ctxSkel)    ctxSkel.style.display    = 'none';
        if (ctxBody)  { ctxBody.innerHTML = _renderMarkdownish(text); ctxBody.style.display = ''; }
        if (ctxRefresh) ctxRefresh.style.display = '';
      }
    } catch (err) {
      console.error('AI analysis failed:', err);
      const errHtml = '<div class="ivdp-ai-error">Analysis unavailable. Check your connection and try refreshing.</div>';
      if (needCoach)   { if (coachSkel) coachSkel.style.display = 'none'; if (coachBody) { coachBody.innerHTML = errHtml; coachBody.style.display = ''; } }
      if (needContext) { if (ctxSkel)   ctxSkel.style.display   = 'none'; if (ctxBody)   { ctxBody.innerHTML   = errHtml; ctxBody.style.display   = ''; } }
    }
  }

  async function _callClaude(prompt) {
    const result = await window.klinch.invoke('claude:coach', {
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }],
    });
    return result?.content?.[0]?.text || result?.text || result || '';
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
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
      if (card) showInterviewDetail(card.dataset.id);
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  function refresh() {
    renderStats();
    renderCalendar();
    updateCompanyFilter();
    renderFeed();
  }

  function reset() {
    if (_layer === 'detail') hideDetail();
    document.removeEventListener('keydown', _onDetailEscape);
    refresh();
  }

  init();
  return { refresh, reset, openDetail: showInterviewDetail };
})();
