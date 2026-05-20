window.CoachPage = (() => {

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Pipeline data ─────────────────────────────────────────────────────────

  function _getPipelineData() {
    const interviews   = JSON.parse(localStorage.getItem('klinch_interviews')   || '[]');
    const applications = JSON.parse(localStorage.getItem('klinch_applications') || '[]');
    const now          = new Date();

    const isCompleted = iv =>
      iv.status === 'completed' ||
      (iv.scheduled_at && new Date(iv.scheduled_at) < now && iv.status !== 'pending');

    const completed = interviews.filter(isCompleted);
    const upcoming  = interviews.filter(iv =>
      !isCompleted(iv) && iv.scheduled_at && new Date(iv.scheduled_at) >= now
    );
    const offers  = applications.filter(a => a.status === 'Offer');
    const active  = applications.filter(a => !['Withdrawn', 'Rejected'].includes(a.status));
    const winRate = applications.length
      ? Math.round((offers.length / applications.length) * 100)
      : null;

    const responseTimes = applications
      .filter(a => a.date_applied && a.date_first_interview)
      .map(a => {
        const d1 = new Date(a.date_applied        + 'T00:00:00');
        const d2 = new Date(a.date_first_interview + 'T00:00:00');
        return Math.max(0, Math.round((d2 - d1) / 86400000));
      });
    const avgResponse = responseTimes.length
      ? Math.round(responseTimes.reduce((s, d) => s + d, 0) / responseTimes.length)
      : null;

    return { interviews, applications, completed, upcoming, offers, active, winRate, avgResponse };
  }

  // ── Section 1 — Pipeline Health ───────────────────────────────────────────

  function _renderHealth(data) {
    const grid = document.getElementById('coach-health-grid');
    if (!grid) return;

    const stats = [
      {
        label: 'Active Applications',
        value: data.active.length,
        sub:   data.applications.length ? `${data.applications.length} total` : 'None yet',
      },
      {
        label: 'Interviews Completed',
        value: data.completed.length,
        sub:   data.completed.length === 1 ? '1 interview done' : `${data.completed.length} interviews done`,
      },
      {
        label: 'Interviews Upcoming',
        value: data.upcoming.length,
        sub:   data.upcoming.length ? 'On your calendar' : 'Nothing scheduled',
      },
      {
        label: 'Offers Received',
        value: data.offers.length,
        sub:   data.offers.length ? '🎉 Congratulations' : 'Keep pushing',
      },
      {
        label: 'Win Rate',
        value: data.winRate !== null ? `${data.winRate}%` : '—',
        sub:   'Offers ÷ applications',
      },
      {
        label: 'Avg Response Time',
        value: data.avgResponse !== null ? `${data.avgResponse} days` : '—',
        sub:   'Applied → first interview',
      },
    ];

    const NAV_TARGETS = {
      'Active Applications':  'applications',
      'Interviews Completed': 'interviews',
      'Interviews Upcoming':  'interviews',
    };

    grid.innerHTML = stats.map(s => {
      const nav = NAV_TARGETS[s.label];
      return `
        <div class="card coach-stat-card"${nav ? ` data-nav="${nav}"` : ''}>
          <div class="card-label">${_esc(s.label)}</div>
          <div class="card-value">${_esc(String(s.value))}</div>
          <div class="card-sub">${_esc(s.sub)}</div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.coach-stat-card[data-nav]').forEach(card => {
      card.addEventListener('click', () => window.navigateTo?.(card.dataset.nav));
    });
  }

  // ── Section 2 — Outreach Actions ─────────────────────────────────────────

  const OUTREACH_CACHE_KEY   = 'klinch_coach_outreach';
  const TRANSCRIPT_MAX_CHARS = 8000; // ≈2 000 tokens

  let _outreachFilter        = null;  // 'pre' | 'post'
  let _outreachFilterUserSet = false;
  let _cardMap               = new Map(); // cacheKey → card descriptor

  function _truncateTranscript(sessions, maxChars) {
    const lines = [];
    for (const s of (sessions || [])) {
      for (const entry of (s.transcript || [])) {
        lines.push(`${entry.speaker || 'Speaker'}: ${entry.text || ''}`);
      }
    }
    const full = lines.join('\n');
    return full.length > maxChars ? full.slice(0, maxChars) + '…' : full;
  }

  function _computeDueLabel(iv, type) {
    const now = new Date();
    if (type === 'post') {
      const completedAt = iv.completed_at
        ? new Date(iv.completed_at)
        : (iv.scheduled_at ? new Date(iv.scheduled_at) : null);
      if (!completedAt) return null;
      const dueAt  = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
      const diffMs = dueAt - now;
      if (diffMs <= 0) {
        const d = Math.floor(-diffMs / 86400000);
        return d < 1 ? { label: 'Overdue', cls: 'due-overdue' } : { label: `Overdue ${d}d`, cls: 'due-overdue' };
      }
      const hrs = Math.ceil(diffMs / 3600000);
      return hrs <= 1
        ? { label: 'Due now',        cls: 'due-today' }
        : { label: `Due in ${hrs}h`, cls: 'due-today' };
    } else {
      const scheduledAt = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
      if (!scheduledAt) return null;
      const diffMs = scheduledAt - now;
      if (diffMs <= 0) return null;
      const hrs  = Math.floor(diffMs / 3600000);
      const days = Math.floor(hrs / 24);
      if (hrs < 24)  return { label: `In ${hrs}h`,  cls: 'due-today' };
      if (days === 1) return { label: 'Tomorrow',    cls: '' };
      return { label: `In ${days}d`, cls: '' };
    }
  }

  function _buildSystemPrompt(type, stage, hasTranscript) {
    const s = (stage || '').toLowerCase();

    if (type === 'pre') {
      const stageTone = s.includes('recruiter') || s.includes('screen') || s.includes('phone')
        ? 'This is an upcoming recruiter screen. Keep the tone casual, warm, and brief.'
        : s.includes('panel') || s.includes('loop') || s.includes('onsite')
          ? 'This is an upcoming panel or onsite interview. Keep the tone warm and genuine.'
          : 'This is an upcoming hiring manager interview. Be warm, confident, and concise.';
      const ref = `${stageTone} Use the candidate and interviewer details provided to personalize the message. Do not reference the interview as if it already happened.`;
      return `You are an expert career coach. Write a casual, warm LinkedIn message (1–2 sentences max) expressing excitement about an upcoming job interview. ${ref} Do NOT use post-interview language such as "enjoyed our conversation", "left feeling energized", or "looking forward to next steps" — those belong in a post-interview follow-up. Return the message text only — no greeting, no sign-off, no preamble.`;
    }

    const stageTone = s.includes('recruiter') || s.includes('screen') || s.includes('phone')
      ? 'This was an early-stage recruiter screen. Keep the tone warm, enthusiastic, and brief.'
      : s.includes('panel') || s.includes('loop') || s.includes('onsite')
        ? "This was a panel or onsite interview. Express appreciation for everyone's time and mention the collaborative energy."
        : 'This was a hiring manager interview. Be confident, personal, and forward-looking.';

    const ref = hasTranscript
      ? 'Reference at least one specific detail from the transcript excerpt below — a topic discussed, a question asked, or a moment of connection — to make the message feel genuinely personal. Do not fabricate details not present in the transcript.'
      : `No transcript is available. ${stageTone} Write a warm message that sounds personal without fabricating details.`;

    return `You are an expert career coach. Write a warm, brief LinkedIn follow-up message after a job interview. ${ref} Return the message text only, no greeting, no sign-off, no preamble.`;
  }

  function _buildEmailSystemPrompt(type, stage, hasTranscript) {
    const s = (stage || '').toLowerCase();

    if (type === 'pre') {
      const stageTone = s.includes('recruiter') || s.includes('screen') || s.includes('phone')
        ? 'This is an upcoming recruiter screen.'
        : s.includes('panel') || s.includes('loop') || s.includes('onsite')
          ? 'This is an upcoming panel or onsite interview.'
          : 'This is an upcoming hiring manager interview.';
      const ref = `${stageTone} Use the candidate, interviewer, company, and role details provided to personalize the message. Do not reference the interview as if it already happened.`;
      return `Write a brief pre-interview email (3–4 sentences max). ${ref} Tone: warm, genuine, and human — like a quick note fired off the day before. Thank them for the calendar invite or opportunity to chat. Express genuine excitement about the upcoming conversation. Write a short, direct subject line. Do NOT include commentary on company culture, growth trajectory, or anything that would only make sense after the interview. Do NOT use post-interview language such as "enjoyed our conversation", "left feeling energized", or "looking forward to next steps". First line must be "Subject: <subject>". Return email text only, no preamble.`;
    }

    const stageTone = s.includes('recruiter') || s.includes('screen') || s.includes('phone')
      ? 'This was an early-stage recruiter screen. Keep the tone warm, brief, and enthusiastic.'
      : s.includes('panel') || s.includes('loop') || s.includes('onsite')
        ? "This was a panel or onsite interview. Express genuine appreciation for everyone's time."
        : 'This was a hiring manager interview. Be confident, specific, and forward-looking.';

    const ref = hasTranscript
      ? 'Reference at least one specific detail from the transcript excerpt below to make the email feel genuinely personal. Do not fabricate details.'
      : `No transcript is available. ${stageTone} Write a message that sounds personal without fabricating details.`;

    return `Write a short personalized thank-you email after a job interview. ${ref} First line must be "Subject: <subject>". Return email text only, no preamble.`;
  }

  function _getOutreachCards() {
    const interviews   = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const now          = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const cards        = [];

    for (const iv of interviews) {
      const scheduled   = iv.scheduled_at ? new Date(iv.scheduled_at) : null;
      const isCompleted = iv.status === 'completed' ||
        (scheduled && scheduled < now && iv.status !== 'pending');

      if (!isCompleted && scheduled && scheduled >= now && iv.status === 'pending') {
        if (!iv.outreach_pre_sent) {
          cards.push({ iv, sessionIdx: null, session: null, type: 'pre', cacheKey: `${iv.id}_pre` });
        }
        continue;
      }

      if (isCompleted) {
        const completedDate = iv.completed_at ? new Date(iv.completed_at) : scheduled;
        if (!completedDate || completedDate < sevenDaysAgo) continue;

        const sessions     = iv.sessions || [];
        const sentSessions = iv.outreach_sessions_sent || {};

        if (sessions.length > 0) {
          sessions.forEach((session, idx) => {
            if (!sentSessions[String(idx)]) {
              cards.push({ iv, sessionIdx: idx, session, type: 'post', cacheKey: `${iv.id}_s${idx}_post` });
            }
          });
        } else if (!iv.outreach_post_sent) {
          cards.push({ iv, sessionIdx: null, session: null, type: 'post', cacheKey: `${iv.id}_post` });
        }
      }
    }

    cards.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'post' ? -1 : 1;
      const da = a.iv.completed_at || a.iv.scheduled_at || 0;
      const db = b.iv.completed_at || b.iv.scheduled_at || 0;
      return new Date(db) - new Date(da);
    });

    return cards;
  }

  function _getSentCards() {
    const interviews   = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cards        = [];

    for (const iv of interviews) {
      if (iv.outreach_pre_sent && new Date(iv.outreach_pre_sent) >= sevenDaysAgo) {
        cards.push({ iv, sessionIdx: null, session: null, type: 'pre', cacheKey: `${iv.id}_pre` });
      }
      const sessions     = iv.sessions || [];
      const sentSessions = iv.outreach_sessions_sent || {};
      sessions.forEach((session, idx) => {
        const sentAt = sentSessions[String(idx)];
        if (sentAt && new Date(sentAt) >= sevenDaysAgo) {
          cards.push({ iv, sessionIdx: idx, session, type: 'post', cacheKey: `${iv.id}_s${idx}_post` });
        }
      });
      if (!sessions.length && iv.outreach_post_sent && new Date(iv.outreach_post_sent) >= sevenDaysAgo) {
        cards.push({ iv, sessionIdx: null, session: null, type: 'post', cacheKey: `${iv.id}_post` });
      }
    }

    return cards;
  }

  function _loadOutreachCache() {
    try { return JSON.parse(localStorage.getItem(OUTREACH_CACHE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function _saveOutreachCache(cache) {
    localStorage.setItem(OUTREACH_CACHE_KEY, JSON.stringify(cache));
  }

  function _updateNavBadge(activeCards) {
    const badge = document.getElementById('coach-nav-badge');
    if (!badge) return;
    const count = activeCards.length;
    badge.textContent   = count;
    badge.style.display = count > 0 ? '' : 'none';
  }

  function _renderOutreachSection() {
    const container = document.getElementById('coach-outreach-list');
    if (!container) return;

    const allCards  = _getOutreachCards();
    const cache     = _loadOutreachCache();
    const sentCards = _getSentCards();

    if (!_outreachFilterUserSet) {
      _outreachFilter = allCards.some(c => c.type === 'post') ? 'post' : 'pre';
    }

    _updateNavBadge(allCards);

    _cardMap = new Map();
    for (const c of allCards)  _cardMap.set(c.cacheKey, c);
    for (const c of sentCards) _cardMap.set(c.cacheKey, c);

    const filtered = allCards.filter(c => c.type === _outreachFilter);

    const postCount = allCards.filter(c => c.type === 'post').length;
    const preCount  = allCards.filter(c => c.type === 'pre').length;
    const filterBar = `
      <div class="coach-outreach-filter-bar">
        <button class="coach-outreach-filter-btn${_outreachFilter === 'post' ? ' active' : ''}" data-filter="post">Post-Interview${postCount ? ` <span class="coach-filter-count">${postCount}</span>` : ''}</button>
        <button class="coach-outreach-filter-btn${_outreachFilter === 'pre'  ? ' active' : ''}" data-filter="pre">Pre-Interview${preCount  ? ` <span class="coach-filter-count">${preCount}</span>`  : ''}</button>
      </div>`;

    let activeHtml;
    if (!filtered.length) {
      const other    = _outreachFilter === 'post' ? 'pre' : 'post';
      const hasOther = allCards.some(c => c.type === other);
      activeHtml = `<div class="coach-outreach-empty">${
        hasOther
          ? `No ${_outreachFilter === 'post' ? 'post' : 'pre'}-interview outreach needed right now.`
          : 'No outreach needed right now. Check back after your next interview is scheduled.'
      }</div>`;
    } else {
      activeHtml = filtered.map(c => _buildOutreachCard(c, cache[c.cacheKey])).join('');
    }

    let archiveHtml = '';
    if (sentCards.length) {
      const archiveCards = sentCards.map(c => _buildOutreachCard(c, cache[c.cacheKey], true)).join('');
      archiveHtml = `
        <div class="coach-outreach-archive coach-outreach-archive-collapsed">
          <div class="coach-outreach-archive-header" data-toggle-archive>
            <span>Completed</span>
            <span class="coach-outreach-archive-count">${sentCards.length}</span>
            <span class="coach-outreach-archive-chevron">▾</span>
          </div>
          <div class="coach-outreach-archive-list">${archiveCards}</div>
        </div>`;
    }

    container.innerHTML = filterBar + `<div id="coach-outreach-active-list">${activeHtml}</div>` + archiveHtml;
    if (window.wireImgFallbacks) window.wireImgFallbacks(container);
    _wireOutreachEvents(container);
  }

  function _buildOutreachCard(card, cached, isArchived = false) {
    const { iv, sessionIdx, session, type } = card;
    const company  = _esc(iv.company?.name || 'Unknown Company');
    const rawRole  = iv.jd?.structured?.role_title || iv.role_title || 'Unknown Role';
    const role     = _esc(window.shortenRoleTitle?.(rawRole) ?? rawRole);
    const isPost   = type === 'post';
    const cardId   = `coach-outreach-${iv.id}-${sessionIdx !== null ? `s${sessionIdx}-` : ''}${type}`;
    const navKey   = _esc(iv.company?.domain || iv.company?.name || '');
    const initial  = (iv.company?.name || '?')[0].toUpperCase();
    const logoId   = `co-outreach-logo-${_esc(iv.id)}-${type}${sessionIdx !== null ? `-s${sessionIdx}` : ''}`;
    const ckEsc    = _esc(card.cacheKey);

    const stage            = iv.stage || '';
    const interviewerNames = (iv.interviewers || []).map(i => i.name).filter(Boolean);

    const due      = _computeDueLabel(iv, type);
    const dueBadge = due
      ? `<span class="coach-outreach-due${due.cls ? ' ' + _esc(due.cls) : ''}">${_esc(due.label)}</span>`
      : '';

    const typeLabel    = isPost ? 'Post-Interview' : 'Pre-Interview';
    const tagClass     = isPost ? 'coach-outreach-tag-post' : 'coach-outreach-tag-pre';
    const sessionLabel = sessionIdx !== null
      ? `<span class="coach-outreach-session-tag">Session ${sessionIdx + 1}</span>`
      : '';

    const metaSub = [
      stage              ? `<span class="coach-outreach-stage">${_esc(stage)}</span>` : '',
      interviewerNames.length ? `<span class="coach-outreach-ivr">${_esc(interviewerNames.join(', '))}</span>` : '',
    ].filter(Boolean).join('<span class="coach-outreach-meta-sep">·</span>');

    const logoHtml = iv.company?.logo_url && !iv.company?.screenshot_mode
      ? `<img src="${_esc(iv.company.logo_url)}" class="coach-outreach-logo-img" alt="" data-fb="${logoId}">
         <div class="coach-outreach-logo-fb" data-fb-id="${logoId}" ${window._fbHiddenStyle(iv.company)}>${initial}</div>`
      : `<div class="coach-outreach-logo-fb"${window._fbStyle(iv.company)}>${initial}</div>`;

    let contentHtml;
    if (cached?.linkedin_message) {
      contentHtml = _buildOutreachContentHtml(iv.id, type, cached, card.cacheKey);
    } else if (isArchived) {
      contentHtml = `<div class="coach-outreach-archived-note">Outreach marked as sent.</div>`;
    } else {
      contentHtml = `
        <div class="coach-outreach-generate-row">
          <button class="coach-outreach-generate-btn" data-cache-key="${ckEsc}" data-outreach-type="${type}">Generate Outreach</button>
        </div>`;
    }

    return `
      <div class="coach-outreach-card${isArchived ? ' coach-outreach-card-archived coach-outreach-card-collapsed' : ''}" id="${cardId}">
        <div class="coach-outreach-card-header" data-toggle-card="${cardId}">
          <label class="coach-outreach-checkbox-wrap" title="Mark as sent">
            <input type="checkbox" class="coach-outreach-checkbox" data-cache-key="${ckEsc}"${isArchived ? ' checked' : ''}>
            <span class="coach-outreach-checkmark"></span>
          </label>
          <div class="coach-outreach-logo-wrap" data-company-nav="${navKey}">${logoHtml}</div>
          <div class="coach-outreach-card-meta">
            <div class="coach-outreach-card-meta-top">
              <span class="coach-outreach-company" data-company-nav="${navKey}">${company}</span>
              <span class="coach-outreach-role">${role}</span>
            </div>
            ${metaSub ? `<div class="coach-outreach-card-meta-sub">${metaSub}</div>` : ''}
          </div>
          <div class="coach-outreach-card-badges">
            ${dueBadge}
            ${sessionLabel}
            <span class="coach-outreach-tag ${tagClass}">${typeLabel}</span>
            <span class="coach-outreach-chevron">▾</span>
          </div>
        </div>
        <div class="coach-outreach-card-body" id="${cardId}-body">
          ${contentHtml}
        </div>
      </div>`;
  }

  function _buildOutreachContentHtml(ivId, type, data, cacheKey) {
    const pfx      = `co-${_esc(cacheKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(data.email?.subject || '')}&body=${encodeURIComponent(data.email?.body || '')}`;
    return `
      <div class="coach-outreach-block">
        <div class="coach-outreach-block-label">LinkedIn Message</div>
        <div class="coach-outreach-copybox" id="${pfx}-li">${_esc(data.linkedin_message || '')}</div>
        <div class="coach-outreach-actions">
          <button class="coach-outreach-btn coach-outreach-btn-ghost" data-copy-id="${pfx}-li">Copy</button>
        </div>
      </div>
      <div class="coach-outreach-block">
        <div class="coach-outreach-block-label">Email</div>
        <div class="coach-outreach-copybox coach-outreach-copybox-subject" id="${pfx}-subj">${_esc(data.email?.subject || '')}</div>
        <div class="coach-outreach-copybox" id="${pfx}-body">${_esc(data.email?.body || '')}</div>
        <div class="coach-outreach-actions">
          <button class="coach-outreach-btn coach-outreach-btn-ghost" data-outreach-gmail="${_esc(gmailUrl)}">Open Gmail →</button>
          <button class="coach-outreach-btn coach-outreach-btn-ghost" data-copy-email-subj="${pfx}-subj" data-copy-email-body="${pfx}-body">Copy Email</button>
        </div>
      </div>
      <div class="coach-outreach-sent-row">
        <button class="coach-outreach-btn coach-outreach-btn-sent" data-mark-sent-key="${_esc(cacheKey)}">Mark as Sent ✓</button>
      </div>`;
  }

  function _wireOutreachEvents(list) {
    if (list.dataset.outreachWired) return;
    list.dataset.outreachWired = '1';
    list.addEventListener('click', async e => {
      // Checkbox must be checked before card-toggle so stopPropagation works
      const checkboxWrap = e.target.closest('.coach-outreach-checkbox-wrap');
      if (checkboxWrap) {
        e.stopPropagation();
        const ck   = checkboxWrap.querySelector('.coach-outreach-checkbox')?.dataset.cacheKey;
        const card = _cardMap.get(ck);
        if (card) _markSent(card.iv.id, card.type, card.sessionIdx);
        return;
      }

      const companyNav = e.target.closest('[data-company-nav]');
      if (companyNav) {
        const key = companyNav.dataset.companyNav;
        if (key && window.navigateTo && window.CompaniesPage) {
          window.navigateTo('companies');
          window.CompaniesPage.openDetail(key);
        }
        return;
      }

      const filterBtn = e.target.closest('[data-filter]');
      if (filterBtn) {
        _outreachFilter        = filterBtn.dataset.filter;
        _outreachFilterUserSet = true;
        _renderOutreachSection();
        return;
      }

      const archiveHdr = e.target.closest('[data-toggle-archive]');
      if (archiveHdr) {
        archiveHdr.closest('.coach-outreach-archive')?.classList.toggle('coach-outreach-archive-collapsed');
        return;
      }

      const toggleHdr = e.target.closest('[data-toggle-card]');
      if (toggleHdr && !e.target.closest('button') && !e.target.closest('label')) {
        const cardEl = document.getElementById(toggleHdr.dataset.toggleCard);
        cardEl?.classList.toggle('coach-outreach-card-collapsed');
        return;
      }

      const genBtn = e.target.closest('[data-outreach-type]');
      if (genBtn) {
        const card = _cardMap.get(genBtn.dataset.cacheKey);
        if (card) await _generateOutreach(card, genBtn);
        return;
      }

      const copyBtn = e.target.closest('[data-copy-id]');
      if (copyBtn) {
        const el = document.getElementById(copyBtn.dataset.copyId);
        if (el) _copyToClipboard(copyBtn, el.textContent.trim());
        return;
      }

      const gmailBtn = e.target.closest('[data-outreach-gmail]');
      if (gmailBtn) {
        window.klinch?.invoke('shell:open-external', { url: gmailBtn.dataset.outreachGmail });
        return;
      }

      const copyEmailBtn = e.target.closest('[data-copy-email-subj]');
      if (copyEmailBtn) {
        const subj = document.getElementById(copyEmailBtn.dataset.copyEmailSubj)?.textContent?.trim() || '';
        const body = document.getElementById(copyEmailBtn.dataset.copyEmailBody)?.textContent?.trim() || '';
        _copyToClipboard(copyEmailBtn, `Subject: ${subj}\n\n${body}`);
        return;
      }

      const sentBtn = e.target.closest('[data-mark-sent-key]');
      if (sentBtn) {
        const card = _cardMap.get(sentBtn.dataset.markSentKey);
        if (card) _markSent(card.iv.id, card.type, card.sessionIdx);
        return;
      }
    });
  }

  function _copyToClipboard(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  }

  async function _generateOutreach(card, btn) {
    const { iv, sessionIdx, session, type } = card;
    const cardId   = `coach-outreach-${iv.id}-${sessionIdx !== null ? `s${sessionIdx}-` : ''}${type}`;
    const cardBody = document.getElementById(`${cardId}-body`);
    if (!cardBody) return;

    btn.disabled    = true;
    btn.textContent = 'Generating…';

    const profile       = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
    const company       = iv.company?.name || 'the company';
    const role          = iv.jd?.structured?.role_title || iv.role_title || 'the role';
    const stage         = iv.stage || '';
    const candidateName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'the candidate';
    const isPost        = type === 'post';

    const ivrLines = (iv.interviewers || [])
      .map(i => [i.name, i.title].filter(Boolean).join(', '))
      .filter(Boolean);

    const dateStr = iv.scheduled_at
      ? new Date(iv.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : '';

    const sessionsForCtx = session ? [session] : (isPost ? (iv.sessions || []) : []);
    const transcriptText = _truncateTranscript(sessionsForCtx, TRANSCRIPT_MAX_CHARS);
    const feedbackText   = sessionsForCtx.map(s => s.feedback).filter(Boolean).join('\n---\n');
    const hasTranscript  = transcriptText.length > 0;

    const payload = [
      `Candidate: ${candidateName}`,
      ivrLines.length ? `Interviewer(s): ${ivrLines.join('; ')}` : '',
      `Company: ${company}`,
      `Role: ${role}`,
      stage   ? `Interview stage: ${stage}` : '',
      dateStr ? `Interview date: ${dateStr}` : '',
      hasTranscript ? `\nTranscript excerpt:\n${transcriptText}` : '',
      feedbackText  ? `\nPost-interview feedback:\n${feedbackText}` : '',
    ].filter(Boolean).join('\n');

    const liSystem    = _buildSystemPrompt(type, stage, hasTranscript);
    const emailSystem = _buildEmailSystemPrompt(type, stage, hasTranscript);

    try {
      const invoke = (system, max_tokens) => window.klinch.invoke('claude:coach', {
        model:      'claude-sonnet-4-6',
        max_tokens,
        system,
        messages:   [{ role: 'user', content: payload }],
      }).then(r => r?.content?.[0]?.text || r?.text || '');

      const [linkedin_message, emailRaw] = await Promise.all([
        invoke(liSystem,    isPost ? 200 : 80),
        invoke(emailSystem, isPost ? 400 : 200),
      ]);

      const emailLines  = emailRaw.split('\n');
      const subjectLine = emailLines.find(l => /^Subject:/i.test(l)) || 'Subject: Following up';
      const subject     = subjectLine.replace(/^Subject:\s*/i, '').trim();
      const body        = emailLines.filter(l => !/^Subject:/i.test(l)).join('\n').trim();

      const data  = { linkedin_message, email: { subject, body }, generated_at: new Date().toISOString() };
      const cache = _loadOutreachCache();
      cache[card.cacheKey] = data;
      _saveOutreachCache(cache);

      cardBody.innerHTML = _buildOutreachContentHtml(iv.id, type, data, card.cacheKey);
      document.getElementById(cardId)?.classList.remove('coach-outreach-card-collapsed');
    } catch (err) {
      console.error('[coach-outreach] generate failed:', err);
      btn.disabled    = false;
      btn.textContent = 'Generate Outreach';
    }
  }

  function _markSent(ivId, type, sessionIdx) {
    const interviews = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const idx = interviews.findIndex(x => x.id === ivId);
    if (idx === -1) return;

    if (type === 'pre') {
      interviews[idx].outreach_pre_sent = new Date().toISOString();
    } else if (sessionIdx !== null && sessionIdx !== undefined && sessionIdx !== '') {
      if (!interviews[idx].outreach_sessions_sent) interviews[idx].outreach_sessions_sent = {};
      interviews[idx].outreach_sessions_sent[String(sessionIdx)] = new Date().toISOString();
    } else {
      interviews[idx].outreach_post_sent = new Date().toISOString();
    }

    localStorage.setItem('klinch_interviews', JSON.stringify(interviews));
    _renderOutreachSection();
  }

  // ── Section 3 — Insider Tips ──────────────────────────────────────────────

  const TIPS = {
    any: [
      {
        title: 'The first 30 seconds decide everything',
        body:  'Hiring managers decide within the first 30 seconds whether they can see you on their team. Open with energy, confidence, and a clear one-line summary of who you are and what you bring. Avoid starting with your life story.',
        stage: 'Any',
      },
      {
        title: 'Prepare three stories, not thirty answers',
        body:  "You can't memorize answers to every possible question. Prepare three strong career stories that demonstrate impact, problem-solving, and resilience. Adapt them to whatever question comes up.",
        stage: 'Any',
      },
      {
        title: 'Ask one question that shows you did the work',
        body:  'Generic questions like "what does success look like" are forgettable. Reference something specific — a product launch, a recent hire, a shift in strategy. It signals you actually prepared.',
        stage: 'Any',
      },
      {
        title: 'Enthusiasm is underrated',
        body:  "Qualifications get you the interview. Genuine enthusiasm for the role often gets you the offer. Hiring managers want to hire people who want to be there — don't be afraid to show it.",
        stage: 'Any',
      },
    ],
    sdr: [
      {
        title: 'Lead with energy, not just experience',
        body:  'Recruiters screening SDRs are evaluating coachability and hunger as much as your resume. Be sharp, be direct, and show genuine excitement for the role. Flat energy on a recruiter screen is often a quiet disqualifier.',
        stage: 'Recruiter',
      },
      {
        title: 'Know why you want this company specifically',
        body:  '"I\'m looking for a high-growth SaaS company" gets you nowhere. Know their ICP, their product, and why this role at this company makes sense for where you\'re going. Recruiters can tell the difference between genuine interest and spray-and-pray.',
        stage: 'Recruiter',
      },
      {
        title: 'Show your cold call framework',
        body:  "Every SDR hiring manager will probe your prospecting approach. Have a clear, repeatable framework ready — how you open, how you handle the brush-off, how you get to a meeting. Walk them through it like you're training a new rep.",
        stage: 'Hiring Manager',
      },
      {
        title: 'Know your numbers cold',
        body:  'Average dials per day, connect rate, meetings booked, show rate, pipeline generated. If you hesitate on any of these it signals you weren\'t paying attention to your own performance. Know them before you walk in.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Prepare for the role play',
        body:  'Most SDR hiring managers will ask you to cold call them on the spot. This is not a trap — it\'s an opportunity. Welcome it. A candidate who leans in confidently immediately stands out from the majority who get flustered.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Show you can hold your own with multiple opinions',
        body:  'Panel interviews test how you handle pressure and competing personalities. Stay grounded, make eye contact with whoever is speaking, and don\'t over-agree with everyone. Confidence without arrogance is what they\'re looking for.',
        stage: 'Panel',
      },
    ],
    ae: [
      {
        title: 'Know your metrics inside out',
        body:  "Average deal size, sales cycle length, quota attainment by quarter, win rate. If you hesitate on any of these it signals you weren't paying attention to your own business. Know them before you walk in.",
        stage: 'Recruiter',
      },
      {
        title: 'Show your deal instinct',
        body:  'AE interviews live or die on deal stories. Have two or three prepared that show discovery, multi-threading, handling objections, and closing. Walk them through your thinking, not just the outcome.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Ask about the ICP',
        body:  'Asking who their best customers are and why shows you think about fit and repeatability. It also tells you whether this is a role where you can actually succeed — and signals commercial maturity to the interviewer.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Multi-threading is a differentiator',
        body:  'Most AE candidates talk about closing. The ones who get hired talk about how they build consensus across an account. Show you understand that deals are won and lost above the first contact.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Understand the competitive landscape',
        body:  'Panel interviews for AEs often include someone from product or marketing. Showing you understand how the product competes — and where it wins and loses — signals you\'re a rep who will actually use the resources available to you.',
        stage: 'Panel',
      },
    ],
    cs: [
      {
        title: 'Lead with retention and expansion, not just relationships',
        body:  'CS is a revenue function. When a recruiter asks about your experience, anchor on churn prevention, NRR, and expansion revenue — not just "I\'m a people person." Show you understand the commercial side of the role.',
        stage: 'Recruiter',
      },
      {
        title: 'Know your book of business numbers',
        body:  'GRR, NRR, number of accounts, average ARR per account, CSAT or NPS scores. CS hiring managers want to see that you treated your book like a portfolio, not a support queue.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Prepare a QBR story',
        body:  'Walk them through a QBR you ran — how you prepared, what you presented, how you handled a tough room. This is the CS equivalent of an AE deal story and most candidates underestimate how much weight it carries.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Show how you handle an at-risk account',
        body:  'Every CS leader will probe this. Have a specific story ready about an account that was churning and what you did about it. Ideally one where you saved it — but even a loss with clear lessons demonstrates maturity.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Align with the sales team story',
        body:  'CS panels often include someone from sales or product. Show you understand the handoff process and have a point of view on what makes a strong CS-to-sales relationship. Candidates who can speak to both sides of the revenue org stand out.',
        stage: 'Panel',
      },
    ],
    am: [
      {
        title: 'Show you can grow accounts, not just retain them',
        body:  'AM roles are expansion-first. Lead with upsell and cross-sell stories — specific examples where you identified an opportunity within an existing account and closed it. Retention is table stakes; growth is what they\'re hiring for.',
        stage: 'Recruiter',
      },
      {
        title: 'Know your expansion metrics',
        body:  'NRR, upsell rate, average expansion deal size, number of accounts managed. AM hiring managers want to see you tracked your book like a sales rep, not just managed relationships.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Demonstrate account planning discipline',
        body:  'Show that you build structured account plans — who the stakeholders are, where the whitespace is, what the renewal timeline looks like. Winging it on account strategy is a red flag at the AM level.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Prepare a multi-stakeholder story',
        body:  'AM panels test whether you can navigate complex accounts. Have a story ready about managing multiple stakeholders with competing priorities — and how you brought them to alignment on a renewal or expansion.',
        stage: 'Panel',
      },
    ],
    se: [
      {
        title: 'Lead with discovery, not demos',
        body:  'The best SEs win on discovery, not on how slick their demo is. In your recruiter screen, signal that you understand this — that your job is to understand the problem before you show the solution.',
        stage: 'Recruiter',
      },
      {
        title: 'Prepare a technical objection story',
        body:  'SE hiring managers want to know how you handle a prospect who pushes back technically — a skeptical IT lead, a developer who thinks they can build it themselves. Have a specific story ready where you navigated that conversation.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Show you can bridge technical and commercial',
        body:  'The best SEs speak both languages fluently. Show that you understand the business problem behind the technical requirement — and that you can translate product capabilities into business outcomes for an economic buyer.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Expect a mock demo',
        body:  'Many SE panels include a live demo or whiteboard exercise. Treat it as a discovery conversation first — ask clarifying questions before you start presenting. SEs who jump straight to showing features without understanding the use case fail this test consistently.',
        stage: 'Panel',
      },
    ],
    revops: [
      {
        title: 'Show systems thinking, not just tool knowledge',
        body:  "RevOps recruiters want to know you can think across the entire revenue funnel, not just that you know Salesforce. Lead with how you've connected marketing, sales, and CS data to drive a decision — not just which tools you've used.",
        stage: 'Recruiter',
      },
      {
        title: 'Prepare a process improvement story',
        body:  'Have a specific example of a broken process you identified and fixed — and the measurable impact it had. Pipeline accuracy, forecast improvement, rep productivity. RevOps leaders hire people who find and fix friction.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Know how to talk about data without getting lost in it',
        body:  'RevOps candidates often over-index on technical detail. Show that you can translate data into a clear business narrative. The best RevOps people make leadership smarter — they don\'t just build dashboards.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Show cross-functional influence',
        body:  'RevOps panels often include sales, marketing, and CS leaders. Show that you understand each function\'s priorities and pain points — and that you can build systems that work for all three, not just the one you came from.',
        stage: 'Panel',
      },
    ],
    marketing: [
      {
        title: 'Lead with pipeline contribution, not activity metrics',
        body:  'Marketing recruiters at SaaS companies want to see that you understand how your work connects to revenue. Lead with pipeline sourced, influenced, or accelerated — not just impressions, clicks, or MQLs.',
        stage: 'Recruiter',
      },
      {
        title: 'Know your attribution story',
        body:  'Marketing hiring managers will probe how you measure impact. Have a clear point of view on attribution — and be honest about its limitations. Candidates who pretend attribution is solved come across as naive.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Prepare a campaign story with a clear result',
        body:  "Walk them through a campaign you owned end to end — the hypothesis, the execution, the result, and what you'd do differently. This is the marketing equivalent of a deal story and it's what separates strategic marketers from order-takers.",
        stage: 'Hiring Manager',
      },
      {
        title: 'Show you understand the sales relationship',
        body:  "Marketing panels often include a sales leader. Show that you've worked closely with sales before — that you understand what makes a good lead, how feedback loops work, and that you don't just throw leads over the fence.",
        stage: 'Panel',
      },
    ],
    partnerships: [
      {
        title: 'Show you can build from zero',
        body:  "Partnerships roles often involve building a program that barely exists. Recruiters want to know you're comfortable with ambiguity and can create structure without a playbook. Lead with an example of something you built from scratch.",
        stage: 'Recruiter',
      },
      {
        title: 'Know what makes a partner relationship actually work',
        body:  'Most candidates talk about signing partners. Hiring managers care about activated partners — ones who actually drive pipeline. Show you understand the difference and have a story about how you moved a partner from signed to productive.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Prepare a co-sell story',
        body:  'Walk them through a deal you ran alongside a partner — how you coordinated, how you handled conflicts of interest, how you got to a close together. Co-sell execution is a differentiator at the hiring manager stage.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Show commercial awareness',
        body:  'Partnerships panels often include someone from sales or finance. Show that you think about partnerships as a revenue channel with real unit economics — not just a relationship-building exercise.',
        stage: 'Panel',
      },
    ],
    engineering: [
      {
        title: 'Show how you communicate across functions',
        body:  'Engineering recruiters at SaaS companies increasingly want to see that you can work with product, design, and business stakeholders — not just ship code. Lead with an example that shows cross-functional collaboration.',
        stage: 'Recruiter',
      },
      {
        title: 'Prepare a technical decision story',
        body:  'Walk them through a significant technical decision you made — the tradeoffs you considered, how you got alignment, and how it played out. Engineering hiring managers want to see judgment, not just technical skill.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Show how you handle ambiguity',
        body:  'The best engineers at SaaS companies can work with incomplete requirements and still move forward. Have a story about a time you had to make progress without having all the answers — and what you did to reduce uncertainty.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Expect a system design or coding exercise',
        body:  'Engineering panels almost always include a technical component. Treat it as a collaborative conversation — think out loud, ask clarifying questions, and show your reasoning. Getting the right answer matters less than showing how you think.',
        stage: 'Panel',
      },
    ],
    hr: [
      {
        title: 'Lead with business impact, not HR activity',
        body:  'HR candidates who lead with "I processed X offers" or "I managed Y employees" miss the mark. Lead with how your work affected retention, hiring velocity, engagement, or culture. HR is a business function — show you know it.',
        stage: 'Recruiter',
      },
      {
        title: 'Know your hiring metrics',
        body:  'Time to fill, offer acceptance rate, quality of hire, retention at 90 days. HR hiring managers want to see that you tracked the outcomes of your work, not just the volume of it.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Prepare a difficult employee situation story',
        body:  'Every HR hiring manager will probe how you handle hard conversations — performance issues, terminations, conflict between employees. Have a specific story ready that shows judgment, empathy, and composure under pressure.',
        stage: 'Hiring Manager',
      },
      {
        title: 'Show you can influence without authority',
        body:  "HR panels often include business leaders who are your internal customers. Show that you understand how to build credibility with people who don't report to you — and that you can push back on a people decision when you need to.",
        stage: 'Panel',
      },
    ],
  };

  const STAGE_CLASS = {
    'Recruiter':      'coach-stage-recruiter',
    'Hiring Manager': 'coach-stage-hiring',
    'Any':            'coach-stage-any',
  };

  function _getRoleKey(profile) {
    const r = (profile.role_type || '').toLowerCase();
    if (r.includes('account executive') || /\bae\b/.test(r))                                    return 'ae';
    if (r.includes('customer success')  || /\bcsm?\b/.test(r))                                   return 'cs';
    if (r.includes('account manager')   || /\bam\b/.test(r))                                    return 'am';
    if (r.includes('solutions engineer') || r.includes('sales engineer') || /\bse\b/.test(r))   return 'se';
    if (r.includes('revenue operations') || r.includes('revops') || r.includes('rev ops'))      return 'revops';
    if (r.includes('partner') || r.includes('alliance') || r.includes('channel'))               return 'partnerships';
    if (r.includes('enablement'))                                                                return 'enablement';
    if (r.includes('engineer') || r.includes('developer') || r.includes('software'))            return 'engineering';
    if (r.includes('hr') || r.includes('human resources') || r.includes('people') || r.includes('talent') || r.includes('recruit')) return 'hr';
    if (r.includes('marketing') || r.includes('demand gen') || r.includes('growth'))            return 'marketing';
    return 'sdr';
  }

  let _tipsAll      = [];   // full list for current user, built once per reset
  let _tipsFilter   = 'All';

  function _applyTipsFilter() {
    const grid = document.getElementById('coach-tips-grid');
    if (!grid) return;
    const visible = _tipsFilter === 'All'
      ? _tipsAll
      : _tipsAll.filter(t => t.stage === _tipsFilter || t.stage === 'Any');
    grid.innerHTML = visible.map(t => `
      <div class="coach-tip-card">
        <div class="coach-tip-top">
          <div class="coach-tip-title">${_esc(t.title)}</div>
          <div class="coach-tip-stage ${_esc(STAGE_CLASS[t.stage] || 'coach-stage-any')}">${_esc(t.stage)}</div>
        </div>
        <div class="coach-tip-body">${_esc(t.body)}</div>
      </div>`).join('');
  }

  function _renderTips(profile) {
    const bar = document.getElementById('coach-tips-filter-bar');
    if (!bar) return;

    const key = _getRoleKey(profile);
    _tipsAll    = [...(TIPS[key] || TIPS.sdr), ...(TIPS.any || [])];
    _tipsFilter = 'All';

    // Reset active state
    bar.querySelectorAll('.coach-outreach-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stage === 'All');
    });

    // Wire filter clicks (guard against double-binding across resets)
    if (!bar.dataset.tipsWired) {
      bar.dataset.tipsWired = '1';
      bar.addEventListener('click', e => {
        const btn = e.target.closest('.coach-outreach-filter-btn');
        if (!btn) return;
        const stage = btn.dataset.stage;
        if (stage === _tipsFilter) return;
        _tipsFilter = stage;
        bar.querySelectorAll('.coach-outreach-filter-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.stage === stage);
        });
        _applyTipsFilter();
      });
    }

    _applyTipsFilter();
  }

  // ── Section 4 — Interview Scores ──────────────────────────────────────────

  let _scoresExpanded = false;

  function _renderInterviewScores() {
    const list = document.getElementById('coach-scores-list');
    if (!list) return;

    const interviews = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const scored = interviews
      .filter(iv => iv.coach_score != null)
      .sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0));

    if (!scored.length) {
      list.innerHTML = '<div class="coach-actions-empty">No interview scores yet. Open an interview to generate coach analysis.</div>';
      return;
    }

    const avg     = Math.round(scored.reduce((s, iv) => s + iv.coach_score, 0) / scored.length);
    const visible = _scoresExpanded ? scored : scored.slice(0, 3);

    const cards = visible.map(iv => {
      const company  = _esc(iv.company?.name || 'Unknown Company');
      const stage    = _esc(iv.stage || 'Interview');
      const date     = iv.scheduled_at
        ? new Date(iv.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const initial  = (iv.company?.name || '?')[0].toUpperCase();
      const logoId   = `co-score-logo-${_esc(iv.id)}`;
      const logoHtml = iv.company?.logo_url && !iv.company?.screenshot_mode
        ? `<img src="${_esc(iv.company.logo_url)}" class="coach-outreach-logo-img" alt="" data-fb="${logoId}">
           <div class="coach-outreach-logo-fb" data-fb-id="${logoId}" ${window._fbHiddenStyle(iv.company)}>${initial}</div>`
        : `<div class="coach-outreach-logo-fb"${window._fbStyle(iv.company)}>${initial}</div>`;
      return `
        <div class="coach-score-card" data-iv-id="${_esc(iv.id)}">
          ${window.buildDonut(iv.coach_score, 52)}
          <div class="coach-outreach-logo-wrap">${logoHtml}</div>
          <div class="coach-score-card-meta">
            <div class="coach-score-card-company">${company}</div>
            <div class="coach-score-card-stage">${stage}</div>
            ${date ? `<div class="coach-score-card-date">${date}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    const toggleLink = scored.length > 3
      ? `<div class="coach-scores-toggle-row">
           <button class="coach-scores-toggle" id="coach-scores-toggle">
             ${_scoresExpanded ? 'Show less' : `Show all (${scored.length})`}
           </button>
         </div>`
      : '';

    list.innerHTML = `
      <div class="coach-scores-summary">
        ${window.buildDonut(avg, 64)}
        <div class="coach-scores-avg-meta">
          <div class="coach-scores-avg-label">Average score</div>
          <div class="coach-scores-avg-sub">${scored.length} interview${scored.length > 1 ? 's' : ''} scored</div>
        </div>
      </div>
      <div class="coach-scores-grid">${cards}</div>
      ${toggleLink}`;

    if (window.wireImgFallbacks) window.wireImgFallbacks(list);

    list.querySelectorAll('.coach-score-card[data-iv-id]').forEach(card => {
      card.addEventListener('click', () => {
        const ivId = card.dataset.ivId;
        window.navigateTo?.('interviews');
        setTimeout(() => {
          window.InterviewsPage?.openDetail(ivId);
          requestAnimationFrame(() => {
            const coachSection = [...document.querySelectorAll('.ivdp-section-title')]
              .find(t => t.textContent.trim() === 'Coach')
              ?.closest('.ivdp-section');
            coachSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }, 0);
      });
    });

    document.getElementById('coach-scores-toggle')?.addEventListener('click', () => {
      _scoresExpanded = !_scoresExpanded;
      _renderInterviewScores();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function reset() {
    const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
    const data    = _getPipelineData();
    _renderHealth(data);
    _renderOutreachSection();
    _renderInterviewScores();
    _renderTips(profile);
  }

  function refreshBadge() {
    _updateNavBadge(_getOutreachCards());
  }

  return { reset, refreshBadge };
})();

// Run immediately — by this line, CoachPage is defined and the badge DOM element exists.
// Covers dev-bypass (no syncAllDown ever runs) and shows badge from any cached localStorage.
window.CoachPage.refreshBadge();

// Refresh again after sync-down completes so the badge reflects the latest Supabase data.
window.addEventListener('klinch:synced', () => window.CoachPage.refreshBadge());
