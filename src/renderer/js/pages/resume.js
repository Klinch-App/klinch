window.ResumePage = (() => {

  const profile = JSON.parse(localStorage.getItem('klinch_profile') || '{}');

  let _selectedIvId = '';

  function _el(id) { return document.getElementById(id); }
  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  // ── Data ──────────────────────────────────────────────────────────────────────

  function getResume() {
    return JSON.parse(localStorage.getItem('klinch_resume') || 'null');
  }

  function saveResume(r) {
    localStorage.setItem('klinch_resume', JSON.stringify(r));
    window.refreshDashboardStats?.();
  }

  function getInterviews() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  }

  function patchIv(id, patch) {
    const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const idx = all.findIndex(x => x.id === id);
    if (idx >= 0) { Object.assign(all[idx], patch); localStorage.setItem('klinch_interviews', JSON.stringify(all)); }
  }

  // ── Annotation helpers ────────────────────────────────────────────────────────

  // Normalises both old schema (highlights/original/reason) and new (annotations/quote/comment)
  function _normalizeAnnotations(analysis) {
    if (!analysis) return [];
    if (analysis.annotations) return analysis.annotations;
    return (analysis.highlights || []).map(h => ({
      id:       h.id,
      quote:    h.original || '',
      comment:  h.reason   || '',
      rewrite:  h.rewrite,
      severity: h.severity || 'medium',
    }));
  }

  // Finds each annotation's quote in raw text, wraps in a mark span.
  // Returns { html, matched } — matched is the subset of annotations that were found.
  function _buildAnnotatedText(rawText, annotations) {
    const positions = [];
    for (const ann of annotations) {
      const quote = ann.quote || '';
      if (!quote) continue;
      const idx = rawText.indexOf(quote);
      if (idx !== -1) positions.push({ idx, len: quote.length, id: ann.id });
    }
    positions.sort((a, b) => a.idx - b.idx);

    // Remove overlapping spans — keep the first occurrence
    const clean = [];
    let end = 0;
    for (const p of positions) {
      if (p.idx >= end) { clean.push(p); end = p.idx + p.len; }
    }

    const matchedIds = new Set(clean.map(p => p.id));
    const matched    = annotations.filter(a => matchedIds.has(a.id));

    // Build numbered marks in document order
    const numMap     = {};
    const severityMap = {};
    clean.forEach((p, i) => { numMap[p.id] = i + 1; });
    annotations.forEach(a => { severityMap[a.id] = a.severity === 'high' ? 'high' : 'medium'; });

    let html   = '';
    let cursor = 0;
    for (const pos of clean) {
      const sev = severityMap[pos.id];
      html += _esc(rawText.slice(cursor, pos.idx));
      html += `<span class="rs-ann-mark rs-severity-${sev}" data-id="${_esc(pos.id)}">` +
              `<span class="rs-ann-mark-num">${numMap[pos.id]}</span>` +
              `${_esc(rawText.slice(pos.idx, pos.idx + pos.len))}</span>`;
      cursor = pos.idx + pos.len;
    }
    html += _esc(rawText.slice(cursor));

    return { html, matched, numMap };
  }

  function _buildBubbles(matched, numMap) {
    return matched.map(ann => `
      <div class="rs-ann-bubble rs-severity-${ann.severity === 'high' ? 'high' : 'medium'}" data-id="${_esc(ann.id)}">
        <div class="rs-ann-bubble-top">
          <span class="rs-ann-num">${numMap[ann.id]}</span>
          <span class="rs-ann-comment">${_esc(ann.comment)}</span>
        </div>
        <button class="rs-hl-rewrite-btn" data-hid="${_esc(ann.id)}">Rewrite this →</button>
        <div class="rs-hl-rewrite-result" id="rs-rw-${_esc(ann.id)}"${ann.rewrite ? '' : ' style="display:none"'}>${ann.rewrite ? _esc(ann.rewrite) : ''}</div>
      </div>`).join('');
  }

  // Positions comment bubbles alongside their highlighted marks.
  // Called via requestAnimationFrame so layout is complete.
  function _positionAnnotations() {
    const wrap  = _el('rs-ann-wrap');
    const right = _el('rs-ann-right');
    if (!wrap || !right) return;

    const wrapTop  = wrap.getBoundingClientRect().top;
    const placements = [];

    _el('rs-ann-left')?.querySelectorAll('.rs-ann-mark').forEach(mark => {
      const bubble = right.querySelector(`.rs-ann-bubble[data-id="${mark.dataset.id}"]`);
      if (!bubble) return;
      const top = mark.getBoundingClientRect().top - wrapTop;
      placements.push({ bubble, top });
    });

    // Sort by document order, then stack from the top — numbered badges keep the association
    placements.sort((a, b) => a.top - b.top);
    let cursor = 28; // matches .rs-text-view padding-top
    for (const p of placements) {
      p.bubble.style.top = cursor + 'px';
      cursor += p.bubble.offsetHeight + 12;
    }

    // Ensure the wrap is tall enough for both columns
    if (placements.length) {
      const last       = placements[placements.length - 1];
      const lastBottom = parseInt(last.bubble.style.top) + last.bubble.offsetHeight;
      const leftHeight = _el('rs-ann-left')?.offsetHeight || 0;
      wrap.style.minHeight = Math.max(leftHeight, lastBottom + 12) + 'px';
    }
  }

  // Updates the Document section in-place after analysis arrives.
  function _renderAnnotations(analysis) {
    const wrap = _el('rs-ann-wrap');
    const left = _el('rs-ann-left');
    if (!wrap || !left) return;

    const r = getResume();
    if (!r?.raw_text) return;

    const annotations = _normalizeAnnotations(analysis);
    if (!annotations.length) return;

    const { html, matched, numMap } = _buildAnnotatedText(r.raw_text, annotations);
    if (!matched.length) return;

    left.innerHTML = `<div class="rs-text-view" id="rs-text-view">${html}</div>`;

    let right = _el('rs-ann-right');
    if (!right) {
      right = document.createElement('div');
      right.className = 'rs-ann-right';
      right.id        = 'rs-ann-right';
      wrap.appendChild(right);
    }
    right.innerHTML = _buildBubbles(matched, numMap);

    requestAnimationFrame(_positionAnnotations);
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  function render() {
    const container = _el('rs-content');
    if (!container) return;
    const r = getResume();

    container.innerHTML = `
      <div class="iv-page-header">
        <div class="iv-page-title">Resume</div>
      </div>
      ${_buildUploadSection(r)}
      ${r ? _buildResumeViewSection(r) : ''}
      ${r ? _buildCoachSection(r) : ''}
      ${r ? _buildRoleFitSection(r) : ''}
    `;

    _wireEvents(r);

    if (r?.analysis) {
      requestAnimationFrame(_positionAnnotations);
    } else if (r) {
      _triggerAnalysis(r);
    }
  }

  // ── Section 1: Upload ─────────────────────────────────────────────────────────

  function _buildUploadSection(r) {
    return `
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Upload</div>
          ${r ? `<button class="ivdp-add-btn" id="rs-replace-btn">↑ Replace Resume</button>` : ''}
        </div>
        <div class="ivdp-section-body" id="rs-upload-body">
          ${r ? _buildFileInfo(r) : _buildDropZone()}
        </div>
      </div>`;
  }

  function _buildDropZone() {
    return `
      <div class="rs-dropzone" id="rs-dropzone">
        <div class="rs-dz-icon">📄</div>
        <div class="rs-dz-title">Drop your resume here</div>
        <div class="rs-dz-sub">PDF or DOCX &nbsp;·&nbsp; or <span class="rs-dz-browse">browse files</span></div>
      </div>
      <input type="file" id="rs-file-input" accept=".pdf,.docx" style="display:none">`;
  }

  function _buildFileInfo(r) {
    const date = r.uploaded_at
      ? new Date(r.uploaded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '';
    return `
      <div class="rs-file-info">
        <div class="rs-file-icon">📄</div>
        <div class="rs-file-meta">
          <div class="rs-file-name">${_esc(r.file_name || 'Resume')}</div>
          ${date ? `<div class="rs-file-date">Uploaded ${_esc(date)}</div>` : ''}
        </div>
      </div>
      <input type="file" id="rs-file-input" accept=".pdf,.docx" style="display:none">`;
  }

  // ── Section 2: Document viewer with annotations ───────────────────────────────

  function _buildResumeViewSection(r) {
    if (!r?.raw_text) return '';

    const annotations = _normalizeAnnotations(r.analysis);
    let textHtml = _esc(r.raw_text);
    let matched  = [];
    let numMap   = {};
    let rightHtml = '';

    if (annotations.length) {
      const result = _buildAnnotatedText(r.raw_text, annotations);
      textHtml  = result.html;
      matched   = result.matched;
      numMap    = result.numMap;
    }

    if (matched.length) {
      rightHtml = `<div class="rs-ann-right" id="rs-ann-right">${_buildBubbles(matched, numMap)}</div>`;
    }

    return `
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Document</div>
        </div>
        <div class="rs-text-body">
          <div class="rs-ann-wrap" id="rs-ann-wrap">
            <div class="rs-ann-left" id="rs-ann-left">
              <div class="rs-text-view" id="rs-text-view">${textHtml}</div>
            </div>
            ${rightHtml}
          </div>
        </div>
      </div>`;
  }

  // ── Section 3: Coach ──────────────────────────────────────────────────────────

  function _buildCoachSection(r) {
    return `
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Resume Coach</div>
          ${r.analysis ? `<button class="ivdp-add-btn" id="rs-refresh-coach">↺ Refresh</button>` : ''}
        </div>
        <div class="ivdp-section-body" id="rs-coach-body">
          ${r.analysis ? _buildCoachResults(r.analysis) : _buildCoachSkeleton()}
        </div>
      </div>`;
  }

  function _buildCoachSkeleton() {
    return `
      <div class="ivdp-ai-skeleton">
        <div class="ivdp-skel-line w80"></div><div class="ivdp-skel-line w60"></div>
        <div class="ivdp-skel-line w70"></div><div class="ivdp-skel-line w50"></div>
        <div class="ivdp-skel-line w80" style="margin-top:14px"></div>
        <div class="ivdp-skel-line w60"></div><div class="ivdp-skel-line w70"></div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:10px">Analyzing your resume…</div>`;
  }

  function _buildCoachResults(a) {
    const DIM_LABELS = {
      impact:                 'Impact',
      clarity:                'Clarity',
      ats_compatibility:      'ATS Compatibility',
      ai_fluency:             'AI Fluency',
      sdr_relevance:          'SDR Relevance',
      ae_relevance:           'AE Relevance',
      csm_relevance:          'CSM Relevance',
      am_relevance:           'AM Relevance',
      se_relevance:           'SE Relevance',
      revops_relevance:       'RevOps Relevance',
      marketing_relevance:    'Marketing Relevance',
      partnerships_relevance: 'Partnerships Relevance',
      enablement_relevance:   'Enablement Relevance',
      people_relevance:       'People Relevance',
    };

    const score      = Math.min(100, Math.max(0, a.overall_score || 0));
    const scoreClass = score >= 80 ? 'rs-score-good' : score >= 60 ? 'rs-score-mid' : 'rs-score-low';

    const dimBars = Object.entries(a.dimensions || {}).map(([key, val]) => {
      const pct      = Math.min(100, Math.max(0, val || 0));
      const barColor = pct >= 80 ? '#4ADE80' : pct >= 60 ? '#FBBF24' : '#F87171';
      return `
        <div class="rs-dim-row">
          <div class="rs-dim-label">${_esc(DIM_LABELS[key] || key)}</div>
          <div class="rs-dim-track"><div class="rs-dim-fill" style="width:${pct}%;background:${barColor}"></div></div>
          <div class="rs-dim-val">${pct}</div>
        </div>`;
    }).join('');

    const atsTips = (a.ats_tips || []).map(t => `
      <div class="rs-ats-tip">
        <span class="rs-ats-check">•</span>
        <span>${_esc(t)}</span>
      </div>`).join('');

    const aiCallouts = (a.ai_fluency_callouts || []).map(t => `
      <div class="rs-ats-tip rs-ai-callout">
        <span class="rs-ats-check">⚡</span>
        <span>${_esc(t)}</span>
      </div>`).join('');

    return `
      <div class="rs-score-row">
        <div class="rs-overall-badge ${scoreClass}">
          <div class="rs-score-num">${score}</div>
          <div class="rs-score-label">Score</div>
        </div>
        <div class="rs-dims">${dimBars}</div>
      </div>
      ${aiCallouts ? `
      <div class="rs-sub-label rs-ai-callout-label" style="margin-top:22px">AI Fluency</div>
      <div class="rs-ats-tips">${aiCallouts}</div>` : ''}
      ${atsTips ? `
      <div class="rs-sub-label" style="margin-top:22px">ATS Tips</div>
      <div class="rs-ats-tips">${atsTips}</div>` : ''}`;
  }

  // ── Section 4: Role Fit ───────────────────────────────────────────────────────

  function _buildRoleFitSection(r) {
    const ivs    = getInterviews().filter(iv => iv.jd?.raw);
    const hasIvs = ivs.length > 0;
    const options = hasIvs
      ? ivs.map(iv => `<option value="${_esc(iv.id)}">${_esc(iv.company?.name || 'Unknown')} — ${_esc(window.shortenRoleTitle(iv.jd?.structured?.role_title) || 'Unknown Role')}</option>`).join('')
      : '<option value="">No interviews with a job description yet</option>';

    const cachedResult = _selectedIvId && r?.role_fits[_selectedIvId]
      ? _buildRoleFitResult(r.role_fits[_selectedIvId])
      : '';

    return `
      <div class="ivdp-section">
        <div class="ivdp-section-header">
          <div class="ivdp-section-title">Role Fit</div>
        </div>
        <div class="ivdp-section-body">
          <div class="rs-rf-select-row">
            <select class="iv-filter-select rs-iv-select" id="rs-iv-select" ${!hasIvs ? 'disabled' : ''}>
              <option value="">Select an interview to analyze…</option>
              ${options}
            </select>
          </div>
          <div id="rs-rolefit-result">${cachedResult}</div>
        </div>
      </div>`;
  }

  function _buildRoleFitResult(data) {
    const score      = Math.min(100, Math.max(0, data.keyword_match_score || 0));
    const scoreClass = score >= 70 ? 'rs-score-good' : score >= 50 ? 'rs-score-mid' : 'rs-score-low';
    const present    = (data.keywords_present || []).map(k => `<span class="rs-kw-tag rs-kw-present">${_esc(k)}</span>`).join('');
    const missing    = (data.keywords_missing || []).map(k => `<span class="rs-kw-tag rs-kw-missing">${_esc(k)}</span>`).join('');

    return `
      <div class="rs-fit-result">
        <div class="rs-fit-score-row">
          <span class="rs-fit-badge ${scoreClass}">${score}% keyword match</span>
        </div>
        ${present ? `
        <div class="rs-kw-group">
          <div class="rs-kw-label">Keywords Found</div>
          <div class="rs-kw-tags">${present}</div>
        </div>` : ''}
        ${missing ? `
        <div class="rs-kw-group">
          <div class="rs-kw-label">Keywords Missing</div>
          <div class="rs-kw-tags">${missing}</div>
        </div>` : ''}
        ${data.strategic_summary ? `<div class="rs-fit-summary">${_esc(data.strategic_summary)}</div>` : ''}
      </div>`;
  }

  // ── Event wiring ──────────────────────────────────────────────────────────────

  function _wireEvents(r) {
    const fileInput = _el('rs-file-input');

    const dropZone = _el('rs-dropzone');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('rs-dz-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('rs-dz-over'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('rs-dz-over');
        const f = e.dataTransfer.files[0];
        if (f) _handleFile(f);
      });
    }

    const replaceBtn = _el('rs-replace-btn');
    if (replaceBtn && fileInput) replaceBtn.addEventListener('click', () => fileInput.click());

    if (fileInput) {
      fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) _handleFile(f);
      });
    }

    const refreshCoach = _el('rs-refresh-coach');
    if (refreshCoach) {
      refreshCoach.addEventListener('click', () => {
        const resume = getResume();
        if (!resume) return;
        resume.analysis  = null;
        resume.role_fits = {};
        _selectedIvId    = '';
        saveResume(resume);
        render();
      });
    }

    // Rewrite button delegation + hover cross-highlighting (both via rs-content event delegation)
    const content = _el('rs-content');
    if (content) {
      content.addEventListener('click', async e => {
        const btn = e.target.closest('.rs-hl-rewrite-btn');
        if (btn) await _triggerRewrite(btn.dataset.hid, btn);
      });

      content.addEventListener('mouseover', e => {
        const mark = e.target.closest('.rs-ann-mark');
        if (mark) {
          content.querySelectorAll(`.rs-ann-bubble[data-id="${mark.dataset.id}"]`).forEach(b => b.classList.add('rs-hover'));
          return;
        }
        const bubble = e.target.closest('.rs-ann-bubble');
        if (bubble) {
          content.querySelectorAll(`.rs-ann-mark[data-id="${bubble.dataset.id}"]`).forEach(m => m.classList.add('rs-hover'));
        }
      });

      content.addEventListener('mouseout', e => {
        const mark = e.target.closest('.rs-ann-mark');
        if (mark) {
          content.querySelectorAll(`.rs-ann-bubble[data-id="${mark.dataset.id}"]`).forEach(b => b.classList.remove('rs-hover'));
          return;
        }
        const bubble = e.target.closest('.rs-ann-bubble');
        if (bubble) {
          content.querySelectorAll(`.rs-ann-mark[data-id="${bubble.dataset.id}"]`).forEach(m => m.classList.remove('rs-hover'));
        }
      });
    }

    const ivSelect = _el('rs-iv-select');
    if (ivSelect) {
      if (_selectedIvId) ivSelect.value = _selectedIvId;
      ivSelect.addEventListener('change', async e => {
        const id = e.target.value;
        if (!id) { _el('rs-rolefit-result').innerHTML = ''; _selectedIvId = ''; return; }
        _selectedIvId = id;
        await _triggerRoleFit(id);
      });
    }
  }

  // ── File handling ─────────────────────────────────────────────────────────────

  async function _handleFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      window.KModal.alert('Unsupported file type', 'Please upload a PDF or DOCX file.');
      return;
    }

    const uploadBody = _el('rs-upload-body');
    if (uploadBody) {
      uploadBody.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Parsing ${_esc(file.name)}…</div>`;
    }

    let data;
    try {
      const ab = await file.arrayBuffer();
      data = Array.from(new Uint8Array(ab));
    } catch (e) {
      window.KModal.alert('File read error', 'Could not read the file. Please try again.');
      render();
      return;
    }

    let result;
    try {
      result = await window.klinch.invoke('resume:parse', { file_name: file.name, data });
    } catch (err) {
      result = { ok: false, error: err.message || 'IPC error' };
    }

    if (!result?.ok) {
      const uploadBody = _el('rs-upload-body');
      if (uploadBody) {
        uploadBody.innerHTML = `
          <div class="ivdp-ai-error" style="padding:4px 0">
            Could not parse "${_esc(file.name)}": ${_esc(result?.error || 'unknown error')}<br>
            <small>Make sure the file is a valid, non-password-protected PDF or DOCX.</small>
          </div>
          ${_buildDropZone()}`;
        _wireEvents(null);
      }
      return;
    }

    const r = {
      file_name:   file.name,
      uploaded_at: new Date().toISOString(),
      raw_text:    result.text,
      analysis:    null,
      role_fits:   {},
    };
    _selectedIvId = '';
    saveResume(r);
    render();
    _triggerAnalysis(r);
  }

  // ── Claude: full analysis ─────────────────────────────────────────────────────

  async function _triggerAnalysis(r) {
    const result = await window.klinch.invoke('claude:resume-analyze', {
      raw_text:        r.raw_text,
      profile_context: window.profileContext ? window.profileContext(profile) : '',
      role_type:       profile.role_type || 'SDR',
    });

    const fresh = getResume();
    if (!fresh) return;

    const coachBody = _el('rs-coach-body');
    if (!result.ok) {
      if (coachBody) coachBody.innerHTML = `<div class="ivdp-ai-error">Analysis failed: ${_esc(result.error || 'unknown error')}. Use the Refresh button to try again.</div>`;
      return;
    }

    fresh.analysis = result.data;
    saveResume(fresh);
    if (window.klinchNotify) window.klinchNotify('Klinch', 'Your resume coach report is ready.');

    if (coachBody) coachBody.innerHTML = _buildCoachResults(fresh.analysis);

    // Reveal Refresh button
    const header = coachBody?.closest('.ivdp-section')?.querySelector('.ivdp-section-header');
    if (header && !header.querySelector('#rs-refresh-coach')) {
      const btn = document.createElement('button');
      btn.id        = 'rs-refresh-coach';
      btn.className = 'ivdp-add-btn';
      btn.textContent = '↺ Refresh';
      btn.addEventListener('click', () => {
        fresh.analysis  = null;
        fresh.role_fits = {};
        _selectedIvId   = '';
        saveResume(fresh);
        render();
      });
      header.appendChild(btn);
    }

    // Update Document section with annotations
    _renderAnnotations(fresh.analysis);
  }

  // ── Claude: single annotation rewrite ────────────────────────────────────────

  async function _triggerRewrite(hid, btn) {
    if (!hid) return;
    const r = getResume();
    if (!r?.analysis) return;

    const annotations = _normalizeAnnotations(r.analysis);
    const ann = annotations.find(x => x.id === hid);
    if (!ann) return;

    const resultEl = _el(`rs-rw-${hid}`);

    if (ann.rewrite) {
      if (resultEl) { resultEl.textContent = ann.rewrite; resultEl.style.display = ''; }
      return;
    }

    btn.textContent = 'Rewriting…';
    btn.disabled    = true;

    const result = await window.klinch.invoke('claude:resume-rewrite', {
      original:        ann.quote,
      reason:          ann.comment,
      raw_text:        r.raw_text,
      profile_context: window.profileContext ? window.profileContext(profile) : '',
    });

    btn.disabled    = false;
    btn.textContent = 'Rewrite this →';

    if (!result.ok) return;

    // Save rewrite back to whichever schema is stored
    const target = (r.analysis.annotations || r.analysis.highlights || []).find(x => x.id === hid);
    if (target) target.rewrite = result.text;
    saveResume(r);

    if (resultEl) { resultEl.textContent = result.text; resultEl.style.display = ''; }

    // Re-position after bubble height changes
    requestAnimationFrame(_positionAnnotations);
  }

  // ── Claude: role fit ──────────────────────────────────────────────────────────

  async function _triggerRoleFit(ivId) {
    const r = getResume();
    if (!r) return;

    const resultEl = _el('rs-rolefit-result');
    if (!resultEl) return;

    if (r.role_fits[ivId]) {
      resultEl.innerHTML = _buildRoleFitResult(r.role_fits[ivId]);
      return;
    }

    const iv = getInterviews().find(x => x.id === ivId);
    if (!iv?.jd?.raw) {
      resultEl.innerHTML = `<div class="ivdp-empty-state"><div class="ivdp-empty-icon">📋</div><div class="ivdp-empty-title">No job description</div><div class="ivdp-empty-sub">Add a JD to this interview to run a fit analysis.</div></div>`;
      return;
    }

    resultEl.innerHTML = `
      <div class="ivdp-ai-skeleton" style="margin-top:14px">
        <div class="ivdp-skel-line w80"></div>
        <div class="ivdp-skel-line w60"></div>
        <div class="ivdp-skel-line w70"></div>
      </div>`;

    const result = await window.klinch.invoke('claude:role-fit', {
      raw_text:        r.raw_text,
      jd_raw:          iv.jd.raw,
      role_title:      iv.jd?.structured?.role_title || '',
      profile_context: window.profileContext ? window.profileContext(profile) : '',
    });

    if (!result.ok) {
      resultEl.innerHTML = `<div class="ivdp-ai-error">Role fit analysis failed. Try again.</div>`;
      return;
    }

    r.role_fits[ivId] = result.data;
    saveResume(r);
    patchIv(ivId, { candidate_fit_score: result.data.keyword_match_score });
    resultEl.innerHTML = _buildRoleFitResult(result.data);
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  function refresh() { render(); }
  function reset()   { render(); }

  document.addEventListener('dragover', e => e.preventDefault(), false);
  document.addEventListener('drop',     e => e.preventDefault(), false);

  return { refresh, reset };
})();
