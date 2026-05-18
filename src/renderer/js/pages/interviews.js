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

  const PROCESS_STATUS_CLS = {
    'Active':         'proc-status-active',
    'Offer Received': 'proc-status-offer-received',
    'Offer Accepted': 'proc-status-offer-accepted',
    'Rejected':       'proc-status-rejected',
    'Withdrawn':      'proc-status-withdrawn',
  };

  let _filter = { view: 'active', status: '', company: '', search: '' };
  let _expanded = new Set();
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

  function getProcesses() {
    return JSON.parse(localStorage.getItem('klinch_processes') || '[]');
  }

  function saveProcesses(list) {
    localStorage.setItem('klinch_processes', JSON.stringify(list));
  }

  function isCompleted(iv) {
    if (iv.status === 'completed') return true;
    if (!iv.scheduled_at) return false;
    return new Date(iv.scheduled_at) < new Date();
  }

  function isWithinDays(iv, days) {
    if (!iv.scheduled_at) return false;
    const d = new Date(iv.scheduled_at);
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + days);
    return d >= now && d <= end;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  function renderStats() {
    const processes  = getProcesses();
    const interviews = getAll();

    const activeProcs  = processes.filter(p => p.status === 'Active' || p.status === 'Offer Received').length;
    const upcoming7d   = interviews.filter(iv => !isCompleted(iv) && isWithinDays(iv, 7)).length;
    const allIvs       = interviews.length;
    const completedIvs = interviews.filter(isCompleted).length;

    _el('iv-stat-total').textContent     = activeProcs;
    _el('iv-stat-upcoming').textContent  = upcoming7d;
    _el('iv-stat-week').textContent      = allIvs;
    _el('iv-stat-completed').textContent = completedIvs;

    // Pipeline: stage counts from active-process interviews
    const activeIds = new Set(processes.filter(p => p.status === 'Active' || p.status === 'Offer Received').map(p => p.id));
    const stageCounts = {};
    interviews
      .filter(iv => !isCompleted(iv) && activeIds.has(iv.process_id))
      .forEach(iv => {
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

  // ── Company filter ─────────────────────────────────────────────────────────────

  function updateCompanyFilter() {
    const companies = [...new Set(getProcesses().map(p => p.company_name).filter(Boolean))].sort();
    const sel       = _el('iv-filter-company');
    const current   = sel.value;
    sel.innerHTML   = `<option value="">All Companies</option>` +
      companies.map(c => `<option value="${_esc(c)}"${c === current ? ' selected' : ''}>${_esc(c)}</option>`).join('');
  }

  // ── Process row HTML ──────────────────────────────────────────────────────────

  function _buildProcessRowHTML(proc, stages) {
    const isOpen = _expanded.has(proc.id);

    const logoHtml = proc.company_logo
      ? `<img src="${_esc(proc.company_logo)}" class="proc-logo-img" alt="" data-fb="proc-logo-${proc.id}">
         <div class="proc-logo-fb" data-fb-id="proc-logo-${proc.id}" style="display:none">${(proc.company_name || '?')[0].toUpperCase()}</div>`
      : `<div class="proc-logo-fb">${(proc.company_name || '?')[0].toUpperCase()}</div>`;

    const statusCls = PROCESS_STATUS_CLS[proc.status] || 'proc-status-active';

    const companyNavKey = _esc(
      stages[0]?.company?.primary_domain ||
      stages[0]?.company?.domain ||
      proc.company_name || ''
    );

    const sorted = [...stages].sort((a, b) => {
      const da = a.scheduled_at ? new Date(a.scheduled_at) : new Date(0);
      const db = b.scheduled_at ? new Date(b.scheduled_at) : new Date(0);
      return da - db;
    });

    const nextIdx = sorted.findIndex(iv => !isCompleted(iv));

    const stagesHtml = isOpen ? `
      <div class="proc-stages">
        ${sorted.map((iv, i) => _buildStageRowHTML(iv, i === nextIdx)).join('')}
        <button class="proc-add-round" data-process-id="${proc.id}">+ Add another round</button>
      </div>` : '';

    return `
      <div class="proc-row" data-process-id="${proc.id}">
        <div class="proc-header" data-process-id="${proc.id}">
          <div class="proc-logo-wrap" data-company-nav="${companyNavKey}">${logoHtml}</div>
          <div class="proc-info">
            <div class="proc-company proc-company-link" data-company-nav="${companyNavKey}">${_esc(proc.company_name || 'Unknown')}</div>
            <div class="proc-role">${_esc(proc.role_title || 'Role TBD')}</div>
          </div>
          <div class="proc-header-right">
            <span class="proc-status-badge ${statusCls}">${_esc(proc.status || 'Active')}</span>
            <button class="proc-kebab" data-process-id="${proc.id}" title="More options">⋮</button>
            <span class="proc-chevron ${isOpen ? 'is-open' : ''}">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 4l4 4 4-4"/></svg>
            </span>
          </div>
        </div>
        ${stagesHtml}
      </div>`;
  }

  function _buildStageRowHTML(iv, isNext) {
    const dateObj  = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
    const dateStr  = dateObj
      ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'TBD';
    const timeStr  = (dateObj && iv.scheduled_at?.includes('T'))
      ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const done = isCompleted(iv);
    const icon = done ? '✓' : (isNext ? '→' : '·');
    const iconCls = done ? 'icon-done' : (isNext ? 'icon-next' : 'icon-dot');

    let statusLabel = 'Scheduled';
    let statusCls   = isNext ? 'proc-ss-upcoming' : 'proc-ss-scheduled';
    if (iv.status === 'completed')  { statusLabel = 'Completed'; statusCls = 'proc-ss-done'; }
    if (iv.status === 'cancelled')  { statusLabel = 'Cancelled'; statusCls = ''; }
    if (iv.status === 'no_show')    { statusLabel = 'No Show';   statusCls = 'proc-ss-noshow'; }
    if (!iv.scheduled_at && iv.status !== 'completed') { statusLabel = 'TBD'; statusCls = ''; }

    return `
      <div class="proc-stage ${done ? 'is-completed' : ''} ${isNext ? 'is-next' : ''}" data-interview-id="${iv.id}">
        <span class="proc-stage-icon ${iconCls}">${icon}</span>
        <div class="proc-stage-info">
          <span class="proc-stage-name">${_esc(iv.stage || 'Interview')}</span>
          <span class="proc-stage-date">${dateStr}${timeStr ? ' · ' + timeStr : ''}</span>
        </div>
        <span class="proc-stage-status ${statusCls}">${statusLabel}</span>
      </div>`;
  }

  // ── Feed ──────────────────────────────────────────────────────────────────────

  function renderFeed() {
    const feed      = _el('iv-feed');
    const empty     = _el('iv-empty');
    const processes = getProcesses();
    const interviews= getAll();

    // Group interviews by process_id
    const byProcess = {};
    interviews.forEach(iv => {
      const pid = iv.process_id || '__orphan__';
      if (!byProcess[pid]) byProcess[pid] = [];
      byProcess[pid].push(iv);
    });

    // Filter processes
    let filtered = processes.filter(proc => {
      const isActive = proc.status === 'Active' || proc.status === 'Offer Received';
      if (_filter.view === 'active' && !isActive) return false;
      if (_filter.status && proc.status !== _filter.status) return false;
      if (_filter.company && proc.company_name !== _filter.company) return false;
      if (_filter.search) {
        const q = _filter.search.toLowerCase();
        if (!proc.company_name?.toLowerCase().includes(q) &&
            !proc.role_title?.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    // Sort: active first, then by most recent updated_at
    filtered.sort((a, b) => {
      const aActive = a.status === 'Active' || a.status === 'Offer Received';
      const bActive = b.status === 'Active' || b.status === 'Offer Received';
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });

    // Auto-expand on first render: expand all processes with upcoming interviews
    if (_expanded.size === 0 && filtered.length > 0) {
      filtered.forEach(proc => {
        const stages = byProcess[proc.id] || [];
        if (stages.some(iv => !isCompleted(iv))) _expanded.add(proc.id);
      });
      // If nothing to expand, expand first
      if (_expanded.size === 0) _expanded.add(filtered[0].id);
    }

    // Orphaned interviews (no process_id or process not found)
    const knownIds = new Set(processes.map(p => p.id));
    const orphans  = (byProcess['__orphan__'] || []).concat(
      interviews.filter(iv => iv.process_id && !knownIds.has(iv.process_id))
    );

    if (!filtered.length && !orphans.length) {
      feed.innerHTML      = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';

    let html = filtered.map(proc => _buildProcessRowHTML(proc, byProcess[proc.id] || [])).join('');

    if (orphans.length) {
      html += `<div class="proc-orphan-label">Other Interviews</div>`;
      // Render orphans as a single pseudo-process row each
      orphans.forEach(iv => {
        const dateObj = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
        const dateStr = dateObj
          ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'TBD';
        const done = isCompleted(iv);
        const logoHtml = iv.company?.logo_url && !iv.company?.screenshot_mode
          ? `<img src="${_esc(iv.company.logo_url)}" class="proc-logo-img" alt="" data-fb="orp-logo-${iv.id}">
             <div class="proc-logo-fb" data-fb-id="orp-logo-${iv.id}" style="display:none">${(iv.company?.name || '?')[0].toUpperCase()}</div>`
          : `<div class="proc-logo-fb">${(iv.company?.name || '?')[0].toUpperCase()}</div>`;
        html += `
          <div class="proc-row" style="opacity:${done ? '.65' : '1'}">
            <div class="proc-header proc-stage" data-interview-id="${iv.id}" style="cursor:pointer">
              <div class="proc-logo-wrap">${logoHtml}</div>
              <div class="proc-info">
                <div class="proc-company">${_esc(iv.company?.name || 'Unknown')}</div>
                <div class="proc-role">${_esc(iv.stage || 'Interview')} · ${dateStr}</div>
              </div>
              <span class="proc-stage-status ${done ? 'proc-ss-done' : ''}">${done ? 'Completed' : 'Scheduled'}</span>
            </div>
          </div>`;
      });
    }

    feed.innerHTML = html;
    if (window.wireImgFallbacks) window.wireImgFallbacks(feed);
  }

  // ── Process status management ─────────────────────────────────────────────────

  function _setProcessStatus(processId, status) {
    const procs = getProcesses();
    const idx   = procs.findIndex(p => p.id === processId);
    if (idx < 0) return;
    const oldStatus  = procs[idx].status;
    procs[idx].status     = status;
    procs[idx].updated_at = new Date().toISOString();
    saveProcesses(procs);

    if (status === 'Offer Accepted' && oldStatus !== 'Offer Accepted') {
      const proc = procs[idx];
      window.ApplicationsPage?.triggerOfferCelebration?.(
        proc.company_name,
        proc.company_logo,
        proc.role_title
      );
    }

    renderFeed();
    renderStats();
  }

  function _deleteProcess(processId) {
    if (!confirm('Delete this application and all its interview rounds?')) return;
    const procs = getProcesses().filter(p => p.id !== processId);
    saveProcesses(procs);
    // Also unlink interviews (keep them as orphans rather than deleting)
    const ivs = getAll().map(iv => {
      if (iv.process_id === processId) { const copy = { ...iv }; delete copy.process_id; return copy; }
      return iv;
    });
    saveAll(ivs);
    _expanded.delete(processId);
    renderFeed();
    renderStats();
    updateCompanyFilter();
  }

  function _openEditProcess(processId) {
    const proc = getProcesses().find(p => p.id === processId);
    if (!proc) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'proc-edit-backdrop';
    backdrop.innerHTML = `
      <div class="proc-edit-card">
        <div class="proc-edit-title">Edit Application</div>
        <div class="proc-edit-field">
          <label class="proc-edit-label">Company Name</label>
          <input class="proc-edit-input" id="proc-edit-company" type="text" value="${_esc(proc.company_name || '')}">
        </div>
        <div class="proc-edit-field">
          <label class="proc-edit-label">Role Title</label>
          <input class="proc-edit-input" id="proc-edit-role" type="text" value="${_esc(proc.role_title || '')}">
        </div>
        <div class="proc-edit-actions">
          <button class="proc-edit-cancel" id="proc-edit-cancel">Cancel</button>
          <button class="proc-edit-save" id="proc-edit-save">Save</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    function _close() { backdrop.remove(); }
    backdrop.addEventListener('click', e => { if (e.target === backdrop) _close(); });
    backdrop.querySelector('#proc-edit-cancel').addEventListener('click', _close);
    backdrop.querySelector('#proc-edit-save').addEventListener('click', () => {
      const company = backdrop.querySelector('#proc-edit-company').value.trim();
      const role    = backdrop.querySelector('#proc-edit-role').value.trim();
      const procs   = getProcesses();
      const idx     = procs.findIndex(p => p.id === processId);
      if (idx >= 0) {
        if (company) procs[idx].company_name = company;
        if (role)    procs[idx].role_title   = role;
        procs[idx].updated_at = new Date().toISOString();
        saveProcesses(procs);
      }
      _close();
      renderFeed();
      updateCompanyFilter();
    });
  }

  function _openKebabMenu(processId, anchorEl) {
    document.querySelector('.proc-kebab-menu')?.remove();
    const proc = getProcesses().find(p => p.id === processId);
    if (!proc) return;

    const menu = document.createElement('div');
    menu.className = 'proc-kebab-menu';
    const isActive = proc.status === 'Active';
    menu.innerHTML = `
      <button class="proc-km-item" data-km-action="edit">Edit Application</button>
      <div class="proc-km-divider"></div>
      ${isActive ? `<button class="proc-km-item" data-km-action="offer-received">Mark: Offer Received</button>` : ''}
      <button class="proc-km-item" data-km-action="offer-accepted">Mark: Offer Accepted</button>
      <button class="proc-km-item proc-km-danger" data-km-action="reject">Mark: Rejected</button>
      <button class="proc-km-item proc-km-danger" data-km-action="withdraw">Mark: Withdrawn</button>
      <div class="proc-km-divider"></div>
      <button class="proc-km-item proc-km-danger" data-km-action="delete">Delete Application</button>`;

    const rect = anchorEl.getBoundingClientRect();
    menu.style.top  = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.min(rect.right - 188, window.innerWidth - 196)}px`;
    document.body.appendChild(menu);

    function close() {
      menu.remove();
      document.removeEventListener('click', close, true);
    }
    setTimeout(() => document.addEventListener('click', close, true), 0);

    menu.addEventListener('click', e => {
      const btn = e.target.closest('[data-km-action]');
      if (!btn) return;
      close();
      switch (btn.dataset.kmAction) {
        case 'edit':           _openEditProcess(processId); break;
        case 'offer-received': _setProcessStatus(processId, 'Offer Received'); break;
        case 'offer-accepted': _setProcessStatus(processId, 'Offer Accepted'); break;
        case 'reject':         _setProcessStatus(processId, 'Rejected'); break;
        case 'withdraw':       _setProcessStatus(processId, 'Withdrawn'); break;
        case 'delete':         _deleteProcess(processId); break;
      }
    });
  }

  // ── Detail page ───────────────────────────────────────────────────────────────

  function showInterviewDetail(id) {
    const iv = getAll().find(x => String(x.id) === String(id));
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
    const roleTitle        = window.shortenRoleTitle(iv.jd?.structured?.role_title) || 'Role TBD';
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
        <div id="ivdp-fit-body" style="display:none"></div>`;
    }

    // ── Section 4: Interview Panel ─────────────────────────────────────────────
    const panelHtml = _buildPanelHtml(iv, interviewers);

    // ── Session Transcript ────────────────────────────────────────────────────
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
          <summary class="ivdp-transcript-toggle">Interview Transcript${sDateStr ? ` — ${_esc(sDateStr)}` : ''}</summary>
          <div class="ivdp-transcript-body">${lines}</div>
        </details>`;
    }

    // ── Section 5: Coach (Ear session feedback only) ─────────────────────────
    const earFeedback = latestSession?.feedback?.trim() || null;
    const scoreHtml   = iv.coach_score != null ? _buildCoachScoreHtml(iv.coach_score) : '<div id="ivdp-coach-score"></div>';
    let coachHtml;
    if (earFeedback) {
      coachHtml = `
        ${scoreHtml}
        <div class="ivdp-ai-body">${_renderMarkdownish(earFeedback)}</div>
        ${transcriptHtml}`;
    } else {
      coachHtml = `
        ${scoreHtml}
        <div class="ivdp-empty-state">
          <div class="ivdp-empty-sub">Complete an Ear session to see your coaching feedback.</div>
        </div>
        ${transcriptHtml}`;
    }

    // ── Section 6: Prep Notes (AI prep brief + context summary) ─────────────
    const coachCached   = iv.coach_analysis  || null;
    const contextCached = iv.context_summary || null;

    // Strip any intro text (heading + subtitle) before the first ## section
    function _stripIntro(text) {
      if (!text) return text;
      const idx = text.search(/^## /m);
      return idx >= 0 ? text.slice(idx) : text;
    }

    const contextHtml = contextCached
      ? `<div class="ivdp-ai-body">${_renderMarkdownish(_stripIntro(contextCached))}</div>`
      : `<div class="ivdp-ai-skeleton" id="ivdp-context-skeleton">
           <div class="ivdp-skel-line w80"></div>
           <div class="ivdp-skel-line w60"></div>
           <div class="ivdp-skel-line w70"></div>
           <div class="ivdp-skel-line w50"></div>
         </div>
         <div class="ivdp-ai-body" id="ivdp-context-body" style="display:none"></div>`;

    // ── Assemble ───────────────────────────────────────────────────────────────
    const container = _el('iv-detail-page');
    container.innerHTML = `
      <div class="ivdp-breadcrumb">
        <button class="ivdp-bc-link" id="ivdp-back">Interviews</button>
        <span class="ivdp-bc-sep">›</span>
        <span class="ivdp-bc-current">${_esc(companyName)} — ${_esc(roleTitle)}</span>
        <button class="ivdp-launch-ear-btn" id="ivdp-launch-ear">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 1h4v4M5 13H1V9M14 1l-6 6M1 13l6-6"/>
          </svg>
          Launch Ear
        </button>
      </div>

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
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            ${iv.status === 'pending' ? '<button class="ivdp-complete-btn" id="ivdp-complete-btn" style="margin-top:0">✓ Mark as Complete</button>' : ''}
            <button class="ivdp-reschedule-btn" id="ivdp-reschedule-btn">Reschedule</button>
          </div>
        </div>
      </div>

      <div class="ivdp-section">
        <div class="ivdp-section-header"><div class="ivdp-section-title">Role Intel</div></div>
        <div class="ivdp-section-body">${roleIntelHtml}</div>
      </div>

      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Candidate Fit</div>
          ${(hasResume && hasJd) ? `<button class="ivdp-refresh-btn" data-action="refresh-fit" data-iv-id="${iv.id}" style="${fitCached ? '' : 'display:none'}">↺ Refresh</button>` : ''}
        </div>
        <div class="ivdp-section-body" id="ivdp-fit-section-body">${fitHtml}</div>
      </div>

      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Interview Panel</div>
          <button class="ivdp-add-btn" id="ivdp-add-interviewer" data-iv-id="${iv.id}">+ Add Interviewer</button>
        </div>
        <div class="ivdp-section-body" id="ivdp-panel-body">${panelHtml}</div>
      </div>

      ${iv.company?.domain ? `
      <div class="ivdp-section">
        <div class="ivdp-section-header"><div class="ivdp-section-title">Community Questions</div></div>
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

      <div class="ivdp-section">
        <div class="ivdp-section-header"><div class="ivdp-section-title">Coach</div></div>
        <div class="ivdp-section-body">${coachHtml}</div>
      </div>

      <div class="ivdp-section">
        <div class="ivdp-section-header"><div class="ivdp-section-title">Prep Notes</div></div>
        <div class="ivdp-section-body">${contextHtml}</div>
      </div>

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

    const needCoach   = !coachCached;
    const needContext = !contextCached;
    if (needCoach && needContext)   _fireAIAnalysis(iv);
    else if (needCoach)             _fireAIAnalysis(iv, 'coach');
    else if (needContext)           _fireAIAnalysis(iv, 'context');

    const _resumeForFit = JSON.parse(localStorage.getItem('klinch_resume') || 'null');
    if (_resumeForFit?.raw_text && iv.jd?.raw && !iv.candidate_fit) _fireCandidateFit(iv);
    if (iv.company?.domain) _fireCommunityQuestions(iv);
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

  function _openRescheduleModal(ivId) {
    const iv = getAll().find(x => x.id === ivId);
    if (!iv) return;

    const backdrop = document.getElementById('reschedule-backdrop');
    const dateInput = document.getElementById('reschedule-date');
    const hourSel   = document.getElementById('reschedule-hour');
    const minSel    = document.getElementById('reschedule-min');
    const saveBtn   = document.getElementById('reschedule-save');
    const cancelBtn = document.getElementById('reschedule-cancel');
    if (!backdrop || !dateInput || !hourSel || !minSel) return;

    if (!hourSel.options.length) {
      for (let h = 1; h <= 12; h++) hourSel.add(new Option(String(h), String(h)));
    }
    if (!minSel.options.length) {
      ['00','15','30','45'].forEach(m => minSel.add(new Option(m, m)));
    }

    if (iv.scheduled_at) {
      const d = new Date(iv.scheduled_at);
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const dd   = String(d.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      const h24 = d.getHours();
      const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
      hourSel.value = String(h12);
      const mins = d.getMinutes();
      const snapMin = ['00','15','30','45'].reduce((best, v) =>
        Math.abs(parseInt(v) - mins) < Math.abs(parseInt(best) - mins) ? v : best, '00');
      minSel.value = snapMin;
    } else {
      dateInput.value = '';
      hourSel.value = '9';
      minSel.value  = '00';
    }

    backdrop.classList.add('visible');
    function _close() { backdrop.classList.remove('visible'); }
    cancelBtn?.addEventListener('click', _close, { once: true });
    backdrop.addEventListener('click', e => { if (e.target === backdrop) _close(); }, { once: true });

    saveBtn?.addEventListener('click', () => {
      const dateVal = dateInput.value;
      if (!dateVal) { dateInput.focus(); return; }
      const h   = parseInt(hourSel.value, 10);
      const m   = parseInt(minSel.value, 10);
      const isPm = h < 9 || h === 12;
      const h24  = isPm && h !== 12 ? h + 12 : h;
      const pad  = n => String(n).padStart(2, '0');
      _patchIv(ivId, { scheduled_at: `${dateVal}T${pad(h24)}:${pad(m)}:00` });
      _close();
      const updated = getAll().find(x => x.id === ivId);
      if (updated) _renderDetail(updated);
      renderCalendar();
      renderFeed();
    }, { once: true });
  }

  function _showPhoneWarnModal() {
    return new Promise(resolve => {
      const backdrop = document.getElementById('phone-warn-backdrop');
      const btn      = document.getElementById('phone-warn-confirm');
      backdrop.style.display = '';
      btn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        resolve();
      }, { once: true });
    });
  }

  function _wireDetailEvents(ivId) {
    const backBtn = _el('ivdp-back');
    if (backBtn) backBtn.addEventListener('click', hideDetail);

    const launchEarBtn = _el('ivdp-launch-ear');
    if (launchEarBtn) {
      launchEarBtn.addEventListener('click', async () => {
        if (!window.Billing?.canStartSession()) { window.Billing?.showUpgradeModal(); return; }

        const allIvs    = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
        const currentIv = allIvs.find(x => String(x.id) === String(ivId));
        const isPhoneScreen = currentIv?.format === 'Phone Screen';

        if (isPhoneScreen && !currentIv?.phone_warned) {
          await _showPhoneWarnModal();
          const updated = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
          const idx = updated.findIndex(x => String(x.id) === String(ivId));
          if (idx >= 0) {
            updated[idx].phone_warned = true;
            localStorage.setItem('klinch_interviews', JSON.stringify(updated));
          }
        }

        const prof = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
        await window.klinch.invoke('ear:fullscreen-launch', {
          interviewId:  ivId,
          returnTo:     'interviews',
          roleType:     prof.role_type || '',
          isPhoneScreen,
        });
        window.Billing?.consumeCredit();
      });
    }

    const completeBtn = _el('ivdp-complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => {
        const all = getAll();
        const idx = all.findIndex(x => String(x.id) === String(ivId));
        // Guard: bail if already completed or not found
        if (idx < 0 || all[idx].status === 'completed') return;
        all[idx].status     = 'completed';
        all[idx].updated_at = new Date().toISOString();
        saveAll(all);
        // Dispatch only — _completionListener (set below) handles the single re-render.
        // Do NOT call _renderDetail here: calling it before the event fires causes a
        // double render, destroying the skeleton DOM nodes that _fireAIAnalysis is
        // about to populate, so coach analysis silently writes to detached elements.
        document.dispatchEvent(new CustomEvent('interview:completed', { detail: { id: all[idx].id } }));
      });
    }

    const rescheduleBtn = _el('ivdp-reschedule-btn');
    if (rescheduleBtn) rescheduleBtn.addEventListener('click', () => _openRescheduleModal(ivId));

    if (_completionListener) document.removeEventListener('interview:completed', _completionListener);
    _completionListener = (e) => {
      if (String(e.detail.id) !== String(ivId)) return;
      document.removeEventListener('interview:completed', _completionListener);
      _completionListener = null;
      const iv = getAll().find(x => String(x.id) === String(ivId));
      if (iv) _renderDetail(iv);
    };
    document.addEventListener('interview:completed', _completionListener);

    document.addEventListener('keydown', _onDetailEscape);

    const addBtn    = _el('ivdp-add-interviewer');
    const modal     = _el('ivdp-iw-modal');
    const closeBtn  = _el('ivdp-iw-close');
    const cancelBtn = _el('ivdp-iw-cancel');
    const saveBtn   = _el('ivdp-iw-save');

    if (addBtn)    addBtn.addEventListener('click', () => { modal.style.display = ''; });
    if (closeBtn)  closeBtn.addEventListener('click', _closeIwModal);
    if (cancelBtn) cancelBtn.addEventListener('click', _closeIwModal);
    if (modal)     modal.addEventListener('click', e => { if (e.target === modal) _closeIwModal(); });

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
        const panelBody = _el('ivdp-panel-body');
        if (panelBody) {
          panelBody.innerHTML = _buildPanelHtml(all[idx], all[idx].interviewers);
          if (window.wireImgFallbacks) window.wireImgFallbacks(panelBody);
          _wirePanelLinkedIn(panelBody);
        }
      });
    }

    const panelBody = _el('ivdp-panel-body');
    if (panelBody) _wirePanelLinkedIn(panelBody);

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
          _patchIv(id, { coach_analysis: null, coach_score: null });
          iv.coach_analysis = null;
          iv.coach_score    = null;
          _fireAIAnalysis(iv, 'coach');
        }
        if (action === 'refresh-context') {
          _patchIv(id, { context_summary: null });
          iv.context_summary = null;
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
            <div id="ivdp-fit-body" style="display:none"></div>`;
          _fireCandidateFit(iv);
        }
      });

      detailPage.addEventListener('click', e => {
        const link = e.target.closest('.ivdp-fit-link[data-nav]');
        if (link && window.navigateTo) window.navigateTo(link.dataset.nav);
        const toggleHdr = e.target.closest('[data-toggle-ai-section]');
        if (toggleHdr) toggleHdr.closest('.ivdp-ai-section')?.classList.toggle('ivdp-ai-section-collapsed');
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
    // Tables: convert pipe-delimited blocks before any other processing
    text = text.replace(/((?:\|[^\n]+\|\n?)+)/g, block => {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return block;
      const sepIdx = lines.findIndex(l => /^\|[\s\-|:]+\|$/.test(l));
      if (sepIdx < 1) return block;
      const cells = l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const thead = cells(lines[sepIdx - 1]).map(c => `<th>${c}</th>`).join('');
      const tbody = lines.slice(sepIdx + 1)
        .map(l => `<tr>${cells(l).map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
      return `<table class="ivdp-md-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    });
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g,  '<em>$1</em>')
      .replace(/^# (.+)$/gm,    '<h3 class="ivdp-ai-h3">$1</h3>')
      .replace(/^### (.+)$/gm,  '<h4 class="ivdp-ai-h4">$1</h4>')
      .replace(/^---$/gm,       '<hr class="ivdp-ai-hr">')
      .replace(/^- (.+)$/gm,    '<li>$1</li>')
      .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hult])(.+)$/gm, (m, p) => p ? `<p>${p}</p>` : '')
      .replace(/<p><\/p>/g, '');
  }

  const _ROLE_SHORTEN_PAIRS = [
    ['Sales Development Representative', 'SDR'],
    ['Account Executive', 'AE'],
    ['Customer Success Manager', 'CSM'],
    ['Account Manager', 'AM'],
    ['Solutions Engineer', 'SE'],
    ['Sales Engineer', 'SE'],
    ['Revenue Operations', 'RevOps'],
    ['Revenue Ops', 'RevOps'],
    ['People Operations', 'People'],
  ];
  function _shortenRolesInText(text) {
    let out = text;
    _ROLE_SHORTEN_PAIRS.forEach(([full, short]) => { out = out.replace(new RegExp(full, 'g'), short); });
    return out;
  }

  function _renderMarkdownish(text) {
    if (!text) return '';
    const escaped = _shortenRolesInText(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    const roleTitle    = iv.jd?.structured?.role_title || 'this role';
    const company      = iv.company?.name || 'this company';
    const stage        = iv.stage || 'interview';
    const mustHave     = (iv.jd?.structured?.must_have || []).join(', ') || 'not specified';
    const niceHave     = (iv.jd?.structured?.nice_to_have || []).join(', ') || 'not specified';
    const interviewers = (iv.interviewers || []).map(iw => `${iw.name || 'Unknown'} (${iw.title || 'Unknown title'})`).join(', ') || 'unknown';
    const profileCtx   = window.profileContext ? window.profileContext(profile) : '';

    // Find the most recent session with a non-empty transcript
    const sessions = iv.sessions || [];
    const sessionWithTranscript = sessions
      .filter(s => s.transcript?.length)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;

    let coachPrompt;

    if (sessionWithTranscript) {
      // ── Post-session mode: feedback grounded in what was actually said ──────
      const transcriptText = sessionWithTranscript.transcript
        .map(t => `${t.speaker === 'you' ? 'Candidate' : 'Interviewer'}: ${t.text}`)
        .join('\n');

      coachPrompt = `${profileCtx ? profileCtx + '\n\n' : ''}You are an expert interview coach reviewing a completed ${stage} interview at ${company} for the role of ${roleTitle}.

Interviewers: ${interviewers}
Must-have qualifications: ${mustHave}
Nice-to-have qualifications: ${niceHave}

Transcript:
${transcriptText}

First, on its own line, output an overall performance score (0–100) based on the actual transcript:
SCORE: [number]

Then provide concise, specific coaching based only on what the candidate actually said. Use exactly these section headers with no deviations:

**What You Did Well**
• [bullet point tied to something specific they said or did]
• [bullet point]

**What to Improve**
• [bullet point tied to a specific gap or missed opportunity in the transcript]
• [bullet point]

**For Your Next Round**
• [bullet point — forward-looking advice for the next stage at this company]
• [bullet point]

Be direct. Ground every point in the transcript. Do not give generic advice.`;

    } else {
      // ── Pre-session mode: prep brief based on JD + profile ─────────────────
      coachPrompt = `${profileCtx ? profileCtx + '\n\n' : ''}You are an expert interview coach. The candidate has an upcoming ${stage} at ${company} for the role of ${roleTitle}.

Must-have qualifications: ${mustHave}
Nice-to-have qualifications: ${niceHave}
Interviewers: ${interviewers}

This is a pre-interview prep brief — no transcript exists yet. First, on its own line, output the candidate's readiness score (0–100) based on their profile fit for this role and stage:
SCORE: [number]

Then provide a focused prep brief in exactly this format — use these exact section headers with no deviations:

**What to Focus On**
• [the 2–3 things most likely to come up given this stage and role]
• [bullet point]

**Key Watch-outs**
• [gaps or risks in their profile relative to the must-haves]
• [bullet point]

**For This Interview**
• [specific, tactical advice for this stage with this interviewer]
• [bullet point]

Be specific to this stage, company, and role. Make clear this is preparation guidance, not a debrief.`;
    }

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

    const coachSkel    = _el('ivdp-coach-skeleton');
    const coachBody    = _el('ivdp-coach-body');
    const coachRefresh = _el('ivdp-coach-refresh');
    const ctxSkel      = _el('ivdp-context-skeleton');
    const ctxBody      = _el('ivdp-context-body');
    const ctxRefresh   = _el('ivdp-context-refresh');

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
        window.refreshDashboardStats?.();
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
    const score    = Math.min(100, Math.max(0, fit.keyword_match_score || 0));
    const strengths= (fit.keywords_present || []).slice(0, 5);
    const gaps     = (fit.keywords_missing || []).slice(0, 4);
    const talking  = (fit.talking_points   || []).slice(0, 3);
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
      ${fit.strategic_summary ? `
      <div class="ivdp-fit-ai-summary">
        <div class="ivdp-fit-ai-summary-label">AI Summary</div>
        <div class="ivdp-fit-summary">${_esc(fit.strategic_summary)}</div>
      </div>` : ''}`;
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
      const fitSkel = _el('ivdp-fit-skeleton');
      const fitBody = _el('ivdp-fit-body');
      if (!res?.ok) throw new Error(res?.error || 'Unknown error');
      _patchIv(iv.id, { candidate_fit: res.data });
      if (fitSkel) fitSkel.style.display = 'none';
      if (fitBody) { fitBody.innerHTML = _buildFitHtml(res.data, iv.id); fitBody.style.display = ''; }
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
    console.log('[community-questions] fetching — domain:', domain, '| company:', iv.company?.name, '| stage:', iv.stage);
    if (!domain || !cqBody) {
      console.log('[community-questions] skipping — missing domain or cqBody element');
      return;
    }

    const CQ_STAGE_ORDER = ['Recruiter Screen', 'Hiring Manager', 'Panel', 'Final Round'];

    function _paintCQ(questions, activeStage) {
      const byStage = {};
      questions.forEach(q => {
        const s = q.interview_stage || 'General';
        if (!byStage[s]) byStage[s] = [];
        byStage[s].push(q);
      });
      const current  = activeStage ?? null;
      const tabsHtml = `
        <div class="co-cq-tabs">
          <button class="co-cq-tab${!current ? ' active' : ''}" data-stage="">
            All <span class="co-cq-tab-count">${questions.length}</span>
          </button>
          ${CQ_STAGE_ORDER.filter(s => (byStage[s] || []).length > 0).map(s => `
            <button class="co-cq-tab${current === s ? ' active' : ''}" data-stage="${_esc(s)}">
              ${_esc(s)} <span class="co-cq-tab-count">${byStage[s].length}</span>
            </button>`).join('')}
        </div>`;
      let contentHtml;
      if (current) {
        const stageQs = byStage[current] || [];
        contentHtml = !stageQs.length
          ? '<div class="ivdp-cq-empty">No questions recorded for this stage yet.</div>'
          : `<ul class="ivdp-cq-list">${stageQs.map(q => `<li class="ivdp-cq-item">${_esc(q.question)}</li>`).join('')}</ul>`;
      } else {
        const populated = CQ_STAGE_ORDER.filter(s => byStage[s]?.length);
        contentHtml = !populated.length
          ? '<div class="ivdp-cq-empty">No community questions yet for this company.</div>'
          : populated.map(stage => {
              const cls   = STAGE_BADGE[stage] || 'badge-recruiter';
              const items = byStage[stage].map(q => `<li class="ivdp-cq-item">${_esc(q.question)}</li>`).join('');
              return `<div class="ivdp-cq-group"><div class="ivdp-cq-stage"><span class="icard-stage-badge ${cls}">${_esc(stage)}</span></div><ul class="ivdp-cq-list">${items}</ul></div>`;
            }).join('');
      }
      cqBody.innerHTML = tabsHtml + `<div class="co-cq-content">${contentHtml}</div>`;
      cqBody.querySelectorAll('.co-cq-tab').forEach(btn => {
        btn.addEventListener('click', () => _paintCQ(questions, btn.dataset.stage || null));
      });
    }

    try {
      const res = await window.klinch.invoke('community:get-questions', { domain });
      console.log('[community-questions] IPC response — ok:', res?.ok, '| count:', res?.data?.length ?? 0, '| error:', res?.error || null);
      if (cqSkel) cqSkel.style.display = 'none';
      let questions = res?.data || [];
      if (!questions.length && window.klinch?.isDev) {
        try {
          const devPool = JSON.parse(localStorage.getItem('klinch_dev_community_questions') || '{}');
          questions = devPool[domain] || [];
        } catch (_) {}
      }
      _paintCQ(questions, iv.stage || null);
    } catch (err) {
      console.error('[community-questions] fetch threw:', err);
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

    // Toggle: Active | All
    document.querySelectorAll('.iv-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.iv-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filter.view = btn.dataset.view; // 'active' | 'all'
        renderFeed();
      });
    });

    _el('iv-filter-company')?.addEventListener('change', e => { _filter.company = e.target.value; renderFeed(); });
    _el('iv-filter-status') ?.addEventListener('change', e => { _filter.status  = e.target.value; renderFeed(); });
    _el('iv-search')        ?.addEventListener('input',  e => { _filter.search  = e.target.value.trim(); renderFeed(); });

    document.addEventListener('interview:completed', () => {
      renderStats();
      renderCalendar();
      renderFeed();
      window.refreshDashboardStats?.();
    });

    // Feed click delegation
    _el('iv-feed').addEventListener('click', e => {
      // Kebab menu — must check before header, as kebab is inside header
      const kebab = e.target.closest('.proc-kebab');
      if (kebab) {
        e.stopPropagation();
        _openKebabMenu(kebab.dataset.processId, kebab);
        return;
      }

      // "Add another round" button
      const addRound = e.target.closest('.proc-add-round');
      if (addRound) {
        e.stopPropagation();
        window.AddInterview?.openForProcess?.(addRound.dataset.processId);
        return;
      }

      // Company navigation — logo or company name click
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

      // Stage row click → interview detail
      const stage = e.target.closest('.proc-stage[data-interview-id]');
      if (stage) {
        showInterviewDetail(stage.dataset.interviewId);
        return;
      }

      // Process header → expand/collapse
      const header = e.target.closest('.proc-header[data-process-id]');
      if (header) {
        const pid = header.dataset.processId;
        if (_expanded.has(pid)) _expanded.delete(pid);
        else                    _expanded.add(pid);
        renderFeed();
        return;
      }
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
