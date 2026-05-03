window.ResumePage = (() => {

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
  }

  function getInterviews() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  }

  function patchIv(id, patch) {
    const all = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
    const idx = all.findIndex(x => x.id === id);
    if (idx >= 0) { Object.assign(all[idx], patch); localStorage.setItem('klinch_interviews', JSON.stringify(all)); }
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
      ${r ? _buildCoachSection(r) : ''}
      ${r ? _buildRoleFitSection(r) : ''}
    `;

    _wireEvents(r);

    if (r && !r.analysis) {
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
        <div class="rs-dz-sub">PDF or DOCX &nbsp;·&nbsp; or <label class="rs-dz-browse" for="rs-file-input">browse files</label></div>
      </div>
      <input type="file" id="rs-file-input" accept=".pdf,.docx" style="display:none">`;
  }

  function _buildFileInfo(r) {
    const date = r.uploaded_at
      ? new Date(r.uploaded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '';
    const preview = r.raw_text
      ? `<details class="ivdp-raw-jd" style="margin-top:14px">
           <summary>Preview extracted text</summary>
           <pre class="ivdp-raw-text">${_esc((r.raw_text || '').slice(0, 3000))}${(r.raw_text || '').length > 3000 ? '\n…' : ''}</pre>
         </details>`
      : '';
    return `
      <div class="rs-file-info">
        <div class="rs-file-icon">📄</div>
        <div class="rs-file-meta">
          <div class="rs-file-name">${_esc(r.file_name || 'Resume')}</div>
          ${date ? `<div class="rs-file-date">Uploaded ${_esc(date)}</div>` : ''}
        </div>
      </div>
      ${preview}
      <input type="file" id="rs-file-input" accept=".pdf,.docx" style="display:none">`;
  }

  // ── Section 2: Coach ──────────────────────────────────────────────────────────

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
      impact:           'Impact',
      clarity:          'Clarity',
      ats_compatibility:'ATS Compatibility',
      sdr_relevance:    'SDR Relevance',
    };

    const score    = Math.min(100, Math.max(0, a.overall_score || 0));
    const scoreClass = score >= 75 ? 'rs-score-good' : score >= 50 ? 'rs-score-mid' : 'rs-score-low';

    const dimBars = Object.entries(a.dimensions || {}).map(([key, val]) => {
      const pct = Math.min(100, Math.max(0, val || 0));
      return `
        <div class="rs-dim-row">
          <div class="rs-dim-label">${_esc(DIM_LABELS[key] || key)}</div>
          <div class="rs-dim-track"><div class="rs-dim-fill" style="width:${pct}%"></div></div>
          <div class="rs-dim-val">${pct}</div>
        </div>`;
    }).join('');

    const highlights = (a.highlights || []).map(h => `
      <div class="rs-highlight-card" data-hid="${_esc(h.id || '')}">
        <div class="rs-hl-original">&ldquo;${_esc(h.original || '')}&rdquo;</div>
        <div class="rs-hl-reason">${_esc(h.reason || '')}</div>
        <button class="rs-hl-rewrite-btn" data-hid="${_esc(h.id || '')}">Rewrite this →</button>
        <div class="rs-hl-rewrite-result" id="rs-rw-${_esc(h.id || '')}"${h.rewrite ? '' : ' style="display:none"'}>${h.rewrite ? _esc(h.rewrite) : ''}</div>
      </div>`).join('');

    const atsTips = (a.ats_tips || []).map(t => `
      <div class="rs-ats-tip">
        <span class="rs-ats-check">○</span>
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
      ${highlights ? `
      <div class="rs-sub-label">Improvements</div>
      <div class="rs-highlights">${highlights}</div>` : ''}
      ${atsTips ? `
      <div class="rs-sub-label" style="margin-top:22px">ATS Tips</div>
      <div class="rs-ats-tips">${atsTips}</div>` : ''}`;
  }

  // ── Section 3: Role Fit ───────────────────────────────────────────────────────

  function _buildRoleFitSection(r) {
    const ivs     = getInterviews().filter(iv => iv.jd?.raw);
    const hasIvs  = ivs.length > 0;
    const options = hasIvs
      ? ivs.map(iv => `<option value="${_esc(iv.id)}">${_esc(iv.company?.name || 'Unknown')} — ${_esc(iv.jd?.structured?.role_title || 'Unknown Role')}</option>`).join('')
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

    // Drop zone: click → browse, drag/drop
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

    // Replace button → click hidden file input
    const replaceBtn = _el('rs-replace-btn');
    if (replaceBtn && fileInput) replaceBtn.addEventListener('click', () => fileInput.click());

    // File input change
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) _handleFile(f);
      });
    }

    // Refresh coach analysis
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

    // Rewrite buttons in coach body (event delegation)
    const coachBody = _el('rs-coach-body');
    if (coachBody) {
      coachBody.addEventListener('click', async e => {
        const btn = e.target.closest('.rs-hl-rewrite-btn');
        if (btn) await _triggerRewrite(btn.dataset.hid, btn);
      });
    }

    // Role fit dropdown
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
      alert('Please upload a PDF or DOCX file.');
      return;
    }

    // Show parsing indicator inline
    const uploadBody = _el('rs-upload-body');
    if (uploadBody) {
      uploadBody.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Parsing ${_esc(file.name)}…</div>`;
    }

    // Read as ArrayBuffer — avoids file.path (removed in Electron 32+)
    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (e) {
      alert('Could not read the file. Please try again.');
      render();
      return;
    }

    const result = await window.klinch.invoke('resume:parse', {
      file_name: file.name,
      buffer:    arrayBuffer,
    });
    if (!result.ok) {
      alert('Failed to parse resume: ' + result.error);
      render();
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
    const result = await window.klinch.invoke('claude:resume-analyze', { raw_text: r.raw_text });

    const fresh = getResume();
    if (!fresh) return;

    const coachBody = _el('rs-coach-body');
    if (!result.ok) {
      if (coachBody) coachBody.innerHTML = `<div class="ivdp-ai-error">Analysis failed: ${_esc(result.error || 'unknown error')}. Use the Refresh button to try again.</div>`;
      return;
    }

    fresh.analysis = result.data;
    saveResume(fresh);

    if (coachBody) {
      coachBody.innerHTML = _buildCoachResults(fresh.analysis);
      // Re-wire rewrite buttons in new HTML
      coachBody.querySelectorAll('.rs-hl-rewrite-btn').forEach(btn => {
        btn.addEventListener('click', async e => { await _triggerRewrite(btn.dataset.hid, btn); });
      });
    }

    // Reveal Refresh button in section header
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
  }

  // ── Claude: single highlight rewrite ─────────────────────────────────────────

  async function _triggerRewrite(hid, btn) {
    if (!hid) return;
    const r = getResume();
    if (!r?.analysis) return;
    const h = r.analysis.highlights.find(x => x.id === hid);
    if (!h) return;

    const resultEl = _el(`rs-rw-${hid}`);

    if (h.rewrite) {
      if (resultEl) { resultEl.textContent = h.rewrite; resultEl.style.display = ''; }
      return;
    }

    btn.textContent = 'Rewriting…';
    btn.disabled    = true;

    const result = await window.klinch.invoke('claude:resume-rewrite', {
      original: h.original,
      reason:   h.reason,
      raw_text: r.raw_text,
    });

    btn.disabled    = false;
    btn.textContent = 'Rewrite this →';

    if (!result.ok) return;

    h.rewrite = result.text;
    saveResume(r);
    if (resultEl) { resultEl.textContent = h.rewrite; resultEl.style.display = ''; }
  }

  // ── Claude: role fit ──────────────────────────────────────────────────────────

  async function _triggerRoleFit(ivId) {
    const r = getResume();
    if (!r) return;

    const resultEl = _el('rs-rolefit-result');
    if (!resultEl) return;

    // Serve cache
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
      raw_text:   r.raw_text,
      jd_raw:     iv.jd.raw,
      role_title: iv.jd?.structured?.role_title || '',
    });

    if (!result.ok) {
      resultEl.innerHTML = `<div class="ivdp-ai-error">Role fit analysis failed. Try again.</div>`;
      return;
    }

    r.role_fits[ivId] = result.data;
    saveResume(r);

    // Write score back to the interview record
    patchIv(ivId, { candidate_fit_score: result.data.keyword_match_score });

    resultEl.innerHTML = _buildRoleFitResult(result.data);
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  function refresh() { render(); }
  function reset()   { render(); }

  // Prevent Electron window from navigating when files are dragged over non-dropzone areas
  document.addEventListener('dragover', e => e.preventDefault(), false);
  document.addEventListener('drop',     e => e.preventDefault(), false);

  return { refresh, reset };
})();
