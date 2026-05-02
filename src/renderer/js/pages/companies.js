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

  // ── Storage ───────────────────────────────────────────────────────────────────

  function _getInterviews() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
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
    const ivs = _getInterviews();
    const map = new Map();
    ivs.forEach(iv => {
      const key = _companyKey(iv.company);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name:       iv.company.name     || key,
          domain:     iv.company.domain   || '',
          logo_url:   iv.company.logo_url || null,
          interviews: [],
        });
      }
      map.get(key).interviews.push(iv);
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

    grid.innerHTML = companies.map(c => {
      const logoHtml = c.logo_url
        ? `<img src="${_esc(c.logo_url)}" class="co-card-logo-img" alt="" data-fb="co-logo-${_esc(c.key)}">
           <div class="icard-logo-fb" data-fb-id="co-logo-${_esc(c.key)}" style="display:none">${(c.name || '?')[0].toUpperCase()}</div>`
        : `<div class="icard-logo-fb">${(c.name || '?')[0].toUpperCase()}</div>`;

      const total    = c.interviews.length;
      const upcoming = c.interviews.filter(iv => !_isCompleted(iv)).length;

      return `
        <div class="co-card" data-key="${_esc(c.key)}">
          <div class="co-card-logo-wrap">${logoHtml}</div>
          <div class="co-card-info">
            <div class="co-card-name">${_esc(c.name)}</div>
            ${c.domain ? `<div class="co-card-domain">${_esc(c.domain)}</div>` : ''}
          </div>
          <div class="co-card-footer">
            <span class="co-card-count">${total} interview${total !== 1 ? 's' : ''}</span>
            ${upcoming > 0 ? `<span class="co-card-upcoming">${upcoming} upcoming</span>` : ''}
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
         <div class="icard-logo-fb co-hero-logo-fb" data-fb-id="co-hero-logo" style="display:none">${(company.name || '?')[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb co-hero-logo-fb">${(company.name || '?')[0].toUpperCase()}</div>`;
    _el('co-hero-name').textContent   = company.name;
    const domainEl = _el('co-hero-domain');
    domainEl.textContent = company.domain || '';
    domainEl.onclick = company.domain
      ? () => window.klinch.invoke('shell:open-external', { url: 'https://' + company.domain })
      : null;
    domainEl.style.cursor = company.domain ? 'pointer' : '';
    if (window.wireImgFallbacks) window.wireImgFallbacks(logoEl);

    // Static sections
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
    _loadSectionNews(key, company.name, cache);
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
        if (window.navigateTo)              window.navigateTo('interviews');
        if (window.InterviewsPage?.openDetail) window.InterviewsPage.openDetail(id);
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

  async function _loadSectionNews(key, companyName, cache) {
    const el = _el('co-sec-news-body');

    if (cache.news && cache.news_cached_at && cache.news_search_v2) {
      const age = Date.now() - new Date(cache.news_cached_at).getTime();
      if (age < 86400000) { _renderNews(cache.news); return; }
    }

    const res = await window.klinch.invoke('news:fetch', { query: companyName });

    if (!res.ok) { el.innerHTML = '<div class="co-empty-hint">Could not load news</div>'; return; }

    const articles = res.data || [];
    if (!articles.length) { el.innerHTML = '<div class="co-empty-hint">No recent news found</div>'; return; }

    const c = _getCache();
    if (!c[key]) c[key] = {};
    c[key].news             = articles;
    c[key].news_cached_at   = new Date().toISOString();
    c[key].news_search_v2   = true;
    _saveCache(c);

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

  const _iwState = { name: '', title: '', linkedin_url: '', photo_url: null };

  function _openAddIwModal() {
    _iwState.name = ''; _iwState.title = ''; _iwState.linkedin_url = ''; _iwState.photo_url = null;
    _el('co-add-iw-name').value  = '';
    _el('co-add-iw-title').value = '';
    _el('co-add-iw-url').value   = '';
    _el('co-add-iw-status').textContent  = '';
    _el('co-add-iw-status').style.color  = '';
    _el('co-add-iw-photo-preview').style.display = 'none';
    _el('co-add-iw-modal').style.display = 'flex';
    _el('co-add-iw-name').focus();
  }

  function _closeAddIwModal() {
    _el('co-add-iw-modal').style.display = 'none';
  }

  async function _fetchAddIwPhoto() {
    const url = _el('co-add-iw-url').value.trim();
    if (!url) return;

    const btn      = _el('co-add-iw-fetch-btn');
    const statusEl = _el('co-add-iw-status');
    btn.disabled = true;
    btn.textContent = 'Fetching…';
    statusEl.textContent = 'Looking up profile…';
    statusEl.style.color = 'var(--text-muted)';

    const res = await window.klinch.invoke('proxycurl:fetch', { linkedin_url: url });
    btn.disabled = false;
    btn.textContent = 'Fetch';

    if (!res.ok || !res.data?.first_name) {
      statusEl.textContent = 'Could not fetch — enter details manually';
      statusEl.style.color = '#EF4444';
      return;
    }

    const p = res.data;
    _iwState.photo_url = p.profile_pic_url || null;

    if (!_el('co-add-iw-name').value.trim()) {
      const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      _el('co-add-iw-name').value = full;
      _iwState.name = full;
    }
    if (!_el('co-add-iw-title').value.trim()) {
      _el('co-add-iw-title').value = p.occupation || '';
      _iwState.title = _el('co-add-iw-title').value;
    }

    statusEl.textContent = 'Profile fetched ✓';
    statusEl.style.color = '#22C55E';

    if (p.profile_pic_url) {
      _el('co-add-iw-photo-img').src           = p.profile_pic_url;
      _el('co-add-iw-photo-preview').style.display = 'flex';
    }
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
      photo_url:    _iwState.photo_url,
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
    _el('co-add-iw-fetch-btn').addEventListener('click', _fetchAddIwPhoto);
    _el('co-add-iw-save-btn').addEventListener('click', _saveAddIw);

    _el('co-add-iw-name').addEventListener('input',  e => { _iwState.name         = e.target.value; });
    _el('co-add-iw-title').addEventListener('input', e => { _iwState.title        = e.target.value; });
    _el('co-add-iw-url').addEventListener('input',   e => { _iwState.linkedin_url = e.target.value; });
    _el('co-add-iw-url').addEventListener('keydown', e => { if (e.key === 'Enter') _fetchAddIwPhoto(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _el('co-add-iw-modal')?.style.display !== 'none') _closeAddIwModal();
    });
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  function refresh() {
    if (_layer === 'detail' && _activeKey) _renderDetail(_activeKey);
    else { _layer = 'grid'; _renderGrid(); }
  }

  init();
  return { refresh, openDetail: _openDetail };
})();
