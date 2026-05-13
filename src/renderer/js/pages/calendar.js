window.CalendarPage = (() => {
  'use strict';

  let _view   = 'month';
  let _cursor = new Date();

  function _el(id) { return document.getElementById(id); }
  function _esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  // ── Data ──────────────────────────────────────────────────────────────────

  function _getAll() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  }

  function _saveAll(all) {
    localStorage.setItem('klinch_interviews', JSON.stringify(all));
  }

  // ── Time helpers ──────────────────────────────────────────────────────────

  function _hasTime(iv)  { return Boolean(iv.scheduled_at?.includes('T')); }
  function _dateStr(iv)  { return iv.scheduled_at?.slice(0, 10) ?? null; }

  function _timeStr(iv) {
    if (!_hasTime(iv)) return null;
    const [, t] = iv.scheduled_at.split('T');
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  function _reminderStatus(iv) {
    if (!_hasTime(iv)) return null;
    const diff = new Date(iv.scheduled_at) - Date.now();
    if (diff <= 0)    return null;
    if (diff < 36e5)  return 'red';
    if (diff < 864e5) return 'amber';
    return null;
  }

  function _toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function _getMondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function _addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function _sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  // ── Shared UI atoms ───────────────────────────────────────────────────────

  function _rdot(iv) {
    const s = _reminderStatus(iv);
    return s ? `<span class="cal-rdot cal-rdot-${s}"></span>` : '';
  }

  function _logoHtml(iv, size) {
    const name = iv.company?.name || '?';
    const logo = iv.company?.logo_url && !iv.company?.screenshot_mode ? iv.company.logo_url : '';
    const init = (name[0] || '?').toUpperCase();
    const bc   = iv.company?.brand_color || '';
    const bcExtra = bc ? `;background:${bc}26;color:${bc}` : '';
    const fb   = `<span class="cal-logo-fb" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.5)}px;display:none${bcExtra}">${_esc(init)}</span>`;
    return logo
      ? `<img src="${_esc(logo)}" class="cal-logo" width="${size}" height="${size}" alt=""
             onerror="this.style.display='none';this.nextSibling.style.display='flex'">${fb}`
      : `<span class="cal-logo-fb" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.5)}px${bcExtra}">${_esc(init)}</span>`;
  }

  // ── Month view ────────────────────────────────────────────────────────────

  function _renderMonth() {
    const ivs   = _getAll();
    const year  = _cursor.getFullYear();
    const month = _cursor.getMonth();

    _el('cal-title').textContent = `${MONTH_NAMES[month]} ${year}`;

    if (!ivs.length) { _renderEmpty(); return; }

    const gridStart = _getMondayOf(new Date(year, month, 1));
    const today     = new Date(); today.setHours(0,0,0,0);

    const byDate = new Map();
    ivs.forEach(iv => {
      const ds = _dateStr(iv);
      if (!ds) return;
      if (!byDate.has(ds)) byDate.set(ds, []);
      byDate.get(ds).push(iv);
    });

    const cells = Array.from({ length: 42 }, (_, i) => _addDays(gridStart, i));

    _el('cal-body').innerHTML = `
      <div class="cal-month">
        <div class="cal-month-head">
          ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d =>
            `<div class="cal-col-hdr">${d}</div>`).join('')}
        </div>
        <div class="cal-month-grid">
          ${cells.map(cell => {
            const ds      = _toDateStr(cell);
            const inMonth = cell.getMonth() === month;
            const isToday = _sameDay(cell, today);
            const dayIvs  = byDate.get(ds) || [];
            const iconSz  = dayIvs.length === 1 ? 52 : dayIvs.length <= 3 ? 32 : 22;
            return `
              <div class="cal-day${inMonth ? '' : ' cal-day-out'}${dayIvs.length ? ' cal-day-lit' : ''}">
                <div class="cal-day-num${isToday ? ' cal-day-today' : ''}">${cell.getDate()}</div>
                <div class="cal-day-logos">
                  ${dayIvs.map(iv => `
                  <div class="cal-logo-dot" data-iv="${_esc(iv.id)}" title="${_esc(iv.company?.name || 'Interview')}" style="width:${iconSz}px;height:${iconSz}px">
                    ${_rdot(iv)}${_logoHtml(iv, iconSz)}
                  </div>`).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;

    _el('cal-body').querySelectorAll('[data-iv]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const iv = _getAll().find(x => x.id === el.dataset.iv);
        if (iv) _openPopover(iv, el);
      });
    });
  }

  // ── Day view ──────────────────────────────────────────────────────────────

  const W_START  = 8;
  const W_END    = 20;
  const SLOT_H   = 64;
  const W_DAYS   = ['Mon','Tue','Wed','Thu','Fri'];

  function _renderDay() {
    const ivs   = _getAll();
    const today = new Date(); today.setHours(0,0,0,0);
    const day   = new Date(_cursor); day.setHours(0,0,0,0);
    const isToday = _sameDay(day, today);

    _el('cal-title').textContent = day.toLocaleDateString('en-US',
      { weekday:'long', month:'long', day:'numeric', year:'numeric' });

    if (!ivs.length) { _renderEmpty(); return; }

    const gridH  = (W_END - W_START) * SLOT_H;
    const dayIvs = ivs.filter(iv => _dateStr(iv) === _toDateStr(day));

    const timeLabels = Array.from({ length: W_END - W_START + 1 }, (_, i) => {
      const h = W_START + i;
      const label = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h-12} PM`;
      return `<div class="cal-tlbl" style="top:${i*SLOT_H}px">${label}</div>`;
    }).join('');

    const gridLines = Array.from({ length: W_END - W_START + 1 }, (_, i) =>
      `<div class="cal-hline" style="top:${i*SLOT_H}px"></div>`
    ).join('');

    let nowLine = '';
    if (isToday) {
      const now = new Date();
      const nowH = now.getHours() + now.getMinutes() / 60;
      if (nowH >= W_START && nowH <= W_END)
        nowLine = `<div class="cal-now-line" style="top:${(nowH-W_START)*SLOT_H}px"></div>`;
    }

    _el('cal-body').innerHTML = `
      <div class="cal-week">
        <div class="cal-week-head cal-day-head">
          <div class="cal-tgutter-corner"></div>
          <div class="cal-wk-hdr${isToday ? ' cal-wk-hdr-today' : ''}" style="flex:1">
            <span class="cal-wk-day">${day.toLocaleDateString('en-US',{weekday:'short'})}</span>
            <span class="cal-wk-num${isToday ? ' cal-day-today' : ''}">${day.getDate()}</span>
          </div>
        </div>
        <div class="cal-week-scroll" id="cal-week-scroll">
          <div class="cal-week-inner" style="height:${gridH}px">
            <div class="cal-tgutter">${timeLabels}</div>
            <div class="cal-week-events">
              ${gridLines}
              <div class="cal-wcol${isToday ? ' cal-wcol-today' : ''}" style="flex:1">
                ${nowLine}${dayIvs.map(iv => _weekCardHtml(iv)).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    requestAnimationFrame(() => {
      const sc = _el('cal-week-scroll');
      if (!sc) return;
      const now = new Date();
      const target = (isToday && now.getHours() >= W_START && now.getHours() < W_END)
        ? now.getHours() - 1 : 8;
      sc.scrollTop = Math.max(0, (target - W_START) * SLOT_H);
    });

    _el('cal-body').querySelectorAll('[data-iv]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const iv = _getAll().find(x => x.id === el.dataset.iv);
        if (iv) _openPopover(iv, el);
      });
    });
  }

  // ── Week view ─────────────────────────────────────────────────────────────

  function _renderWeek() {
    const ivs   = _getAll();
    const mon   = _getMondayOf(_cursor);
    const fri   = _addDays(mon, 4);
    const today = new Date(); today.setHours(0,0,0,0);

    const fmt = { month: 'short', day: 'numeric' };
    _el('cal-title').textContent =
      `${mon.toLocaleDateString('en-US', fmt)} – ${fri.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })}`;

    if (!ivs.length) { _renderEmpty(); return; }

    const weekDates = Array.from({ length: 5 }, (_, i) => _addDays(mon, i));
    const gridH     = (W_END - W_START) * SLOT_H;

    // Time gutter labels
    const timeLabels = Array.from({ length: W_END - W_START + 1 }, (_, i) => {
      const h = W_START + i;
      const label = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h-12} PM`;
      return `<div class="cal-tlbl" style="top:${i * SLOT_H}px">${label}</div>`;
    }).join('');

    // Horizontal grid lines
    const gridLines = Array.from({ length: W_END - W_START + 1 }, (_, i) =>
      `<div class="cal-hline" style="top:${i * SLOT_H}px"></div>`
    ).join('');

    // Day columns
    const cols = weekDates.map((day, di) => {
      const isToday = _sameDay(day, today);
      const dayIvs  = ivs.filter(iv => _dateStr(iv) === _toDateStr(day));

      let nowLine = '';
      if (isToday) {
        const now = new Date();
        const nowH = now.getHours() + now.getMinutes() / 60;
        if (nowH >= W_START && nowH <= W_END)
          nowLine = `<div class="cal-now-line" style="top:${(nowH-W_START)*SLOT_H}px"></div>`;
      }

      return `<div class="cal-wcol${isToday ? ' cal-wcol-today' : ''}">
        ${nowLine}${dayIvs.map(iv => _weekCardHtml(iv)).join('')}
      </div>`;
    }).join('');

    // Column headers
    const headers = weekDates.map((day, di) => {
      const isToday = _sameDay(day, today);
      return `<div class="cal-wk-hdr${isToday ? ' cal-wk-hdr-today' : ''}">
        <span class="cal-wk-day">${W_DAYS[di]}</span>
        <span class="cal-wk-num${isToday ? ' cal-day-today' : ''}">${day.getDate()}</span>
      </div>`;
    }).join('');

    _el('cal-body').innerHTML = `
      <div class="cal-week">
        <div class="cal-week-head">
          <div class="cal-tgutter-corner"></div>
          ${headers}
        </div>
        <div class="cal-week-scroll" id="cal-week-scroll">
          <div class="cal-week-inner" style="height:${gridH}px">
            <div class="cal-tgutter">${timeLabels}</div>
            <div class="cal-week-events">${gridLines}${cols}</div>
          </div>
        </div>
      </div>`;

    // Scroll to current time or 9 AM
    requestAnimationFrame(() => {
      const sc = _el('cal-week-scroll');
      if (!sc) return;
      const now = new Date();
      const target = (_sameDay(now, today) && now.getHours() >= W_START && now.getHours() < W_END)
        ? now.getHours() - 1 : 8;
      sc.scrollTop = Math.max(0, (target - W_START) * SLOT_H);
    });

    _el('cal-body').querySelectorAll('[data-iv]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const iv = _getAll().find(x => x.id === el.dataset.iv);
        if (iv) _openPopover(iv, el);
      });
    });
  }

  function _weekCardHtml(iv) {
    const noTime = !_hasTime(iv);
    let topPx;
    if (noTime) {
      topPx = (9 - W_START) * SLOT_H + 2;
    } else {
      const [, t] = iv.scheduled_at.split('T');
      const [h, m] = t.split(':').map(Number);
      topPx = ((h + m/60) - W_START) * SLOT_H + 2;
    }
    const iw1 = iv.interviewers?.[0]?.name || '';
    const cls  = STAGE_BADGE[iv.stage] || 'badge-recruiter';
    return `
      <div class="cal-wcard${noTime ? ' cal-wcard-notime' : ''}" data-iv="${_esc(iv.id)}"
           style="top:${topPx}px;height:${SLOT_H-4}px">
        ${_rdot(iv)}${_logoHtml(iv, 14)}
        <div class="cal-wcard-body">
          <div class="cal-wcard-co">${_esc(iv.company?.name || 'Interview')}</div>
          ${iw1 ? `<div class="cal-wcard-iw">${_esc(iw1)}</div>` : ''}
          ${noTime ? `<div class="cal-wcard-notlbl">⏰ Tap to set time</div>` : ''}
        </div>
        <span class="icard-stage-badge ${cls} cal-wcard-badge">${_esc(iv.stage||'')}</span>
      </div>`;
  }

  // ── Popover ───────────────────────────────────────────────────────────────

  function _openPopover(iv, anchor) {
    const pop      = _el('cal-popover');
    const stageCls = STAGE_BADGE[iv.stage] || 'badge-recruiter';
    const fmtCls   = iv.format === 'Virtual' ? 'badge-virtual' : 'badge-phone';
    const role     = iv.jd?.structured?.role_title || '';
    const iws      = (iv.interviewers||[]).map(x=>x.name).filter(Boolean).join(', ') || '—';
    const timeDisp = _timeStr(iv);

    pop.innerHTML = `
      <button class="cal-pop-x" id="cal-pop-x">✕</button>
      <div class="cal-pop-co">
        ${_logoHtml(iv, 36)}
        <div class="cal-pop-co-info">
          <div class="cal-pop-co-name">${_esc(iv.company?.name||'Interview')}</div>
          ${role ? `<div class="cal-pop-role">${_esc(role)}</div>` : ''}
        </div>
      </div>
      <div class="cal-pop-rows">
        <div class="cal-pop-row"><span class="cal-pop-lbl">With</span><span class="cal-pop-val">${_esc(iws)}</span></div>
        <div class="cal-pop-row">
          <span class="cal-pop-lbl">Time</span>
          ${timeDisp
            ? `<span class="cal-pop-val">${_esc(timeDisp)}</span>`
            : `<span class="cal-pop-val cal-pop-notime">
                Not set &nbsp;
                <input type="time" class="cal-pop-ti" id="cal-pop-ti">
                <button class="cal-pop-savetime" id="cal-pop-st">Save</button>
               </span>`}
        </div>
        <div class="cal-pop-row"><span class="cal-pop-lbl">Stage</span><span class="icard-stage-badge ${stageCls}">${_esc(iv.stage||'')}</span></div>
        <div class="cal-pop-row"><span class="cal-pop-lbl">Format</span><span class="icard-format-badge ${fmtCls}">${_esc(iv.format||'Virtual')}</span></div>
      </div>
      <button class="hero-cta cal-pop-ear" id="cal-pop-ear"
              style="margin-top:0;width:100%;padding:9px;font-size:12px;justify-content:center">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="3" width="12" height="8" rx="2"/><circle cx="7" cy="7" r="2"/>
        </svg>
        Launch Klinch Ear
      </button>`;

    pop.style.display = 'block';

    // Smart position (prefer right of anchor, flip left if off-screen)
    const rect = anchor.getBoundingClientRect();
    const pw = 280;
    let left = rect.right + 10;
    let top  = rect.top;
    if (left + pw > window.innerWidth - 16) left = rect.left - pw - 10;
    if (left < 16) left = 16;
    // Measure after paint so offsetHeight is real
    requestAnimationFrame(() => {
      const ph = pop.offsetHeight;
      if (top + ph > window.innerHeight - 16) top = window.innerHeight - ph - 16;
      if (top < 60) top = 60;
      pop.style.left = `${left}px`;
      pop.style.top  = `${top}px`;
    });
    pop.style.left = `${left}px`;
    pop.style.top  = `${top}px`;

    _el('cal-pop-x').onclick = _closePopover;
    _el('cal-pop-ear').onclick = async () => {
      if (!window.Billing?.canStartSession()) { window.Billing?.showUpgradeModal(); return; }
      const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
      await window.klinch.invoke('ear:fullscreen-launch', {
        interviewId: iv.id || null,
        returnTo:    'calendar',
        roleType:    profile.role_type || '',
      });
      window.Billing?.consumeCredit();
      _closePopover();
    };

    const saveBtn = _el('cal-pop-st');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const val = _el('cal-pop-ti').value;
        if (!val) return;
        const all = _getAll();
        const idx = all.findIndex(x => x.id === iv.id);
        if (idx !== -1) {
          const ds = all[idx].scheduled_at?.slice(0,10) || _toDateStr(new Date());
          all[idx].scheduled_at = `${ds}T${val}`;
          _saveAll(all);
        }
        _closePopover();
        _render();
      };
    }
  }

  function _closePopover() {
    const pop = _el('cal-popover');
    if (pop) pop.style.display = 'none';
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────

  function _renderSidebar() {
    const sb = _el('cal-sb');
    if (!sb) return;

    const upcoming = _getAll()
      .filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) > new Date())
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
      .slice(0, 5);

    if (!upcoming.length) {
      sb.innerHTML = `<div class="cal-sb-title">Upcoming</div><div class="cal-sb-empty">No upcoming interviews</div>`;
      return;
    }

    sb.innerHTML = `
      <div class="cal-sb-title">Upcoming</div>
      ${upcoming.map(iv => {
        const cls  = STAGE_BADGE[iv.stage] || 'badge-recruiter';
        const role = iv.jd?.structured?.role_title || iv.stage || '';
        const dt   = new Date(iv.scheduled_at);
        const date = dt.toLocaleDateString('en-US', { month:'short', day:'numeric' });
        const time = _timeStr(iv);
        const dot  = _reminderStatus(iv);
        return `
          <div class="cal-sb-item">
            <div class="cal-sb-top">
              ${_logoHtml(iv, 28)}
              <div class="cal-sb-info">
                <div class="cal-sb-co">${_esc(iv.company?.name||'Interview')}
                  ${dot ? `<span class="cal-rdot cal-rdot-${dot}" style="margin-left:4px"></span>` : ''}
                </div>
                ${role ? `<div class="cal-sb-role">${_esc(role)}</div>` : ''}
              </div>
            </div>
            <div class="cal-sb-meta">
              <span class="cal-sb-date">${date}${time ? ' · '+time : ''}</span>
              <span class="icard-stage-badge ${cls}" style="font-size:9px;padding:2px 5px">${_esc(iv.stage||'')}</span>
            </div>
            <button class="cal-sb-ear" data-iv="${_esc(iv.id)}">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="1" y="3" width="12" height="8" rx="2"/><circle cx="7" cy="7" r="2"/>
              </svg>
              Launch Klinch Ear
            </button>
          </div>`;
      }).join('')}`;

    sb.querySelectorAll('.cal-sb-ear').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!window.Billing?.canStartSession()) { window.Billing?.showUpgradeModal(); return; }
        const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
        await window.klinch.invoke('ear:fullscreen-launch', {
          interviewId: btn.dataset.iv || null,
          returnTo:    'calendar',
          roleType:    profile.role_type || '',
        });
        window.Billing?.consumeCredit();
      });
    });
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  function _renderEmpty() {
    _el('cal-body').innerHTML = `
      <div class="cal-empty">
        <svg width="52" height="52" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25">
          <rect x="4" y="8" width="40" height="36" rx="4"/>
          <path d="M16 4v8M32 4v8M4 20h40"/>
        </svg>
        <div class="cal-empty-title">No interviews scheduled</div>
        <div class="cal-empty-sub">Add your first interview to get started.</div>
        <button class="hero-cta add-interview-trigger" style="margin-top:0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 1v12M1 7h12"/>
          </svg>
          Add Interview
        </button>
      </div>`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function _render() {
    _closePopover();
    _el('cal-toggle-day')?.classList.toggle('cal-tog-on',   _view === 'day');
    _el('cal-toggle-week')?.classList.toggle('cal-tog-on',  _view === 'week');
    _el('cal-toggle-month')?.classList.toggle('cal-tog-on', _view === 'month');
    if (_view === 'day')   _renderDay();
    else if (_view === 'week') _renderWeek();
    else _renderMonth();
    _renderSidebar();
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function _prev() {
    if (_view === 'month') _cursor = new Date(_cursor.getFullYear(), _cursor.getMonth() - 1, 1);
    else if (_view === 'week') _cursor = _addDays(_cursor, -7);
    else _cursor = _addDays(_cursor, -1);
    _render();
  }

  function _next() {
    if (_view === 'month') _cursor = new Date(_cursor.getFullYear(), _cursor.getMonth() + 1, 1);
    else if (_view === 'week') _cursor = _addDays(_cursor, 7);
    else _cursor = _addDays(_cursor, 1);
    _render();
  }

  // ── Public ────────────────────────────────────────────────────────────────

  function refresh() { _render(); }

  function reset() {
    _cursor = new Date();
    _view   = 'month';
    _render();
  }

  function init() {
    _el('cal-prev')?.addEventListener('click', _prev);
    _el('cal-next')?.addEventListener('click', _next);
    _el('cal-today')?.addEventListener('click', () => { _cursor = new Date(); _render(); });
    _el('cal-toggle-day')?.addEventListener('click',   () => { _view = 'day';   _render(); });
    _el('cal-toggle-week')?.addEventListener('click',  () => { _view = 'week';  _render(); });
    _el('cal-toggle-month')?.addEventListener('click', () => { _view = 'month'; _render(); });

    document.addEventListener('click', e => {
      const pop = _el('cal-popover');
      if (pop?.style.display !== 'none' && !pop?.contains(e.target)) _closePopover();
    });
  }

  init();
  return { refresh, reset };
})();
