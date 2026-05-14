// ── Generic modal utility (replaces native confirm / alert / prompt) ──────────
// KModal.alert(title, body)
// KModal.confirm(title, body, onConfirm, { confirmLabel, cancelLabel, onCancel })

window.KModal = (() => {
  const backdrop  = document.getElementById('kmodal-backdrop');
  const titleEl   = document.getElementById('kmodal-title');
  const bodyEl    = document.getElementById('kmodal-body');
  const actionsEl = document.getElementById('kmodal-actions');

  function _close() { backdrop.classList.remove('visible'); }

  backdrop.addEventListener('click', e => { if (e.target === backdrop) _close(); });

  function alert(title, body) {
    titleEl.textContent  = title;
    bodyEl.textContent   = body;
    actionsEl.innerHTML  = `<button class="kmodal-btn-confirm" id="kmodal-ok">OK</button>`;
    document.getElementById('kmodal-ok').addEventListener('click', _close, { once: true });
    backdrop.classList.add('visible');
  }

  function confirm(title, body, onConfirm, { confirmLabel = 'Confirm', cancelLabel = 'Cancel', onCancel } = {}) {
    titleEl.textContent = title;
    bodyEl.textContent  = body;
    actionsEl.innerHTML = `
      <button class="kmodal-btn-cancel"  id="kmodal-cancel">${cancelLabel}</button>
      <button class="kmodal-btn-confirm" id="kmodal-confirm">${confirmLabel}</button>
    `;
    document.getElementById('kmodal-cancel').addEventListener('click',  () => { _close(); onCancel?.();  }, { once: true });
    document.getElementById('kmodal-confirm').addEventListener('click', () => { _close(); onConfirm?.(); }, { once: true });
    backdrop.classList.add('visible');
  }

  return { alert, confirm };
})();

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
    placeholders: {
      SDR:          'e.g. Consistent quota attainment, strong relationship builder',
      AE:           'e.g. Strong discovery skills, closing complex multi-stakeholder deals',
      CSM:          'e.g. High retention rates, strong executive relationship building',
      AM:           'e.g. Consistent expansion revenue, deep account relationships',
      SE:           'e.g. Technical depth, ability to simplify complex concepts',
      RevOps:       'e.g. Process optimization, strong analytical and systems thinking',
      Marketing:    'e.g. Pipeline generation, strong content and campaign execution',
      Partnerships: 'e.g. Channel development, co-sell motion experience',
      Enablement:   'e.g. Ramp time reduction, strong training program design',
      People:       'e.g. Strong recruiting pipeline, culture and retention focus',
    },
    optional: true,
  },
  {
    key: 'improvement_area',
    q: "What's one area you know you need to improve?",
    type: 'text',
    placeholder: 'e.g. Talking too much, weak on compensation conversations',
    placeholders: {
      SDR:          'e.g. Talking too much, weak on compensation conversations',
      AE:           'e.g. Struggling with multi-threader deals, weak on negotiation',
      CSM:          'e.g. Difficult conversations, proving ROI to executives',
      AM:           'e.g. Upsell conversations, navigating procurement',
      SE:           'e.g. Struggling with business case framing, too technical in demos',
      RevOps:       'e.g. Stakeholder alignment, translating data into strategy',
      Marketing:    'e.g. Proving attribution, aligning with sales on pipeline',
      Partnerships: 'e.g. Internal alignment, partner enablement at scale',
      Enablement:   'e.g. Measuring impact, getting sales buy-in',
      People:       'e.g. Difficult performance conversations, scaling hiring processes',
    },
    optional: true,
  },
  {
    key: 'tools',
    q: 'What tools and platforms are you most experienced with?',
    type: 'text',
    placeholder: 'e.g. Salesforce, Outreach, HubSpot, Gong',
    placeholders: {
      SDR:          'e.g. Salesforce, Outreach, HubSpot, Gong',
      AE:           'e.g. Salesforce, Gong, LinkedIn Sales Navigator, Docusign',
      CSM:          'e.g. Gainsight, Salesforce, Intercom, Zendesk',
      AM:           'e.g. Salesforce, HubSpot, Gong, ChurnZero',
      SE:           'e.g. Salesforce, Gong, SQL, AWS, Tableau',
      RevOps:       'e.g. Salesforce, HubSpot, Looker, Clari, Outreach',
      Marketing:    'e.g. HubSpot, Marketo, Google Analytics, Salesforce',
      Partnerships: 'e.g. Salesforce, PartnerStack, Crossbeam, HubSpot',
      Enablement:   'e.g. Salesforce, Highspot, Gong, LMS platforms',
      People:       'e.g. Workday, Greenhouse, Lever, BambooHR',
    },
    optional: true,
  },
  {
    key: 'additional_context',
    q: 'Anything else you want Klinch to know about you?',
    type: 'textarea',
    placeholder: 'Optional — any context that would help us personalize your experience',
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

  if (!window.klinch?.isDev) devSkipBtn?.remove();

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
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('ob-fade-out');
      _flowStarted = false;
      _initFlow();
    }, 400);
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
      const ph = s.placeholders?.[answers.role_type] || s.placeholder;
      inputWrap.innerHTML = `<input class="ob-input" type="text" placeholder="${ph}" value="${answers[s.key] || ''}">`;
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
    if (devSkipBtn?.isConnected) devSkipBtn.style.display = idx <= 2 ? '' : 'none';
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
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('ob-fade-out');
        _flowStarted = false;
        _initFlow();
      }, 400);
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
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('ob-fade-out');
        _flowStarted = false;
        _initFlow();
      }, 400);
    }
  });

  goTo(0, null);
}

// ── Post-interview nudge system ───────────────────────────────────────────────

const _nudgePicker = { year: 0, month: 0, day: 0 };

function _nudgeRenderCal() {
  const grid  = document.getElementById('nudge-cal-grid');
  const label = document.getElementById('nudge-cal-month-label');
  if (!grid || !label) return;
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${MONTHS[_nudgePicker.month]} ${_nudgePicker.year}`;
  const firstDay    = new Date(_nudgePicker.year, _nudgePicker.month, 1).getDay();
  const daysInMonth = new Date(_nudgePicker.year, _nudgePicker.month + 1, 0).getDate();
  const today = new Date();
  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="nudge-cal-cell nudge-cal-cell-empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday    = today.getFullYear() === _nudgePicker.year && today.getMonth() === _nudgePicker.month && today.getDate() === d;
    const isSelected = _nudgePicker.day === d;
    let cls = 'nudge-cal-cell';
    if (isToday)    cls += ' is-today';
    if (isSelected) cls += ' is-selected';
    html += `<div class="${cls}" data-day="${d}">${d}</div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.nudge-cal-cell[data-day]').forEach(cell => {
    cell.onclick = () => { _nudgePicker.day = +cell.dataset.day; _nudgeRenderCal(); };
  });
}


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

    const src = iv.scheduled_at ? new Date(iv.scheduled_at) : new Date();
    _nudgePicker.year  = src.getFullYear();
    _nudgePicker.month = src.getMonth();
    _nudgePicker.day   = src.getDate();
    _nudgeRenderCal();

    const hourSel = document.getElementById('nudge-time-hour');
    hourSel.innerHTML = '';
    for (let h = 1; h <= 12; h++) {
      const o = document.createElement('option');
      o.value = h; o.textContent = h; hourSel.appendChild(o);
    }
    const rawH = src.getHours();
    const initPM = rawH >= 12;
    hourSel.value = rawH % 12 || 12;

    const minSel = document.getElementById('nudge-time-min');
    minSel.innerHTML = '';
    for (let m = 0; m < 60; m += 5) {
      const o = document.createElement('option');
      o.value = m; o.textContent = String(m).padStart(2, '0'); minSel.appendChild(o);
    }
    minSel.value = Math.round(src.getMinutes() / 5) * 5 % 60;

    const amBtn = document.getElementById('nudge-ampm-am');
    const pmBtn = document.getElementById('nudge-ampm-pm');
    amBtn.classList.toggle('active', !initPM);
    pmBtn.classList.toggle('active',  initPM);
    amBtn.onclick = () => { amBtn.classList.add('active'); pmBtn.classList.remove('active'); };
    pmBtn.onclick = () => { pmBtn.classList.add('active'); amBtn.classList.remove('active'); };

    document.getElementById('nudge-cal-prev').onclick = () => {
      if (--_nudgePicker.month < 0) { _nudgePicker.month = 11; _nudgePicker.year--; }
      _nudgePicker.day = 0; _nudgeRenderCal();
    };
    document.getElementById('nudge-cal-next').onclick = () => {
      if (++_nudgePicker.month > 11) { _nudgePicker.month = 0; _nudgePicker.year++; }
      _nudgePicker.day = 0; _nudgeRenderCal();
    };
  };

  document.getElementById('nudge-reschedule-cancel').onclick = () => {
    reschedPanel.style.display = 'none';
    actionBtns.style.display   = '';
  };

  document.getElementById('nudge-reschedule-save').onclick = () => {
    if (!_nudgePicker.day) return;
    const hourSel = document.getElementById('nudge-time-hour');
    const minSel  = document.getElementById('nudge-time-min');
    const isPM    = document.getElementById('nudge-ampm-pm').classList.contains('active');
    let h = parseInt(hourSel.value, 10);
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    const dt = new Date(_nudgePicker.year, _nudgePicker.month, _nudgePicker.day, h, parseInt(minSel.value, 10));
    _patch({ scheduled_at: dt.toISOString(), nudge_sent: true, updated_at: new Date().toISOString() });
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

// Called by auth.js after successful sign-in
function _klinchInitApp() {
  const p = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
  if (!p.completed) showOnboarding();
  else _checkInterviewNudges();
}
window._klinchInitApp = _klinchInitApp;

// Flow: Welcome → Onboarding → Auth → App
// Each step is checked in strict order. Dev bypass only skips auth, not welcome or onboarding.
let _flowStarted = false;

async function _initFlow() {
  if (_flowStarted) {
    console.warn('[klinch] _initFlow: duplicate call blocked');
    return;
  }
  _flowStarted = true;

  // Hide the app shell immediately to prevent dashboard flashing through
  // while overlays are being decided. Restored at every destination below.
  const appShell = document.querySelector('.app-shell');
  if (appShell) appShell.style.opacity = '0';

  console.log('[klinch] _initFlow called');

  // Step 1: Welcome — unconditionally first
  if (!localStorage.getItem('klinch_welcome_seen')) {
    console.log('[klinch] step 1 → showing welcome screen');
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) overlay.style.display = 'flex';
    if (appShell) appShell.style.opacity = ''; // overlay covers shell
    document.getElementById('welcome-cta-btn')?.addEventListener('click', () => {
      localStorage.setItem('klinch_welcome_seen', '1');
      if (overlay) overlay.style.display = 'none';
      _flowStarted = false; // reset so the continuation can proceed
      _initFlow();
    }, { once: true });
    return;
  }
  console.log('[klinch] step 1 → welcome already seen, continuing');

  // Step 2: Onboarding — checked before dev bypass so it can never be skipped
  const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
  console.log('[klinch] step 2 → klinch_profile raw:', localStorage.getItem('klinch_profile'), '| completed:', profile.completed);
  if (!profile.completed) {
    console.log('[klinch] step 2 → profile incomplete, showing onboarding');
    showOnboarding();
    if (appShell) appShell.style.opacity = ''; // overlay covers shell
    return;
  }
  console.log('[klinch] step 2 → profile complete, continuing');

  // Dev bypass: welcome + onboarding already done; only skips the auth check
  if (window.klinch.isDev && localStorage.getItem('klinch_dev_auth_bypass') === '1') {
    console.log('[klinch] step 3 → dev bypass active, skipping auth → going to app');
    if (appShell) appShell.style.opacity = ''; // going to app, reveal shell
    _checkInterviewNudges();
    return;
  }
  console.log('[klinch] step 3 → no dev bypass, running auth check');

  // Step 4: Auth check
  const res = await window.klinch.invoke('auth:get-session');
  console.log('[klinch] step 4 → auth result:', res.ok, '| has session:', !!res.session);
  if (res.ok && res.session) {
    await window.Sync?.syncAllDown?.();
    console.log('[klinch] step 4 → signed in, going to app');
    if (appShell) appShell.style.opacity = ''; // going to app, reveal shell
    _checkInterviewNudges();
  } else {
    console.log('[klinch] step 4 → not signed in, showing auth screen');
    if (appShell) appShell.style.opacity = ''; // auth overlay covers shell
    window.Auth?.showAuthScreen();
  }
}

_initFlow();

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
  const idx = all.findIndex(x => String(x.id) === String(id));
  if (idx < 0) return;
  const alreadyDone = all[idx].status === 'completed';
  if (!alreadyDone) {
    all[idx].status     = 'completed';
    all[idx].updated_at = new Date().toISOString();
    localStorage.setItem('klinch_interviews', JSON.stringify(all));
    const company = all[idx].company?.name || 'your interview';
    window.klinchNotify('Klinch', `How did your ${company} interview go? Your follow-up prompts are ready.`);
  }
  // Always dispatch so listeners (Coach, UI) sync regardless of prior state
  document.dispatchEvent(new CustomEvent('interview:completed', { detail: { id: all[idx].id } }));
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

// ── Settings — Privacy Policy ─────────────────────────────────────────────────
document.getElementById('st-pp-btn')?.addEventListener('click', () => {
  window.klinch.invoke('shell:open-external', { url: 'https://tryklinch.com/privacy' });
});

// ── Settings — Account section ────────────────────────────────────────────────
(async function() {
  // Populate email display
  const emailEl = document.getElementById('st-account-email');
  if (emailEl) {
    const res = await window.klinch.invoke('auth:get-session');
    if (res.ok && res.session?.user?.email) {
      emailEl.textContent = res.session.user.email;
    }
  }

  // ── Change Password modal ──────────────────────────────────────────────────
  const cpBackdrop = document.getElementById('change-password-backdrop');
  const cpOpenBtn  = document.getElementById('st-change-password-btn');
  const cpCancel   = document.getElementById('cp-cancel-btn');
  const cpConfirm  = document.getElementById('cp-confirm-btn');
  const cpError    = document.getElementById('cp-error');
  const cpCurrent  = document.getElementById('cp-current');
  const cpNew      = document.getElementById('cp-new');
  const cpConfirmPw = document.getElementById('cp-confirm-pw');

  function _closeCp() {
    cpBackdrop?.classList.remove('visible');
    if (cpCurrent)   cpCurrent.value   = '';
    if (cpNew)       cpNew.value       = '';
    if (cpConfirmPw) cpConfirmPw.value = '';
    if (cpError)    { cpError.textContent = ''; cpError.style.display = 'none'; }
  }
  function _cpError(msg) {
    if (!cpError) return;
    cpError.textContent = msg;
    cpError.style.display = '';
  }

  cpOpenBtn?.addEventListener('click', () => cpBackdrop?.classList.add('visible'));
  cpCancel?.addEventListener('click', _closeCp);
  cpBackdrop?.addEventListener('click', e => { if (e.target === cpBackdrop) _closeCp(); });

  cpConfirm?.addEventListener('click', async () => {
    const current = cpCurrent?.value || '';
    const newPw   = cpNew?.value     || '';
    const confirm = cpConfirmPw?.value || '';
    if (!current)            { _cpError('Please enter your current password.'); return; }
    if (!newPw)              { _cpError('Please enter a new password.'); return; }
    if (newPw.length < 8)    { _cpError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirm)   { _cpError('Passwords do not match.'); return; }

    cpConfirm.disabled     = true;
    cpConfirm.textContent  = 'Saving…';
    const res = await window.klinch.invoke('auth:change-password', { currentPassword: current, newPassword: newPw });
    cpConfirm.disabled     = false;
    cpConfirm.textContent  = 'Change Password';

    if (!res.ok) { _cpError(res.error || 'Could not change password.'); return; }
    _closeCp();
  });

  // ── Delete Account modal ───────────────────────────────────────────────────
  const daBackdrop = document.getElementById('delete-account-backdrop');
  const daOpenBtn  = document.getElementById('st-delete-account-btn');
  const daCancel   = document.getElementById('da-cancel-btn');
  const daConfirm  = document.getElementById('da-confirm-btn');
  const daInput    = document.getElementById('da-confirm-input');
  const daError    = document.getElementById('da-error');

  function _closeDa() {
    daBackdrop?.classList.remove('visible');
    if (daInput) daInput.value = '';
    if (daError) { daError.textContent = ''; daError.style.display = 'none'; }
    if (daConfirm) daConfirm.disabled = true;
  }

  daOpenBtn?.addEventListener('click', () => daBackdrop?.classList.add('visible'));
  daCancel?.addEventListener('click', _closeDa);
  daBackdrop?.addEventListener('click', e => { if (e.target === daBackdrop) _closeDa(); });

  daInput?.addEventListener('input', () => {
    if (daConfirm) daConfirm.disabled = daInput.value !== 'DELETE';
  });

  daConfirm?.addEventListener('click', async () => {
    if (daInput?.value !== 'DELETE') return;
    daConfirm.disabled    = true;
    daConfirm.textContent = 'Deleting…';
    const res = await window.klinch.invoke('auth:delete-account');
    if (!res.ok) {
      daConfirm.disabled    = false;
      daConfirm.textContent = 'Delete My Account';
      if (daError) { daError.textContent = res.error || 'Could not delete account.'; daError.style.display = ''; }
      return;
    }
    localStorage.clear();
    location.reload();
  });
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
      } else {
        await window.klinch.invoke('overlay:close');
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
      } else {
        await window.klinch.invoke('overlay:close');
      }
      btnStart.disabled = false;
      btnStart.textContent = 'Start Klinch Ear';
    });
  });
}

// ── Ear end confirmation modal ────────────────────────────────────────────────

(function() {
  const confirmBackdrop  = document.getElementById('ear-end-confirm-backdrop');
  const confirmCancelBtn = document.getElementById('ear-end-cancel-btn');
  const confirmOkBtn     = document.getElementById('ear-end-confirm-btn');
  const completeLabel    = document.getElementById('ear-end-complete-label');
  const completeBox      = document.getElementById('ear-end-complete-box');

  let _pendingMarkComplete = false;

  function _openEndConfirm() {
    _pendingMarkComplete = false;
    completeLabel?.classList.remove('checked');
    completeBox?.classList.remove('checked');
    confirmBackdrop?.classList.add('visible');
  }

  function _closeEndConfirm() {
    confirmBackdrop?.classList.remove('visible');
  }

  completeLabel?.addEventListener('click', () => {
    _pendingMarkComplete = !_pendingMarkComplete;
    completeLabel.classList.toggle('checked', _pendingMarkComplete);
    completeBox.classList.toggle('checked', _pendingMarkComplete);
  });

  confirmCancelBtn?.addEventListener('click', _closeEndConfirm);

  confirmOkBtn?.addEventListener('click', async () => {
    const markComplete = _pendingMarkComplete;
    _closeEndConfirm();

    const earInterviewId = window.getEarSelectedId?.() || null;

    await window.STT.stopSession();
    await window.klinch.invoke('overlay:close');
    if (btnStop)  btnStop.style.display  = 'none';
    if (btnStart) btnStart.style.display = '';
    transcriptLines = [];
    renderTranscript();

    if (earInterviewId) window._showEarExitModal?.(earInterviewId, markComplete);

    if (feedbackStatus) {
      feedbackStatus.textContent = 'Generating feedback…';
      feedbackStatus.style.display = '';
    }

    await window.klinch.invoke('interview:feedback', { interviewId: earInterviewId });

    if (feedbackStatus) {
      feedbackStatus.textContent = 'Feedback ready — view in Interviews';
    }
  });

  if (btnStop) {
    btnStop.addEventListener('click', _openEndConfirm);
  }
})();

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

// ── Full-screen Ear mode ──────────────────────────────────────────────────────

const btnExpand      = document.getElementById('btn-expand-ear');
const earFsActiveBadge = document.getElementById('ear-fs-active-badge');

function _setEarPanelPassive(passive) {
  if (btnStart)       btnStart.style.display  = passive ? 'none' : '';
  if (btnStop)        btnStop.style.display   = 'none';
  if (btnExpand)      btnExpand.style.display = passive ? 'none' : '';
  if (earFsActiveBadge) earFsActiveBadge.style.display = passive ? '' : 'none';
}

if (btnExpand) {
  btnExpand.addEventListener('click', async () => {
    if (!window.Billing?.canStartSession()) {
      window.Billing?.showUpgradeModal();
      return;
    }
    const profile     = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
    const interviewId = window.getEarSelectedId?.() || null;
    await window.klinch.invoke('ear:fullscreen-launch', {
      interviewId,
      returnTo: 'dashboard',
      roleType: profile.role_type || '',
    });
    _setEarPanelPassive(true);
    window.Billing?.consumeCredit();
  });
}

// Main process → start STT for full-screen Ear session
window.klinch.on('ear:do-start', async ({ interviewId } = {}) => {
  await window.STT?.startSession(interviewId || null);
});

// Main process → stop STT and generate feedback for full-screen Ear session
window.klinch.on('ear:do-stop', async ({ interviewId } = {}) => {
  await window.STT?.stopSession();
  window.klinch.invoke('interview:feedback', { interviewId: interviewId || null }).catch(console.error);
});

// Main process → overlay minimized (no exit modal — just restore panel)
window.klinch.on('ear:fs-minimized', () => {
  _setEarPanelPassive(false);
});

// Main process → full-screen session ended: navigate back + show exit modal
window.klinch.on('ear:fs-closed', ({ returnTo, interviewId, markComplete } = {}) => {
  _setEarPanelPassive(false);
  transcriptLines = [];
  renderTranscript();

  if (markComplete && interviewId) {
    window._completeInterview?.(interviewId);
  }

  if (returnTo === 'interviews' && interviewId) {
    window.navigateTo?.('interviews');
    setTimeout(() => window.InterviewsPage?.openDetail(interviewId), 80);
  } else if (returnTo === 'calendar' && interviewId) {
    window.navigateTo?.('interviews');
    setTimeout(() => window.InterviewsPage?.openDetail(interviewId), 80);
  } else if (interviewId) {
    window.navigateTo?.('interviews');
    setTimeout(() => window.InterviewsPage?.openDetail(interviewId), 80);
  } else {
    window.navigateTo?.('dashboard');
  }
});

// ── Post-session exit modal ───────────────────────────────────────────────────

(function() {
  const backdrop      = document.getElementById('ear-exit-backdrop');
  const subtitle      = document.getElementById('ear-exit-subtitle');
  const completeLabel = document.getElementById('ear-exit-complete-label');
  const completeTitle = document.getElementById('ear-exit-complete-title');
  const completeBox   = document.getElementById('ear-exit-complete-box');
  const notesInput    = document.getElementById('ear-exit-notes');
  const saveBtn       = document.getElementById('ear-exit-save-btn');
  const skipBtn       = document.getElementById('ear-exit-skip-btn');

  let _activeInterviewId = null;
  let _markedComplete    = false;

  function _saveNotes() {
    if (!_activeInterviewId) return;
    const notes = notesInput?.value?.trim();
    if (!notes) return;
    const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const idx = all.findIndex(x => String(x.id) === String(_activeInterviewId));
    if (idx < 0) return;
    all[idx].post_session_notes = notes;
    all[idx].updated_at = new Date().toISOString();
    localStorage.setItem('klinch_interviews', JSON.stringify(all));
  }

  function _close() {
    _saveNotes();
    backdrop?.classList.remove('visible');
    _activeInterviewId = null;
    _markedComplete    = false;
    if (notesInput)    notesInput.value = '';
    if (completeLabel) completeLabel.classList.remove('checked');
  }

  window._showEarExitModal = function(interviewId, preMarkComplete = false) {
    if (!backdrop) return;
    _activeInterviewId = interviewId || null;
    _markedComplete    = preMarkComplete;
    if (notesInput) notesInput.value = '';
    if (completeLabel) completeLabel.classList.toggle('checked', preMarkComplete);

    if (interviewId) {
      const interviews = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
      const iv = interviews.find(x => String(x.id) === String(interviewId));
      if (iv) {
        const company = iv.company?.name || 'your interview';
        const stage   = iv.stage   || 'Interview';
        if (subtitle)      subtitle.textContent      = `${company} — ${stage}`;
        if (completeTitle) completeTitle.textContent = `Mark "${stage} at ${company}" as complete`;
      }
      if (preMarkComplete) window._completeInterview?.(interviewId);
    }

    backdrop.classList.add('visible');
    setTimeout(() => notesInput?.focus(), 180);
  };

  completeLabel?.addEventListener('click', () => {
    _markedComplete = !_markedComplete;
    completeLabel.classList.toggle('checked', _markedComplete);
    if (_markedComplete && _activeInterviewId) {
      const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
      const idx = all.findIndex(x => String(x.id) === String(_activeInterviewId));
      if (idx !== -1 && all[idx].status !== 'completed') {
        all[idx].status     = 'completed';
        all[idx].updated_at = new Date().toISOString();
        localStorage.setItem('klinch_interviews', JSON.stringify(all));
        document.dispatchEvent(new CustomEvent('interview:completed', { detail: { id: _activeInterviewId } }));
        window.refreshDashboardStats?.();
      }
    }
  });

  notesInput?.addEventListener('blur', _saveNotes);

  skipBtn?.addEventListener('click', _close);
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) _close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && backdrop?.classList.contains('visible')) _close();
  });
})();
