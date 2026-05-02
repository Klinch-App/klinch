// ── State ─────────────────────────────────────────────────────────────────────

const _state = {
  step: 1,
  company: null,      // { name, logo_url, domain, apollo_id }
  interviewer: null,  // { name, title, photo_url, linkedin_url }
  jd: null,           // { raw, structured }
};

let _searchTimeout = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────

const _modal        = document.getElementById('add-interview-modal');
const _backBtn      = document.getElementById('ai-back');
const _closeBtn     = document.getElementById('ai-close');
const _nextBtn      = document.getElementById('ai-next');
const _stepLabel    = document.getElementById('ai-step-label');
const _stepDots     = document.querySelectorAll('.ai-step-dot');
const _stepPanels   = [1, 2, 3, 4].map(n => document.getElementById(`ai-step-${n}`));

// ── Open / Close ──────────────────────────────────────────────────────────────

function openModal() {
  _state.step = 1;
  _state.company = null;
  _state.interviewer = null;
  _state.jd = null;

  // Reset step 1
  _el('ai-company-input').value = '';
  _el('ai-company-input').style.display = '';
  _el('ai-company-results').style.display = 'none';
  _el('ai-company-results').innerHTML = '';
  _el('ai-selected-company').style.display = 'none';

  // Reset step 2
  _el('ai-manual-name').value = '';
  _el('ai-manual-title').value = '';
  _el('ai-interviewer-url').value = '';
  _el('ai-fetch-btn').disabled = false;
  _el('ai-fetch-btn').textContent = 'Fetch';
  _el('ai-fetch-status').textContent = '';
  _el('ai-fetch-status').className = 'ai-field-status';
  _el('ai-selected-interviewer').style.display = 'none';

  // Reset step 3
  _el('ai-jd-textarea').value = '';
  _el('ai-jd-textarea').style.display = '';
  _el('ai-jd-structured').style.display = 'none';

  _modal.style.display = 'flex';
  _goToStep(1);
}

function closeModal() {
  _modal.style.display = 'none';
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _el(id) { return document.getElementById(id); }

// Attach img error → fallback without inline onerror (blocked by CSP script-src 'self')
function _wireImgFallbacks(container) {
  container.querySelectorAll('img[data-fb]').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fb = container.querySelector(`[data-fb-id="${img.dataset.fb}"]`);
      if (fb) fb.style.display = 'flex';
    });
  });
}

function _showError(msg) {
  const toast = _el('ai-toast');
  toast.textContent = msg;
  toast.style.display = '';
  clearTimeout(_showError._t);
  _showError._t = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ── Step navigation ───────────────────────────────────────────────────────────

const STEP_LABELS = ['Company', 'Interviewer', 'Job Description', 'Details'];

function _goToStep(n) {
  _state.step = n;

  _stepPanels.forEach((el, i) => { el.style.display = (i + 1 === n) ? '' : 'none'; });

  _stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === n);
    dot.classList.toggle('done', i + 1 < n);
  });

  _backBtn.style.visibility = n === 1 ? 'hidden' : '';
  _stepLabel.textContent = `Step ${n} of 4 — ${STEP_LABELS[n - 1]}`;
  _updateNextBtn();

  if (n === 4) _setDefaultDate();
}

function _updateNextBtn() {
  const n = _state.step;
  if (n === 4) {
    _nextBtn.textContent = 'Add Interview';
  } else if (n === 3 && !_state.jd) {
    _nextBtn.textContent = 'Process with AI →';
  } else {
    _nextBtn.textContent = 'Continue →';
  }
  _nextBtn.disabled = false;
}

// ── Next / Back ───────────────────────────────────────────────────────────────

_nextBtn.addEventListener('click', async () => {
  const n = _state.step;
  if (n === 1) {
    if (!_state.company) return _showError('Please select a company first.');
    _goToStep(2);
  } else if (n === 2) {
    const name = _el('ai-manual-name').value.trim();
    if (!name) return _showError('Please enter the interviewer\'s name.');
    // Merge manual fields with any photo fetched via LinkedIn
    _state.interviewer = {
      name,
      title: _el('ai-manual-title').value.trim(),
      photo_url: _state.interviewer?.photo_url || null,
      linkedin_url: _el('ai-interviewer-url').value.trim() || null,
    };
    _goToStep(3);
  } else if (n === 3) {
    if (_state.jd) { _goToStep(4); return; }
    const raw = _el('ai-jd-textarea').value.trim();
    if (!raw) return _showError('Please paste a job description.');
    await _processJd(raw);
  } else if (n === 4) {
    await _completeInterview();
  }
});

_backBtn.addEventListener('click', () => { if (_state.step > 1) _goToStep(_state.step - 1); });
_closeBtn.addEventListener('click', closeModal);
_modal.addEventListener('click', (e) => { if (e.target === _modal) closeModal(); });

// ── Step 1: Company Search ────────────────────────────────────────────────────

_el('ai-company-input').addEventListener('input', () => {
  clearTimeout(_searchTimeout);
  const q = _el('ai-company-input').value.trim();
  if (q.length < 2) { _el('ai-company-results').style.display = 'none'; return; }
  _searchTimeout = setTimeout(() => _searchCompanies(q), 350);
});

async function _searchCompanies(query) {
  const resultsEl = _el('ai-company-results');
  resultsEl.innerHTML = '<div class="ai-search-loading">Searching…</div>';
  resultsEl.style.display = '';

  const res = await window.klinch.invoke('apollo:search', { query });
  if (!res.ok) {
    resultsEl.innerHTML = '<div class="ai-search-loading">Search failed — try again</div>';
    return;
  }

  const orgs = res.data?.organizations || [];
  if (!orgs.length) {
    resultsEl.innerHTML = '<div class="ai-search-loading">No results found</div>';
    return;
  }

  resultsEl.innerHTML = orgs.slice(0, 8).map((org, i) => `
    <div class="ai-search-result" data-idx="${i}">
      <div class="ai-search-logo">
        ${org.logo_url ? `<img src="${org.logo_url}" alt="" data-fb="logo-${i}">` : ''}
        <div class="ai-logo-fallback" data-fb-id="logo-${i}"${org.logo_url ? ' style="display:none"' : ''}>${(org.name || '?')[0].toUpperCase()}</div>
      </div>
      <div>
        <div class="ai-search-name">${org.name || ''}</div>
        <div class="ai-search-sub">${org.primary_domain || ''}</div>
      </div>
    </div>
  `).join('');

  _wireImgFallbacks(resultsEl);

  resultsEl.querySelectorAll('.ai-search-result').forEach((item) => {
    const idx = parseInt(item.dataset.idx, 10);
    item.addEventListener('click', () => _selectCompany(orgs[idx]));
  });
}

function _selectCompany(org) {
  _state.company = {
    name: org.name,
    logo_url: org.logo_url || null,
    domain: org.primary_domain || '',
    apollo_id: org.id,
  };

  const inp = _el('ai-company-input');
  const results = _el('ai-company-results');
  inp.style.display = 'none';
  results.style.display = 'none';

  const sel = _el('ai-selected-company');
  const logoImg = _el('ai-sel-logo-img');
  const logoFb = _el('ai-sel-logo-fb');

  if (org.logo_url) {
    logoImg.src = org.logo_url;
    logoImg.style.display = '';
    logoFb.style.display = 'none';
    logoImg.onerror = null;
    logoImg.addEventListener('error', () => {
      logoImg.style.display = 'none';
      logoFb.style.display = 'flex';
    }, { once: true });
  } else {
    logoImg.style.display = 'none';
    logoFb.textContent = (org.name || '?')[0].toUpperCase();
    logoFb.style.display = 'flex';
  }
  _el('ai-sel-company-name').textContent = org.name;
  _el('ai-sel-company-domain').textContent = org.primary_domain || '';
  sel.style.display = '';
}

_el('ai-company-change').addEventListener('click', () => {
  _state.company = null;
  _el('ai-selected-company').style.display = 'none';
  const inp = _el('ai-company-input');
  inp.style.display = '';
  inp.value = '';
  inp.focus();
});

// ── Step 2: Interviewer ───────────────────────────────────────────────────────

_el('ai-fetch-btn').addEventListener('click', _fetchInterviewer);

async function _fetchInterviewer() {
  const url = _el('ai-interviewer-url').value.trim();
  if (!url) return _showError('Please enter a LinkedIn URL.');

  const btn = _el('ai-fetch-btn');
  const status = _el('ai-fetch-status');
  btn.disabled = true;
  btn.textContent = 'Fetching…';
  status.textContent = 'Looking up profile…';
  status.className = 'ai-field-status ai-status-loading';

  const res = await window.klinch.invoke('proxycurl:fetch', { linkedin_url: url });

  btn.disabled = false;
  btn.textContent = 'Fetch';

  if (!res.ok || !res.data?.first_name) {
    status.textContent = 'Could not fetch LinkedIn profile — continue with name and title below.';
    status.className = 'ai-field-status ai-status-error';
    return;
  }

  const p = res.data;
  // Store the photo; name/title come from the manual fields the user already filled
  _state.interviewer = { ..._state.interviewer, photo_url: p.profile_pic_url || null };

  status.textContent = 'Profile photo fetched ✓';
  status.className = 'ai-field-status ai-status-ok';

  // Pre-fill name/title from LinkedIn if fields are still empty
  if (!_el('ai-manual-name').value.trim()) {
    _el('ai-manual-name').value = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  }
  if (!_el('ai-manual-title').value.trim()) {
    _el('ai-manual-title').value = p.occupation || p.headline || '';
  }

  const photo = _el('ai-interviewer-photo');
  if (p.profile_pic_url) {
    photo.src = p.profile_pic_url;
    photo.style.display = '';
    _el('ai-interviewer-photo-fb').style.display = 'none';
    photo.addEventListener('error', () => {
      photo.style.display = 'none';
      _el('ai-interviewer-photo-fb').style.display = 'flex';
    }, { once: true });
    _el('ai-selected-interviewer').style.display = '';
  }
}

_el('ai-interviewer-change').addEventListener('click', () => {
  _state.interviewer = null;
  _el('ai-selected-interviewer').style.display = 'none';
  _el('ai-fetch-status').textContent = '';
  _el('ai-fetch-status').className = 'ai-field-status';
});

// ── Step 3: Job Description ───────────────────────────────────────────────────

async function _processJd(raw) {
  _nextBtn.disabled = true;
  _nextBtn.textContent = 'Processing…';

  const res = await window.klinch.invoke('claude:process-jd', { jd_text: raw });

  if (!res.ok) {
    _nextBtn.disabled = false;
    _updateNextBtn();
    return _showError('Failed to process job description. Please try again.');
  }

  _state.jd = { raw, structured: res.data };

  _el('ai-jd-textarea').style.display = 'none';
  _el('ai-jd-role-title').textContent = res.data.role_title || '';

  function renderList(id, items) {
    _el(id).innerHTML = (items || []).map(item => `<li>${item}</li>`).join('');
  }
  renderList('ai-jd-resp', res.data.responsibilities);
  renderList('ai-jd-must', res.data.must_have);
  renderList('ai-jd-nice', res.data.nice_to_have);

  const niceSection = _el('ai-jd-nice-section');
  niceSection.style.display = res.data.nice_to_have?.length ? '' : 'none';

  _el('ai-jd-structured').style.display = '';
  _nextBtn.disabled = false;
  _updateNextBtn();
  setTimeout(() => _goToStep(4), 500);
}

_el('ai-jd-edit').addEventListener('click', () => {
  _state.jd = null;
  _el('ai-jd-textarea').style.display = '';
  _el('ai-jd-structured').style.display = 'none';
  _updateNextBtn();
});

// ── Step 4: Date default ──────────────────────────────────────────────────────

function _setDefaultDate() {
  const dateEl = _el('ai-date');
  if (!dateEl.value) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    dateEl.value = d.toISOString().split('T')[0];
  }
}

// ── Complete ──────────────────────────────────────────────────────────────────

async function _completeInterview() {
  const date = _el('ai-date').value;
  const time = _el('ai-time').value;
  const stage = _el('ai-stage').value;

  if (!date) return _showError('Please select a date.');

  const record = {
    id: crypto.randomUUID(),
    company: _state.company,
    interviewer: _state.interviewer,
    jd: _state.jd,
    stage,
    scheduled_at: time ? `${date}T${time}` : date,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  all.push(record);
  localStorage.setItem('klinch_interviews', JSON.stringify(all));

  closeModal();
  renderInterviews();
}

// ── Render interviews on dashboard ────────────────────────────────────────────

function renderInterviews() {
  const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  const grid = _el('upcoming-interviews-grid');
  const empty = _el('upcoming-empty-state');
  const countEl = document.querySelector('.card-value[data-stat="interviews"]');
  const companyCountEl = document.querySelector('.card-value[data-stat="companies"]');

  if (countEl) countEl.textContent = all.length;
  if (companyCountEl) {
    const uniqueCompanies = new Set(all.map(iv => iv.company?.name).filter(Boolean));
    companyCountEl.textContent = uniqueCompanies.size;
  }

  if (!grid) return;

  if (!all.length) {
    empty.style.display = '';
    grid.innerHTML = '';
    return;
  }

  empty.style.display = 'none';
  const sorted = [...all].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  grid.innerHTML = sorted.map(iv => {
    const dateObj = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
    const dateStr = dateObj
      ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD';
    const timeStr = (dateObj && iv.scheduled_at.includes('T'))
      ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const logoHtml = iv.company?.logo_url
      ? `<img src="${iv.company.logo_url}" class="icard-logo-img" alt="" data-fb="clogo-${iv.id}">
         <div class="icard-logo-fb" data-fb-id="clogo-${iv.id}" style="display:none">${(iv.company?.name || '?')[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb">${(iv.company?.name || '?')[0].toUpperCase()}</div>`;

    const photoHtml = iv.interviewer?.photo_url
      ? `<img src="${iv.interviewer.photo_url}" class="icard-photo" alt="" data-fb="cphoto-${iv.id}">
         <div class="icard-photo-fb" data-fb-id="cphoto-${iv.id}" style="display:none">${(iv.interviewer?.name || '?')[0].toUpperCase()}</div>`
      : iv.interviewer
        ? `<div class="icard-photo-fb">${(iv.interviewer?.name || '?')[0].toUpperCase()}</div>`
        : '';

    const stageBadgeClass = {
      'Recruiter Screen': 'badge-recruiter',
      'Hiring Manager': 'badge-hiring',
      'Panel': 'badge-panel',
    }[iv.stage] || 'badge-recruiter';

    return `
      <div class="icard">
        <div class="icard-top">
          <div class="icard-logo-wrap">${logoHtml}</div>
          <div class="icard-company-info">
            <div class="icard-company-name">${iv.company?.name || 'Unknown Company'}</div>
            <div class="icard-role">${iv.jd?.structured?.role_title || 'Role TBD'}</div>
          </div>
          <span class="icard-stage-badge ${stageBadgeClass}">${iv.stage}</span>
        </div>
        ${iv.interviewer ? `
        <div class="icard-interviewer">
          <div class="icard-photo-wrap">${photoHtml}</div>
          <div class="icard-interviewer-info">
            <div class="icard-interviewer-name">${iv.interviewer.name}</div>
            <div class="icard-interviewer-title">${iv.interviewer.title || ''}</div>
          </div>
        </div>` : ''}
        <div class="icard-footer">
          <div class="icard-date">${dateStr}${timeStr ? ' · ' + timeStr : ''}</div>
          <span class="icard-status-badge">Upcoming</span>
        </div>
      </div>`;
  }).join('');

  _wireImgFallbacks(grid);
}

// ── Wire up triggers ──────────────────────────────────────────────────────────

document.querySelectorAll('.add-interview-trigger').forEach(btn => {
  btn.addEventListener('click', openModal);
});

renderInterviews();

window.AddInterview = { open: openModal };
