window.ApplicationsPage = (() => {

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

  const STATUS_CLASS = {
    'Applied':      'ap-status-applied',
    'Interviewing': 'ap-status-interviewing',
    'Offer':        'ap-status-offer',
    'Withdrawn':    'ap-status-withdrawn',
    'Rejected':     'ap-status-rejected',
  };

  let _filter = { status: '', stage: '', search: '', sort: 'date_applied' };
  let _pendingLinkRecord = null;
  let _deleteTargetId    = null;
  let _detailApp         = null;

  function _el(id) { return document.getElementById(id); }
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Data ──────────────────────────────────────────────────────────────────────

  function getAll() {
    return JSON.parse(localStorage.getItem('klinch_applications') || '[]');
  }
  function saveAll(apps) {
    localStorage.setItem('klinch_applications', JSON.stringify(apps));
  }
  function getInterviews() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  }

  function responseDays(app) {
    if (!app.date_applied || !app.date_first_interview) return null;
    const d1 = new Date(app.date_applied + 'T00:00:00');
    const d2 = new Date(app.date_first_interview + 'T00:00:00');
    return Math.max(0, Math.round((d2 - d1) / 86400000));
  }

  function isHot(app) {
    const d = responseDays(app);
    return d !== null && d <= 7;
  }

  function linkedInterviews(app) {
    const ids = app.interview_ids || [];
    return getInterviews().filter(iv => ids.includes(iv.id));
  }

  // Returns real applications merged with synthetic records derived from
  // interviews that aren't already linked to any real application.
  function _getMergedApps() {
    const real    = getAll();
    const allIvs  = getInterviews();
    const covered = new Set(real.flatMap(a => a.interview_ids || []));

    // Group uncovered interviews by normalised company name
    const groups = {};
    allIvs.filter(iv => !covered.has(iv.id)).forEach(iv => {
      const key = (iv.company?.name || '').toLowerCase().trim();
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(iv);
    });

    const synthetic = Object.entries(groups).map(([key, ivList]) => {
      ivList.sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));
      const first   = ivList[0];
      const latest  = ivList[ivList.length - 1];
      const withJd  = ivList.find(iv => iv.jd?.structured?.role_title);
      const now     = new Date();
      const dateStr = first.scheduled_at ? first.scheduled_at.slice(0, 10) : null;
      return {
        id:                   '_syn_' + key.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        _synthetic:           true,
        company:              first.company,
        role_title:           (withJd || first)?.jd?.structured?.role_title || '',
        date_applied:         dateStr,
        date_first_interview: dateStr,
        status:               ivList.some(iv => iv.scheduled_at && new Date(iv.scheduled_at) >= now)
                                ? 'Interviewing' : 'Interviewing',
        current_stage:        latest.stage || null,
        jd:                   (withJd || first)?.jd || null,
        notes:                '',
        interview_ids:        ivList.map(iv => iv.id),
        created_at:           first.created_at || dateStr,
        updated_at:           latest.created_at || dateStr,
      };
    });

    return [...real, ...synthetic];
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  function renderStats() {
    const all    = _getMergedApps();
    const active = all.filter(a => a.status === 'Interviewing').length;
    const offers = all.filter(a => a.status === 'Offer').length;
    const times  = all.map(responseDays).filter(d => d !== null);
    const avg    = times.length ? Math.round(times.reduce((s, d) => s + d, 0) / times.length) : null;

    _el('ap-stat-total').textContent    = all.length;
    _el('ap-stat-active').textContent   = active;
    _el('ap-stat-offers').textContent   = offers;
    _el('ap-stat-response').textContent = avg !== null ? avg : '—';
  }

  // ── Card HTML ─────────────────────────────────────────────────────────────────

  function buildCardHTML(app) {
    const logoHtml = app.company?.logo_url
      ? `<img src="${_esc(app.company.logo_url)}" class="icard-logo-img" alt="" data-fb="apcard-logo-${app.id}">
         <div class="icard-logo-fb" data-fb-id="apcard-logo-${app.id}" style="display:none">${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`
      : `<div class="icard-logo-fb">${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`;

    const statusClass = STATUS_CLASS[app.status] || 'ap-status-applied';
    const stageBadgeClass = STAGE_BADGE[app.current_stage] || '';

    const dateApplied = app.date_applied
      ? new Date(app.date_applied + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';

    const days = responseDays(app);
    const hot  = isHot(app);

    const ivs      = linkedInterviews(app);
    const now      = new Date();
    const done     = ivs.filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) < now).length;
    const upcoming = ivs.filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) >= now).length;

    const firstIvDate = app.date_first_interview
      ? new Date(app.date_first_interview + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;

    return `
      <div class="icard ap-card" data-id="${_esc(app.id)}"${app._synthetic ? ' data-synthetic="1"' : ''}>
        ${app._synthetic ? '' : '<button class="icard-delete-btn" aria-label="Delete application">✕</button>'}
        <div class="icard-top">
          <div class="icard-logo-wrap">${logoHtml}</div>
          <div class="icard-company-info">
            <div class="icard-company-name">${_esc(app.company?.name || 'Unknown Company')}</div>
            <div class="icard-role">${_esc(app.role_title || 'Role TBD')}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
            <span class="icard-stage-badge ${_esc(statusClass)}">${_esc(app.status)}</span>
            ${app.current_stage ? `<span class="icard-stage-badge ${_esc(stageBadgeClass)}">${_esc(app.current_stage)}</span>` : ''}
          </div>
        </div>
        <div class="ap-card-footer">
          <div class="ap-card-meta">
            <span class="icard-date">Applied ${_esc(dateApplied)}</span>
            ${firstIvDate ? `<span class="ap-meta-dot">·</span><span class="icard-date">1st interview ${_esc(firstIvDate)}</span>` : ''}
            ${days !== null ? `<span class="ap-meta-dot">·</span><span class="icard-date">${days}d response</span>` : ''}
            ${hot ? `<span class="ap-hot" aria-label="Hot job">🔥<span class="ap-hot-tooltip">This role is moving fast. You heard back within ${days} day${days === 1 ? '' : 's'} of applying — a strong signal of company urgency or candidate fit. Prioritise this one.</span></span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${ivs.length ? `<span class="icard-date" style="color:var(--text-muted)">${done} done${upcoming ? ` · ${upcoming} upcoming` : ''}</span>` : ''}
            <button class="ap-add-iv-btn">+ Add Interview</button>
          </div>
        </div>
      </div>`;
  }

  // ── Feed ──────────────────────────────────────────────────────────────────────

  function renderFeed() {
    let apps = _getMergedApps();

    if (_filter.status) apps = apps.filter(a => a.status === _filter.status);
    if (_filter.stage)  apps = apps.filter(a => a.current_stage === _filter.stage);
    if (_filter.search) {
      const q = _filter.search.toLowerCase();
      apps = apps.filter(a =>
        a.company?.name?.toLowerCase().includes(q) ||
        a.role_title?.toLowerCase().includes(q)
      );
    }

    apps.sort((a, b) => {
      if (_filter.sort === 'response_time') {
        const da = responseDays(a); const db = responseDays(b);
        if (da === null && db === null) return 0;
        if (da === null) return 1; if (db === null) return -1;
        return da - db;
      }
      if (_filter.sort === 'activity') {
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
      }
      // default: date_applied descending
      return new Date(b.date_applied || 0) - new Date(a.date_applied || 0);
    });

    const feed  = _el('ap-feed');
    const empty = _el('ap-empty');

    if (!apps.length) {
      feed.innerHTML      = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    feed.innerHTML = apps.map(buildCardHTML).join('');
    if (window.wireImgFallbacks) window.wireImgFallbacks(feed);
  }

  // ── Detail view ───────────────────────────────────────────────────────────────

  function openDetail(id) {
    const app = _getMergedApps().find(a => a.id === id);
    if (!app) return;
    _detailApp = app;
    _el('ap-grid-layer').style.display  = 'none';
    _el('ap-detail-layer').style.display = '';
    _renderDetailHero(app);
    _renderDetailBody(app);
  }

  function _renderDetailHero(app) {
    const logoHtml = app.company?.logo_url
      ? `<img src="${_esc(app.company.logo_url)}" class="co-hero-logo-img" alt="" data-fb="apd-logo">
         <div class="icard-logo-fb co-hero-logo-fb" data-fb-id="apd-logo" style="display:none">${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`
      : `<div class="icard-logo-fb co-hero-logo-fb">${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`;

    const days = responseDays(app);
    const hot  = isHot(app);
    const stageBadgeClass = STAGE_BADGE[app.current_stage] || '';
    const statusClass     = STATUS_CLASS[app.status] || 'ap-status-applied';

    const el = _el('ap-detail-hero');
    el.innerHTML = `
      <div class="co-hero-logo">${logoHtml}</div>
      <div class="co-hero-info">
        <div class="co-hero-name">${_esc(app.company?.name || '')}</div>
        <div class="co-hero-domain" style="cursor:default">${_esc(app.role_title || '')}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap">
        <span class="icard-stage-badge ${_esc(statusClass)}">${_esc(app.status)}</span>
        ${app.current_stage ? `<span class="icard-stage-badge ${_esc(stageBadgeClass)}">${_esc(app.current_stage)}</span>` : ''}
        ${hot ? `<span class="ap-hot" style="font-size:16px" aria-label="Hot job">🔥<span class="ap-hot-tooltip">This role is moving fast. You heard back within ${days} day${days === 1 ? '' : 's'} of applying — a strong signal of company urgency or candidate fit. Prioritise this one.</span></span>` : ''}
        <button class="ap-add-iv-btn">+ Add Interview</button>
      </div>`;

    if (window.wireImgFallbacks) window.wireImgFallbacks(el);
  }

  function _renderDetailBody(app) {
    const ivs      = linkedInterviews(app);
    const now      = new Date();
    const done     = ivs.filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) < now);
    const upcoming = ivs.filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) >= now);
    const days     = responseDays(app);

    const fmtDate = d => d
      ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;

    let html = `
      <div class="co-section">
        <div class="co-section-title">Timeline</div>
        <div class="ap-timeline-row">
          <div class="ap-timeline-item">
            <div class="ap-timeline-label">Date Applied</div>
            <div class="ap-timeline-value">${fmtDate(app.date_applied) || '<span style="color:var(--text-muted)">—</span>'}</div>
          </div>
          <div class="ap-timeline-item">
            <div class="ap-timeline-label">First Interview</div>
            <div class="ap-timeline-value">${fmtDate(app.date_first_interview) || '<span style="color:var(--text-muted)">Not yet</span>'}</div>
          </div>
          <div class="ap-timeline-item">
            <div class="ap-timeline-label">Response Time</div>
            <div class="ap-timeline-value">${days !== null ? `${days} day${days === 1 ? '' : 's'}` : '<span style="color:var(--text-muted)">—</span>'}</div>
          </div>
        </div>
      </div>`;

    if (app.jd?.structured) {
      const jd = app.jd.structured;
      html += `
        <div class="co-section">
          <div class="co-section-title">Job Description</div>
          ${jd.role_title ? `<div class="ai-jd-role-title" style="margin-bottom:14px">${_esc(jd.role_title)}</div>` : ''}
          ${jd.location || jd.salary ? `
            <div style="display:flex;gap:16px;margin-bottom:14px;font-size:12px;color:var(--text-muted)">
              ${jd.location ? `<span>📍 ${_esc(jd.location)}</span>` : ''}
              ${jd.salary   ? `<span>💰 ${_esc(jd.salary)}</span>`   : ''}
            </div>` : ''}
          ${jd.responsibilities?.length ? `
            <div class="ai-jd-section">
              <div class="ai-jd-section-label">Key Responsibilities</div>
              <ul class="ai-jd-list">${jd.responsibilities.map(r => `<li>${_esc(r)}</li>`).join('')}</ul>
            </div>` : ''}
          ${jd.must_have?.length ? `
            <div class="ai-jd-section">
              <div class="ai-jd-section-label">Must-Have</div>
              <ul class="ai-jd-list">${jd.must_have.map(r => `<li>${_esc(r)}</li>`).join('')}</ul>
            </div>` : ''}
          ${jd.nice_to_have?.length ? `
            <div class="ai-jd-section">
              <div class="ai-jd-section-label">Nice-to-Have</div>
              <ul class="ai-jd-list">${jd.nice_to_have.map(r => `<li>${_esc(r)}</li>`).join('')}</ul>
            </div>` : ''}
        </div>`;
    }

    html += `
      <div class="co-section">
        <div class="co-section-title">Completed Interviews (${done.length})</div>
        ${done.length
          ? done.map(_buildIvRow).join('')
          : '<div class="co-empty-hint">No completed interviews yet</div>'}
      </div>
      <div class="co-section">
        <div class="co-section-title">Upcoming Interviews (${upcoming.length})</div>
        ${upcoming.length
          ? upcoming.map(_buildIvRow).join('')
          : '<div class="co-empty-hint">No upcoming interviews scheduled</div>'}
      </div>
      ${app._synthetic
        ? `<div class="co-section"><div class="co-section-title">Notes</div><div class="co-empty-hint" style="font-size:12px">Add this as a manual application to save notes.</div></div>`
        : `<div class="co-section"><div class="co-section-title">Notes</div><textarea id="ap-detail-notes" class="co-notes-input" placeholder="Add your own notes about this role…">${_esc(app.notes || '')}</textarea></div>`
      }`;

    _el('ap-detail-body').innerHTML = html;
    if (window.wireImgFallbacks) window.wireImgFallbacks(_el('ap-detail-body'));

    const notesEl = _el('ap-detail-notes');
    if (notesEl) {
      notesEl.addEventListener('input', () => {
        const all = getAll();
        const idx = all.findIndex(a => a.id === app.id);
        if (idx !== -1) {
          all[idx].notes      = notesEl.value;
          all[idx].updated_at = new Date().toISOString();
          saveAll(all);
        }
      });
    }
  }

  function _buildIvRow(iv) {
    const dateObj = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
    const dateStr = dateObj
      ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD';
    const stageCls = STAGE_BADGE[iv.stage] || 'badge-recruiter';
    const iws      = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);
    const iwName   = iws[0]?.name || '';

    return `
      <div class="ap-iv-row" data-iv-id="${_esc(iv.id)}">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          <span class="icard-stage-badge ${_esc(stageCls)}" style="flex-shrink:0">${_esc(iv.stage)}</span>
          ${iwName ? `<span style="font-size:13px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(iwName)}</span>` : ''}
        </div>
        <span class="icard-date" style="flex-shrink:0">${_esc(dateStr)}</span>
      </div>`;
  }

  // ── Add Application modal ─────────────────────────────────────────────────────

  const _aa = { step: 1, company: null, jd: null };
  let _aaSearchTimeout = null;

  function openAddModal(prefill = null) {
    _aa.step    = 1;
    _aa.company = prefill?.company || null;
    const _ivFallback = (!prefill?.jd && prefill?.company)
      ? getInterviews().find(iv =>
          (iv.company?.name || '').toLowerCase() === (prefill.company.name || '').toLowerCase() &&
          iv.jd?.structured)
      : null;
    _aa.jd = prefill?.jd || _ivFallback?.jd || null;

    if (_aa.company) {
      _el('aa-company-input').style.display = 'none';
      _el('aa-company-results').style.display = 'none';
      _el('aa-sel-logo-img').src        = _aa.company.logo_url || '';
      _el('aa-sel-company-name').textContent  = _aa.company.name;
      _el('aa-sel-company-domain').textContent = _aa.company.domain || '';
      _el('aa-selected-company').style.display = '';
      if (window.wireImgFallbacks) window.wireImgFallbacks(_el('aa-selected-company'));
    } else {
      _el('aa-company-input').value      = '';
      _el('aa-company-input').style.display = '';
      _el('aa-company-results').style.display = 'none';
      _el('aa-company-results').innerHTML = '';
      _el('aa-selected-company').style.display = 'none';
    }

    _el('aa-role').value = prefill?.role_title || _aa.jd?.structured?.role_title || '';
    _el('aa-date-applied').value = prefill?.date_applied || new Date().toISOString().slice(0, 10);
    _el('aa-status').value       = 'Applied';
    _el('aa-jd-textarea').value  = _aa.jd?.raw || '';
    if (_aa.jd?.structured) {
      const s = _aa.jd.structured;
      _el('aa-jd-role-title').textContent = s.role_title || '';
      _el('aa-jd-resp').innerHTML = (s.responsibilities || []).map(x => `<li>${x}</li>`).join('');
      _el('aa-jd-must').innerHTML = (s.must_have || []).map(x => `<li>${x}</li>`).join('');
      _el('aa-jd-structured').style.display = '';
      _el('aa-jd-textarea').style.display   = 'none';
    } else {
      _el('aa-jd-structured').style.display = 'none';
      _el('aa-jd-textarea').style.display   = '';
    }
    _el('aa-toast').style.display = 'none';

    if (prefill?.company && prefill?.role_title && prefill?.jd) {
      _aaSave();
      return;
    }

    _aaShowStep(prefill?.company && prefill?.role_title ? 2 : 1);
    _el('add-app-modal').style.display = '';
  }

  function _aaShowStep(n) {
    _aa.step = n;
    [1, 2].forEach(i => { _el(`aa-step-${i}`).style.display = i === n ? '' : 'none'; });
    document.querySelectorAll('#add-app-modal .ai-step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i < n);
    });
    _el('aa-step-label').textContent = n === 1 ? 'Step 1 of 2 — Company & Role' : 'Step 2 of 2 — Job Description';
    _el('aa-next').textContent       = n === 1 ? 'Continue →' : 'Save Application';
    _el('aa-back').style.visibility  = n > 1 ? '' : 'hidden';
  }

  async function _aaNext() {
    if (_aa.step === 1) {
      if (!_aa.company) { _showToast('Please select a company first.'); return; }
      if (!_el('aa-role').value.trim()) { _showToast('Please enter a role title.'); return; }
      _aaShowStep(2);
    } else {
      await _aaSave();
    }
  }

  async function _aaSave() {
    const jdRaw = _el('aa-jd-textarea').value.trim();
    let jd = _aa.jd;

    if (jdRaw && !jd) {
      const btn = _el('aa-next');
      btn.textContent = 'Processing…';
      btn.disabled    = true;
      try {
        const res = await window.klinch.invoke('claude:process-jd', { jd_text: jdRaw });
        if (res.ok) jd = { raw: jdRaw, structured: res.data };
      } catch (_) {}
      btn.disabled = false;
    }

    // Absorb any interviews for this company that aren't yet linked to a real application
    const coveredIds   = new Set(getAll().flatMap(a => a.interview_ids || []));
    const coName       = (_aa.company.name || '').toLowerCase().trim();
    const toLink       = getInterviews().filter(iv =>
      !coveredIds.has(iv.id) &&
      (iv.company?.name || '').toLowerCase().trim() === coName
    ).sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));

    const firstIv      = toLink.find(iv => iv.scheduled_at);
    const latestIv     = [...toLink].reverse().find(iv => iv.stage);

    const record = {
      id:                   crypto.randomUUID(),
      company:              _aa.company,
      role_title:           _el('aa-role').value.trim(),
      date_applied:         _el('aa-date-applied').value,
      date_first_interview: firstIv ? firstIv.scheduled_at.slice(0, 10) : null,
      status:               _el('aa-status').value,
      current_stage:        latestIv?.stage || null,
      jd:                   jd || null,
      notes:                '',
      interview_ids:        toLink.map(iv => iv.id),
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    };

    const all = getAll();
    all.push(record);
    saveAll(all);

    _el('add-app-modal').style.display = 'none';
    refresh();
  }

  function _aaSearch(query) {
    clearTimeout(_aaSearchTimeout);
    if (!query.trim()) { _el('aa-company-results').style.display = 'none'; return; }
    _aaSearchTimeout = setTimeout(async () => {
      try {
        const res  = await window.klinch.invoke('apollo:search', { query });
        const orgs = res?.data?.organizations || [];
        if (!orgs.length) { _el('aa-company-results').style.display = 'none'; return; }

        _el('aa-company-results').innerHTML = orgs.map((org, i) => `
          <div class="ai-search-result" data-idx="${i}">
            <div class="ai-search-logo">
              <img src="${_esc(org.logo_url || '')}" alt="" data-fb="aa-org-${i}">
              <div class="ai-logo-fallback" data-fb-id="aa-org-${i}" style="display:none">${_esc((org.name || '?')[0])}</div>
            </div>
            <div>
              <div class="ai-search-name">${_esc(org.name)}</div>
              <div class="ai-search-sub">${_esc(org.primary_domain || '')}</div>
            </div>
          </div>`).join('');
        _el('aa-company-results').style.display = '';
        if (window.wireImgFallbacks) window.wireImgFallbacks(_el('aa-company-results'));

        _el('aa-company-results').querySelectorAll('.ai-search-result').forEach((row, i) => {
          row.addEventListener('click', () => {
            const org   = orgs[i];
            _aa.company = { name: org.name, domain: org.primary_domain, logo_url: org.logo_url, apollo_id: org.id };
            _el('aa-company-input').style.display    = 'none';
            _el('aa-company-results').style.display  = 'none';
            _el('aa-sel-logo-img').src               = org.logo_url || '';
            _el('aa-sel-company-name').textContent   = org.name;
            _el('aa-sel-company-domain').textContent = org.primary_domain || '';
            _el('aa-selected-company').style.display = '';
            if (window.wireImgFallbacks) window.wireImgFallbacks(_el('aa-selected-company'));
            const ivMatch = getInterviews().find(iv =>
              (iv.company?.name || '').toLowerCase() === (org.name || '').toLowerCase() &&
              iv.jd?.structured
            );
            if (ivMatch) {
              if (!_el('aa-role').value.trim()) _el('aa-role').value = ivMatch.jd.structured.role_title || '';
              if (!_aa.jd) {
                _aa.jd = ivMatch.jd;
                _el('aa-jd-textarea').value = ivMatch.jd.raw || '';
                const s = ivMatch.jd.structured;
                _el('aa-jd-role-title').textContent = s.role_title || '';
                _el('aa-jd-resp').innerHTML = (s.responsibilities || []).map(x => `<li>${x}</li>`).join('');
                _el('aa-jd-must').innerHTML = (s.must_have || []).map(x => `<li>${x}</li>`).join('');
                _el('aa-jd-structured').style.display = '';
                _el('aa-jd-textarea').style.display   = 'none';
              }
            }
          });
        });
      } catch (_) {}
    }, 280);
  }

  // ── Interview link prompt ─────────────────────────────────────────────────────

  function showLinkPrompt(record) {
    _pendingLinkRecord = record;
    _el('ap-link-company-name').textContent = record.company?.name || 'this company';
    const el = _el('ap-link-prompt');
    el.style.display = '';
    requestAnimationFrame(() => el.classList.add('visible'));
  }

  function _hideLinkPrompt() {
    const el = _el('ap-link-prompt');
    el.classList.remove('visible');
    setTimeout(() => { el.style.display = 'none'; }, 220);
    _pendingLinkRecord = null;
  }

  // Called from add-interview.js after every new interview is saved
  function onInterviewSaved(record) {
    const all      = getAll();
    const existing = all.find(a =>
      (a.company?.name || '').toLowerCase() === (record.company?.name || '').toLowerCase()
    );

    if (existing) {
      const idx = all.indexOf(existing);
      if (!all[idx].interview_ids.includes(record.id)) {
        all[idx].interview_ids.push(record.id);
      }
      all[idx].current_stage = record.stage;
      if (!['Offer', 'Withdrawn', 'Rejected'].includes(all[idx].status)) {
        all[idx].status = 'Interviewing';
      }
      // Recalculate first interview date from all linked interviews
      const ivDates = getInterviews()
        .filter(iv => all[idx].interview_ids.includes(iv.id) && iv.scheduled_at)
        .map(iv => iv.scheduled_at.slice(0, 10))
        .sort();
      if (ivDates.length) all[idx].date_first_interview = ivDates[0];
      all[idx].updated_at = new Date().toISOString();
      saveAll(all);
    } else {
      showLinkPrompt(record);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  function _openDeleteConfirm(id) {
    _deleteTargetId = id;
    const app = getAll().find(a => a.id === id);
    _el('ap-delete-company-name').textContent = app?.company?.name || 'this application';
    const el = _el('ap-delete-confirm');
    el.style.display = '';
    requestAnimationFrame(() => el.classList.add('visible'));
  }

  function _closeDeleteConfirm() {
    const el = _el('ap-delete-confirm');
    el.classList.remove('visible');
    setTimeout(() => { el.style.display = 'none'; }, 220);
    _deleteTargetId = null;
  }

  function _confirmDelete() {
    if (!_deleteTargetId) return;
    saveAll(getAll().filter(a => a.id !== _deleteTargetId));
    _closeDeleteConfirm();
    // If we're in the detail view, go back to grid
    if (_el('ap-detail-layer').style.display !== 'none') {
      _el('ap-detail-layer').style.display = 'none';
      _el('ap-grid-layer').style.display   = '';
    }
    refresh();
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────

  function _showToast(msg) {
    const el = _el('aa-toast');
    el.textContent    = msg;
    el.style.display  = '';
    clearTimeout(_showToast._timer);
    _showToast._timer = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    // Stat card click-throughs
    const _setStatusFilter = (status, sort) => {
      _filter.status = status;
      if (sort) _filter.sort = sort;
      _el('ap-filter-status').value = status;
      if (sort) _el('ap-sort').value = sort;
      renderFeed();
    };
    _el('ap-stat-total').closest('.ap-stat-card').addEventListener('click', () => _setStatusFilter('', null));
    _el('ap-stat-active').closest('.ap-stat-card').addEventListener('click', () => _setStatusFilter('Interviewing', null));
    _el('ap-stat-offers').closest('.ap-stat-card').addEventListener('click', () => _setStatusFilter('Offer', null));
    _el('ap-stat-response').closest('.ap-stat-card').addEventListener('click', () => _setStatusFilter('', 'response_time'));

    // Status filter select
    _el('ap-filter-status').addEventListener('change', e => { _filter.status = e.target.value; renderFeed(); });
    _el('ap-filter-stage').addEventListener('change',  e => { _filter.stage  = e.target.value; renderFeed(); });
    _el('ap-sort').addEventListener('change',          e => { _filter.sort   = e.target.value; renderFeed(); });
    _el('ap-search').addEventListener('input',         e => { _filter.search = e.target.value.trim(); renderFeed(); });

    // Feed: delete / add-interview / card detail
    _el('ap-feed').addEventListener('click', e => {
      const del = e.target.closest('.icard-delete-btn');
      if (del) {
        e.stopPropagation();
        const card = del.closest('.icard');
        if (card?.dataset.id) _openDeleteConfirm(card.dataset.id);
        return;
      }
      const addIv = e.target.closest('.ap-add-iv-btn');
      if (addIv) {
        e.stopPropagation();
        const card = addIv.closest('.icard');
        if (card?.dataset.id) {
          const app = _getMergedApps().find(a => a.id === card.dataset.id);
          if (app) window.AddInterview?.openWithCompany(app.company, app.jd || null);
        }
        return;
      }
      const card = e.target.closest('.icard');
      if (card) openDetail(card.dataset.id);
    });

    // Back to grid
    _el('ap-back-btn').addEventListener('click', () => {
      _el('ap-detail-layer').style.display = 'none';
      _el('ap-grid-layer').style.display   = '';
      refresh();
    });

    // Detail hero: add interview button
    _el('ap-detail-hero').addEventListener('click', e => {
      if (e.target.closest('.ap-add-iv-btn') && _detailApp) {
        window.AddInterview?.openWithCompany(_detailApp.company, _detailApp.jd || null);
      }
    });

    // Detail: iv-row click opens interview detail
    _el('ap-detail-body').addEventListener('click', e => {
      const row = e.target.closest('.ap-iv-row[data-iv-id]');
      if (row && window.InterviewsPage) {
        window.navigateTo?.('interviews');
        setTimeout(() => window.InterviewsPage.openDetail(row.dataset.ivId), 0);
      }
    });

    // Add Application button
    _el('ap-add-btn').addEventListener('click', () => openAddModal());

    // Add Application modal controls
    _el('aa-company-input').addEventListener('input', e => _aaSearch(e.target.value));
    _el('aa-company-change').addEventListener('click', () => {
      _aa.company = null;
      _el('aa-selected-company').style.display = 'none';
      _el('aa-company-input').style.display    = '';
      _el('aa-company-input').value            = '';
      _el('aa-company-input').focus();
    });
    _el('aa-back').addEventListener('click',  () => { if (_aa.step > 1) _aaShowStep(_aa.step - 1); });
    _el('aa-close').addEventListener('click', () => { _el('add-app-modal').style.display = 'none'; });
    _el('aa-next').addEventListener('click',  _aaNext);
    _el('aa-jd-edit').addEventListener('click', () => {
      _aa.jd = null;
      _el('aa-jd-structured').style.display = 'none';
      _el('aa-jd-textarea').style.display   = '';
    });
    _el('add-app-modal').addEventListener('click', e => {
      if (e.target === _el('add-app-modal')) _el('add-app-modal').style.display = 'none';
    });

    // Link prompt
    _el('ap-link-yes').addEventListener('click', () => {
      const rec = _pendingLinkRecord;
      _hideLinkPrompt();
      if (rec) {
        openAddModal({
          company:      rec.company,
          role_title:   rec.jd?.structured?.role_title || '',
          jd:           rec.jd || null,
          date_applied: new Date().toISOString().slice(0, 10),
        });
      }
    });
    _el('ap-link-no').addEventListener('click', _hideLinkPrompt);
    _el('ap-link-prompt').addEventListener('click', e => {
      if (e.target === _el('ap-link-prompt')) _hideLinkPrompt();
    });

    // Delete confirm
    _el('ap-delete-go').addEventListener('click',     _confirmDelete);
    _el('ap-delete-cancel').addEventListener('click', _closeDeleteConfirm);
    _el('ap-delete-confirm').addEventListener('click', e => {
      if (e.target === _el('ap-delete-confirm')) _closeDeleteConfirm();
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  function refresh() {
    renderStats();
    renderFeed();
    window.refreshDashboardStats?.();
  }

  function reset() {
    _el('ap-detail-layer').style.display = 'none';
    _el('ap-grid-layer').style.display   = '';
    refresh();
  }

  function getStats() {
    const all = _getMergedApps();
    return {
      total:  all.length,
      active: all.filter(a => a.status === 'Interviewing').length,
    };
  }

  init();
  return { refresh, reset, openDetail, onInterviewSaved, openAddModal, getStats };
})();
