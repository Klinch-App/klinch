window.InterviewsPage = (() => {

  const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');

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
  let _completionListener = null;

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

    const logoHtml = iv.company?.logo_url && !iv.company?.screenshot_mode
      ? `<img src="${iv.company.logo_url}" class="icard-logo-img" alt="" data-fb="ivpg-logo-${iv.id}">
         <div class="icard-logo-fb" data-fb-id="ivpg-logo-${iv.id}" ${window._fbHiddenStyle(iv.company)}>${(iv.company?.name || '?')[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb"${window._fbStyle(iv.company)}>${(iv.company?.name || '?')[0].toUpperCase()}</div>`;

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
      if (_filter.view === 'upcoming'   && isCompleted(iv))                       return false;
      if (_filter.view === 'completed'  && !isCompleted(iv))                      return false;
      if (_filter.view === 'this-week'  && (!isThisWeek(iv) || isCompleted(iv)))  return false;
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
    if (_completionListener) {
      document.removeEventListener('interview:completed', _completionListener);
      _completionListener = null;
    }
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

    const logoHtml = iv.company?.logo_url && !iv.company?.screenshot_mode
      ? `<img src="${iv.company.logo_url}" class="ivdp-logo-img" alt="" data-fb="ivdp-logo-${iv.id}">
         <div class="icard-logo-fb ivdp-logo-fb" data-fb-id="ivdp-logo-${iv.id}" ${window._fbHiddenStyle(iv.company)}>${companyName[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb ivdp-logo-fb"${window._fbStyle(iv.company)}>${companyName[0].toUpperCase()}</div>`;

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

    // ── Section 3: Candidate Fit ──────────────────────────────────────────────
    const resumeData  = JSON.parse(localStorage.getItem('klinch_resume') || 'null');
    const hasResume   = !!(resumeData?.raw_text);
    const hasJd       = !!(iv.jd?.raw);
    const fitCached   = iv.candidate_fit || null;

    let fitHtml;
    if (fitCached) {
      fitHtml = _buildFitHtml(fitCached, iv.id);
    } else if (!hasResume) {
      fitHtml = `<div class="ivdp-fit-banner">
        <span class="ivdp-fit-lock-icon">🔒</span>
        <span>Upload your resume on the <a class="ivdp-fit-link" data-nav="resume">Resume tab</a> to unlock Candidate Fit analysis.</span>
      </div>`;
    } else if (!hasJd) {
      fitHtml = `<div class="ivdp-fit-banner">
        <span class="ivdp-fit-lock-icon">🔒</span>
        <span>Add a job description to this interview to unlock Candidate Fit analysis.</span>
      </div>`;
    } else {
      fitHtml = `
        <div class="ivdp-ai-skeleton" id="ivdp-fit-skeleton">
          <div class="ivdp-skel-line w80"></div>
          <div class="ivdp-skel-line w60"></div>
          <div class="ivdp-skel-line w70"></div>
          <div class="ivdp-fit-analyzing-note">Analyzing your resume against this role — may take a few moments…</div>
        </div>
        <div id="ivdp-fit-body" style="display:none"></div>
        <button class="ivdp-refresh-btn" id="ivdp-fit-refresh" data-action="refresh-fit" data-iv-id="${iv.id}" style="display:none">↺ Refresh</button>`;
    }

    // ── Section 4: Interview Panel ─────────────────────────────────────────────
    const panelHtml = _buildPanelHtml(iv, interviewers);

    // ── Session Transcript (folded into Coach) ────────────────────────────────
    const sessions = iv.sessions || [];
    const latestSession = sessions.length
      ? sessions.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      : null;
    let transcriptHtml = '';
    if (latestSession?.transcript?.length) {
      const sDateStr = latestSession.created_at
        ? new Date(latestSession.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const lines = latestSession.transcript.map(t => `
        <div class="ivdp-transcript-line ${t.speaker === 'you' ? 'ivdp-transcript-you' : 'ivdp-transcript-interviewer'}">
          <span class="ivdp-transcript-speaker">${_esc(t.speaker === 'you' ? 'You' : 'Interviewer')}</span>
          <span class="ivdp-transcript-text">${_esc(t.text)}</span>
        </div>`).join('');
      transcriptHtml = `
        <details class="ivdp-transcript-section">
          <summary class="ivdp-transcript-toggle">Session Transcript${sDateStr ? ` — ${_esc(sDateStr)}` : ''}</summary>
          <div class="ivdp-transcript-body">${lines}</div>
        </details>`;
    }

    // ── Section 5 & 6: Coach + Context (cached) ────────────────────────────────
    const coachCached   = iv.coach_analysis  || null;
    const contextCached = iv.context_summary || null;

    let coachHtml;
    if (iv.status !== 'completed') {
      coachHtml = `<div class="ivdp-empty-state">
        <div class="ivdp-empty-sub">This section will populate once you mark this interview as complete.</div>
      </div>`;
    } else if (coachCached) {
      coachHtml = `${iv.coach_score != null ? _buildCoachScoreHtml(iv.coach_score) : ''}
         <div class="ivdp-ai-body">${_renderMarkdownish(coachCached)}</div>
         <button class="ivdp-refresh-btn" data-action="refresh-coach" data-iv-id="${iv.id}">↺ Refresh</button>
         ${transcriptHtml}`;
    } else {
      coachHtml = `<div id="ivdp-coach-score"></div>
         <div class="ivdp-ai-skeleton" id="ivdp-coach-skeleton">
           <div class="ivdp-skel-line w80"></div>
           <div class="ivdp-skel-line w60"></div>
           <div class="ivdp-skel-line w70"></div>
           <div class="ivdp-skel-line w50"></div>
         </div>
         <div class="ivdp-ai-body" id="ivdp-coach-body" style="display:none"></div>
         <button class="ivdp-refresh-btn" id="ivdp-coach-refresh" data-action="refresh-coach" data-iv-id="${iv.id}" style="display:none">↺ Refresh</button>`;
    }

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
          ${iv.status === 'pending' ? '<button class="ivdp-complete-btn" id="ivdp-complete-btn">✓ Mark as Complete</button>' : ''}
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
          ${(hasResume && hasJd) ? `<button class="ivdp-refresh-btn" data-action="refresh-fit" data-iv-id="${iv.id}" style="${fitCached ? '' : 'display:none'}">↺ Refresh</button>` : ''}
        </div>
        <div class="ivdp-section-body" id="ivdp-fit-section-body">${fitHtml}</div>
      </div>

      <!-- Section 4: Interview Panel -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Interview Panel</div>
          <button class="ivdp-add-btn" id="ivdp-add-interviewer" data-iv-id="${iv.id}">+ Add Interviewer</button>
        </div>
        <div class="ivdp-section-body" id="ivdp-panel-body">${panelHtml}</div>
      </div>

      <!-- Section 5: Community Questions -->
      ${iv.company?.domain ? `
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Community Questions</div>
        </div>
        <div class="ivdp-section-subtitle">Questions Klinch has identified from real interviews at this company over the last 12 months.</div>
        <div class="ivdp-section-body">
          <div id="ivdp-cq-body">
            <div class="ivdp-ai-skeleton" id="ivdp-cq-skeleton">
              <div class="ivdp-skel-line w80"></div>
              <div class="ivdp-skel-line w60"></div>
              <div class="ivdp-skel-line w70"></div>
            </div>
          </div>
        </div>
      </div>` : ''}

      <!-- Section 6: Coach -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Coach</div>
        </div>
        <div class="ivdp-section-body">${coachHtml}</div>
      </div>

      <!-- Section 6: Prep Notes -->
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Prep Notes</div>
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

    // Fire Coach (completed only) + Prep Notes as needed
    const needCoach   = iv.status === 'completed' && !coachCached;
    const needContext = !contextCached;
    if (needCoach && needContext) {
      _fireAIAnalysis(iv);
    } else if (needCoach) {
      _fireAIAnalysis(iv, 'coach');
    } else if (needContext) {
      _fireAIAnalysis(iv, 'context');
    }

    // Fire Candidate Fit if resume + JD available but not yet cached
    const _resumeForFit = JSON.parse(localStorage.getItem('klinch_resume') || 'null');
    if (_resumeForFit?.raw_text && iv.jd?.raw && !iv.candidate_fit) {
      _fireCandidateFit(iv);
    }

    // Fire Community Questions fetch if company domain is known
    if (iv.company?.domain) {
      _fireCommunityQuestions(iv);
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

    // Mark as Complete
    const completeBtn = _el('ivdp-complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => {
        if (confirm('Mark this interview as complete?')) {
          window._completeInterview?.(ivId);
        }
      });
    }

    // React to completion (manual or auto-scheduler)
    if (_completionListener) {
      document.removeEventListener('interview:completed', _completionListener);
    }
    _completionListener = (e) => {
      if (e.detail.id !== ivId) return;
      document.removeEventListener('interview:completed', _completionListener);
      _completionListener = null;
      const iv = getAll().find(x => x.id === ivId);
      if (iv) _renderDetail(iv);
    };
    document.addEventListener('interview:completed', _completionListener);

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
          iv.coach_score    = null;
          _patchIv(id, { coach_analysis: null, coach_score: null });
          _fireAIAnalysis(iv, 'coach');
        }
        if (action === 'refresh-context') {
          iv.context_summary = null;
          _patchIv(id, { context_summary: null });
          _fireAIAnalysis(iv, 'context');
        }
        if (action === 'retry-dry-run') {
          window.navigateTo('dry-run');
          window.DryRunPage?.launch({ mode: 'retry', interviewId: id });
        }
        if (action === 'refresh-fit') {
          _patchIv(id, { candidate_fit: null });
          iv.candidate_fit = null;
          const sectionBody = _el('ivdp-fit-section-body');
          if (sectionBody) sectionBody.innerHTML = `
            <div class="ivdp-ai-skeleton" id="ivdp-fit-skeleton">
              <div class="ivdp-skel-line w80"></div>
              <div class="ivdp-skel-line w60"></div>
              <div class="ivdp-skel-line w70"></div>
              <div class="ivdp-fit-analyzing-note">Analyzing your resume against this role — may take a few moments…</div>
            </div>
            <div id="ivdp-fit-body" style="display:none"></div>
            <button class="ivdp-refresh-btn" id="ivdp-fit-refresh" data-action="refresh-fit" data-iv-id="${id}" style="display:none">↺ Refresh</button>`;
          _fireCandidateFit(iv);
        }
      });
    }

    // Wire resume link in fit banner + AI section toggles
    const detailPage2 = _el('iv-detail-page');
    if (detailPage2) {
      detailPage2.addEventListener('click', e => {
        const link = e.target.closest('.ivdp-fit-link[data-nav]');
        if (link && window.navigateTo) window.navigateTo(link.dataset.nav);

        const toggleHdr = e.target.closest('[data-toggle-ai-section]');
        if (toggleHdr) {
          toggleHdr.closest('.ivdp-ai-section')?.classList.toggle('ivdp-ai-section-collapsed');
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

  function _processMarkdownBody(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h4 class="ivdp-ai-h4">$1</h4>')
      .replace(/^- (.+)$/gm,   '<li>$1</li>')
      .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hul])(.+)$/gm, (m, p) => p ? `<p>${p}</p>` : '')
      .replace(/<p><\/p>/g, '');
  }

  function _renderMarkdownish(text) {
    if (!text) return '';
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts   = escaped.split(/^## (.+)$/m);

    if (parts.length === 1) return _processMarkdownBody(parts[0]);

    let html = parts[0]?.trim() ? `<div class="ivdp-ai-intro">${_processMarkdownBody(parts[0])}</div>` : '';
    for (let i = 1; i < parts.length; i += 2) {
      const heading = parts[i];
      const body    = parts[i + 1] || '';
      html += `
        <div class="ivdp-ai-section ivdp-ai-section-collapsed">
          <div class="ivdp-ai-section-hdr" data-toggle-ai-section>
            <span>${heading}</span>
            <span class="ivdp-ai-chevron">▾</span>
          </div>
          <div class="ivdp-ai-section-body">${_processMarkdownBody(body)}</div>
        </div>`;
    }
    return html;
  }

  function _parseCoachScore(text) {
    const match = text.match(/^SCORE:\s*(\d{1,3})\s*\n/i);
    if (!match) return { score: null, text };
    const score = Math.min(100, Math.max(0, parseInt(match[1], 10)));
    return { score, text: text.slice(match[0].length) };
  }

  function _buildCoachScoreHtml(score) {
    return window.buildDonut(score, 80, 'ivdp-coach-score-circle');
  }

  async function _fireAIAnalysis(iv, only) {
    const roleTitle   = iv.jd?.structured?.role_title || 'this role';
    const company     = iv.company?.name || 'this company';
    const stage       = iv.stage || 'interview';
    const mustHave    = (iv.jd?.structured?.must_have || []).join(', ') || 'not specified';
    const niceHave    = (iv.jd?.structured?.nice_to_have || []).join(', ') || 'not specified';
    const interviewers= (iv.interviewers || []).map(iw => `${iw.name || 'Unknown'} (${iw.title || 'Unknown title'})`).join(', ') || 'unknown';
    const profileCtx  = window.profileContext ? window.profileContext(profile) : '';

    const coachPrompt = `${profileCtx ? profileCtx + '\n\n' : ''}You are an expert interview coach. The candidate has a ${stage} at ${company} for the role of ${roleTitle}.

Must-have qualifications: ${mustHave}
Nice-to-have qualifications: ${niceHave}
Interviewers: ${interviewers}

First, on its own line, output the candidate's overall interview readiness score (0–100) based on their profile fit for this role and stage:
SCORE: [number]

Then provide concise, actionable coaching in exactly this format — use these exact section headers with no deviations:

**What You Did Well**
• [bullet point]
• [bullet point]

**What to Improve**
• [bullet point]
• [bullet point]

**For Your Next Interview**
• [bullet point]
• [bullet point]

Be specific to this stage, company, and role. Be direct and confident.`;

    const contextPrompt = `${profileCtx ? profileCtx + '\n\n' : ''}You are an expert interview researcher. The candidate has a ${stage} at ${company} for the role of ${roleTitle}.

Interviewers: ${interviewers}
Must-have qualifications: ${mustHave}
Nice-to-have qualifications: ${niceHave}

Provide a concise prep brief for this interview. Include:
## About the Company
## Role Context
## Questions to Ask Them

Be specific and actionable. Focus on what will most help the candidate prepare for this specific role and stage.`;

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
        const rawText = results[ri++];
        const { score, text } = _parseCoachScore(rawText);
        const patch = { coach_analysis: text };
        if (score != null) patch.coach_score = score;
        _patchIv(iv.id, patch);
        const scoreEl = _el('ivdp-coach-score');
        if (scoreEl && score != null) scoreEl.innerHTML = _buildCoachScoreHtml(score);
        if (coachSkel)    coachSkel.style.display    = 'none';
        if (coachBody)  { coachBody.innerHTML = _renderMarkdownish(text); coachBody.style.display = ''; }
        if (coachRefresh) coachRefresh.style.display = '';
        if (window.refreshDashboardStats) window.refreshDashboardStats();
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

  function _buildFitHtml(fit, ivId) {
    const score   = Math.min(100, Math.max(0, fit.keyword_match_score || 0));
    const strengths = (fit.keywords_present || []).slice(0, 5);
    const gaps      = (fit.keywords_missing || []).slice(0, 4);
    const talking   = (fit.talking_points   || []).slice(0, 3);
    return `
      <div class="ivdp-fit-score-row">
        ${window.buildDonut(score, 80)}
        <div class="ivdp-fit-cols">
          <div class="ivdp-fit-col ivdp-fit-match">
            <div class="ivdp-fit-col-label">Strengths</div>
            ${strengths.map(s => `<div class="ivdp-fit-item">${_esc(s)}</div>`).join('') || '<div class="ivdp-fit-item" style="opacity:.5">None identified</div>'}
          </div>
          <div class="ivdp-fit-col ivdp-fit-gap">
            <div class="ivdp-fit-col-label">Gaps</div>
            ${gaps.map(g => `<div class="ivdp-fit-item">${_esc(g)}</div>`).join('') || '<div class="ivdp-fit-item" style="opacity:.5">None identified</div>'}
          </div>
          <div class="ivdp-fit-col ivdp-fit-talk">
            <div class="ivdp-fit-col-label">Talking Points</div>
            ${talking.map(t => `<div class="ivdp-fit-item">${_esc(t)}</div>`).join('') || '<div class="ivdp-fit-item" style="opacity:.5">None identified</div>'}
          </div>
        </div>
      </div>
      ${fit.strategic_summary ? `<div class="ivdp-fit-summary">${_esc(fit.strategic_summary)}</div>` : ''}`;
  }

  async function _fireCandidateFit(iv) {
    const resume = JSON.parse(localStorage.getItem('klinch_resume') || 'null');
    if (!resume?.raw_text || !iv.jd?.raw) return;

    try {
      const res = await window.klinch.invoke('claude:role-fit', {
        raw_text:        resume.raw_text,
        jd_raw:          iv.jd.raw,
        role_title:      iv.jd?.structured?.role_title || 'this role',
        profile_context: window.profileContext ? window.profileContext(profile) : '',
      });

      const fitSkel    = _el('ivdp-fit-skeleton');
      const fitBody    = _el('ivdp-fit-body');
      const fitRefresh = _el('ivdp-fit-refresh');

      if (!res?.ok) throw new Error(res?.error || 'Unknown error');

      _patchIv(iv.id, { candidate_fit: res.data });
      if (fitSkel)    fitSkel.style.display    = 'none';
      if (fitBody)  { fitBody.innerHTML = _buildFitHtml(res.data, iv.id); fitBody.style.display = ''; }
      if (fitRefresh) fitRefresh.style.display = '';

      // also show the header refresh button
      const headerRefresh = document.querySelector(`.ivdp-section-header [data-action="refresh-fit"]`);
      if (headerRefresh) headerRefresh.style.display = '';
    } catch (err) {
      console.error('[candidate-fit] failed:', err);
      const fitSkel = _el('ivdp-fit-skeleton');
      const fitBody = _el('ivdp-fit-body');
      if (fitSkel) fitSkel.style.display = 'none';
      if (fitBody) { fitBody.innerHTML = '<div class="ivdp-ai-error">Analysis failed. Try refreshing.</div>'; fitBody.style.display = ''; }
    }
  }

  async function _fireCommunityQuestions(iv) {
    const domain  = iv.company?.domain;
    const cqBody  = _el('ivdp-cq-body');
    const cqSkel  = _el('ivdp-cq-skeleton');
    if (!domain || !cqBody) return;

    const CQ_STAGE_ORDER = Object.keys(STAGE_BADGE);

    function _paintCQ(questions, activeStage) {
      const byStage = {};
      questions.forEach(q => {
        const s = q.interview_stage || 'General';
        if (!byStage[s]) byStage[s] = [];
        byStage[s].push(q);
      });

      const current = activeStage ?? null;

      const tabsHtml = `
        <div class="co-cq-tabs">
          <button class="co-cq-tab${!current ? ' active' : ''}" data-stage="">
            All <span class="co-cq-tab-count">${questions.length}</span>
          </button>
          ${CQ_STAGE_ORDER.map(s => `
            <button class="co-cq-tab${current === s ? ' active' : ''}" data-stage="${_esc(s)}">
              ${_esc(s)} <span class="co-cq-tab-count">${(byStage[s] || []).length}</span>
            </button>`).join('')}
        </div>`;

      let contentHtml;
      if (current) {
        const stageQs = byStage[current] || [];
        if (!stageQs.length) {
          contentHtml = '<div class="ivdp-cq-empty">No questions recorded for this stage yet.</div>';
        } else {
          const items = stageQs.map(q => `<li class="ivdp-cq-item">${_esc(q.question)}</li>`).join('');
          contentHtml = `<ul class="ivdp-cq-list">${items}</ul>`;
        }
      } else {
        const populated = CQ_STAGE_ORDER.filter(s => byStage[s]?.length);
        if (!populated.length) {
          contentHtml = '<div class="ivdp-cq-empty">No community questions yet for this company.</div>';
        } else {
          contentHtml = populated.map(stage => {
            const cls   = STAGE_BADGE[stage] || 'badge-recruiter';
            const items = byStage[stage].map(q => `<li class="ivdp-cq-item">${_esc(q.question)}</li>`).join('');
            return `
              <div class="ivdp-cq-group">
                <div class="ivdp-cq-stage"><span class="icard-stage-badge ${cls}">${_esc(stage)}</span></div>
                <ul class="ivdp-cq-list">${items}</ul>
              </div>`;
          }).join('');
        }
      }

      cqBody.innerHTML = tabsHtml + `<div class="co-cq-content">${contentHtml}</div>`;
      cqBody.querySelectorAll('.co-cq-tab').forEach(btn => {
        btn.addEventListener('click', () => _paintCQ(questions, btn.dataset.stage || null));
      });
    }

    try {
      const res = await window.klinch.invoke('community:get-questions', { domain });
      if (cqSkel) cqSkel.style.display = 'none';

      let questions = res?.data || [];
      if (!questions.length && window.klinch?.isDev) {
        try {
          const devPool = JSON.parse(localStorage.getItem('klinch_dev_community_questions') || '{}');
          questions = devPool[domain] || [];
        } catch (_) {}
      }

      _paintCQ(questions, null);
    } catch (err) {
      console.error('[community-questions]', err);
      if (cqSkel) cqSkel.style.display = 'none';
      if (cqBody) cqBody.innerHTML = `<div class="ivdp-cq-empty">Could not load community questions.</div>`;
    }
  }

  async function _callClaude(prompt) {
    const result = await window.klinch.invoke('claude:coach', {
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }],
    });
    return result?.content?.[0]?.text || result?.text || result || '';
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    document.querySelector('.iv-calendar-panel')?.addEventListener('click', () => {
      window.navigateTo('calendar');
    });

    document.querySelectorAll('.iv-stat-card[data-stat-filter]').forEach(card => {
      card.addEventListener('click', () => {
        const view = card.dataset.statFilter;
        _filter.view = view;
        // Sync toggle buttons
        document.querySelectorAll('.iv-toggle-btn').forEach(b => b.classList.remove('active'));
        if (view === 'upcoming' || view === 'this-week') {
          document.querySelector('.iv-toggle-btn[data-view="upcoming"]')?.classList.add('active');
        } else if (view === 'completed') {
          document.querySelector('.iv-toggle-btn[data-view="completed"]')?.classList.add('active');
        }
        // Active card highlight
        document.querySelectorAll('.iv-stat-card').forEach(c => c.classList.remove('iv-stat-active'));
        card.classList.add('iv-stat-active');
        renderFeed();
      });
    });

    document.querySelectorAll('.iv-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.iv-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filter.view = btn.dataset.view;
        document.querySelectorAll('.iv-stat-card').forEach(c => c.classList.remove('iv-stat-active'));
        renderFeed();
      });
    });

    _el('iv-filter-company').addEventListener('change', e => { _filter.company = e.target.value; renderFeed(); });
    _el('iv-filter-stage'  ).addEventListener('change', e => { _filter.stage   = e.target.value; renderFeed(); });
    _el('iv-filter-format' ).addEventListener('change', e => { _filter.format  = e.target.value; renderFeed(); });
    _el('iv-search').addEventListener('input', e => { _filter.search = e.target.value.trim(); renderFeed(); });

    document.addEventListener('interview:completed', () => {
      renderStats();
      renderCalendar();
      renderFeed();
      window.refreshDashboardStats?.();
    });

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
