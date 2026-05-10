window.CompaniesPage = (() => {

  let _layer    = 'grid';
  let _activeKey = null;

  function _el(id) { return document.getElementById(id); }
  function _esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function _slug(name) {
    return String(name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  // ── Storage ───────────────────────────────────────────────────────────────────

  function _getInterviews() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  }

  function _getApplications() {
    return JSON.parse(localStorage.getItem('klinch_applications') || '[]');
  }

  function _getCache() {
    return JSON.parse(localStorage.getItem('klinch_company_cache') || '{}');
  }

  function _saveCache(c) {
    try { localStorage.setItem('klinch_company_cache', JSON.stringify(c)); } catch {}
  }

  function _companyKey(co) {
    return co?.domain || co?.name || '';
  }

  // ── Company list ──────────────────────────────────────────────────────────────

  function _getCompanies() {
    const map = new Map();

    function _upsert(co) {
      const key = _companyKey(co);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { key, name: co.name || key, domain: co.domain || '', logo_url: co.logo_url || null, brand_color: co.brand_color || null, interviews: [], applications: [] });
      }
      const e = map.get(key);
      if (!e.domain      && co.domain)      e.domain      = co.domain;
      if (!e.logo_url    && co.logo_url)    e.logo_url    = co.logo_url;
      if (!e.brand_color && co.brand_color) e.brand_color = co.brand_color;
    }

    _getInterviews().forEach(iv => {
      if (!iv.company) return;
      _upsert(iv.company);
      map.get(_companyKey(iv.company))?.interviews.push(iv);
    });

    _getApplications().forEach(app => {
      if (!app.company) return;
      _upsert(app.company);
      map.get(_companyKey(app.company))?.applications.push(app);
    });

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function _isCompleted(iv) {
    if (iv.status === 'completed') return true;
    if (!iv.scheduled_at) return false;
    return new Date(iv.scheduled_at) < new Date();
  }

  // ── Stage badge map (shared with interviews page) ─────────────────────────────

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

  // ── Layer 1: Grid ─────────────────────────────────────────────────────────────

  function _renderGrid() {
    const companies = _getCompanies();
    const grid  = _el('co-grid');
    const empty = _el('co-empty');

    if (!companies.length) {
      grid.innerHTML    = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    const STATUS_CLASS = {
      'Applied':      'ap-status-applied',
      'Interviewing': 'ap-status-interviewing',
      'Offer':        'ap-status-offer',
      'Withdrawn':    'ap-status-withdrawn',
      'Rejected':     'ap-status-rejected',
    };

    grid.innerHTML = companies.map(c => {
      const logoHtml = c.logo_url
        ? `<img src="${_esc(c.logo_url)}" class="co-card-logo-img" alt="" data-fb="co-logo-${_esc(c.key)}">
           <div class="icard-logo-fb" data-fb-id="co-logo-${_esc(c.key)}" ${window._fbHiddenStyle(c)}>${(c.name || '?')[0].toUpperCase()}</div>`
        : `<div class="icard-logo-fb"${window._fbStyle(c)}>${(c.name || '?')[0].toUpperCase()}</div>`;

      const ivCount  = c.interviews.length;
      const appCount = c.applications.length;

      // Most recently updated application drives the status badge
      const latestApp = [...c.applications].sort((a, b) =>
        new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
      )[0];
      const status      = latestApp?.status || '';
      const statusClass = STATUS_CLASS[status] || '';

      // Most recent activity across all interviews and applications
      const allDates = [
        ...c.interviews.map(iv => iv.scheduled_at || iv.created_at),
        ...c.applications.map(ap => ap.updated_at  || ap.created_at),
      ].filter(Boolean).map(d => new Date(d));
      const lastDate = allDates.length ? new Date(Math.max(...allDates)) : null;
      const lastStr  = lastDate
        ? lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

      const countParts = [
        ivCount  ? `${ivCount} interview${ivCount  !== 1 ? 's' : ''}` : '',
        appCount ? `${appCount} application${appCount !== 1 ? 's' : ''}` : '',
      ].filter(Boolean);

      return `
        <div class="co-card" data-key="${_esc(c.key)}">
          <div class="co-card-logo-wrap">${logoHtml}</div>
          <div class="co-card-info">
            <div class="co-card-name">${_esc(c.name)}</div>
            ${c.domain ? `<div class="co-card-domain">${_esc(c.domain)}</div>` : ''}
          </div>
          <div class="co-card-footer">
            <span class="co-card-count">${_esc(countParts.join(' · '))}</span>
            <div style="display:flex;align-items:center;gap:6px">
              ${status ? `<span class="icard-stage-badge ${_esc(statusClass)}" style="font-size:9px;padding:2px 6px">${_esc(status)}</span>` : ''}
              ${lastStr ? `<span class="co-card-upcoming">${_esc(lastStr)}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    if (window.wireImgFallbacks) window.wireImgFallbacks(grid);
  }

  // ── Layer 2: Detail ───────────────────────────────────────────────────────────

  function _openDetail(key) {
    _layer     = 'detail';
    _activeKey = key;
    _el('co-grid-layer').style.display   = 'none';
    _el('co-detail-layer').style.display = '';
    const mc = document.getElementById('main-content');
    if (mc) mc.scrollTop = 0;
    _renderDetail(key);
  }

  function _goBack() {
    _layer     = 'grid';
    _activeKey = null;
    _el('co-detail-layer').style.display = 'none';
    _el('co-grid-layer').style.display   = '';
    _renderGrid();
  }

  function _renderDetail(key) {
    const company = _getCompanies().find(c => c.key === key);
    if (!company) { _goBack(); return; }

    const cache = _getCache()[key] || {};

    // Hero
    const logoEl  = _el('co-hero-logo');
    logoEl.innerHTML = company.logo_url
      ? `<img src="${_esc(company.logo_url)}" class="co-hero-logo-img" alt="" data-fb="co-hero-logo">
         <div class="icard-logo-fb co-hero-logo-fb" data-fb-id="co-hero-logo" ${window._fbHiddenStyle(company)}>${(company.name || '?')[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb co-hero-logo-fb"${window._fbStyle(company)}>${(company.name || '?')[0].toUpperCase()}</div>`;
    _el('co-hero-name').textContent   = company.name;
    const domainEl = _el('co-hero-domain');
    domainEl.textContent = company.domain || '';
    domainEl.onclick = company.domain
      ? () => window.klinch.invoke('shell:open-external', { url: 'https://' + company.domain })
      : null;
    domainEl.style.cursor = company.domain ? 'pointer' : '';
    if (window.wireImgFallbacks) window.wireImgFallbacks(logoEl);

    // Research links — all homepage links, user searches manually on each platform
    const links = [
      { label: 'Crunchbase', domain: 'crunchbase.com', url: 'https://www.crunchbase.com' },
      { label: 'G2',         domain: 'g2.com',         url: 'https://www.g2.com' },
      { label: 'Capterra',   domain: 'capterra.com',   url: 'https://www.capterra.com' },
      { label: 'Glassdoor',  domain: 'glassdoor.com',  url: 'https://www.glassdoor.com' },
      { label: 'RepVue',     domain: 'repvue.com',     url: 'https://www.repvue.com' },
    ];
    _el('co-hero-links').innerHTML = links.map(l => `
      <button class="icard-stage-badge co-hero-link" data-url="${_esc(l.url)}" title="${_esc('Search for ' + company.name + ' on ' + l.label)}">
        <img src="https://www.google.com/s2/favicons?domain=${_esc(l.domain)}&sz=16" width="12" height="12" alt="" style="display:block;flex-shrink:0">
        ${_esc(l.label)}
      </button>`).join('');
    _el('co-hero-links').querySelectorAll('.co-hero-link').forEach(btn => {
      btn.onclick = () => window.klinch.invoke('shell:open-external', { url: btn.dataset.url });
    });

    // Static sections
    _renderSectionApplications(company);
    _renderSectionInterviews(company);
    _renderSectionInterviewers(company, key, cache);
    _renderSectionRoles(company);
    _renderSectionNotes(key, cache);

    // Auto-save notes
    const notesEl = _el('co-notes-input');
    notesEl.oninput = null;
    notesEl.addEventListener('input', () => {
      const c = _getCache();
      if (!c[key]) c[key] = {};
      c[key].notes = notesEl.value;
      _saveCache(c);
    });

    // Lazy sections (skeleton while loading)
    _el('co-sec-overview-body').innerHTML = _skeleton(3);
    _el('co-sec-people-body').innerHTML   = _skeleton(3);
    _el('co-sec-news-body').innerHTML     = _skeleton(3);

    _loadSectionOverview(key, company.domain, cache);
    _loadSectionPeople(key, company.name, cache);
    _loadSectionNews(key, company.name);
    _loadSectionCommunityQuestions(company.domain);
  }

  // ── Section: My Applications ──────────────────────────────────────────────────

  const _APP_STATUS_CLASS = {
    'Applied':      'ap-status-applied',
    'Interviewing': 'ap-status-interviewing',
    'Offer':        'ap-status-offer',
    'Withdrawn':    'ap-status-withdrawn',
    'Rejected':     'ap-status-rejected',
  };

  function _renderSectionApplications(company) {
    const section = _el('co-sec-applications');
    const el      = _el('co-sec-applications-body');

    if (!company.applications.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    const sorted = [...company.applications].sort((a, b) =>
      new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    );

    el.innerHTML = sorted.map(app => {
      const dateApplied = app.date_applied
        ? new Date(app.date_applied + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

      let days = null;
      if (app.date_applied && app.date_first_interview) {
        days = Math.max(0, Math.round(
          (new Date(app.date_first_interview + 'T00:00:00') - new Date(app.date_applied + 'T00:00:00')) / 86400000
        ));
      }
      const hot         = days !== null && days <= 7;
      const statusClass = _APP_STATUS_CLASS[app.status] || 'ap-status-applied';

      return `
        <div class="co-iv-row" data-app-id="${_esc(app.id)}">
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
            <span style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(app.role_title || 'Role TBD')}</span>
            ${days !== null ? `<span class="co-iv-date">${days}d response</span>` : ''}
            ${hot ? `<span class="ap-hot" style="font-size:13px">🔥<span class="ap-hot-tooltip">This role is moving fast. You heard back within ${days} day${days === 1 ? '' : 's'} of applying.</span></span>` : ''}
          </div>
          <div class="co-iv-meta">
            ${dateApplied ? `<span class="co-iv-date">Applied ${_esc(dateApplied)}</span>` : ''}
            <span class="icard-stage-badge ${_esc(statusClass)}" style="font-size:9px;padding:2px 6px">${_esc(app.status)}</span>
            <button class="ap-add-iv-btn">+ Add Interview</button>
          </div>
        </div>`;
    }).join('');

    el.querySelectorAll('[data-app-id]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.ap-add-iv-btn')) {
          e.stopPropagation();
          const app = sorted.find(a => a.id === row.dataset.appId);
          if (app) window.AddInterview?.openWithCompany(app.company, app.jd || null);
          return;
        }
        if (window.navigateTo)                    window.navigateTo('applications');
        if (window.ApplicationsPage?.openDetail)  window.ApplicationsPage.openDetail(row.dataset.appId);
      });
    });
  }

  // ── Section: My Interviews ────────────────────────────────────────────────────

  function _renderSectionInterviews(company) {
    const el = _el('co-sec-interviews-body');

    if (!company.interviews.length) {
      el.innerHTML = '<div class="co-empty-hint">No interviews recorded</div>';
      return;
    }

    const sorted = [...company.interviews].sort((a, b) => {
      const da = a.scheduled_at ? new Date(a.scheduled_at) : new Date(0);
      const db = b.scheduled_at ? new Date(b.scheduled_at) : new Date(0);
      return da - db;
    });

    el.innerHTML = sorted.map(iv => {
      const dateObj  = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
      const dateStr  = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
      const done     = _isCompleted(iv);
      const badgeCls = STAGE_BADGE[iv.stage] || 'badge-recruiter';
      const iws      = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);
      const iwNames  = iws.map(iw => iw.name).filter(Boolean).join(', ');

      return `
        <div class="co-iv-row" data-iv-id="${_esc(iv.id)}">
          <div class="co-iv-badges">
            <span class="icard-stage-badge ${badgeCls}">${_esc(iv.stage)}</span>
            <span class="icard-status-badge${done ? ' iv-status-done' : ''}" style="font-size:10px">${done ? 'Done' : 'Upcoming'}</span>
          </div>
          <div class="co-iv-meta">
            <span class="co-iv-date">${_esc(dateStr)}</span>
            ${iwNames ? `<span class="co-iv-iwnames">${_esc(iwNames)}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.co-iv-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.ivId;
        if (!id) return;
        if (window.navigateTo) window.navigateTo('interviews');
        if (window.InterviewsPage?.openDetail) setTimeout(() => window.InterviewsPage.openDetail(id), 0);
      });
    });
  }

  // ── Section: Interviewers ─────────────────────────────────────────────────────

  function _renderSectionInterviewers(company, key, cache) {
    const el  = _el('co-sec-interviewers-body');
    const all = [];
    const seen = new Set();

    company.interviews.forEach(iv => {
      const iws = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);
      iws.forEach(iw => {
        if (!iw.name) return;
        const lc = iw.name.toLowerCase();
        if (seen.has(lc)) return;
        seen.add(lc);
        all.push(iw);
      });
    });

    (cache.contacts || []).forEach(ct => {
      if (!ct.name) return;
      const lc = ct.name.toLowerCase();
      if (seen.has(lc)) return;
      seen.add(lc);
      all.push(ct);
    });

    if (!all.length) {
      el.innerHTML = '<div class="co-empty-hint">No interviewers added yet</div>';
      return;
    }

    el.innerHTML = all.map((iw, i) => {
      const photo = iw.photo_url
        ? `<img src="${_esc(iw.photo_url)}" class="icard-photo" alt="" data-fb="co-iw-${i}">
           <div class="icard-photo-fb" data-fb-id="co-iw-${i}" style="display:none">${(iw.name || '?')[0].toUpperCase()}</div>`
        : `<div class="icard-photo-fb">${(iw.name || '?')[0].toUpperCase()}</div>`;

      return `
        <div class="co-iw-row">
          <div class="icard-photo-wrap">${photo}</div>
          <div class="co-iw-info">
            <div class="co-iw-name">${_esc(iw.name)}</div>
            ${iw.title ? `<div class="co-iw-title">${_esc(iw.title)}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    if (window.wireImgFallbacks) window.wireImgFallbacks(el);
  }

  // ── Section: Roles / JD ───────────────────────────────────────────────────────

  function _renderSectionRoles(company) {
    const el   = _el('co-sec-roles-body');
    const roles = [];
    const seen  = new Set();

    company.interviews.forEach(iv => {
      const title = iv.jd?.structured?.role_title;
      if (!title || seen.has(title)) return;
      seen.add(title);
      roles.push({ title, structured: iv.jd.structured });
    });

    if (!roles.length) {
      el.innerHTML = '<div class="co-empty-hint">No job descriptions added</div>';
      return;
    }

    el.innerHTML = roles.map(r => `
      <div class="co-role-card">
        <div class="co-role-title">${_esc(r.title)}</div>
        ${r.structured.must_have?.length ? `
          <div class="co-role-label">Must-Have</div>
          <ul class="co-role-list">${r.structured.must_have.map(x => `<li>${_esc(x)}</li>`).join('')}</ul>
        ` : ''}
      </div>`).join('');
  }

  // ── Section: Prep Notes ───────────────────────────────────────────────────────

  function _renderSectionNotes(key, cache) {
    _el('co-notes-input').value = cache.notes || '';
  }

  // ── Section: Community Questions ─────────────────────────────────────────────

  const _CQ_STAGE_ORDER = [
    'Recruiter Screen', 'Hiring Manager', 'Executive', 'Peer', 'Culture Fit',
    'Technical Screen', 'Case Study / Presentation', 'Panel', 'Group', 'Final Round',
  ];

  async function _loadSectionCommunityQuestions(domain) {
    const section = _el('co-sec-community-questions');
    const body    = _el('co-sec-cq-body');
    if (!domain) { section.style.display = 'none'; return; }

    section.style.display = '';
    body.innerHTML = _skeleton(3);

    try {
      const res = await window.klinch.invoke('community:get-questions', { domain });
      let all = res?.data || [];

      if (!all.length && window.klinch?.isDev) {
        try {
          const devPool = JSON.parse(localStorage.getItem('klinch_dev_community_questions') || '{}');
          all = devPool[domain] || [];
        } catch (_) {}
      }

      _renderCommunityQuestions(body, all, false);
    } catch (err) {
      body.innerHTML = '<div class="co-empty-hint">Could not load community questions.</div>';
    }
  }

  function _renderCommunityQuestions(el, all, showAll, activeStage) {
    const cutoff90  = Date.now() - 90 * 86400000;
    const questions = showAll
      ? all
      : all.filter(q => new Date(q.created_at).getTime() >= cutoff90);
    const hasMore   = !showAll && all.length > questions.length;

    if (!all.length) {
      el.innerHTML = '<div class="co-empty-hint">No community questions yet for this company — they\'ll appear here after Klinch users complete interviews.</div>';
      return;
    }

    if (!questions.length) {
      el.innerHTML = '<div class="co-empty-hint" style="margin-bottom:10px">No questions in the last 90 days.</div>' +
        `<button class="co-cq-toggle-btn">View all 12 months (${all.length})</button>`;
      el.querySelector('.co-cq-toggle-btn').addEventListener('click', () => _renderCommunityQuestions(el, all, true, null));
      return;
    }

    // Build stage map in canonical order
    const byStage = {};
    questions.forEach(q => {
      const s = q.interview_stage || 'General';
      if (!byStage[s]) byStage[s] = [];
      byStage[s].push(q);
    });
    const stages = Object.keys(byStage).sort((a, b) => {
      const ai = _CQ_STAGE_ORDER.indexOf(a), bi = _CQ_STAGE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });

    // Active stage — null means "All"; any _CQ_STAGE_ORDER value is valid even if count is 0
    const current = activeStage ?? null;

    // Stage tab buttons — always show every stage regardless of question count
    const tabsHtml = `
      <div class="co-cq-tabs">
        <button class="co-cq-tab${!current ? ' active' : ''}" data-stage="">
          All <span class="co-cq-tab-count">${questions.length}</span>
        </button>
        ${_CQ_STAGE_ORDER.map(s => `
          <button class="co-cq-tab${current === s ? ' active' : ''}" data-stage="${_esc(s)}">
            ${_esc(s)} <span class="co-cq-tab-count">${(byStage[s] || []).length}</span>
          </button>`).join('')}
      </div>`;

    // Question list — flat for single stage, grouped for All
    let contentHtml;
    if (current) {
      const stageQs = byStage[current] || [];
      if (!stageQs.length) {
        contentHtml = '<div class="co-empty-hint">No questions recorded for this stage yet.</div>';
      } else {
        const items = stageQs.map(q => `<li class="co-cq-item">${_esc(q.question)}</li>`).join('');
        contentHtml = `<ul class="co-cq-list">${items}</ul>`;
      }
    } else {
      contentHtml = stages.map(stage => {
        const cls   = STAGE_BADGE[stage] || 'badge-recruiter';
        const items = byStage[stage].map(q => `<li class="co-cq-item">${_esc(q.question)}</li>`).join('');
        return `
          <div class="co-cq-group">
            <div class="co-cq-stage"><span class="icard-stage-badge ${cls}">${_esc(stage)}</span></div>
            <ul class="co-cq-list">${items}</ul>
          </div>`;
      }).join('');
    }

    const toggleLabel = hasMore ? `View all 12 months (${all.length})` : showAll ? 'Show recent (90 days)' : '';
    const toggleHtml  = toggleLabel ? `<button class="co-cq-toggle-btn">${_esc(toggleLabel)}</button>` : '';

    el.innerHTML = tabsHtml + `<div class="co-cq-content">${contentHtml}</div>` + toggleHtml;

    el.querySelectorAll('.co-cq-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _renderCommunityQuestions(el, all, showAll, btn.dataset.stage || null);
      });
    });
    el.querySelector('.co-cq-toggle-btn')?.addEventListener('click', () => {
      _renderCommunityQuestions(el, all, !showAll, current);
    });
  }

  // ── Skeleton helper ───────────────────────────────────────────────────────────

  function _skeleton(n) {
    return `<div class="co-skeleton-wrap">${Array(n).fill('<div class="co-skeleton"></div>').join('')}</div>`;
  }

  // ── Lazy: Overview (Apollo enrich) ────────────────────────────────────────────

  async function _loadSectionOverview(key, domain, cache) {
    const el = _el('co-sec-overview-body');

    if (cache.org) { _renderOverview(cache.org); return; }
    if (!domain)   { el.innerHTML = '<div class="co-empty-hint">No domain — unable to fetch company data</div>'; return; }

    const res = await window.klinch.invoke('apollo:enrich', { domain });

    if (!res.ok || !res.data) {
      el.innerHTML = '<div class="co-empty-hint">Could not load company info</div>';
      return;
    }

    const c = _getCache();
    if (!c[key]) c[key] = {};
    c[key].org = res.data;
    _saveCache(c);

    _renderOverview(res.data);
  }

  function _renderOverview(org) {
    const el    = _el('co-sec-overview-body');
    const desc  = org.short_description || org.description || '';
    const stats = [
      { label: 'Industry',  value: org.industry },
      { label: 'Employees', value: org.estimated_num_employees ? Number(org.estimated_num_employees).toLocaleString() : null },
      { label: 'Founded',   value: org.founded_year },
      { label: 'HQ',        value: [org.city, org.state, org.country].filter(Boolean).join(', ') || null },
    ].filter(s => s.value);

    el.innerHTML = `
      ${desc ? `<p class="co-overview-desc">${_esc(desc)}</p>` : ''}
      ${stats.length ? `<div class="co-overview-stats">${stats.map(s =>
        `<div class="co-overview-stat">
           <div class="co-stat-label">${_esc(s.label)}</div>
           <div class="co-stat-value">${_esc(String(s.value))}</div>
         </div>`
      ).join('')}</div>` : ''}
      ${!desc && !stats.length ? '<div class="co-empty-hint">No data available</div>' : ''}
    `;
  }

  // ── Lazy: Key People (LinkedIn CTA) ──────────────────────────────────────────

  function _loadSectionPeople(key, companyName, cache) {
    const el = _el('co-sec-people-body');
    // Use LinkedIn company people page if we have it from org enrich; otherwise search
    const liBase = cache.org?.linkedin_url?.replace(/\/$/, '');
    const href   = liBase
      ? `${liBase}/people/`
      : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent('"' + companyName + '"')}&origin=GLOBAL_SEARCH_HEADER`;

    el.innerHTML = `
      <div class="co-li-cta">
        <div class="co-li-cta-label">Search hiring managers &amp; decision-makers at ${_esc(companyName)}</div>
        <div class="co-li-cta-btn" data-url="${_esc(href)}">View on LinkedIn →</div>
      </div>`;

    el.querySelector('[data-url]').addEventListener('click', () => {
      window.klinch.invoke('shell:open-external', { url: href });
    });
  }

  // ── Lazy: Recent News (NewsAPI) ───────────────────────────────────────────────

  async function _loadSectionNews(key, companyName) {
    const el = _el('co-sec-news-body');
    const res = await window.klinch.invoke('news:fetch', { query: companyName });

    if (!res.ok) { el.innerHTML = '<div class="co-empty-hint">Could not load news</div>'; return; }

    const articles = res.data || [];
    if (!articles.length) { el.innerHTML = '<div class="co-empty-hint">No recent news found</div>'; return; }

    _renderNews(articles);
  }

  function _renderNews(articles) {
    const el = _el('co-sec-news-body');
    el.innerHTML = articles.slice(0, 5).map(a => {
      const date = a.publishedAt
        ? new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const url = a.url || '';
      return `
        <div class="co-news-item${url ? ' co-news-link' : ''}" ${url ? `data-url="${_esc(url)}"` : ''}>
          <div class="co-news-title">${_esc(a.title || '')}</div>
          <div class="co-news-meta">${_esc(a.source?.name || '')}${date ? ' · ' + _esc(date) : ''}</div>
          ${a.description ? `<div class="co-news-desc">${_esc(a.description)}</div>` : ''}
        </div>`;
    }).join('');

    el.querySelectorAll('.co-news-item[data-url]').forEach(item => {
      item.addEventListener('click', () => {
        window.klinch.invoke('shell:open-external', { url: item.dataset.url });
      });
    });
  }

  // ── Add Interviewer Modal ─────────────────────────────────────────────────────

  const _iwState = { name: '', title: '', linkedin_url: '' };

  function _openAddIwModal() {
    _iwState.name = ''; _iwState.title = ''; _iwState.linkedin_url = '';
    _el('co-add-iw-name').value  = '';
    _el('co-add-iw-title').value = '';
    _el('co-add-iw-url').value   = '';
    _el('co-add-iw-status').textContent  = '';
    _el('co-add-iw-status').style.color  = '';
    _el('co-add-iw-modal').style.display = 'flex';
    _el('co-add-iw-name').focus();
  }

  function _closeAddIwModal() {
    _el('co-add-iw-modal').style.display = 'none';
  }

  function _saveAddIw() {
    const name = _el('co-add-iw-name').value.trim();
    if (!name) {
      _el('co-add-iw-status').textContent = 'Name is required';
      _el('co-add-iw-status').style.color = '#EF4444';
      return;
    }

    const contact = {
      name,
      title:        _el('co-add-iw-title').value.trim(),
      linkedin_url: _el('co-add-iw-url').value.trim() || null,
    };

    const key = _activeKey;
    const c   = _getCache();
    if (!c[key])          c[key] = {};
    if (!c[key].contacts) c[key].contacts = [];
    c[key].contacts.push(contact);
    _saveCache(c);

    _closeAddIwModal();

    const company = _getCompanies().find(co => co.key === key);
    if (company) _renderSectionInterviewers(company, key, c[key]);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    _el('co-grid').addEventListener('click', e => {
      const card = e.target.closest('.co-card');
      if (card) _openDetail(card.dataset.key);
    });

    _el('co-back-btn').addEventListener('click', _goBack);
    _el('co-add-iw-btn').addEventListener('click', _openAddIwModal);

    _el('co-add-iw-close').addEventListener('click', _closeAddIwModal);
    _el('co-add-iw-cancel').addEventListener('click', _closeAddIwModal);
    _el('co-add-iw-modal').addEventListener('click', e => {
      if (e.target === _el('co-add-iw-modal')) _closeAddIwModal();
    });
    _el('co-add-iw-save-btn').addEventListener('click', _saveAddIw);

    _el('co-add-iw-name').addEventListener('input',  e => { _iwState.name         = e.target.value; });
    _el('co-add-iw-title').addEventListener('input', e => { _iwState.title        = e.target.value; });
    _el('co-add-iw-url').addEventListener('input',   e => { _iwState.linkedin_url = e.target.value; });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _el('co-add-iw-modal')?.style.display !== 'none') _closeAddIwModal();
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  function refresh() {
    if (_layer === 'detail' && _activeKey) _renderDetail(_activeKey);
    else { _layer = 'grid'; _renderGrid(); }
  }

  function reset() {
    _layer     = 'grid';
    _activeKey = null;
    _el('co-detail-layer').style.display = 'none';
    _el('co-grid-layer').style.display   = '';
    _renderGrid();
  }

  init();
  return { refresh, reset, openDetail: _openDetail };
})();
