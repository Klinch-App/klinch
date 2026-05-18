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
    const stageTone = s.includes('recruiter') || s.includes('screen') || s.includes('phone')
      ? 'This was an early-stage recruiter screen. Keep the tone warm, enthusiastic, and brief.'
      : s.includes('panel') || s.includes('loop') || s.includes('onsite')
        ? "This was a panel or onsite interview. Express appreciation for everyone's time and mention the collaborative energy."
        : 'This was a hiring manager interview. Be confident, personal, and forward-looking.';

    const ref = hasTranscript
      ? 'Reference at least one specific detail from the transcript excerpt below — a topic discussed, a question asked, or a moment of connection — to make the message feel genuinely personal. Do not fabricate details not present in the transcript.'
      : `No transcript is available. ${stageTone} Write a warm message that sounds personal without fabricating details.`;

    return type === 'post'
      ? `You are an expert career coach. Write a warm, brief LinkedIn follow-up message after a job interview. ${ref} Return the message text only, no greeting, no sign-off, no preamble.`
      : `You are an expert career coach. Write a warm, brief LinkedIn connection request ahead of a job interview. ${ref} Return the message text only, no greeting, no sign-off, no preamble.`;
  }

  function _buildEmailSystemPrompt(type, stage, hasTranscript) {
    const s = (stage || '').toLowerCase();
    const stageTone = s.includes('recruiter') || s.includes('screen') || s.includes('phone')
      ? 'This was an early-stage recruiter screen. Keep the tone warm, brief, and enthusiastic.'
      : s.includes('panel') || s.includes('loop') || s.includes('onsite')
        ? "This was a panel or onsite interview. Express genuine appreciation for everyone's time."
        : 'This was a hiring manager interview. Be confident, specific, and forward-looking.';

    const ref = hasTranscript
      ? 'Reference at least one specific detail from the transcript excerpt below to make the email feel genuinely personal. Do not fabricate details.'
      : `No transcript is available. ${stageTone} Write a message that sounds personal without fabricating details.`;

    return type === 'post'
      ? `Write a short personalised thank-you email after a job interview. ${ref} First line must be "Subject: <subject>". Return email text only, no preamble.`
      : `Write a short warm pre-interview email. ${ref} First line must be "Subject: <subject>". Return email text only, no preamble.`;
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
        invoke(liSystem,    200),
        invoke(emailSystem, 400),
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
        stage: 'Any',
        body:  'Hiring managers decide within the first 30 seconds whether they can see you on their team. Open with energy, confidence, and a clear one-line summary of who you are and what you bring. Avoid starting with your life story.',
      },
    ],
    sdr: [
      {
        title: 'Never recite your cold call script',
        stage: 'Hiring Manager',
        body:  "When asked about your cold call framework, talk about principles not scripts. Explain why you do what you do. Anyone can memorise a script — interviewers want to know you understand the psychology behind it.",
      },
      {
        title: 'Quantify everything',
        stage: 'Any',
        body:  "Every achievement needs a number. Not 'I had a strong quarter' — 'I hit 127% of quota in Q3 by focusing exclusively on mid-market accounts in fintech.' Numbers show you think like a businessperson, not just a rep.",
      },
      {
        title: 'Ask about the ramp',
        stage: 'Hiring Manager',
        body:  "Asking smart questions signals you think ahead. Ask what the ramp period looks like, what the top performers did in their first 90 days, and what separates the good reps from the great ones on this team.",
      },
    ],
    ae: [
      {
        title: 'Show your deal instinct',
        stage: 'Hiring Manager',
        body:  'AE interviews live or die on deal stories. Have two or three prepared that show discovery, multi-threading, handling objections, and closing. Walk them through your thinking, not just the outcome.',
      },
      {
        title: 'Know your numbers cold',
        stage: 'Any',
        body:  "Average deal size, sales cycle length, quota attainment by quarter, win rate. If you hesitate on any of these it signals you weren't paying attention to your business. Know them before you walk in.",
      },
      {
        title: 'Ask about the ICP',
        stage: 'Hiring Manager',
        body:  'Asking who their best customers are and why shows you think about fit and repeatability. It also tells you whether this is a role where you can actually succeed.',
      },
    ],
    cs: [
      {
        title: 'Lead with retention stories',
        stage: 'Hiring Manager',
        body:  'CS interviews want to know you can save accounts and grow them. Have a story ready about a customer who was at risk and how you turned it around. Specifics matter — what was the risk signal, what did you do, what was the outcome.',
      },
      {
        title: 'Show you understand the product deeply',
        stage: 'Any',
        body:  'CS candidates who can speak to product functionality, common failure points, and how customers get value stand out immediately. Do your homework on the product before the interview.',
      },
      {
        title: 'Quantify your book of health',
        stage: 'Any',
        body:  'Come ready with your NRR, GRR, churn rate, and average health score across your book. These numbers tell the story of how well you manage relationships.',
      },
    ],
    am: [
      {
        title: 'Expansion is your north star',
        stage: 'Hiring Manager',
        body:  'AM roles are won on expansion stories. Show you proactively identified upsell opportunities rather than waiting for procurement to come to you. Talk about how you mapped the account and found the whitespace.',
      },
      {
        title: 'Relationship breadth wins',
        stage: 'Any',
        body:  'Single-threaded relationships are a red flag in AM interviews. Talk about how you built relationships across multiple stakeholders — champions, economic buyers, end users — and how that protected your renewal.',
      },
    ],
    se: [
      {
        title: 'Discovery before demo',
        stage: 'Hiring Manager',
        body:  "The biggest mistake SEs make is jumping to the demo too fast. Talk about how you run discovery to understand the prospect's technical environment, pain points, and success criteria before you show anything.",
      },
      {
        title: 'Simplify the complex',
        stage: 'Any',
        body:  'The best SEs can explain technical concepts to a non-technical audience without dumbing it down. Be ready to demonstrate this. Have an example of when you bridged the gap between technical and business stakeholders.',
      },
    ],
    revops: [
      {
        title: 'Lead with revenue impact',
        stage: 'Hiring Manager',
        body:  'RevOps interviews are won with outcome stories. Every process improvement, system migration, or forecast fix needs a revenue number attached — reduced ramp time by X weeks, increased forecast accuracy to Y%. Make it concrete.',
      },
      {
        title: 'Know the full funnel cold',
        stage: 'Any',
        body:  'You will be asked how you think about the revenue funnel end to end. Have your conversion rates, cycle lengths, and attribution logic ready. Weak answers here signal someone who built reports but never influenced strategy.',
      },
      {
        title: 'Show cross-functional range',
        stage: 'Hiring Manager',
        body:  'RevOps lives at the intersection of Sales, Marketing, and CS. Be ready to talk about how you aligned competing priorities across those teams — and a specific time you resolved a conflict between them.',
      },
      {
        title: 'Ask about the tech stack',
        stage: 'Any',
        body:  "Ask what their CRM, MAP, and reporting stack look like and where the biggest data integrity issues are. This signals you know where RevOps work actually lives and helps you assess whether it's a role you can win in.",
      },
    ],
    marketing: [
      {
        title: 'Attribution is everything',
        stage: 'Hiring Manager',
        body:  'Marketing interviews live or die on pipeline contribution. Know your MQL-to-SQL conversion rate, cost per opportunity, and how much of closed revenue your programs influenced. Vague answers about brand and awareness will not land.',
      },
      {
        title: 'Lead with a campaign story',
        stage: 'Any',
        body:  'Have one well-structured campaign story ready: the objective, the channel mix, the budget, the result, and what you would do differently. Interviewers use this to assess how you think, not just what you executed.',
      },
      {
        title: 'Show you understand sales alignment',
        stage: 'Hiring Manager',
        body:  "Marketing candidates who can talk about how they worked with sales — joint pipeline reviews, SLA agreements, feedback loops on lead quality — stand out immediately. Show you see marketing as a revenue function, not a creative one.",
      },
      {
        title: 'Ask about the pipeline target',
        stage: 'Hiring Manager',
        body:  "Asking what percentage of pipeline is expected to come from marketing signals commercial maturity. It also tells you whether this is a role with clear accountability or one where you will be measured on outputs no one can connect to revenue.",
      },
    ],
    partnerships: [
      {
        title: 'Show a partner revenue story',
        stage: 'Hiring Manager',
        body:  'Partnerships interviews are about co-sell motion and sourced revenue. Have a story ready that shows how you recruited a partner, enabled them, and generated pipeline together — with numbers. Co-sell influence is good; sourced deals are better.',
      },
      {
        title: 'Demonstrate partner activation',
        stage: 'Any',
        body:  "Recruiting partners is table stakes — everyone can sign agreements. What separates good partnerships candidates is activation: how you moved a partner from signed to producing. Walk through the specific steps you took.",
      },
      {
        title: 'Know how you measure partner health',
        stage: 'Hiring Manager',
        body:  'Be ready to talk about your tier structure, what metrics you tracked per partner, and how you decided where to invest your time. Showing systematic thinking about partner health sets you apart from relationship-only candidates.',
      },
      {
        title: 'Ask about the partner ecosystem today',
        stage: 'Any',
        body:  'Ask how many active partners they have, what percentage are producing, and where the biggest untapped opportunity is. This positions you as someone who will audit and build — not just inherit and manage.',
      },
    ],
    engineering: [
      {
        title: 'Nail the behavioural layer',
        stage: 'Hiring Manager',
        body:  'Technical interviews focus on code, but hiring decisions turn on behavioural signals. Have STAR stories ready for how you handled ambiguity, disagreed with a technical decision, unblocked a team dependency, and learned from a failure.',
      },
      {
        title: 'Talk about impact, not implementation',
        stage: 'Any',
        body:  "When describing past projects, lead with the business outcome, not the tech stack. 'I reduced p95 latency by 60% which unlocked a new enterprise tier' lands better than 'I refactored the service layer using async workers'. Both are true — order matters.",
      },
      {
        title: 'Ask about engineering culture',
        stage: 'Hiring Manager',
        body:  'Ask how the team handles code review, how on-call is structured, how often production incidents happen, and what the last major technical decision debated was. The answers tell you more about day-to-day reality than any job description.',
      },
      {
        title: 'Show you have range beyond the code',
        stage: 'Any',
        body:  'Engineers who can talk to product managers, explain tradeoffs to non-technical stakeholders, and write clear documentation are disproportionately valuable. Have an example of when you bridged that gap — it will stick in the interviewers memory.',
      },
    ],
    hr: [
      {
        title: 'Anchor every story in a metric',
        stage: 'Hiring Manager',
        body:  'HR candidates often tell stories without numbers. Come prepared with time-to-fill, offer acceptance rate, 90-day retention, engagement scores, or eNPS. If you ran programs, know the before and after. Numbers make soft skills legible.',
      },
      {
        title: 'Show you understand the business',
        stage: 'Any',
        body:  "The best HR candidates talk about headcount planning in the context of revenue targets, not just hiring plans. Show you understand how talent decisions connect to company performance — it signals you will be a strategic partner, not just an executor.",
      },
      {
        title: 'Have an employee relations story ready',
        stage: 'Hiring Manager',
        body:  "You will almost certainly be asked about a difficult employee situation. Prepare one that shows you balanced empathy with process discipline, involved the right stakeholders, and reached a resolution that was fair and legally sound.",
      },
      {
        title: 'Ask about their biggest people challenge',
        stage: 'Any',
        body:  "Asking what the company's biggest talent or culture challenge is right now signals strategic curiosity. The answer also tells you what you're actually walking into — and whether it's a problem you know how to solve.",
      },
    ],
    enablement: [
      {
        title: 'Lead with ramp time and quota attainment',
        stage: 'Hiring Manager',
        body:  'Enablement interviews come down to one question: did your programs move the business? Know your before-and-after on ramp time, time to first deal, and quota attainment. If you can say you reduced ramp by X weeks and improved attainment by Y%, you will stand out.',
      },
      {
        title: 'Show you understand the sales motion',
        stage: 'Any',
        body:  "Enablement candidates who have sold — or who deeply understand how reps sell — are far more credible than those who built training from the outside. Show you have shadowed calls, ridden along on deals, and built content from real field insights.",
      },
      {
        title: 'Demonstrate cross-functional alignment',
        stage: 'Hiring Manager',
        body:  'Enablement sits between Sales, Product, and Marketing. Be ready to talk about how you aligned messaging across those teams, how you handled competing priorities for rep attention, and how you measured content adoption.',
      },
      {
        title: 'Ask about rep feedback loops',
        stage: 'Any',
        body:  "Ask how reps currently surface feedback on what's working and what's not, and how that feedback gets into training. A company with no feedback loop is one where enablement is output-driven, not outcome-driven — good to know before you accept.",
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

  function _renderTips(profile) {
    const grid = document.getElementById('coach-tips-grid');
    if (!grid) return;
    const key  = _getRoleKey(profile);
    const tips = [...(TIPS[key] || TIPS.sdr), ...(TIPS.any || [])];

    grid.innerHTML = tips.map(t => `
      <div class="coach-tip-card">
        <div class="coach-tip-top">
          <div class="coach-tip-title">${_esc(t.title)}</div>
          <div class="coach-tip-stage ${_esc(STAGE_CLASS[t.stage] || 'coach-stage-any')}">${_esc(t.stage)}</div>
        </div>
        <div class="coach-tip-body">${_esc(t.body)}</div>
      </div>`).join('');
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

// Refresh badge once synced data lands in localStorage (covers auth + post-signin paths).
// dev-bypass path has no syncAllDown so app.js handles it with setTimeout(0).
window.addEventListener('klinch:synced', () => window.CoachPage?.refreshBadge());
