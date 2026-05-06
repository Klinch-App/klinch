window.CoachPage = (() => {

  const CACHE_KEY = 'coach_actions';
  const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

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
        sub:   data.completed.length === 1 ? '1 session done' : `${data.completed.length} sessions done`,
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
        value: data.avgResponse !== null ? `${data.avgResponse}d` : '—',
        sub:   'Applied → first interview',
      },
    ];

    grid.innerHTML = stats.map(s => `
      <div class="card">
        <div class="card-label">${_esc(s.label)}</div>
        <div class="card-value">${_esc(String(s.value))}</div>
        <div class="card-sub">${_esc(s.sub)}</div>
      </div>`).join('');
  }

  // ── Section 2 — Outreach Actions ─────────────────────────────────────────

  const OUTREACH_CACHE_KEY = 'klinch_coach_outreach';

  function _getOutreachInterviews() {
    const interviews = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const now        = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const pre = interviews.filter(iv =>
      iv.status === 'pending' && iv.scheduled_at && new Date(iv.scheduled_at) >= now
    ).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

    const post = interviews.filter(iv => {
      const isCompleted = iv.status === 'completed' ||
        (iv.scheduled_at && new Date(iv.scheduled_at) < now && iv.status !== 'pending');
      if (!isCompleted) return false;
      const completedDate = iv.completed_at ? new Date(iv.completed_at) : (iv.scheduled_at ? new Date(iv.scheduled_at) : null);
      if (!completedDate || completedDate < sevenDaysAgo) return false;
      return !iv.outreach_post_sent;
    }).sort((a, b) => {
      const da = a.completed_at || a.scheduled_at || 0;
      const db = b.completed_at || b.scheduled_at || 0;
      return new Date(db) - new Date(da);
    });

    return { pre, post };
  }

  function _loadOutreachCache() {
    try { return JSON.parse(localStorage.getItem(OUTREACH_CACHE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function _saveOutreachCache(cache) {
    localStorage.setItem(OUTREACH_CACHE_KEY, JSON.stringify(cache));
  }

  function _renderOutreachSection() {
    const list = document.getElementById('coach-outreach-list');
    if (!list) return;

    const { pre, post } = _getOutreachInterviews();
    const cache = _loadOutreachCache();

    const sent = JSON.parse(localStorage.getItem('klinch_interviews') || '[]')
      .filter(iv => iv.outreach_post_sent || iv.outreach_pre_sent);

    if (!pre.length && !post.length) {
      const hasSent = sent.length > 0;
      list.innerHTML = `<div class="coach-outreach-empty">${hasSent ? 'All outreach sent. Great work!' : 'No outreach needed right now. Check back after your next interview is scheduled.'}</div>`;
      return;
    }

    const cards = [
      ...post.map(iv => _buildOutreachCard(iv, 'post', cache[iv.id + '_post'])),
      ...pre.map(iv  => _buildOutreachCard(iv, 'pre',  cache[iv.id + '_pre'])),
    ];

    list.innerHTML = cards.join('');
    _wireOutreachEvents(list);
  }

  function _buildOutreachCard(iv, type, cached) {
    const company   = _esc(iv.company?.name || 'Unknown Company');
    const role      = _esc(iv.jd?.structured?.role_title || iv.role_title || 'Unknown Role');
    const isPost    = type === 'post';
    const cardId    = `coach-outreach-${iv.id}-${type}`;
    const dateLabel = isPost
      ? (iv.completed_at || iv.scheduled_at ? new Date(iv.completed_at || iv.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
      : (iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

    const typeLabel = isPost ? 'Post-Interview' : 'Pre-Interview';
    const tagClass  = isPost ? 'coach-outreach-tag-post' : 'coach-outreach-tag-pre';

    let contentHtml;
    if (cached?.linkedin_message) {
      contentHtml = _buildOutreachContentHtml(iv.id, type, cached);
    } else {
      contentHtml = `
        <div class="coach-outreach-generate-row">
          <button class="coach-outreach-generate-btn" data-iv-id="${_esc(iv.id)}" data-outreach-type="${type}">Generate Outreach</button>
        </div>`;
    }

    return `
      <div class="coach-outreach-card" id="${cardId}">
        <div class="coach-outreach-card-header" data-toggle-card="${cardId}">
          <div class="coach-outreach-card-meta">
            <span class="coach-outreach-company">${company}</span>
            <span class="coach-outreach-role">${role}</span>
          </div>
          <div class="coach-outreach-card-badges">
            ${dateLabel ? `<span class="coach-outreach-date">${dateLabel}</span>` : ''}
            <span class="coach-outreach-tag ${tagClass}">${typeLabel}</span>
            <span class="coach-outreach-chevron">▾</span>
          </div>
        </div>
        <div class="coach-outreach-card-body" id="${cardId}-body">
          ${contentHtml}
        </div>
      </div>`;
  }

  function _buildOutreachContentHtml(ivId, type, data) {
    const pfx = `co-${ivId}-${type}`;
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
        <button class="coach-outreach-btn coach-outreach-btn-sent" data-mark-sent-id="${_esc(ivId)}" data-mark-sent-type="${type}">Mark as Sent ✓</button>
      </div>`;
  }

  function _wireOutreachEvents(list) {
    list.addEventListener('click', async e => {
      const toggleHdr = e.target.closest('[data-toggle-card]');
      if (toggleHdr && !e.target.closest('button')) {
        const card = document.getElementById(toggleHdr.dataset.toggleCard);
        card?.classList.toggle('coach-outreach-card-collapsed');
        return;
      }

      const genBtn = e.target.closest('[data-outreach-type]');
      if (genBtn) {
        const ivId = genBtn.dataset.ivId;
        const type = genBtn.dataset.outreachType;
        await _generateOutreach(ivId, type, genBtn);
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

      const sentBtn = e.target.closest('[data-mark-sent-id]');
      if (sentBtn) {
        const ivId = sentBtn.dataset.markSentId;
        const type = sentBtn.dataset.markSentType;
        _markSent(ivId, type);
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

  async function _generateOutreach(ivId, type, btn) {
    const interviews = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const iv = interviews.find(x => x.id === ivId);
    if (!iv) return;

    const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
    const cardBody = document.getElementById(`coach-outreach-${ivId}-${type}-body`);
    if (!cardBody) return;

    btn.disabled = true;
    btn.textContent = 'Generating…';

    const ivr          = iv.interviewers?.[0] || {};
    const company      = iv.company?.name || 'the company';
    const role         = iv.jd?.structured?.role_title || iv.role_title || 'the role';
    const candidateName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'the candidate';
    const interviewerName  = ivr.name  || '';
    const interviewerTitle = ivr.title || '';
    const isPost = type === 'post';

    const dateStr = iv.scheduled_at
      ? new Date(iv.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : '';
    const highlights = isPost ? (iv.sessions || []).map(s => s.synopsis).filter(Boolean) : [];

    const payload = [
      `Candidate: ${candidateName}`,
      interviewerName ? `Interviewer: ${interviewerName}${interviewerTitle ? ', ' + interviewerTitle : ''}` : '',
      `Company: ${company}`,
      `Role: ${role}`,
      dateStr ? `Interview date: ${dateStr}` : '',
      highlights.length ? `Key moments: ${highlights.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    const [liSystemPre, liSystemPost, emailSystemPre, emailSystemPost] = [
      'You are an expert career coach. Write a warm, brief LinkedIn connection request before a job interview. Return the message text only, no preamble.',
      'You are an expert career coach. Write a warm, brief LinkedIn follow-up message after a job interview. Be grateful, specific, forward-looking. Return the message text only, no preamble.',
      'Write a short warm pre-interview email. First line must be "Subject: <subject>". Return email text only, no preamble.',
      'Write a personalised thank-you email after a job interview. First line must be "Subject: <subject>". Be warm, specific, concise. Return email text only, no preamble.',
    ];

    try {
      const invoke = (system, max_tokens) => window.klinch.invoke('claude:coach', {
        model:      'claude-sonnet-4-6',
        max_tokens,
        system,
        messages:   [{ role: 'user', content: payload }],
      }).then(r => r?.content?.[0]?.text || r?.text || '');

      const [linkedin_message, emailRaw] = await Promise.all([
        invoke(isPost ? liSystemPost : liSystemPre, 150),
        invoke(isPost ? emailSystemPost : emailSystemPre, 300),
      ]);

      const emailLines  = emailRaw.split('\n');
      const subjectLine = emailLines.find(l => /^Subject:/i.test(l)) || 'Subject: Following up';
      const subject     = subjectLine.replace(/^Subject:\s*/i, '').trim();
      const body        = emailLines.filter(l => !/^Subject:/i.test(l)).join('\n').trim();

      const data = { linkedin_message, email: { subject, body }, generated_at: new Date().toISOString() };
      const cache = _loadOutreachCache();
      cache[ivId + '_' + type] = data;
      _saveOutreachCache(cache);

      cardBody.innerHTML = _buildOutreachContentHtml(ivId, type, data);
      document.getElementById(`coach-outreach-${ivId}-${type}`)?.classList.remove('coach-outreach-card-collapsed');
    } catch (err) {
      console.error('[coach-outreach] generate failed:', err);
      btn.disabled = false;
      btn.textContent = 'Generate Outreach';
    }
  }

  function _markSent(ivId, type) {
    const interviews = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const idx = interviews.findIndex(x => x.id === ivId);
    if (idx === -1) return;

    const field = type === 'post' ? 'outreach_post_sent' : 'outreach_pre_sent';
    interviews[idx][field] = new Date().toISOString();
    localStorage.setItem('klinch_interviews', JSON.stringify(interviews));

    _renderOutreachSection();
  }

  // ── Section 3 — Recommended Next Actions ─────────────────────────────────

  const TYPE_ICONS = {
    'follow-up': '↩',
    'prepare':   '◎',
    'apply':     '→',
    'other':     '⚡',
  };

  function _buildActionSummary(data) {
    const recentIvs = [...data.interviews]
      .sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0))
      .slice(0, 10)
      .map(iv => ({
        company:      iv.company?.name,
        stage:        iv.stage,
        status:       iv.status,
        scheduled_at: iv.scheduled_at,
      }));

    const recentApps = [...data.applications]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 8)
      .map(a => ({
        company:   a.company?.name,
        role:      a.role_title,
        status:    a.status,
        stage:     a.current_stage,
        applied:   a.date_applied,
      }));

    return JSON.stringify({
      total_applications:   data.applications.length,
      active_applications:  data.active.length,
      offers:               data.offers.length,
      interviews_completed: data.completed.length,
      interviews_upcoming:  data.upcoming.length,
      win_rate:             data.winRate !== null ? `${data.winRate}%` : 'N/A',
      avg_response_days:    data.avgResponse,
      recent_interviews:    recentIvs,
      recent_applications:  recentApps,
    });
  }

  function _renderActions(actions) {
    const list = document.getElementById('coach-actions-list');
    if (!list) return;

    if (!actions?.length) {
      list.innerHTML = '<div class="coach-actions-empty">Add interviews and applications to get personalised coaching recommendations.</div>';
      return;
    }

    list.innerHTML = actions.map(a => {
      const urgency  = (a.urgency || 'low').toLowerCase();
      const type     = (a.type    || 'other').toLowerCase();
      const icon     = TYPE_ICONS[type] || TYPE_ICONS.other;
      return `
        <div class="coach-action-card">
          <div class="coach-action-urgency-dot coach-urgency-${_esc(urgency)}"></div>
          <div class="coach-action-body">
            <div class="coach-action-header">
              <span class="coach-action-icon">${icon}</span>
              <span class="coach-action-title">${_esc(a.action)}</span>
              <span class="coach-urgency-tag coach-urgency-${_esc(urgency)}">${_esc(urgency)}</span>
            </div>
            <div class="coach-action-detail">${_esc(a.detail)}</div>
          </div>
        </div>`;
    }).join('');
  }

  function _renderActionsSkeleton() {
    const list = document.getElementById('coach-actions-list');
    if (!list) return;
    list.innerHTML = [1, 2, 3].map(() => `
      <div class="coach-action-card">
        <div class="coach-action-urgency-dot coach-skel-dot"></div>
        <div class="coach-action-body" style="flex:1">
          <div class="ivdp-skel-line w50" style="height:12px;margin-bottom:8px"></div>
          <div class="ivdp-skel-line w80" style="height:10px"></div>
        </div>
      </div>`).join('');
  }

  async function _fetchActions(data, force = false) {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached?.generated_at && Date.now() - new Date(cached.generated_at).getTime() < CACHE_TTL) {
          _renderActions(cached.actions);
          return;
        }
      } catch (_) {}
    }

    _renderActionsSkeleton();

    try {
      const summary = _buildActionSummary(data);
      const result  = await window.klinch.invoke('claude:coach', {
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        system:     'Return only valid JSON. No preamble. No markdown.',
        messages:   [{
          role:    'user',
          content: `You are a SaaS hiring coach reviewing a candidate's interview pipeline. Based on the following data, return the top 5 recommended next actions as a JSON array. Each action should have: action (short title), detail (one sentence explanation), urgency (high/medium/low), and type (follow-up/prepare/apply/other). Data: ${summary}`,
        }],
      });

      const text    = result?.content?.[0]?.text || result?.text || '[]';
      const actions = JSON.parse(text.trim());
      localStorage.setItem(CACHE_KEY, JSON.stringify({ actions, generated_at: new Date().toISOString() }));
      _renderActions(actions);
    } catch (err) {
      console.error('[coach] actions failed:', err);
      const list = document.getElementById('coach-actions-list');
      if (list) list.innerHTML = '<div class="coach-actions-empty">Could not load recommendations — try refreshing.</div>';
    }
  }

  // ── Section 3 — Insider Tips ──────────────────────────────────────────────

  const TIPS = {
    sdr: [
      {
        title: 'The first 30 seconds decide everything',
        stage: 'Recruiter',
        body:  'Hiring managers decide within the first 30 seconds whether they can see you on their team. Open with energy, confidence, and a clear one-line summary of who you are and what you bring. Avoid starting with your life story.',
      },
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
  };

  const STAGE_CLASS = {
    'Recruiter':      'coach-stage-recruiter',
    'Hiring Manager': 'coach-stage-hiring',
    'Any':            'coach-stage-any',
  };

  function _getRoleKey(profile) {
    const r = (profile.role_type || '').toLowerCase();
    if (r.includes('account executive') || /\bae\b/.test(r))                          return 'ae';
    if (r.includes('customer success')  || /\bcs\b/.test(r))                          return 'cs';
    if (r.includes('account manager')   || /\bam\b/.test(r))                          return 'am';
    if (r.includes('solutions engineer') || r.includes('sales engineer') || /\bse\b/.test(r)) return 'se';
    return 'sdr';
  }

  function _renderTips(profile) {
    const grid = document.getElementById('coach-tips-grid');
    if (!grid) return;
    const key  = _getRoleKey(profile);
    const tips = TIPS[key] || TIPS.sdr;

    grid.innerHTML = tips.map(t => `
      <div class="coach-tip-card">
        <div class="coach-tip-top">
          <div class="coach-tip-title">${_esc(t.title)}</div>
          <div class="coach-tip-stage ${_esc(STAGE_CLASS[t.stage] || 'coach-stage-any')}">${_esc(t.stage)}</div>
        </div>
        <div class="coach-tip-body">${_esc(t.body)}</div>
      </div>`).join('');
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  document.getElementById('coach-actions-refresh')?.addEventListener('click', () => {
    _fetchActions(_getPipelineData(), true);
  });

  function reset() {
    const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');
    const data    = _getPipelineData();
    _renderHealth(data);
    _renderOutreachSection();
    _fetchActions(data);
    _renderTips(profile);
  }

  return { reset };
})();
