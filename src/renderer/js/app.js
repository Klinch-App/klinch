// ── Onboarding ────────────────────────────────────────────────────────────────

const OB_STEPS = [
  {
    key: 'role_type',
    q: 'What type of role are you looking for?',
    type: 'role-select',
    options: [
      'SDR', 'AE',
      'CSM', 'AM',
      'SE',  'RevOps',
      'Marketing', 'Partnerships',
      'Enablement', 'People',
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
    key: 'job_search_status',
    q: 'Where are you in your job search?',
    type: 'choice',
    options: ['Just starting out', 'Actively interviewing', 'Have offers, deciding', 'Passively exploring'],
  },
  {
    key: 'salary_range',
    q: "What's your target base salary range?",
    type: 'salary',
  },
  {
    key: 'challenge',
    q: "What's your biggest interview challenge?",
    type: 'choice',
    multi: true,
    options: ['Nerves & confidence', 'Structuring my answers', 'Knowledge gaps', 'Negotiating compensation'],
  },
  {
    key: 'strongest_asset',
    q: "What's your strongest asset as a candidate?",
    type: 'text',
    placeholder: 'e.g. Consistent quota attainment, strong relationship builder',
    optional: true,
  },
  {
    key: 'improvement_area',
    q: "What's one area you know you need to improve?",
    type: 'text',
    placeholder: 'e.g. Talking too much, weak on compensation conversations',
    optional: true,
  },
  {
    key: 'tools',
    q: 'What tools and platforms are you most experienced with?',
    type: 'text',
    placeholder: 'e.g. Salesforce, Outreach, HubSpot, Gong',
    optional: true,
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
  const overlay      = document.getElementById('onboarding-overlay');
  const fill         = overlay.querySelector('.ob-progress-fill');
  const stepCount    = overlay.querySelector('.ob-step-count');
  const cardBody     = overlay.querySelector('.ob-card-body');
  const questionEl   = overlay.querySelector('.ob-question');
  const inputWrap    = overlay.querySelector('.ob-input-wrap');
  const backBtn      = document.getElementById('ob-back-btn');
  const nextBtn      = document.getElementById('ob-next-btn');
  const introEl          = document.getElementById('ob-intro');
  const progressWrap     = overlay.querySelector('.ob-progress-wrap');
  const navEl            = overlay.querySelector('.ob-nav');
  const devSkipBtn       = document.getElementById('ob-dev-skip');
  const userSkipBtn      = document.getElementById('ob-user-skip');

  overlay.style.display = 'flex';

  devSkipBtn?.addEventListener('click', () => {
    localStorage.setItem('klinch_profile', JSON.stringify({
      completed: true,
      role_type: 'SDR', experience_years: '1–3 years',
      company_size: ['Startup (1–50)'], challenge: ['Nerves & confidence'],
      job_search_status: 'Actively interviewing', strongest_asset: '[dev]',
      improvement_area: '[dev]', tools: '[dev]',
      salary_range: 'USD $70,000 – $90,000', additional_context: '',
    }));
    overlay.classList.add('ob-fade-out');
    setTimeout(() => location.reload(), 400);
  });

  // Hide Q&A chrome while intro screen is shown
  progressWrap.style.display = 'none';
  stepCount.style.display    = 'none';
  cardBody.style.display     = 'none';
  navEl.style.display        = 'none';

  document.getElementById('ob-intro-cta').addEventListener('click', () => {
    introEl.classList.add('ob-exit-left');
    setTimeout(() => {
      introEl.style.display      = 'none';
      introEl.classList.remove('ob-exit-left');
      progressWrap.style.display = '';
      stepCount.style.display    = '';
      navEl.style.display        = '';
      cardBody.classList.add('ob-enter-right');
      cardBody.style.display = '';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        cardBody.classList.remove('ob-enter-right');
      }));
    }, 180);
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
      inputWrap.style.cssText = 'flex-direction:column;gap:12px';
      const currencies = [
        { code: 'USD', symbol: '$',   label: 'USD ($)' },
        { code: 'EUR', symbol: '€',   label: 'EUR (€)' },
        { code: 'GBP', symbol: '£',   label: 'GBP (£)' },
        { code: 'CAD', symbol: 'CA$', label: 'CAD (CA$)' },
        { code: 'AUD', symbol: 'A$',  label: 'AUD (A$)' },
      ];
      let existCode = 'USD', existMin = '', existMax = '';
      const existing = answers[s.key] || '';
      if (existing) {
        const m = existing.match(/^([A-Z]{3})\s+[^\d]*([\d,]+)(?:\s*[–-]\s*[^\d]*([\d,]+))?/);
        if (m) { existCode = m[1]; existMin = m[2].replace(/,/g, ''); existMax = (m[3] || '').replace(/,/g, ''); }
      }
      const curObj = currencies.find(c => c.code === existCode) || currencies[0];
      function _salOpts(sym, sel) {
        let o = `<option value="">Select</option>`;
        for (let v = 50000; v <= 500000; v += 10000)
          o += `<option value="${v}"${sel == v ? ' selected' : ''}>${sym}${v.toLocaleString()}</option>`;
        return o;
      }
      inputWrap.innerHTML = `
        <div class="ob-salary-currency-row">
          <select class="ob-salary-select ob-currency-select">
            ${currencies.map(c => `<option value="${c.code}" data-symbol="${c.symbol}"${c.code === existCode ? ' selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="ob-salary-row">
          <select class="ob-salary-select ob-sal-min">${_salOpts(curObj.symbol, existMin)}</select>
          <span class="ob-salary-sep">–</span>
          <select class="ob-salary-select ob-sal-max">${_salOpts(curObj.symbol, existMax)}</select>
        </div>`;
      const currSel = inputWrap.querySelector('.ob-currency-select');
      const minSel  = inputWrap.querySelector('.ob-sal-min');
      const maxSel  = inputWrap.querySelector('.ob-sal-max');
      function _syncSalary() {
        const opt  = currSel.options[currSel.selectedIndex];
        const sym  = opt.dataset.symbol;
        const code = currSel.value;
        const min  = minSel.value, max = maxSel.value;
        answers[s.key] = (min && max) ? `${code} ${sym}${Number(min).toLocaleString()} – ${sym}${Number(max).toLocaleString()}`
                       : min          ? `${code} ${sym}${Number(min).toLocaleString()}+`
                       : '';
        updateNext();
      }
      function _rebuildSalOpts() {
        const sym = currSel.options[currSel.selectedIndex].dataset.symbol;
        const prevMin = minSel.value, prevMax = maxSel.value;
        minSel.innerHTML = _salOpts(sym, prevMin);
        maxSel.innerHTML = _salOpts(sym, prevMax);
        _syncSalary();
      }
      currSel.addEventListener('change', _rebuildSalOpts);
      minSel.addEventListener('change', _syncSalary);
      maxSel.addEventListener('change', _syncSalary);
      if (existMin) _syncSalary();
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
    fill.style.width          = ((idx + 1) / OB_STEPS.length * 100) + '%';
    stepCount.textContent     = `${idx + 1} of ${OB_STEPS.length}`;
    backBtn.style.visibility  = idx === 0 ? 'hidden' : '';
    devSkipBtn.style.display  = idx <= 2 ? '' : 'none';
    userSkipBtn.style.display = idx >= 3 ? '' : 'none';

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

  userSkipBtn.addEventListener('click', () => {
    answers[OB_STEPS[step].key] = null;
    if (step < OB_STEPS.length - 1) {
      step++;
      goTo(step, 'fwd');
    } else {
      localStorage.setItem('klinch_profile', JSON.stringify({ completed: true, ...answers }));
      overlay.classList.add('ob-fade-out');
      setTimeout(() => location.reload(), 400);
    }
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

// ── Post-interview nudge system ───────────────────────────────────────────────

function _checkInterviewNudges() {
  const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  const now = new Date();
  const queue = all.filter(iv =>
    iv.status === 'pending' &&
    iv.scheduled_at &&
    new Date(iv.scheduled_at) < now &&
    !(iv.sessions?.length) &&
    iv.nudge_sent !== true
  );
  if (queue.length) setTimeout(() => _processNudgeQueue(queue), 600);
}

function _processNudgeQueue(queue) {
  if (!queue.length) return;
  const [current, ...rest] = queue;
  _showNudge(current, rest);
}

function _showNudge(iv, remaining) {
  const backdrop      = document.getElementById('nudge-backdrop');
  const panelMain     = document.getElementById('nudge-panel-main');
  const panelCoaching = document.getElementById('nudge-panel-coaching');
  const actionBtns    = document.getElementById('nudge-action-btns');
  const reschedPanel  = document.getElementById('nudge-reschedule-panel');
  const titleEl       = document.getElementById('nudge-title');
  const metaEl        = document.getElementById('nudge-meta');
  const coachMetaEl   = document.getElementById('nudge-coaching-meta');
  if (!backdrop) return;

  const company = iv.company?.name || 'the company';
  const stage   = iv.stage || 'Interview';
  const dateStr = iv.scheduled_at
    ? new Date(iv.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  // Reset to initial state
  panelMain.style.display     = '';
  panelCoaching.style.display = 'none';
  actionBtns.style.display    = '';
  reschedPanel.style.display  = 'none';

  titleEl.textContent = `How did your ${stage} with ${company} go?`;
  metaEl.textContent  = dateStr ? `Scheduled for ${dateStr}` : '';

  function _patch(patch) {
    const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const idx = all.findIndex(x => x.id === iv.id);
    if (idx < 0) return;
    Object.assign(all[idx], patch);
    localStorage.setItem('klinch_interviews', JSON.stringify(all));
  }

  function _dismiss() {
    backdrop.classList.remove('visible');
    setTimeout(() => _processNudgeQueue(remaining), 280);
  }

  document.getElementById('nudge-happened').onclick = () => {
    _patch({ status: 'completed', nudge_sent: true, updated_at: new Date().toISOString() });
    window.refreshDashboardStats?.();
    document.dispatchEvent(new CustomEvent('interview:completed', { detail: { id: iv.id } }));
    // Switch to coaching follow-up panel
    panelMain.style.display     = 'none';
    coachMetaEl.textContent     = `${company} — ${stage}`;
    panelCoaching.style.display = '';
  };

  document.getElementById('nudge-rescheduled').onclick = () => {
    actionBtns.style.display   = 'none';
    reschedPanel.style.display = '';
    const inp = document.getElementById('nudge-reschedule-input');
    if (iv.scheduled_at) {
      const d = new Date(iv.scheduled_at);
      inp.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
  };

  document.getElementById('nudge-reschedule-cancel').onclick = () => {
    reschedPanel.style.display = 'none';
    actionBtns.style.display   = '';
  };

  document.getElementById('nudge-reschedule-save').onclick = () => {
    const val = document.getElementById('nudge-reschedule-input').value;
    if (!val) return;
    _patch({ scheduled_at: new Date(val).toISOString(), nudge_sent: true, updated_at: new Date().toISOString() });
    _dismiss();
  };

  document.getElementById('nudge-cancelled').onclick = () => {
    _patch({ status: 'cancelled', nudge_sent: true, updated_at: new Date().toISOString() });
    window.refreshDashboardStats?.();
    _dismiss();
  };

  document.getElementById('nudge-coach-yes').onclick = () => {
    backdrop.classList.remove('visible');
    window.navigateTo?.('interviews');
    setTimeout(() => {
      window.InterviewsPage?.openDetail(iv.id);
      requestAnimationFrame(() => {
        const coachSection = [...document.querySelectorAll('.ivdp-section-title')]
          .find(t => t.textContent.trim() === 'Coach')
          ?.closest('.ivdp-section');
        coachSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      _processNudgeQueue(remaining);
    }, 0);
  };

  document.getElementById('nudge-coach-no').onclick = _dismiss;

  backdrop.classList.add('visible');
}

// Gate: show onboarding if profile not yet completed
// Called directly on authed launch, or by auth.js after sign-in
function _klinchInitApp() {
  const p = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
  if (!p.completed) showOnboarding();
  else _checkInterviewNudges();
}
window._klinchInitApp = _klinchInitApp;

// Auth gate — check session, sync data from Supabase, then init app
(async function() {
  // Dev bypass: persists across reloads so the login screen doesn't re-appear
  // after onboarding's location.reload() call.
  if (window.klinch.isDev && localStorage.getItem('klinch_dev_auth_bypass') === '1') {
    _klinchInitApp();
    return;
  }

  const res = await window.klinch.invoke('auth:get-session');
  if (res.ok && res.session) {
    await window.Sync?.syncAllDown?.(); // Supabase wins on conflict
    _klinchInitApp();
  } else {
    window.Auth?.showAuthScreen();
  }
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

// ── Settings — plan upgrade buttons handled by billing.js ────────────────────

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
      .filter(k => k.startsWith('klinch') && k !== 'klinch_dev_auth_bypass')
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

// ── Settings — Sign Out ───────────────────────────────────────────────────────
document.getElementById('st-sign-out-btn')?.addEventListener('click', async () => {
  localStorage.removeItem('klinch_dev_auth_bypass');
  await window.klinch.invoke('auth:sign-out');
  location.reload();
});

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

// ── Klinch Ear intro modal (shown once, gates consent) ────────────────────────
(function() {
  const backdrop   = document.getElementById('ear-intro-backdrop');
  const confirmBtn = document.getElementById('ear-intro-confirm-btn');

  function _openIntroModal(onConfirm) {
    backdrop.classList.add('visible');
    confirmBtn.onclick = () => {
      localStorage.setItem('klinch_ear_intro_seen', '1');
      backdrop.classList.remove('visible');
      onConfirm();
    };
  }

  const _origOpen = window._openConsentModal;
  window._openConsentModal = function(onConfirm) {
    if (!localStorage.getItem('klinch_ear_intro_seen')) {
      _openIntroModal(() => _origOpen(onConfirm));
    } else {
      _origOpen(onConfirm);
    }
  };
})();

// ── Overlay launch button ─────────────────────────────────────────────────────
const launchBtn = document.getElementById('btn-launch-overlay');
if (launchBtn) {
  launchBtn.addEventListener('click', () => {
    if (!window.Billing?.canStartSession()) {
      window.Billing?.showUpgradeModal();
      return;
    }
    window._openConsentModal(async () => {
      launchBtn.disabled = true;
      await window.klinch.invoke('overlay:launch');
      const ok = await window.STT.startSession(window.getEarSelectedId?.() || null);
      if (ok) {
        window.Billing?.consumeCredit();
        launchBtn.textContent = 'Klinch Ear Active';
        launchBtn.style.opacity = '0.6';
        launchBtn.style.cursor = 'default';
        // Sync the dashboard panel buttons
        if (btnStart) btnStart.style.display = 'none';
        if (btnStop)  btnStop.style.display  = '';
      }
      launchBtn.disabled = false;
    });
  });

  window.klinch.on('overlay:closed', () => {
    // Stop STT if it was running via the pop-out path
    window.STT.stopSession();
    // Reset dashboard panel buttons
    if (btnStop)  btnStop.style.display  = 'none';
    if (btnStart) btnStart.style.display = '';
    transcriptLines = [];
    renderTranscript();
    // Reset launch button
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
const feedbackStatus = document.getElementById('feedback-status');

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
    if (!window.Billing?.canStartSession()) {
      window.Billing?.showUpgradeModal();
      return;
    }
    window._openConsentModal(async () => {
      btnStart.disabled = true;
      btnStart.textContent = 'Starting Klinch Ear…';
      if (feedbackStatus) feedbackStatus.style.display = 'none';

      await window.klinch.invoke('overlay:launch');

      const ok = await window.STT.startSession(window.getEarSelectedId?.() || null);
      if (ok) {
        window.Billing?.consumeCredit();
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

    if (feedbackStatus) {
      feedbackStatus.textContent = 'Generating feedback…';
      feedbackStatus.style.display = '';
    }

    await window.klinch.invoke('interview:feedback', { interviewId: window.getEarSelectedId?.() || null });

    if (feedbackStatus) {
      feedbackStatus.textContent = 'Feedback ready — view in Interviews';
    }
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
  if (status === 'mic') {
    deviceDot.classList.add('ok');
    if (deviceLabel) deviceLabel.textContent = 'Microphone active ✓';
  } else {
    deviceDot.classList.add('error');
    if (deviceLabel) deviceLabel.textContent = 'Audio device: Error — check microphone permissions';
  }
});
