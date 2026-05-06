// ── Onboarding ────────────────────────────────────────────────────────────────

const OB_STEPS = [
  {
    key: 'role_type',
    q: 'What type of role are you looking for?',
    type: 'role-select',
    options: [
      'Sales Development Rep (SDR)',
      'Account Executive (AE)',
      'Customer Success (CSM)',
      'Account Manager (AM)',
      'Solutions / Sales Engineer',
      'Revenue Operations (RevOps)',
      'Marketing',
      'Partnerships & Alliances',
      'Sales Enablement',
      'Engineering',
      'HR / People Ops',
    ],
  },
  {
    key: 'experience_years',
    q: 'How many years of experience do you have in this field?',
    type: 'choice',
    options: ['Less than 1 year', '1–3 years', '3–5 years', '5+ years'],
  },
  {
    key: 'company_size',
    q: 'What size of company are you targeting?',
    type: 'choice',
    multi: true,
    options: ['Startup (1–50)', 'Scale-up (51–500)', 'Mid-market (501–2000)', 'Enterprise (2000+)'],
  },
  {
    key: 'challenge',
    q: "What's your biggest interview challenge?",
    type: 'choice',
    multi: true,
    options: ['Nerves & confidence', 'Structuring my answers', 'Knowledge gaps', 'Negotiating compensation'],
  },
  {
    key: 'job_search_status',
    q: 'Where are you in your job search?',
    type: 'choice',
    options: ['Just starting out', 'Actively interviewing', 'Have offers, deciding', 'Passively exploring'],
  },
  {
    key: 'strongest_asset',
    q: "What's your strongest asset as a candidate?",
    type: 'text',
    placeholder: 'e.g. Consistent quota attainment, strong relationship builder',
  },
  {
    key: 'improvement_area',
    q: "What's one area you know you need to improve?",
    type: 'text',
    placeholder: 'e.g. Talking too much, weak on compensation conversations',
  },
  {
    key: 'tools',
    q: 'What tools and platforms are you most experienced with?',
    type: 'text',
    placeholder: 'e.g. Salesforce, Outreach, HubSpot, Gong',
  },
  {
    key: 'salary_range',
    q: "What's your target base salary range?",
    type: 'salary',
  },
  {
    key: 'additional_context',
    q: 'Anything else you want Klinch to know about you?',
    type: 'textarea',
    placeholder: 'Optional — any context that would help us personalise your experience',
    optional: true,
  },
];

function showOnboarding() {
  const overlay    = document.getElementById('onboarding-overlay');
  const fill       = overlay.querySelector('.ob-progress-fill');
  const stepCount  = overlay.querySelector('.ob-step-count');
  const cardBody   = overlay.querySelector('.ob-card-body');
  const questionEl = overlay.querySelector('.ob-question');
  const inputWrap  = overlay.querySelector('.ob-input-wrap');
  const backBtn    = document.getElementById('ob-back-btn');
  const nextBtn    = document.getElementById('ob-next-btn');

  overlay.style.display = 'flex';

  document.getElementById('ob-dev-skip')?.addEventListener('click', () => {
    localStorage.setItem('klinch_profile', JSON.stringify({ completed: true }));
    overlay.classList.add('ob-fade-out');
    setTimeout(() => location.reload(), 400);
  });

  let step = 0;
  const answers = {};

  function renderInput(s) {
    if (s.type === 'choice') {
      inputWrap.style.cssText = 'flex-direction:row;flex-wrap:wrap;gap:8px';
      const sel = s.multi ? (Array.isArray(answers[s.key]) ? answers[s.key] : []) : answers[s.key];
      inputWrap.innerHTML = s.options.map(opt =>
        `<button class="ob-choice${(s.multi ? sel.includes(opt) : sel === opt) ? ' ob-selected' : ''}" data-value="${opt}">${opt}</button>`
      ).join('');
      inputWrap.querySelectorAll('.ob-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          if (s.multi) {
            const arr = Array.isArray(answers[s.key]) ? [...answers[s.key]] : [];
            const i = arr.indexOf(btn.dataset.value);
            if (i === -1) arr.push(btn.dataset.value); else arr.splice(i, 1);
            answers[s.key] = arr;
            btn.classList.toggle('ob-selected', arr.includes(btn.dataset.value));
          } else {
            inputWrap.querySelectorAll('.ob-choice').forEach(b => b.classList.remove('ob-selected'));
            btn.classList.add('ob-selected');
            answers[s.key] = btn.dataset.value;
          }
          updateNext();
        });
      });
    } else if (s.type === 'role-select') {
      inputWrap.style.cssText = 'flex-direction:column;gap:10px';
      const current = answers[s.key] || '';
      const isOther = current && !s.options.includes(current);
      inputWrap.innerHTML = `
        <div class="ob-role-grid">
          ${s.options.map(opt => `
            <button class="ob-choice ob-role-btn${current === opt ? ' ob-selected' : ''}" data-value="${opt}">${opt}</button>
          `).join('')}
          <button class="ob-choice ob-role-btn ob-role-other${isOther ? ' ob-selected' : ''}" data-value="__other__">Other…</button>
        </div>
        <input class="ob-input ob-role-other-input" type="text" placeholder="Type your role" value="${isOther ? current : ''}" style="display:${isOther ? 'block' : 'none'}">`;
      const grid     = inputWrap.querySelector('.ob-role-grid');
      const otherInp = inputWrap.querySelector('.ob-role-other-input');
      grid.querySelectorAll('.ob-role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.ob-role-btn').forEach(b => b.classList.remove('ob-selected'));
          btn.classList.add('ob-selected');
          if (btn.dataset.value === '__other__') {
            otherInp.style.display = 'block';
            answers[s.key] = otherInp.value.trim();
            setTimeout(() => otherInp.focus(), 50);
          } else {
            otherInp.style.display = 'none';
            answers[s.key] = btn.dataset.value;
          }
          updateNext();
        });
      });
      otherInp.addEventListener('input', e => {
        answers[s.key] = e.target.value.trim();
        updateNext();
      });
      otherInp.addEventListener('keydown', e => { if (e.key === 'Enter' && !nextBtn.disabled) nextBtn.click(); });
    } else if (s.type === 'salary') {
      inputWrap.style.cssText = 'flex-direction:column;gap:8px';
      let existMin = '', existMax = '';
      const existing = answers[s.key] || '';
      if (existing) {
        const m = existing.match(/\$?([\d,]+)\s*[–-]\s*\$?([\d,]+)/);
        if (m) { existMin = m[1].replace(/,/g, ''); existMax = m[2].replace(/,/g, ''); }
      }
      inputWrap.innerHTML = `
        <div class="ob-salary-row">
          <div class="ob-salary-field">
            <span class="ob-salary-prefix">$</span>
            <input class="ob-salary-input ob-sal-min" type="number" placeholder="70000" min="0" step="1000" value="${existMin}">
          </div>
          <span class="ob-salary-sep">–</span>
          <div class="ob-salary-field">
            <span class="ob-salary-prefix">$</span>
            <input class="ob-salary-input ob-sal-max" type="number" placeholder="90000" min="0" step="1000" value="${existMax}">
          </div>
        </div>
        <div class="ob-salary-hint">Numbers only — no $ or commas needed</div>`;
      const minInp = inputWrap.querySelector('.ob-sal-min');
      const maxInp = inputWrap.querySelector('.ob-sal-max');
      function _syncSalary() {
        const min = minInp.value, max = maxInp.value;
        answers[s.key] = (min && max) ? `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`
                       : min          ? `$${Number(min).toLocaleString()}+`
                       : '';
        updateNext();
      }
      minInp.addEventListener('input', _syncSalary);
      maxInp.addEventListener('input', _syncSalary);
      minInp.addEventListener('keydown', e => { if (e.key === 'Enter') maxInp.focus(); });
      maxInp.addEventListener('keydown', e => { if (e.key === 'Enter' && !nextBtn.disabled) nextBtn.click(); });
      if (existMin) _syncSalary();
      setTimeout(() => minInp.focus(), 250);
    } else if (s.type === 'textarea') {
      inputWrap.style.cssText = 'flex-direction:column;gap:0';
      inputWrap.innerHTML = `<textarea class="ob-textarea" placeholder="${s.placeholder}">${answers[s.key] || ''}</textarea>`;
      inputWrap.querySelector('textarea').addEventListener('input', e => {
        answers[s.key] = e.target.value;
      });
    } else {
      inputWrap.style.cssText = 'flex-direction:column;gap:0';
      inputWrap.innerHTML = `<input class="ob-input" type="text" placeholder="${s.placeholder}" value="${answers[s.key] || ''}">`;
      const inp = inputWrap.querySelector('input');
      inp.addEventListener('input', e => { answers[s.key] = e.target.value; updateNext(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !nextBtn.disabled) nextBtn.click(); });
      setTimeout(() => inp.focus(), 250);
    }
  }

  function updateNext() {
    const s   = OB_STEPS[step];
    const val = answers[s.key] || '';
    nextBtn.disabled  = s.optional ? false : (s.type === 'choice' || s.type === 'role-select'
      ? (s.multi ? !(answers[s.key]?.length > 0) : !val)
      : !(val + '').trim());
    nextBtn.textContent = step === OB_STEPS.length - 1 ? "Let's go →" : 'Continue →';
  }

  function goTo(idx, dir) {
    fill.style.width        = ((idx + 1) / OB_STEPS.length * 100) + '%';
    stepCount.textContent   = `${idx + 1} of ${OB_STEPS.length}`;
    backBtn.style.visibility = idx === 0 ? 'hidden' : '';

    if (dir === null) {
      questionEl.textContent = OB_STEPS[idx].q;
      renderInput(OB_STEPS[idx]);
      updateNext();
      return;
    }

    cardBody.classList.add(dir === 'fwd' ? 'ob-exit-left' : 'ob-exit-right');

    setTimeout(() => {
      cardBody.classList.remove('ob-exit-left', 'ob-exit-right');
      questionEl.textContent = OB_STEPS[idx].q;
      renderInput(OB_STEPS[idx]);
      updateNext();
      cardBody.classList.add(dir === 'fwd' ? 'ob-enter-right' : 'ob-enter-left');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        cardBody.classList.remove('ob-enter-right', 'ob-enter-left');
      }));
    }, 180);
  }

  backBtn.addEventListener('click', () => {
    if (step > 0) { step--; goTo(step, 'back'); }
  });

  nextBtn.addEventListener('click', () => {
    const s = OB_STEPS[step];
    if (s.type === 'text')     answers[s.key] = (inputWrap.querySelector('input')?.value    || '').trim();
    if (s.type === 'textarea') answers[s.key] = (inputWrap.querySelector('textarea')?.value || '').trim();

    if (step < OB_STEPS.length - 1) {
      step++;
      goTo(step, 'fwd');
    } else {
      localStorage.setItem('klinch_profile', JSON.stringify({ completed: true, ...answers }));
      overlay.classList.add('ob-fade-out');
      setTimeout(() => location.reload(), 400);
    }
  });

  goTo(0, null);
}

// Gate: show onboarding if profile not yet completed
(function() {
  const p = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
  if (!p.completed) showOnboarding();
})();

// ── Profile context helper ─────────────────────────────────────────────────────
window.profileContext = (profile) => `
Candidate profile:
- Role seeking: ${profile.role_type}
- Experience: ${profile.experience_years}
- Target company size: ${Array.isArray(profile.company_size) ? profile.company_size.join(', ') : profile.company_size}
- Biggest challenge: ${Array.isArray(profile.challenge) ? profile.challenge.join(', ') : profile.challenge}
- Job search status: ${profile.job_search_status}
- Strongest asset: ${profile.strongest_asset}
- Area to improve: ${profile.improvement_area}
- Tools: ${profile.tools}
- Target salary: ${profile.salary_range}
${profile.additional_context ? `- Additional context: ${profile.additional_context}` : ''}
`.trim();

// ── Sidebar navigation ────────────────────────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  // Show the matching page div, hide all others
  document.querySelectorAll('[id^="page-"]').forEach(p => {
    p.style.display = p.id === `page-${page}` ? '' : 'none';
  });

  if (page === 'resume'       && window.ResumePage)       window.ResumePage.reset();
  if (page === 'interviews'   && window.InterviewsPage)   window.InterviewsPage.reset();
  if (page === 'companies'    && window.CompaniesPage)    window.CompaniesPage.reset();
  if (page === 'applications' && window.ApplicationsPage) window.ApplicationsPage.reset();
  if (page === 'calendar'     && window.CalendarPage)     window.CalendarPage.reset();
  if (page === 'dry-run'      && window.DryRunPage)       window.DryRunPage.reset();
  if (page === 'coach'        && window.CoachPage)        window.CoachPage.reset();
}
window.navigateTo = navigateTo;

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ── Dashboard stat card click-throughs ────────────────────────────────────────
document.querySelectorAll('.card[data-nav]').forEach(card => {
  card.addEventListener('click', () => navigateTo(card.dataset.nav));
});

// ── Notifications ─────────────────────────────────────────────────────────────

function _klinchSettings() {
  return JSON.parse(localStorage.getItem('klinch_settings') || '{}');
}

window.klinchNotify = function(title, body) {
  if (_klinchSettings().notifications_enabled === false) return;
  window.klinch.send('notify', { title, body });
};

window._completeInterview = function(id) {
  const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0 || all[idx].status === 'completed') return;
  all[idx].status     = 'completed';
  all[idx].updated_at = new Date().toISOString();
  localStorage.setItem('klinch_interviews', JSON.stringify(all));
  const company = all[idx].company?.name || 'your interview';
  window.klinchNotify('Klinch', `How did your ${company} interview go? Your follow-up prompts are ready.`);
  document.dispatchEvent(new CustomEvent('interview:completed', { detail: { id } }));
};

const _notifToggle = document.getElementById('st-notif-toggle');
if (_notifToggle) {
  _notifToggle.checked = _klinchSettings().notifications_enabled !== false;
  _notifToggle.addEventListener('change', () => {
    const s = _klinchSettings();
    s.notifications_enabled = _notifToggle.checked;
    localStorage.setItem('klinch_settings', JSON.stringify(s));
  });
}

// ── Settings — plan upgrade buttons ──────────────────────────────────────────
document.getElementById('page-settings').addEventListener('click', e => {
  const btn = e.target.closest('.plan-upgrade-btn');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = 'Coming soon';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
});

// ── Settings — reset app data ─────────────────────────────────────────────────
(function() {
  const backdrop   = document.getElementById('reset-confirm-backdrop');
  const openBtn    = document.getElementById('st-reset-btn');
  const cancelBtn  = document.getElementById('reset-cancel-btn');
  const confirmBtn = document.getElementById('reset-confirm-btn');

  openBtn?.addEventListener('click', () => backdrop.classList.add('visible'));
  cancelBtn?.addEventListener('click', () => backdrop.classList.remove('visible'));
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.remove('visible'); });

  confirmBtn?.addEventListener('click', () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('klinch'))
      .forEach(k => localStorage.removeItem(k));
    location.reload();
  });
})();

// ── Settings — reset onboarding ───────────────────────────────────────────────
(function() {
  const backdrop   = document.getElementById('ob-reset-confirm-backdrop');
  const openBtn    = document.getElementById('st-ob-reset-btn');
  const cancelBtn  = document.getElementById('ob-reset-cancel-btn');
  const confirmBtn = document.getElementById('ob-reset-confirm-btn');

  openBtn?.addEventListener('click', () => backdrop?.classList.add('visible'));
  cancelBtn?.addEventListener('click', () => backdrop?.classList.remove('visible'));
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.remove('visible'); });

  confirmBtn?.addEventListener('click', () => {
    localStorage.removeItem('klinch_profile');
    location.reload();
  });
})();

// ── Settings — Terms of Service modal ────────────────────────────────────────
(function() {
  const backdrop = document.getElementById('tos-modal-backdrop');
  const openBtn  = document.getElementById('st-tos-btn');
  const closeBtn = document.getElementById('tos-close-btn');

  openBtn?.addEventListener('click', () => backdrop?.classList.add('visible'));
  closeBtn?.addEventListener('click', () => backdrop?.classList.remove('visible'));
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.remove('visible'); });
})();

// ── Recording consent modal ───────────────────────────────────────────────────
(function() {
  const backdrop    = document.getElementById('consent-modal-backdrop');
  const checkRec    = document.getElementById('consent-recording');
  const checkNda    = document.getElementById('consent-nda');
  const rowRec      = document.getElementById('consent-row-recording');
  const rowNda      = document.getElementById('consent-row-nda');
  const launchBtn   = document.getElementById('consent-launch-btn');
  const cancelBtn   = document.getElementById('consent-cancel-btn');

  let _onConfirm = null;

  function _updateLaunchBtn() {
    launchBtn.disabled = !(checkRec.checked && checkNda.checked);
  }

  function _logConsent() {
    const log = JSON.parse(localStorage.getItem('klinch_consent_log') || '[]');
    log.push({
      session_id:        crypto.randomUUID(),
      interview_id:      window.getEarSelectedId?.() || null,
      timestamp:         new Date().toISOString(),
      recording_consent: true,
      nda_consent:       true,
    });
    localStorage.setItem('klinch_consent_log', JSON.stringify(log));
  }

  function _openConsentModal(onConfirm) {
    // Reset checkboxes every session
    checkRec.checked = false;
    checkNda.checked = false;
    rowRec.classList.remove('checked');
    rowNda.classList.remove('checked');
    _updateLaunchBtn();
    _onConfirm = onConfirm;
    backdrop.classList.add('visible');
  }

  checkRec.addEventListener('change', () => {
    rowRec.classList.toggle('checked', checkRec.checked);
    _updateLaunchBtn();
  });
  checkNda.addEventListener('change', () => {
    rowNda.classList.toggle('checked', checkNda.checked);
    _updateLaunchBtn();
  });

  launchBtn.addEventListener('click', () => {
    _logConsent();
    backdrop.classList.remove('visible');
    _onConfirm?.();
    _onConfirm = null;
  });

  cancelBtn.addEventListener('click', () => {
    backdrop.classList.remove('visible');
    _onConfirm = null;
  });

  // Expose for both launch buttons below
  window._openConsentModal = _openConsentModal;
})();

// ── Overlay launch button ─────────────────────────────────────────────────────
const launchBtn = document.getElementById('btn-launch-overlay');
if (launchBtn) {
  launchBtn.addEventListener('click', () => {
    window._openConsentModal(async () => {
      await window.klinch.invoke('overlay:launch');
      launchBtn.textContent = 'Klinch Ear Active';
      launchBtn.style.opacity = '0.6';
      launchBtn.style.cursor = 'default';
    });
  });

  window.klinch.on('overlay:closed', () => {
    launchBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="3" width="12" height="8" rx="2"/>
        <circle cx="7" cy="7" r="2"/>
      </svg>
      Launch Klinch Ear`;
    launchBtn.style.opacity = '';
    launchBtn.style.cursor = '';
  });
}

// ── Interview panel ───────────────────────────────────────────────────────────
const btnStart       = document.getElementById('btn-start-interview');
const btnStop        = document.getElementById('btn-stop-interview');
const deviceDot      = document.getElementById('device-dot');
const deviceLabel    = document.getElementById('device-label');
const transcriptBody = document.getElementById('transcript-body');

// Each entry: { speaker: 'interviewer'|'you', text: string }
let transcriptLines = [];
const MAX_LINES = 8;

function renderTranscript(interimText = null, interimSpeaker = null) {
  if (!transcriptBody) return;

  const lines = transcriptLines.map((l) => {
    const prefix = l.speaker === 'interviewer' ? 'Interviewer' : 'You';
    return `${prefix}: ${l.text}`;
  });

  if (interimText) {
    const prefix = interimSpeaker === 'interviewer' ? 'Interviewer' : 'You';
    lines.push(`${prefix}: ${interimText}…`);
  }

  transcriptBody.textContent = lines.join('\n') || 'Transcript will appear here once Klinch Ear is active…';
}

if (btnStart) {
  btnStart.addEventListener('click', () => {
    window._openConsentModal(async () => {
      btnStart.disabled = true;
      btnStart.textContent = 'Starting Klinch Ear…';

      await window.klinch.invoke('overlay:launch');

      const ok = await window.STT.startSession();
      if (ok) {
        btnStart.style.display = 'none';
        btnStop.style.display  = '';
      }
      btnStart.disabled = false;
      btnStart.textContent = 'Start Klinch Ear';
    });
  });
}

if (btnStop) {
  btnStop.addEventListener('click', async () => {
    await window.STT.stopSession();
    btnStop.style.display  = 'none';
    btnStart.style.display = '';
    transcriptLines = [];
    renderTranscript();
  });
}

// ── Live transcript display ───────────────────────────────────────────────────

document.addEventListener('stt:interim', (e) => {
  renderTranscript(e.detail.text, e.detail.speaker);
});

document.addEventListener('stt:final', (e) => {
  transcriptLines.push({ speaker: e.detail.speaker, text: e.detail.text });
  if (transcriptLines.length > MAX_LINES) transcriptLines.shift();
  renderTranscript();
});

// ── Device status badge ───────────────────────────────────────────────────────

document.addEventListener('stt:device-status', (e) => {
  const status = e.detail;
  if (!deviceDot) return;
  deviceDot.className = 'device-dot';
  if (status === 'blackhole') {
    deviceDot.classList.add('ok');
    if (deviceLabel) deviceLabel.textContent = 'Audio device: BlackHole + mic ✓';
  } else if (status === 'fallback') {
    deviceDot.classList.add('warn');
    if (deviceLabel) deviceLabel.textContent = 'Audio device: Default mic (BlackHole not found)';
  } else {
    deviceDot.classList.add('error');
    if (deviceLabel) deviceLabel.textContent = 'Audio device: Error — check microphone permissions';
  }
});
