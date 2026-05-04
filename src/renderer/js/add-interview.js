// ── State ─────────────────────────────────────────────────────────────────────

function _emptyInterviewer() {
  return { name: '', title: '', photo_url: null, linkedin_url: null };
}

const _state = {
  step: 1,
  company: null,       // { name, logo_url, domain, apollo_id }
  interviewers: [_emptyInterviewer()],
  jd: null,            // { raw, structured }
  format: 'Virtual',   // 'Virtual' | 'Phone Screen'
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
  _state.jd = null;

  // Reset step 1
  _el('ai-company-input').value = '';
  _el('ai-company-input').style.display = '';
  _el('ai-company-results').style.display = 'none';
  _el('ai-company-results').innerHTML = '';
  _el('ai-selected-company').style.display = 'none';

  // Reset step 2
  _state.interviewers = [_emptyInterviewer()];
  _state.format = 'Virtual';

  // Reset step 4
  _el('ai-time').value        = '';
  _el('ai-time-custom').value = '';
  _el('ai-time-custom').style.display = 'none';
  _el('ai-stage').value = 'Recruiter Screen';
  _el('ai-stage-other').style.display = 'none';
  _el('ai-stage-other').value = '';

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
// Shared with interviews page
window.wireImgFallbacks = _wireImgFallbacks;

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

  if (n === 2) _renderInterviewerList();
  if (n === 4) { _setDefaultDate(); _syncFormatToggle(); }
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
    if (!_state.interviewers[0]?.name.trim()) return _showError('Please enter the interviewer\'s name.');
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

// ── Step 2: Interviewers ──────────────────────────────────────────────────────

function _esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function _renderInterviewerList() {
  const list = _el('ai-interviewers-list');
  list.innerHTML = _state.interviewers.map((iv, idx) => `
    <div class="ai-interviewer-entry" data-idx="${idx}">
      ${_state.interviewers.length > 1 ? `
        <div class="ai-iw-entry-header">
          <span class="ai-iw-entry-label">Interviewer ${idx + 1}</span>
          ${idx > 0 ? `<button class="ai-iw-remove-btn" data-idx="${idx}">Remove</button>` : ''}
        </div>` : ''}
      <div class="ai-field-group">
        <label class="ai-field-label">Name</label>
        <input type="text" class="ai-modal-input ai-iw-name" data-idx="${idx}" placeholder="Jane Smith" value="${_esc(iv.name)}">
      </div>
      <div class="ai-field-group">
        <label class="ai-field-label">Title</label>
        <input type="text" class="ai-modal-input ai-iw-title" data-idx="${idx}" placeholder="Senior Recruiter" value="${_esc(iv.title)}">
      </div>
      <div class="ai-field-group">
        <label class="ai-field-label" style="display:flex;align-items:center;gap:5px">
          LinkedIn URL
          <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted)">(optional)</span>
          <span class="ai-info-tip">ⓘ<span class="ai-info-tip-body">Adding a LinkedIn URL helps Klinch build a deeper picture of who you're speaking with — their background, seniority, and career history. This lets the AI tailor coaching to the specific person in the room, not just the role title.</span></span>
        </label>
        <input type="url" class="ai-modal-input ai-iw-url" data-idx="${idx}" placeholder="https://linkedin.com/in/…" value="${_esc(iv.linkedin_url || '')}">
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.ai-iw-name').forEach(inp => {
    inp.addEventListener('input', e => { _state.interviewers[+e.target.dataset.idx].name = e.target.value; });
  });
  list.querySelectorAll('.ai-iw-title').forEach(inp => {
    inp.addEventListener('input', e => { _state.interviewers[+e.target.dataset.idx].title = e.target.value; });
  });
  list.querySelectorAll('.ai-iw-url').forEach(inp => {
    inp.addEventListener('input', e => { _state.interviewers[+e.target.dataset.idx].linkedin_url = e.target.value; });
  });
  list.querySelectorAll('.ai-iw-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      _state.interviewers.splice(+e.currentTarget.dataset.idx, 1);
      _renderInterviewerList();
    });
  });
}

_el('ai-add-interviewer-btn').addEventListener('click', () => {
  _state.interviewers.push(_emptyInterviewer());
  _renderInterviewerList();
  // Focus the new entry's name field
  const entries = _el('ai-interviewers-list').querySelectorAll('.ai-iw-name');
  if (entries.length) entries[entries.length - 1].focus();
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

// ── Step 4: Format toggle + Date ─────────────────────────────────────────────

_el('ai-stage').addEventListener('change', () => {
  _el('ai-stage-other').style.display = _el('ai-stage').value === 'Other' ? '' : 'none';
  if (_el('ai-stage').value === 'Other') _el('ai-stage-other').focus();
});

document.querySelectorAll('.ai-format-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    _state.format = btn.dataset.value;
    _syncFormatToggle();
  });
});

function _syncFormatToggle() {
  document.querySelectorAll('.ai-format-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === _state.format);
  });
}

function _setDefaultDate() {
  const dateEl = _el('ai-date');
  if (!dateEl.value) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    dateEl.value = d.toISOString().split('T')[0];
  }
  _initTimeSelect();
}

function _initTimeSelect() {
  const sel    = _el('ai-time');
  const custom = _el('ai-time-custom');
  if (sel.options.length > 1) return; // already populated
  for (let h = 8; h <= 17; h++) {
    for (const m of [0, 30]) {
      if (h === 17 && m === 30) break;
      const val   = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const ampm  = h < 12 ? 'AM' : 'PM';
      const hour  = h % 12 || 12;
      const label = `${hour}:${m === 0 ? '00' : '30'} ${ampm}`;
      const opt   = document.createElement('option');
      opt.value   = val;
      opt.textContent = label;
      sel.appendChild(opt);
    }
  }
  const otherOpt = document.createElement('option');
  otherOpt.value = 'other';
  otherOpt.textContent = 'Other time…';
  sel.appendChild(otherOpt);

  sel.addEventListener('change', () => {
    const isOther = sel.value === 'other';
    custom.style.display = isOther ? '' : 'none';
    if (isOther) custom.focus();
  });
}

// ── Complete ──────────────────────────────────────────────────────────────────

async function _completeInterview() {
  const date = _el('ai-date').value;
  const time = _el('ai-time').value === 'other'
    ? _el('ai-time-custom').value
    : _el('ai-time').value;
  const stageRaw = _el('ai-stage').value;
  const stage = stageRaw === 'Other'
    ? (_el('ai-stage-other').value.trim() || 'Other')
    : stageRaw;

  if (!date) return _showError('Please select a date.');
  if (stageRaw === 'Other' && !_el('ai-stage-other').value.trim()) return _showError('Please enter a stage name.');

  const record = {
    id: crypto.randomUUID(),
    company: _state.company,
    interviewers: _state.interviewers.filter(iv => iv.name.trim()),
    jd: _state.jd,
    stage,
    format: _state.format,
    scheduled_at: time ? `${date}T${time}` : date,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  all.push(record);
  localStorage.setItem('klinch_interviews', JSON.stringify(all));

  if (window.ApplicationsPage) window.ApplicationsPage.onInterviewSaved(record);

  closeModal();
  renderInterviews();
}

// ── Render interviews on dashboard ────────────────────────────────────────────

function refreshDashboardStats() {
  const all  = JSON.parse(localStorage.getItem('klinch_interviews')  || '[]');
  const apps = JSON.parse(localStorage.getItem('klinch_applications') || '[]');
  const resume = JSON.parse(localStorage.getItem('klinch_resume') || 'null');

  const countEl    = document.querySelector('.card-value[data-stat="interviews"]');
  const companyEl  = document.querySelector('.card-value[data-stat="companies"]');
  const appValEl   = document.querySelector('.card-value[data-stat="applications"]');
  const appSubEl   = document.querySelector('[data-stat-sub="applications"]');
  const resValEl   = document.querySelector('.card-value[data-stat="resume"]');
  const resSubEl   = document.querySelector('[data-stat-sub="resume"]');

  if (countEl) countEl.textContent = all.length;
  if (companyEl) {
    const uniqueCompanies = new Set(all.map(iv => iv.company?.name).filter(Boolean));
    companyEl.textContent = uniqueCompanies.size;
  }

  if (appValEl) appValEl.textContent = apps.length;
  if (appSubEl) {
    const active = apps.filter(a => a.status === 'Interviewing').length;
    appSubEl.textContent = apps.length === 0
      ? 'No applications yet'
      : active > 0 ? `${active} active` : 'None active';
  }

  if (resValEl) resValEl.textContent = resume ? '✓' : '—';
  if (resSubEl) resSubEl.textContent = resume ? 'Resume uploaded' : 'Upload your resume';
}
window.refreshDashboardStats = refreshDashboardStats;

function renderInterviews() {
  const all  = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  const grid  = _el('upcoming-interviews-grid');
  const empty = _el('upcoming-empty-state');

  refreshDashboardStats();

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

    // Support both old single-interviewer records and new array records
    const interviewers = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);

    const photoStackHtml = interviewers.slice(0, 3).map((iw, i) => iw.photo_url
      ? `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)">
           <img src="${iw.photo_url}" class="icard-photo" alt="" data-fb="cphoto-${iv.id}-${i}">
           <div class="icard-photo-fb" data-fb-id="cphoto-${iv.id}-${i}" style="display:none">${(iw.name || '?')[0].toUpperCase()}</div>
         </div>`
      : `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)">
           <div class="icard-photo-fb">${(iw.name || '?')[0].toUpperCase()}</div>
         </div>`
    ).join('');

    const primaryName = interviewers[0]?.name || '';
    const extraCount = interviewers.length - 1;
    const interviewerNameHtml = extraCount > 0
      ? `${primaryName} <span style="color:var(--text-muted)">+${extraCount}</span>`
      : primaryName;

    const stageBadgeClass = {
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
    }[iv.stage] || 'badge-recruiter';

    const formatBadgeHtml = iv.format
      ? `<span class="icard-format-badge ${iv.format === 'Virtual' ? 'badge-virtual' : 'badge-phone'}">${iv.format}</span>`
      : '';

    return `
      <div class="icard" data-id="${iv.id}">
        <button class="icard-delete-btn" aria-label="Delete interview">✕</button>
        <div class="icard-top">
          <div class="icard-logo-wrap" data-company-nav="${iv.company?.domain || iv.company?.name || ''}">${logoHtml}</div>
          <div class="icard-company-info">
            <div class="icard-company-name" data-company-nav="${iv.company?.domain || iv.company?.name || ''}">${iv.company?.name || 'Unknown Company'}</div>
            <div class="icard-role">${iv.jd?.structured?.role_title || 'Role TBD'}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
            <span class="icard-stage-badge ${stageBadgeClass}">${iv.stage}</span>
            ${formatBadgeHtml}
          </div>
        </div>
        ${interviewers.length ? `
        <div class="icard-interviewer">
          <div class="icard-photo-stack">${photoStackHtml}</div>
          <div class="icard-interviewer-info">
            <div class="icard-interviewer-name">${interviewerNameHtml}</div>
            <div class="icard-interviewer-title">${interviewers[0]?.title || ''}</div>
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

// ── Delete interview flow ─────────────────────────────────────────────────────

(function setupDeleteFlow() {
  // Inject modal once
  const backdrop = document.createElement('div');
  backdrop.className = 'delete-confirm-backdrop';
  backdrop.id = 'delete-confirm-backdrop';
  backdrop.innerHTML = `
    <div class="delete-confirm-card">
      <p class="delete-confirm-title" id="delete-confirm-msg">
        Are you sure you want to delete the interview with <strong id="delete-confirm-company"></strong>?
      </p>
      <div class="delete-confirm-field">
        <label class="delete-confirm-label" for="delete-reason-select">Reason for deleting (optional)</label>
        <select class="delete-confirm-reason" id="delete-reason-select">
          <option value="">Select a reason…</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Withdrew application">Withdrew application</option>
          <option value="Offer declined">Offer declined</option>
          <option value="Rescheduling">Rescheduling</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="delete-confirm-actions">
        <button class="btn-delete-confirm" id="btn-delete-confirm">Delete</button>
        <button class="btn-keep" id="btn-keep-interview">Keep it</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  let pendingId = null;

  function openDeleteModal(id, companyName) {
    pendingId = id;
    document.getElementById('delete-confirm-company').textContent = companyName;
    document.getElementById('delete-reason-select').value = '';
    backdrop.classList.add('visible');
  }

  function closeDeleteModal() {
    backdrop.classList.remove('visible');
    pendingId = null;
  }

  function confirmDelete() {
    if (!pendingId) return;
    const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const updated = all.filter(iv => iv.id !== pendingId);
    localStorage.setItem('klinch_interviews', JSON.stringify(updated));
    closeDeleteModal();
    renderInterviews();
    window.InterviewsPage?.refresh();
  }

  // Expose so the interviews page can trigger this modal for its own cards
  window.openInterviewDeleteModal = openDeleteModal;

  // Event delegation on grid for card and delete button clicks
  const grid = _el('upcoming-interviews-grid');
  if (grid) {
    grid.addEventListener('click', e => {
      // Delete button takes priority
      const btn = e.target.closest('.icard-delete-btn');
      if (btn) {
        e.stopPropagation();
        const card = btn.closest('.icard');
        const id = card?.dataset.id;
        if (!id) return;
        const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
        const iv = all.find(x => x.id === id);
        openDeleteModal(id, iv?.company?.name || 'this company');
        return;
      }

      // Company nav: logo or name click → Companies tab
      const navEl = e.target.closest('[data-company-nav]');
      if (navEl) {
        const key = navEl.dataset.companyNav;
        if (key && window.navigateTo && window.CompaniesPage) {
          window.navigateTo('companies');
          window.CompaniesPage.openDetail(key);
        }
        return;
      }

      // Card body click → navigate to interviews section
      if (e.target.closest('.icard') && window.navigateTo) {
        window.navigateTo('interviews');
      }
    });
  }

  document.getElementById('btn-delete-confirm').addEventListener('click', confirmDelete);
  document.getElementById('btn-keep-interview').addEventListener('click', closeDeleteModal);

  // Close on backdrop click
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeDeleteModal();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && backdrop.classList.contains('visible')) closeDeleteModal();
  });
})();

window.AddInterview = { open: openModal };
