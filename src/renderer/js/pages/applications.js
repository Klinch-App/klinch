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
    'Applied':        'ap-status-applied',
    'Interviewing':   'ap-status-interviewing',
    'Offer':          'ap-status-offer',
    'Offer Accepted': 'ap-status-offer-accepted',
    'Withdrawn':      'ap-status-withdrawn',
    'Rejected':       'ap-status-rejected',
  };

  let _filter = { status: '', stage: '', search: '', sort: 'date_applied' };
  let _pendingLinkRecord = null;
  let _deleteTargetId    = null;
  let _detailApp         = null;
  let _cel_appId         = null;
  let _confettiRaf       = null;

  const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');

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

  // ── Confetti ──────────────────────────────────────────────────────────────────

  function _fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    const COLORS   = ['#7C3AFF', '#DC3CA0', '#3CDBA0', '#FFFFFF', '#9B6BFF', '#E879C0'];
    const DURATION = 3800;

    const particles = Array.from({ length: 180 }, () => ({
      x:     Math.random() * canvas.width,
      y:     -20 - Math.random() * 120,
      w:     5 + Math.random() * 9,
      h:     Math.random() < 0.4 ? (5 + Math.random() * 9) : (2 + Math.random() * 4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx:    -2 + Math.random() * 4,
      vy:    1.5 + Math.random() * 4,
      rot:   Math.random() * Math.PI * 2,
      rotV:  -0.12 + Math.random() * 0.24,
      phase: Math.random() * Math.PI * 2,
      amp:   0.5 + Math.random() * 1.5,
    }));

    let startTime = null;
    cancelAnimationFrame(_confettiRaf);

    function _tick(ts) {
      if (!startTime) startTime = ts;
      const elapsed  = ts - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const alpha    = progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.vy  += 0.05;
        p.x   += p.vx + Math.sin(elapsed * 0.002 + p.phase) * p.amp * 0.1;
        p.y   += p.vy;
        p.rot += p.rotV;

        const bottomFade = Math.max(0, 1 - Math.max(0, p.y - canvas.height * 0.85) / (canvas.height * 0.15));
        ctx.save();
        ctx.globalAlpha = alpha * bottomFade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (progress < 1) {
        _confettiRaf = requestAnimationFrame(_tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
      }
    }

    _confettiRaf = requestAnimationFrame(_tick);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  function renderStats() {
    const all    = _getMergedApps();
    const active = all.filter(a => a.status === 'Interviewing').length;
    const offers = all.filter(a => a.status === 'Offer' || a.status === 'Offer Accepted').length;
    const times  = all.map(responseDays).filter(d => d !== null);
    const avg    = times.length ? Math.round(times.reduce((s, d) => s + d, 0) / times.length) : null;

    _el('ap-stat-total').textContent    = all.length;
    _el('ap-stat-active').textContent   = active;
    _el('ap-stat-offers').textContent   = offers;
    _el('ap-stat-response').textContent = avg !== null ? avg : '—';
  }

  // ── Card HTML ─────────────────────────────────────────────────────────────────

  function buildCardHTML(app) {
    const logoHtml = app.company?.logo_url && !app.company?.screenshot_mode
      ? `<img src="${_esc(app.company.logo_url)}" class="icard-logo-img" alt="" data-fb="apcard-logo-${app.id}">
         <div class="icard-logo-fb" data-fb-id="apcard-logo-${app.id}" ${window._fbHiddenStyle(app.company)}>${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`
      : `<div class="icard-logo-fb"${window._fbStyle(app.company)}>${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`;

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
          ${ivs.length ? `<span class="icard-date" style="color:var(--text-muted)">${done} done${upcoming ? ` · ${upcoming} upcoming` : ''}</span>` : ''}
        </div>
        <button class="ap-add-iv-btn">+ Add Interview</button>
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
    feed.innerHTML = apps.map(app => buildCardHTML(app)).join('');
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
    const logoHtml = app.company?.logo_url && !app.company?.screenshot_mode
      ? `<img src="${_esc(app.company.logo_url)}" class="co-hero-logo-img" alt="" data-fb="apd-logo">
         <div class="icard-logo-fb co-hero-logo-fb" data-fb-id="apd-logo" ${window._fbHiddenStyle(app.company)}>${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`
      : `<div class="icard-logo-fb co-hero-logo-fb"${window._fbStyle(app.company)}>${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`;

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
      <div style="display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap;justify-content:flex-end">
        ${!app._synthetic ? `
          <select class="ap-status-select" id="ap-status-select">
            <option value="Applied"        ${app.status==='Applied'        ?'selected':''}>Applied</option>
            <option value="Interviewing"   ${app.status==='Interviewing'   ?'selected':''}>Interviewing</option>
            <option value="Offer"          ${app.status==='Offer'          ?'selected':''}>Offer</option>
            <option value="Offer Accepted" ${app.status==='Offer Accepted' ?'selected':''}>Offer Accepted</option>
            <option value="Withdrawn"      ${app.status==='Withdrawn'      ?'selected':''}>Withdrawn</option>
            <option value="Rejected"       ${app.status==='Rejected'       ?'selected':''}>Rejected</option>
          </select>` : `<span class="icard-stage-badge ${_esc(statusClass)}">${_esc(app.status)}</span>`}
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
    const appJd    = app.jd || ivs.find(iv => iv.jd)?.jd || null;

    const fmtDate = d => d
      ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;

    let html = `
      ${(app.status === 'Offer Accepted' && app.offer_modal_shown) ? `
        <div class="ap-win-banner">
          <div class="ap-win-banner-left">
            <span class="ap-win-banner-icon">🎉</span>
            <div>
              <div class="ap-win-banner-title">You landed this one!</div>
              <div class="ap-win-banner-sub">${app.offer_review_status === 'pending_review'
                ? 'Gift card claim submitted — we\'ll review within 24 hours.'
                : 'Share your win on LinkedIn and earn a $20 gift card.'}</div>
            </div>
          </div>
          ${app.offer_review_status !== 'pending_review'
            ? '<button class="ap-win-banner-btn" id="ap-win-share-btn">Share &amp; Earn $20 →</button>'
            : ''}
        </div>` : ''}
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

    if (appJd?.structured || appJd?.raw) {
      const jd       = appJd.structured || {};
      const raw      = appJd.raw || '';
      const hasBoth  = !!(appJd.structured && appJd.raw);

      html += `
        <div class="co-section">
          <div class="co-section-header">
            <div class="co-section-title" style="margin-bottom:0">Job Description</div>
            ${hasBoth ? `<button class="ap-jd-toggle" id="ap-jd-toggle" data-showing="summary">View full text →</button>` : ''}
          </div>

          ${appJd.structured ? `
            <div id="ap-jd-summary">
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
            </div>
          ` : ''}

          ${raw ? `
            <div id="ap-jd-full"${appJd.structured ? ' style="display:none"' : ''}>
              <pre class="ap-jd-raw-text">${_esc(raw)}</pre>
            </div>
          ` : ''}
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

    const jdToggle = _el('ap-jd-toggle');
    if (jdToggle) {
      jdToggle.addEventListener('click', () => {
        const showing = jdToggle.dataset.showing;
        if (showing === 'summary') {
          _el('ap-jd-summary').style.display = 'none';
          _el('ap-jd-full').style.display    = '';
          jdToggle.textContent               = '← Show summary';
          jdToggle.dataset.showing           = 'full';
        } else {
          _el('ap-jd-full').style.display    = 'none';
          _el('ap-jd-summary').style.display = '';
          jdToggle.textContent               = 'View full text →';
          jdToggle.dataset.showing           = 'summary';
        }
      });
    }

    const winBtn = _el('ap-win-share-btn');
    if (winBtn) winBtn.addEventListener('click', () => _showCelebrationModal(_detailApp));

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

  // ── Status update ────────────────────────────────────────────────────────────

  function _updateAppStatus(id, newStatus) {
    const all = getAll();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) return;
    const oldStatus     = all[idx].status;
    all[idx].status     = newStatus;
    all[idx].updated_at = new Date().toISOString();
    saveAll(all);
    if (_detailApp?.id === id) _detailApp = all[idx];
    refresh();

    // Trigger 2: status changed to 'Offer Accepted' → confetti + modal (once)
    if (newStatus === 'Offer Accepted' && oldStatus !== 'Offer Accepted') {
      _fireConfetti();
      if (!all[idx].offer_modal_shown) {
        setTimeout(() => _showCelebrationModal(all[idx]), 1000);
      }
    }
  }

  // ── Celebration modal ─────────────────────────────────────────────────────────

  function _showCelebrationModal(app) {
    _cel_appId = app.id;

    const logoWrap = _el('cel-company-logo-wrap');
    if (app.company?.logo_url && !app.company?.screenshot_mode) {
      logoWrap.innerHTML = `<img src="${_esc(app.company.logo_url)}" class="cel-logo-img" alt="">`;
    } else {
      logoWrap.innerHTML = `<div class="cel-logo-fb"${window._fbStyle(app.company)}>${_esc((app.company?.name || '?')[0].toUpperCase())}</div>`;
    }

    _el('cel-company-name').textContent = app.company?.name || '';
    _el('cel-role-title').textContent   = app.role_title   || '';

    const roleTitle   = app.role_title    || '[Role Title]';
    const companyName = app.company?.name || '[Company Name]';
    _el('cel-li-post').value =
      `Just accepted an offer as ${roleTitle} at ${companyName}. If you're interviewing in SaaS sales, check out Klinch — it's an AI interview coaching tool that helped me prepare and stay sharp during every interview. Real-time suggestions, post-interview coaching, and a full job search tracker in one place. tryklinch.com #NewJob #SaaSSales #Klinch`;

    _el('cel-li-url').value = app.offer_linkedin_post_url || '';
    const alreadySubmitted = app.offer_review_status === 'pending_review';
    _el('cel-submit-confirm').style.display = alreadySubmitted ? '' : 'none';
    _el('cel-submit-review').style.display  = alreadySubmitted ? 'none' : '';

    const backdrop = _el('cel-modal-backdrop');
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.classList.add('visible'));
  }

  function _hideCelebrationModal() {
    const backdrop = _el('cel-modal-backdrop');
    backdrop.classList.remove('visible');
    setTimeout(() => { backdrop.style.display = 'none'; }, 220);

    if (_cel_appId) {
      const all = getAll();
      const idx = all.findIndex(a => a.id === _cel_appId);
      if (idx !== -1 && !all[idx].offer_modal_shown) {
        all[idx].offer_modal_shown = true;
        saveAll(all);
        if (_detailApp?.id === _cel_appId) {
          _detailApp = all[idx];
          _renderDetailBody(_detailApp);
        }
      }
      _cel_appId = null;
    }
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
      if (!['Offer', 'Offer Accepted', 'Withdrawn', 'Rejected'].includes(all[idx].status)) {
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

    // Trigger 1: interview added at 'Offer' stage → confetti (no modal)
    if (record.stage === 'Offer') _fireConfetti();
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

    // Feed: delete / add-interview / outreach / card detail
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

    // Detail hero: add interview button + status select
    _el('ap-detail-hero').addEventListener('click', e => {
      if (e.target.closest('.ap-add-iv-btn') && _detailApp) {
        window.AddInterview?.openWithCompany(_detailApp.company, _detailApp.jd || null);
      }
    });
    _el('ap-detail-hero').addEventListener('change', e => {
      const sel = e.target.closest('#ap-status-select');
      if (sel && _detailApp && !_detailApp._synthetic) {
        _updateAppStatus(_detailApp.id, sel.value);
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

    // Celebration modal
    _el('cel-close').addEventListener('click',     _hideCelebrationModal);
    _el('cel-close-btn').addEventListener('click', _hideCelebrationModal);
    _el('cel-modal-backdrop').addEventListener('click', e => {
      if (e.target === _el('cel-modal-backdrop')) _hideCelebrationModal();
    });
    _el('cel-copy-post').addEventListener('click', () => {
      navigator.clipboard.writeText(_el('cel-li-post').value).then(() => {
        const btn  = _el('cel-copy-post');
        const prev = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = prev; }, 2000);
      });
    });
    _el('cel-post-li').addEventListener('click', () => {
      window.klinch?.invoke('shell:open-external', { url: 'https://www.linkedin.com/feed/' });
    });
    _el('cel-submit-review').addEventListener('click', () => {
      const url = _el('cel-li-url').value.trim();
      if (!url) { _el('cel-li-url').focus(); return; }
      if (_cel_appId) {
        const all = getAll();
        const idx = all.findIndex(a => a.id === _cel_appId);
        if (idx !== -1) {
          all[idx].offer_linkedin_post_url = url;
          all[idx].offer_review_status     = 'pending_review';
          saveAll(all);
          if (_detailApp?.id === _cel_appId) _detailApp = all[idx];
        }
      }
      _el('cel-submit-confirm').style.display = '';
      _el('cel-submit-review').style.display  = 'none';
    });
    _el('cel-view-app').addEventListener('click', () => {
      const id = _cel_appId;
      _hideCelebrationModal();
      setTimeout(() => {
        window.navigateTo?.('applications');
        setTimeout(() => id && openDetail(id), 50);
      }, 220);
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
