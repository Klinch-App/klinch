// ── State ─────────────────────────────────────────────────────────────────────

function _emptyInterviewer() {
  return { name: '', title: '', photo_url: null, linkedin_url: null };
}

const _state = {
  step: 1,
  flowType: 'new',          // 'new' | 'existing'
  selectedProcessId: null,  // set when flowType === 'existing'
  company: null,            // { name, logo_url, domain, apollo_id }
  interviewers: [_emptyInterviewer()],
  jd: null,                 // { raw, structured }
  format: 'Virtual',        // 'Virtual' | 'Phone Screen'
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
  _state.flowType = 'new';
  _state.selectedProcessId = null;
  _state.company = null;
  _state.jd = null;
  _state.skipJdStep = false;

  // Reset step 1
  _el('ai-company-input').value = '';
  _el('ai-company-input').style.display = '';
  _el('ai-company-results').style.display = 'none';
  _el('ai-company-results').innerHTML = '';
  _el('ai-selected-company').style.display = 'none';
  if (_el('ai-role-title')) _el('ai-role-title').value = '';

  // Reset step 2
  _state.interviewers = [_emptyInterviewer()];
  _state.format = 'Virtual';

  // Reset step 4
  _el('ai-time').value = '';
  _el('ai-stage').value = 'Recruiter Screen';
  _el('ai-stage-other').style.display = 'none';
  _el('ai-stage-other').value = '';

  // Reset step 3
  _el('ai-jd-textarea').value = '';
  _el('ai-jd-textarea').style.display = '';
  _el('ai-jd-structured').style.display = 'none';

  _modal.style.display = 'flex';
  _showIntro('choice');
}

function closeModal() {
  _modal.style.display = 'none';
}

function openModalWithCompany(company, jd) {
  _state.step = 1;
  _state.flowType = 'new';
  _state.selectedProcessId = null;
  _state.company = company;
  _state.jd = jd || null;
  _state.skipJdStep = !!jd;

  // Pre-fill company UI — hide search, show selected pill
  _el('ai-company-input').value = '';
  _el('ai-company-input').style.display = 'none';
  _el('ai-company-results').style.display = 'none';
  _el('ai-company-results').innerHTML = '';
  const logoImg = _el('ai-sel-logo-img');
  const logoFb  = _el('ai-sel-logo-fb');
  if (company.logo_url) {
    logoImg.src = company.logo_url;
    logoImg.style.display = '';
    logoFb.style.display = 'none';
    logoImg.addEventListener('error', () => {
      logoImg.style.display = 'none';
      logoFb.style.display = 'flex';
    }, { once: true });
  } else {
    logoImg.style.display = 'none';
    logoFb.textContent = (company.name || '?')[0].toUpperCase();
    logoFb.style.display = 'flex';
  }
  _el('ai-sel-company-name').textContent   = company.name || '';
  _el('ai-sel-company-domain').textContent = company.domain || '';
  _el('ai-selected-company').style.display = '';

  // Reset step 2
  _state.interviewers = [_emptyInterviewer()];
  _state.format = 'Virtual';

  // Reset step 4
  _el('ai-time').value = '';
  _el('ai-stage').value = 'Recruiter Screen';
  _el('ai-stage-other').style.display = 'none';
  _el('ai-stage-other').value = '';

  // Set up JD display
  if (jd?.structured) {
    _el('ai-jd-textarea').value = jd.raw || '';
    _el('ai-jd-textarea').style.display = 'none';
    _el('ai-jd-role-title').textContent = jd.structured.role_title || '';
    const renderList = (id, items) => { _el(id).innerHTML = (items || []).map(x => `<li>${x}</li>`).join(''); };
    renderList('ai-jd-resp', jd.structured.responsibilities);
    renderList('ai-jd-must', jd.structured.must_have);
    renderList('ai-jd-nice', jd.structured.nice_to_have);
    const niceSection = _el('ai-jd-nice-section');
    if (niceSection) niceSection.style.display = jd.structured.nice_to_have?.length ? '' : 'none';
    _el('ai-jd-structured').style.display = '';
  } else {
    _el('ai-jd-textarea').value = '';
    _el('ai-jd-textarea').style.display = '';
    _el('ai-jd-structured').style.display = 'none';
  }

  _modal.style.display = 'flex';
  _goToStep(2);
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

// Brand-color helpers for fallback avatars — used in all page scripts
// Returns inline style attr for a directly-visible fallback element
window._fbStyle = function(co) {
  const c = co?.brand_color;
  return c ? ` style="background:${c}26;color:${c}"` : '';
};
// Returns full style attr for a hidden fallback (display:none + optional brand color)
window._fbHiddenStyle = function(co) {
  const c = co?.brand_color;
  return c ? `style="display:none;background:${c}26;color:${c}"` : 'style="display:none"';
};

// Shared radial donut builder — r=15.9 → circumference≈100 units
// stroke-dasharray="${s} ${100-s}" fills exactly s% of the circle
window.buildDonut = function(score, sizePx, extraClass) {
  const s     = Math.min(100, Math.max(0, score || 0));
  const px    = sizePx || 80;
  const fs    = px <= 52 ? 14 : 18;
  const cls   = extraClass ? ` ${extraClass}` : '';
  const color = s >= 80 ? '#4ADE80' : s >= 60 ? '#FBBF24' : '#F87171';
  return `
    <div class="ivdp-fit-score-circle${cls}" style="width:${px}px;height:${px}px;flex-shrink:0">
      <svg viewBox="0 0 36 36" class="ivdp-fit-donut" style="width:${px}px;height:${px}px">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3"/>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="${color}" stroke-width="3"
          stroke-dasharray="${s} ${100 - s}" stroke-dashoffset="25" stroke-linecap="round"/>
      </svg>
      <div class="ivdp-fit-pct" style="font-size:${fs}px">${s}</div>
    </div>`;
};

function _showError(msg) {
  const toast = _el('ai-toast');
  toast.textContent = msg;
  toast.style.display = '';
  clearTimeout(_showError._t);
  _showError._t = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ── Intro panels (step 0 / 0b) ────────────────────────────────────────────────

let _introPanel = null; // 'choice' | 'pick' | null

function _showIntro(panel) {
  _introPanel = panel;
  _el('ai-step-0').style.display  = panel === 'choice' ? '' : 'none';
  _el('ai-step-0b').style.display = panel === 'pick'   ? '' : 'none';
  _stepPanels.forEach(el => { el.style.display = 'none'; });
  _modal.querySelector('.ai-step-dots').style.visibility = 'hidden';
  _stepLabel.style.visibility = 'hidden';
  _backBtn.style.visibility = panel === 'pick' ? '' : 'hidden';
  _nextBtn.style.display = 'none';
  if (panel === 'pick') _renderProcessList();
}

function _renderProcessList() {
  const list = _el('ai-process-list');
  if (!list) return;

  const processes = JSON.parse(localStorage.getItem('klinch_processes') || '[]');
  const active = processes.filter(p => p.status === 'Active' || p.status === undefined);

  if (active.length === 0) {
    list.innerHTML = '<p class="ai-process-empty">No active applications yet. <button class="ai-link-btn" id="ai-no-process-btn">Start a new one →</button></p>';
    document.getElementById('ai-no-process-btn')?.addEventListener('click', () => {
      _state.flowType = 'new';
      _showIntro('choice');
    });
    return;
  }

  list.innerHTML = active.map(p => {
    const initial = (p.company_name || '?')[0].toUpperCase();
    const logo = p.company_logo
      ? `<img class="ai-process-logo-img" src="${p.company_logo}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + `<div class="ai-process-logo-fb" style="display:none">${initial}</div>`
      : `<div class="ai-process-logo-fb">${initial}</div>`;
    return `
      <div class="ai-process-item" data-id="${p.id}">
        <div class="ai-process-logo">${logo}</div>
        <div class="ai-process-info">
          <div class="ai-process-company">${p.company_name}</div>
          <div class="ai-process-role">${p.role_title}</div>
        </div>
        <span class="ai-process-arrow">→</span>
      </div>`;
  }).join('');

  list.querySelectorAll('.ai-process-item').forEach(item => {
    item.addEventListener('click', () => {
      const p = active.find(x => x.id === item.dataset.id);
      _state.selectedProcessId = item.dataset.id;
      if (p) _state.company = { name: p.company_name, logo_url: p.company_logo || null };
      _goToStep(4);
    });
  });
}

// ── Step navigation ───────────────────────────────────────────────────────────

const STEP_LABELS = ['Company', 'Interviewer', 'Job Description', 'Details'];

function _goToStep(n) {
  _introPanel = null;
  _state.step = n;

  // Restore header elements hidden during intro panels
  _el('ai-step-0').style.display  = 'none';
  _el('ai-step-0b').style.display = 'none';
  _modal.querySelector('.ai-step-dots').style.visibility = '';
  _stepLabel.style.visibility = '';
  _nextBtn.style.display = '';

  _stepPanels.forEach((el, i) => { el.style.display = (i + 1 === n) ? '' : 'none'; });

  // Show/hide the JD dot based on whether step 3 is being skipped
  const jdDot = _modal.querySelector('.ai-step-dot[data-step="3"]');
  if (jdDot) jdDot.style.display = _state.skipJdStep ? 'none' : '';

  _stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === n);
    dot.classList.toggle('done', i + 1 < n);
  });

  _backBtn.style.visibility = n === 1 ? 'hidden' : '';
  const totalSteps  = _state.skipJdStep ? 3 : 4;
  const displayStep = _state.skipJdStep ? (n < 4 ? n : 3) : n;
  _stepLabel.textContent = `Step ${displayStep} of ${totalSteps} — ${STEP_LABELS[n - 1]}`;
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
    _goToStep(_state.skipJdStep ? 4 : 3);
  } else if (n === 3) {
    if (_state.jd) { _goToStep(4); return; }
    const raw = _el('ai-jd-textarea').value.trim();
    if (!raw) return _showError('Please paste a job description.');
    await _processJd(raw);
  } else if (n === 4) {
    await _completeAddInterview();
  }
});

_backBtn.addEventListener('click', () => {
  if (_introPanel === 'pick') { _showIntro('choice'); return; }
  if (_state.step === 1)      { _showIntro('choice'); return; }
  if (_state.step === 4 && _state.flowType === 'existing') { _showIntro('pick'); return; }
  if (_state.step > 1) {
    const prev = _state.step - 1;
    _goToStep(_state.skipJdStep && prev === 3 ? 2 : prev);
  }
});
_closeBtn.addEventListener('click', closeModal);
_modal.addEventListener('click', (e) => { if (e.target === _modal) closeModal(); });

_el('ai-flow-new')?.addEventListener('click', () => {
  _state.flowType = 'new';
  _goToStep(1);
});

_el('ai-flow-existing')?.addEventListener('click', () => {
  _state.flowType = 'existing';
  _showIntro('pick');
});

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

function _findExistingJd(companyName) {
  const name = (companyName || '').toLowerCase().trim();
  const ivs  = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  const ivMatch = ivs.find(iv =>
    (iv.company?.name || '').toLowerCase().trim() === name && iv.jd?.structured
  );
  if (ivMatch) return ivMatch.jd;
  const apps = JSON.parse(localStorage.getItem('klinch_applications') || '[]');
  const appMatch = apps.find(app =>
    (app.company?.name || '').toLowerCase().trim() === name && app.jd?.structured
  );
  return appMatch?.jd || null;
}

function _selectCompany(org) {
  _state.company = {
    name: org.name,
    logo_url: org.logo_url || null,
    domain: org.primary_domain || '',
    apollo_id: org.id,
  };

  const existingJd = _findExistingJd(org.name);
  _state.jd         = existingJd || null;
  _state.skipJdStep = !!existingJd;

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
  _state.company    = null;
  _state.jd         = null;
  _state.skipJdStep = false;
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
  // Auto-fill role title field if not already set
  const roleInput = _el('ai-role-title');
  if (roleInput && !roleInput.value.trim()) roleInput.value = res.data.role_title || '';

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
  _initTimePicker();
  _resetTimePicker();
}

function _initTimePicker() {
  const hourSel = _el('ai-time-hour');
  const minSel  = _el('ai-time-min');
  if (hourSel.options.length > 0) return;

  for (let h = 1; h <= 12; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = String(h);
    hourSel.appendChild(opt);
  }
  for (let m = 0; m < 60; m += 5) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = String(m).padStart(2, '0');
    minSel.appendChild(opt);
  }

  hourSel.addEventListener('change', _updateHiddenTime);
  minSel.addEventListener('change', _updateHiddenTime);
}

function _updateHiddenTime() {
  const hour = parseInt(_el('ai-time-hour').value, 10);
  const min  = _el('ai-time-min').value;
  // 9, 10, 11 → AM; everything else (1–8, 12) → PM
  const isPm = hour < 9 || hour === 12;
  const h24  = isPm && hour !== 12 ? hour + 12 : hour;
  _el('ai-time').value = `${String(h24).padStart(2, '0')}:${min}`;
}

function _resetTimePicker() {
  _el('ai-time-hour').value = '9';
  _el('ai-time-min').value  = '00';
  _updateHiddenTime();
}

// ── Complete ──────────────────────────────────────────────────────────────────

async function _completeAddInterview() {
  const date = _el('ai-date').value;
  const time = _el('ai-time').value;
  const stageRaw = _el('ai-stage').value;
  const stage = stageRaw === 'Other'
    ? (_el('ai-stage-other').value.trim() || 'Other')
    : stageRaw;

  if (!date) return _showError('Please select a date.');
  if (stageRaw === 'Other' && !_el('ai-stage-other').value.trim()) return _showError('Please enter a stage name.');

  const now = new Date().toISOString();
  let processId = _state.selectedProcessId || null;

  if (_state.flowType === 'new') {
    const roleTitle = (_el('ai-role-title')?.value.trim())
      || _state.jd?.structured?.role_title
      || stage;

    processId = crypto.randomUUID();
    const process = {
      id:           processId,
      company_name: _state.company?.name   || '',
      company_logo: _state.company?.logo_url || null,
      role_title:   roleTitle,
      status:       'Active',
      notes:        null,
      created_at:   now,
      updated_at:   now,
    };
    const allProcesses = JSON.parse(localStorage.getItem('klinch_processes') || '[]');
    allProcesses.push(process);
    localStorage.setItem('klinch_processes', JSON.stringify(allProcesses));
  }

  const record = {
    id:           crypto.randomUUID(),
    process_id:   processId,
    company:      _state.company,
    interviewers: _state.interviewers.filter(iv => iv.name.trim()),
    jd:           _state.jd,
    stage,
    format:       _state.format,
    scheduled_at: time ? `${date}T${time}` : date,
    status:       'pending',
    created_at:   now,
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
  const all    = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  const resume = JSON.parse(localStorage.getItem('klinch_resume') || 'null');

  const countEl    = document.querySelector('.card-value[data-stat="interviews"]');
  const companyEl  = document.querySelector('.card-value[data-stat="companies"]');
  const appValEl   = document.querySelector('.card-value[data-stat="applications"]');
  const appSubEl   = document.querySelector('[data-stat-sub="applications"]');
  const resValEl   = document.querySelector('.card-value[data-stat="resume"]');
  const resSubEl   = document.querySelector('[data-stat-sub="resume"]');

  if (countEl) countEl.textContent = all.length;
  const ivSubEl = document.querySelector('[data-stat-sub="interviews"]');
  if (ivSubEl) {
    if (all.length === 0) {
      ivSubEl.textContent = 'No interviews yet';
    } else {
      const now = new Date();
      const upcoming = all.filter(iv => iv.status === 'pending' && iv.scheduled_at && new Date(iv.scheduled_at) > now).length;
      ivSubEl.textContent = upcoming > 0 ? `${upcoming} upcoming` : `${all.length} total`;
    }
  }

  const uniqueCompanies = new Set(all.map(iv => iv.company?.name).filter(Boolean));
  if (companyEl) companyEl.textContent = uniqueCompanies.size;
  const coSubEl = document.querySelector('[data-stat-sub="companies"]');
  if (coSubEl) coSubEl.textContent = uniqueCompanies.size === 0 ? 'No companies added' : `${uniqueCompanies.size} tracked`;

  // Mirror the same merged-app logic as _getMergedApps() in applications.js:
  // interviews not linked to a real application become synthetic "Interviewing" records.
  const realApps = JSON.parse(localStorage.getItem('klinch_applications') || '[]');
  const covered  = new Set(realApps.flatMap(a => a.interview_ids || []));
  const syntheticCount = new Set(
    all.filter(iv => !covered.has(iv.id))
       .map(iv => (iv.company?.name || '').toLowerCase().trim())
       .filter(Boolean)
  ).size;
  const appTotal  = realApps.length + syntheticCount;
  const appActive = realApps.filter(a => a.status === 'Interviewing').length + syntheticCount;

  if (appValEl) appValEl.textContent = appTotal;
  if (appSubEl) {
    appSubEl.textContent = appTotal === 0
      ? 'No applications yet'
      : appActive > 0 ? `${appActive} active` : 'None active';
  }

  if (resValEl) resValEl.textContent = resume ? '✓' : '—';
  if (resSubEl) resSubEl.textContent = resume ? 'Resume uploaded' : 'Upload your resume';

  const offersValEl = document.querySelector('.card-value[data-stat="offers"]');
  const offersSubEl = document.querySelector('[data-stat-sub="offers"]');
  const offersCount = realApps.filter(a => a.status === 'Offer' || a.status === 'Offer Accepted').length;
  if (offersValEl) offersValEl.textContent = offersCount;
  if (offersSubEl) offersSubEl.textContent = 'offers received';

  const coachValEl = document.querySelector('.card-value[data-stat="coach-score"]');
  const coachSubEl = document.querySelector('[data-stat-sub="coach-score"]');
  const scored = all.filter(iv => iv.coach_score != null);
  if (coachValEl) {
    if (scored.length) {
      const avg = Math.round(scored.reduce((s, iv) => s + iv.coach_score, 0) / scored.length);
      coachValEl.textContent = avg;
      if (coachSubEl) coachSubEl.textContent = `Avg across ${scored.length} interview${scored.length > 1 ? 's' : ''}`;
    } else {
      coachValEl.textContent = '—';
      if (coachSubEl) coachSubEl.textContent = 'Complete an interview to see score';
    }
  }
}
window.refreshDashboardStats = refreshDashboardStats;

// ── Role title shortener ──────────────────────────────────────────────────────
const _ROLE_MAP = {
  'sales development representative': 'SDR',
  'account executive':                'AE',
  'customer success manager':         'CSM',
  'account manager':                  'AM',
  'solutions engineer':               'SE',
  'sales engineer':                   'SE',
  'revenue operations':               'RevOps',
  'revenue ops':                      'RevOps',
  'marketing':                        'Marketing',
  'partnerships':                     'Partnerships',
  'enablement':                       'Enablement',
  'people':                           'People',
  'people operations':                'People',
  'hr':                               'People',
};
window.shortenRoleTitle = function(title) {
  if (!title) return title;
  const match = _ROLE_MAP[title.toLowerCase().trim()];
  if (match) return match;
  return title.length > 12 ? title.slice(0, 12) + '…' : title;
};

// ── Klinch Ear — interview context bar ───────────────────────────────────────

let _earSelectedId = null;

function _getUpcomingInterviews() {
  const now = new Date();
  return JSON.parse(localStorage.getItem('klinch_interviews') || '[]')
    .filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) > now && iv.status !== 'completed')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
}

function _formatEarTime(iv) {
  if (!iv.scheduled_at) return 'TBD';
  const d    = new Date(iv.scheduled_at);
  const now  = new Date();
  const isToday    = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday)    return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + timeStr;
}

function _logoHtmlForEar(iv, cls) {
  const initial = (iv.company?.name || '?')[0].toUpperCase();
  return iv.company?.logo_url && !iv.company?.screenshot_mode
    ? `<img src="${iv.company.logo_url}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display=''">${initial}`
    : initial;
}

function updateEarContext() {
  const upcoming = _getUpcomingInterviews();

  const ctxEl    = _el('ear-iv-context');
  const selEl    = _el('ear-iv-selected');
  const noneEl   = _el('ear-iv-none');
  if (!ctxEl) return;

  if (!upcoming.length) {
    selEl.style.display  = 'none';
    noneEl.style.display = '';
    _earSelectedId = null;
    return;
  }

  // Keep previous selection if it's still upcoming; otherwise default to soonest
  const stillValid = _earSelectedId && upcoming.find(iv => iv.id === _earSelectedId);
  if (!stillValid) _earSelectedId = upcoming[0].id;

  const iv = upcoming.find(iv => iv.id === _earSelectedId);

  selEl.style.display  = '';
  noneEl.style.display = 'none';

  const logoEl    = _el('ear-iv-logo');
  const companyEl = _el('ear-iv-company');
  const roleEl    = _el('ear-iv-role');
  const timeEl    = _el('ear-iv-time');

  if (logoEl) {
    if (iv.company?.logo_url && !iv.company?.screenshot_mode) {
      logoEl.innerHTML = `<img src="${iv.company.logo_url}" alt="" onerror="this.style.display='none'">`;
      // show initial as fallback if img fails
      const img = logoEl.querySelector('img');
      if (img) img.addEventListener('error', () => { logoEl.textContent = (iv.company?.name || '?')[0].toUpperCase(); }, { once: true });
    } else {
      logoEl.textContent = (iv.company?.name || '?')[0].toUpperCase();
    }
  }
  if (companyEl) companyEl.textContent = iv.company?.name || '';
  if (roleEl)    roleEl.textContent    = iv.jd?.structured?.role_title || iv.stage || '';
  if (timeEl)    timeEl.textContent    = _formatEarTime(iv);
}
window.updateEarContext = updateEarContext;
window.getEarSelectedId = () => _earSelectedId;

// Wire the change button and dropdown (runs once)
(function _wireEarDropdown() {
  const changeBtn  = _el('ear-iv-change-btn');
  const dropdownEl = _el('ear-iv-dropdown');
  if (!changeBtn || !dropdownEl) return;

  changeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const upcoming = _getUpcomingInterviews();
    if (!upcoming.length) return;

    dropdownEl.innerHTML = upcoming.map(iv => {
      const initial = (iv.company?.name || '?')[0].toUpperCase();
      const logoHtml = iv.company?.logo_url && !iv.company?.screenshot_mode
        ? `<img src="${iv.company.logo_url}" alt="" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'">${initial}`
        : initial;
      return `
        <div class="ear-iv-option${iv.id === _earSelectedId ? ' active' : ''}" data-iv-id="${iv.id}">
          <div class="ear-iv-option-logo">${logoHtml}</div>
          <div class="ear-iv-option-info">
            <div class="ear-iv-option-company">${iv.company?.name || 'Unknown'}</div>
            <div class="ear-iv-option-time">${_formatEarTime(iv)}</div>
          </div>
        </div>`;
    }).join('');

    dropdownEl.style.display = dropdownEl.style.display === 'none' ? '' : 'none';
  });

  dropdownEl.addEventListener('click', (e) => {
    const opt = e.target.closest('.ear-iv-option');
    if (!opt) return;
    _earSelectedId = opt.dataset.ivId;
    dropdownEl.style.display = 'none';
    updateEarContext();
  });

  document.addEventListener('click', (e) => {
    if (!dropdownEl.contains(e.target) && e.target !== changeBtn) {
      dropdownEl.style.display = 'none';
    }
  });
})();

function renderInterviews() {
  const all  = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  const grid  = _el('upcoming-interviews-grid');
  const empty = _el('upcoming-empty-state');

  refreshDashboardStats();
  updateEarContext();

  if (!grid) return;

  const now = new Date();
  const upcoming = [...all]
    .filter(iv =>
      iv.scheduled_at &&
      new Date(iv.scheduled_at) > now &&
      iv.status !== 'completed' &&
      iv.status !== 'cancelled'
    )
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  if (!upcoming.length) {
    empty.style.display = '';
    grid.innerHTML = '';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = upcoming.map(iv => {
    const dateObj = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
    const dateStr = dateObj
      ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD';
    const timeStr = (dateObj && iv.scheduled_at.includes('T'))
      ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';

    const logoHtml = iv.company?.logo_url && !iv.company?.screenshot_mode
      ? `<img src="${iv.company.logo_url}" class="icard-logo-img" alt="" data-fb="clogo-${iv.id}">
         <div class="icard-logo-fb" data-fb-id="clogo-${iv.id}" ${window._fbHiddenStyle(iv.company)}>${(iv.company?.name || '?')[0].toUpperCase()}</div>`
      : `<div class="icard-logo-fb"${window._fbStyle(iv.company)}>${(iv.company?.name || '?')[0].toUpperCase()}</div>`;

    // Support both old single-interviewer records and new array records
    const interviewers = iv.interviewers || (iv.interviewer ? [iv.interviewer] : []);

    const photoStackHtml = interviewers.slice(0, 3).map((iw, i) => iw.photo_url
      ? `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)" title="${iw.name || ''}">
           <img src="${iw.photo_url}" class="icard-photo" alt="" data-fb="cphoto-${iv.id}-${i}">
           <div class="icard-photo-fb" data-fb-id="cphoto-${iv.id}-${i}" style="display:none">${(iw.name || '?')[0].toUpperCase()}</div>
         </div>`
      : `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)" title="${iw.name || ''}">
           <div class="icard-photo-fb">${(iw.name || '?')[0].toUpperCase()}</div>
         </div>`
    ).join('');

    const primaryName = interviewers[0]?.name || '';
    const extraCount = interviewers.length - 1;
    const interviewerNameHtml = extraCount > 0
      ? `${primaryName} <button class="icard-extra-toggle" style="color:var(--text-muted);background:none;border:none;cursor:pointer;padding:0;font:inherit">+${extraCount}</button>`
      : primaryName;

    const extraInterviewersHtml = extraCount > 0
      ? `<div class="icard-extra-list" style="display:none">${
          interviewers.slice(1).map(iw => `
            <div class="icard-interviewer">
              <div class="icard-photo-stack">
                ${iw.photo_url
                  ? `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)" title="${iw.name || ''}">
                       <img src="${iw.photo_url}" class="icard-photo" alt="">
                       <div class="icard-photo-fb" style="display:none">${(iw.name || '?')[0].toUpperCase()}</div>
                     </div>`
                  : `<div class="icard-photo-wrap" style="border:2px solid var(--bg-surface)" title="${iw.name || ''}">
                       <div class="icard-photo-fb">${(iw.name || '?')[0].toUpperCase()}</div>
                     </div>`}
              </div>
              <div class="icard-interviewer-info">
                <div class="icard-interviewer-name">${iw.name || ''}</div>
                <div class="icard-interviewer-title">${iw.title || ''}</div>
              </div>
            </div>`
          ).join('')
        }</div>`
      : '';

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
            <div class="icard-role">${window.shortenRoleTitle(iv.jd?.structured?.role_title) || 'Role TBD'}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
            <span class="icard-stage-badge ${stageBadgeClass}">${iv.stage === 'Recruiter Screen' ? 'Recruiter' : iv.stage}</span>
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
        </div>
        ${extraInterviewersHtml}` : ''}
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

      // Extra interviewers expand/collapse
      const toggleBtn = e.target.closest('.icard-extra-toggle');
      if (toggleBtn) {
        e.stopPropagation();
        const extraList = toggleBtn.closest('.icard')?.querySelector('.icard-extra-list');
        if (extraList) extraList.style.display = extraList.style.display === 'none' ? '' : 'none';
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

window.AddInterview = { open: openModal, openWithCompany: openModalWithCompany };
