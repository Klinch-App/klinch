window.DryRunPage = (() => {

  // ── In-memory session state ────────────────────────────────────────────────
  let _config          = null;   // { mode, stage, interview_id }
  let _history         = [];     // [{ question, answer }]
  let _view            = 'setup';
  let _timerInterval   = null;
  let _timerSeconds    = 0;
  let _isRecording     = false;
  let _sessionRunId    = null;
  let _questionNum     = 0;
  let _currentQuestion = null;
  let _mediaRecorder   = null;
  let _dgSocket        = null;
  let _micStream       = null;

  const MAX_QUESTIONS = 10;
  const STAGES = ['Recruiter Screen', 'Hiring Manager', 'Final Round', 'Panel'];

  const INTERVIEW_SYSTEM =
    'You are conducting a realistic SDR job interview. Ask one question at a time based on ' +
    'the stage and context provided. Questions should feel natural and conversational, not robotic. ' +
    'Do not number your questions. Do not explain what you are doing. Just ask the question.';

  const REPORT_SYSTEM =
    'You are an expert SDR interview coach. Analyse this mock interview transcript and return ' +
    'ONLY valid JSON, no preamble, no markdown:\n' +
    '{\n' +
    '  "overall_score": number,\n' +
    '  "summary": string,\n' +
    '  "question_feedback": [{ "question": string, "answer": string, "feedback": string, "score": number }],\n' +
    '  "patterns": {\n' +
    '    "strengths": string[],\n' +
    '    "improvements": string[]\n' +
    '  },\n' +
    '  "filler_words": { "count": number, "examples": string[] },\n' +
    '  "talk_time_note": string\n' +
    '}';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _el(id)  { return document.getElementById(id); }
  function _root()  { return _el('dr-root'); }
  function _esc(s)  {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _getInterviews() {
    return JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
  }
  function _getDryRuns() {
    return JSON.parse(localStorage.getItem('klinch_dry_runs') || '[]');
  }
  function _saveDryRuns(list) {
    localStorage.setItem('klinch_dry_runs', JSON.stringify(list));
  }

  // ── Claude API ─────────────────────────────────────────────────────────────

  async function _claude(system, userContent, maxTokens) {
    const result = await window.klinch.invoke('claude:coach', {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    });
    const text = result?.content?.[0]?.text;
    if (!text) throw new Error('No response from Claude');
    return text;
  }

  // ── Speech Synthesis ───────────────────────────────────────────────────────

  function _speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    function _doSpeak() {
      const utt = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find(v => v.lang.startsWith('en'));
      if (enVoice) utt.voice = enVoice;
      utt.rate = 0.95;
      utt.pitch = 1.0;
      window.speechSynthesis.speak(utt);
    }

    if (window.speechSynthesis.getVoices().length) {
      _doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        _doSpeak();
      };
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────

  function _startTimer() {
    _timerSeconds = 0;
    _timerInterval = setInterval(() => {
      _timerSeconds++;
      const m = Math.floor(_timerSeconds / 60);
      const s = String(_timerSeconds % 60).padStart(2, '0');
      const el = _el('dr-timer');
      if (el) el.textContent = `${m}:${s}`;
    }, 1000);
  }

  function _stopTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }

  // ── Setup Screen ───────────────────────────────────────────────────────────

  function _renderSetup() {
    _view = 'setup';
    const interviews = _getInterviews().filter(iv => iv.jd !== null);
    const dryRuns    = _getDryRuns()
      .filter(r => r.report)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    const interviewOptions = interviews.map(iv => {
      const role = iv.jd?.structured?.role_title || 'SDR';
      return `<option value="${_esc(iv.id)}">${_esc(iv.company.name)} — ${_esc(role)}</option>`;
    }).join('');

    const pastRunsHtml = dryRuns.length ? `
      <div class="dr-history-section">
        <div class="dr-field-label" style="margin-bottom:12px">Past Sessions</div>
        <div class="dr-history-list">
          ${dryRuns.map(r => `
            <div class="dr-history-row">
              <div class="dr-history-meta">
                <span class="dr-history-date">${new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                <span class="dr-history-stage">${_esc(r.stage)}</span>
                <span class="dr-history-mode">${r.mode === 'generic' ? 'Generic SDR' : 'Company-Specific'}</span>
              </div>
              <div class="dr-history-score">${r.report.overall_score}/10</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    _root().innerHTML = `
      <div class="iv-page-header">
        <div class="iv-page-title">Dry Run</div>
      </div>

      <div class="dr-setup-wrap">
        <div class="dr-setup-card">

          <div class="dr-setup-section">
            <div class="dr-field-label">Mode</div>
            <div class="dr-mode-toggle" id="dr-mode-toggle">
              <button class="dr-mode-opt active" data-mode="generic">Generic SDR</button>
              <button class="dr-mode-opt" data-mode="company">Company-Specific</button>
            </div>
          </div>

          <div class="dr-company-row" id="dr-company-row" style="display:none">
            <div class="dr-field-label">Interview</div>
            ${interviews.length
              ? `<select id="dr-interview-select" class="iv-filter-select dr-interview-select">
                   <option value="">Select an interview…</option>
                   ${interviewOptions}
                 </select>`
              : `<div class="dr-no-interviews">No interviews with a job description found. Add one in Interviews.</div>`
            }
          </div>

          <div class="dr-setup-section">
            <div class="dr-field-label">Stage</div>
            <div class="dr-stage-grid" id="dr-stage-grid">
              ${STAGES.map(s => `<button class="dr-stage-opt" data-stage="${_esc(s)}">${_esc(s)}</button>`).join('')}
            </div>
          </div>

          <button class="hero-cta dr-start-btn" id="dr-start-btn" disabled style="margin-top:8px">
            Start Session →
          </button>

        </div>

        ${pastRunsHtml}
      </div>
    `;

    let selectedMode  = 'generic';
    let selectedStage = null;

    function _checkEnabled() {
      const needsInterview = selectedMode === 'company';
      const selectEl = _el('dr-interview-select');
      const hasInterview = needsInterview ? (selectEl && selectEl.value) : true;
      _el('dr-start-btn').disabled = !selectedStage || !hasInterview;
    }

    _el('dr-mode-toggle').addEventListener('click', e => {
      const opt = e.target.closest('.dr-mode-opt');
      if (!opt) return;
      selectedMode = opt.dataset.mode;
      _el('dr-mode-toggle').querySelectorAll('.dr-mode-opt')
        .forEach(b => b.classList.toggle('active', b === opt));
      _el('dr-company-row').style.display = selectedMode === 'company' ? '' : 'none';
      _checkEnabled();
    });

    _el('dr-stage-grid').addEventListener('click', e => {
      const opt = e.target.closest('.dr-stage-opt');
      if (!opt) return;
      selectedStage = opt.dataset.stage;
      _el('dr-stage-grid').querySelectorAll('.dr-stage-opt')
        .forEach(b => b.classList.toggle('active', b === opt));
      _checkEnabled();
    });

    const selectEl = _el('dr-interview-select');
    if (selectEl) selectEl.addEventListener('change', _checkEnabled);

    _el('dr-start-btn').addEventListener('click', () => {
      const interviewId = selectedMode === 'company'
        ? (_el('dr-interview-select')?.value || null)
        : null;
      _config = { mode: selectedMode, stage: selectedStage, interview_id: interviewId };
      _startSession();
    });
  }

  // ── Session Screen ─────────────────────────────────────────────────────────

  async function _startSession() {
    _history     = [];
    _questionNum = 0;
    _isRecording = false;

    _sessionRunId = crypto.randomUUID();
    const runs = _getDryRuns();
    runs.unshift({
      id:           _sessionRunId,
      created_at:   new Date().toISOString(),
      mode:         _config.mode,
      stage:        _config.stage,
      interview_id: _config.interview_id,
      history:      [],
      report:       null,
    });
    _saveDryRuns(runs);

    _renderSessionShell();
    _startTimer();
    _setupMicListeners();
    await _nextQuestion();
  }

  function _renderSessionShell() {
    _view = 'session';
    _root().innerHTML = `
      <div class="dr-session">
        <div class="dr-session-topbar">
          <div class="dr-timer" id="dr-timer">0:00</div>
          <div class="dr-progress" id="dr-progress">
            <div class="dr-q-label">Question</div>
            <div class="dr-q-nums"><span id="dr-q-current">1</span><span class="dr-q-sep"> / ${MAX_QUESTIONS}</span></div>
          </div>
          <div class="dr-topbar-spacer"></div>
        </div>

        <div class="dr-question-area">
          <div class="dr-question-loading" id="dr-question-loading">
            <div class="ivdp-ai-skeleton" style="max-width:580px;margin:0 auto">
              <div class="ivdp-skel-line w80"></div>
              <div class="ivdp-skel-line w60"></div>
            </div>
          </div>
          <div class="dr-question-text" id="dr-question-text" style="display:none"></div>
        </div>

        <div class="dr-controls">
          <div class="dr-transcript-live" id="dr-transcript-live"></div>
          <div class="dr-waveform" id="dr-waveform" style="display:none">${
            [[0.5,0.00,12],[0.7,0.10,32],[0.4,0.20,20],[0.6,0.05,40],
             [0.5,0.30,16],[0.8,0.15,36],[0.4,0.25,24],[0.6,0.00,32],
             [0.7,0.10,18],[0.5,0.35,40],[0.4,0.05,24],[0.6,0.20,20],
             [0.8,0.10,36],[0.5,0.00,28],[0.4,0.30,16],[0.6,0.15,28]]
            .map(([d,dl,h]) => `<span style="animation-duration:${d}s;animation-delay:-${dl}s;height:${h}px"></span>`)
            .join('')
          }</div>
          <button class="dr-start-btn" id="dr-start-btn" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6"/>
            </svg>
            Start Answer
          </button>
          <button class="dr-stop-btn" id="dr-stop-btn" style="display:none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
            Stop & Submit
          </button>
          <div class="dr-mic-label" id="dr-mic-label">Generating question…</div>
        </div>

        <div class="dr-session-footer">
          <button class="dr-end-btn" id="dr-end-btn">End Session</button>
        </div>
      </div>
    `;
  }

  function _setupMicListeners() {
    const root = _root();
    let finalTranscript = '';

    function _resetMicUI(msg) {
      _isRecording = false;
      if (_mediaRecorder && _mediaRecorder.state !== 'inactive') { try { _mediaRecorder.stop(); } catch (_) {} }
      _mediaRecorder = null;
      if (_micStream) { _micStream.getTracks().forEach(t => t.stop()); _micStream = null; }
      if (_dgSocket)  { try { _dgSocket.close(); } catch (_) {} _dgSocket = null; }
      const wvEl = _el('dr-waveform');
      if (wvEl) wvEl.style.display = 'none';
      const startBtn = _el('dr-start-btn');
      const stopBtn  = _el('dr-stop-btn');
      if (startBtn) { startBtn.style.display = ''; startBtn.disabled = false; }
      if (stopBtn)  stopBtn.style.display = 'none';
      const micLabel = _el('dr-mic-label');
      if (micLabel) micLabel.textContent = msg || 'Tap Start Answer to respond';
    }

    async function _startRecording() {
      if (_isRecording) return;
      const startBtn = _el('dr-start-btn');
      if (!startBtn || startBtn.disabled) return;

      _isRecording    = true;
      finalTranscript = '';

      startBtn.style.display = 'none';
      const stopBtn = _el('dr-stop-btn');
      if (stopBtn) stopBtn.style.display = '';

      const micLabel     = _el('dr-mic-label');
      const transcriptEl = _el('dr-transcript-live');
      if (micLabel)     micLabel.textContent = 'Connecting…';
      if (transcriptEl) transcriptEl.textContent = '';

      if (window.speechSynthesis) window.speechSynthesis.cancel();

      try {
        _micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (_) {
        _resetMicUI('Microphone access denied.');
        return;
      }

      const dgKey = window.klinch?.deepgramKey;
      if (!dgKey) {
        _resetMicUI('No API key — check your .env file.');
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';

      _dgSocket = new WebSocket(
        'wss://api.deepgram.com/v1/listen?interim_results=true&punctuate=true&smart_format=true',
        ['token', dgKey]
      );

      _dgSocket.onopen = () => {
        const waveform = _el('dr-waveform');
        if (waveform) waveform.style.display = '';
        if (micLabel) micLabel.textContent = 'Listening…';

        _mediaRecorder = new MediaRecorder(_micStream, { mimeType });
        _mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0 && _dgSocket?.readyState === WebSocket.OPEN) _dgSocket.send(e.data);
        };
        _mediaRecorder.start(200);
      };

      _dgSocket.onmessage = e => {
        try {
          const data = JSON.parse(e.data);
          const alt  = data?.channel?.alternatives?.[0];
          if (!alt?.transcript) return;
          if (data.is_final) finalTranscript += alt.transcript + ' ';
          const el = _el('dr-transcript-live');
          if (el) el.textContent = (finalTranscript + (!data.is_final ? alt.transcript : '')).trim();
        } catch (_) {}
      };

      _dgSocket.onerror = () => _resetMicUI('Connection error — try again.');
      _dgSocket.onclose = () => { if (_isRecording) _resetMicUI('Connection lost — try again.'); };
    }

    function _stopRecording() {
      if (!_isRecording) return;
      _isRecording = false;

      const wvEl = _el('dr-waveform');
      if (wvEl) wvEl.style.display = 'none';
      const startBtn = _el('dr-start-btn');
      const stopBtn  = _el('dr-stop-btn');
      if (startBtn) startBtn.style.display = 'none';
      if (stopBtn)  stopBtn.style.display  = 'none';
      const micLabel = _el('dr-mic-label');
      if (micLabel) micLabel.textContent = 'Processing…';

      if (_mediaRecorder && _mediaRecorder.state !== 'inactive') _mediaRecorder.stop();
      _mediaRecorder = null;
      if (_micStream) { _micStream.getTracks().forEach(t => t.stop()); _micStream = null; }

      // Small delay so Deepgram flushes its last result before closing
      setTimeout(() => {
        if (_dgSocket) { try { _dgSocket.close(); } catch (_) {} _dgSocket = null; }
        const answer = finalTranscript.trim() || '[No answer recorded]';
        const el = _el('dr-transcript-live');
        if (el) el.textContent = '';
        if (_currentQuestion) _submitAnswer(_currentQuestion, answer);
      }, 600);
    }

    root.addEventListener('click', e => {
      if (e.target.closest('#dr-start-btn')) _startRecording();
      if (e.target.closest('#dr-stop-btn'))  _stopRecording();
      if (e.target.closest('#dr-end-btn'))   _endSession();
    });
  }

  async function _nextQuestion() {
    _questionNum++;
    const qNumEl = _el('dr-q-current');
    if (qNumEl) qNumEl.textContent = _questionNum;

    const interviews = _getInterviews();
    const jd = _config.interview_id
      ? (interviews.find(iv => iv.id === _config.interview_id)?.jd?.structured ?? null)
      : null;

    let question;
    try {
      question = await _claude(
        INTERVIEW_SYSTEM,
        JSON.stringify({ stage: _config.stage, mode: _config.mode, jd, history: _history }),
        300
      );
    } catch (_) {
      question = 'Walk me through how you handle a prospect who goes cold after initial interest.';
    }

    _currentQuestion = question;

    const loadingEl  = _el('dr-question-loading');
    const textEl     = _el('dr-question-text');
    const startBtn   = _el('dr-start-btn');
    const micLabel   = _el('dr-mic-label');

    if (loadingEl)  loadingEl.style.display = 'none';
    if (textEl)   { textEl.textContent = question; textEl.style.display = ''; }
    if (startBtn) { startBtn.disabled = false; startBtn.style.display = ''; }
    if (micLabel)   micLabel.textContent = 'Tap Start Answer when ready';

    _speak(question);
  }

  async function _submitAnswer(question, answer) {
    const startBtn  = _el('dr-start-btn');
    const loadingEl = _el('dr-question-loading');
    const textEl    = _el('dr-question-text');
    const micLabel  = _el('dr-mic-label');

    if (startBtn) { startBtn.disabled = true; startBtn.style.display = ''; }

    _history.push({ question, answer });
    _currentQuestion = null;

    const runs = _getDryRuns();
    const run  = runs.find(r => r.id === _sessionRunId);
    if (run) { run.history = [..._history]; _saveDryRuns(runs); }

    if (_history.length >= MAX_QUESTIONS) {
      _endSession();
      return;
    }

    if (textEl)    textEl.style.display = 'none';
    if (loadingEl) loadingEl.style.display = '';
    if (micLabel)  micLabel.textContent = 'Generating next question…';

    await _nextQuestion();
  }

  // ── End Session + Report ───────────────────────────────────────────────────

  async function _endSession() {
    _stopTimer();
    _currentQuestion = null;
    if (_recognition) { try { _recognition.stop(); } catch (_) {} _recognition = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    _renderReportLoading();

    let report = null;
    try {
      const raw     = await _claude(REPORT_SYSTEM, JSON.stringify({ stage: _config.stage, history: _history }), 1500);
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      report = JSON.parse(cleaned);
    } catch (_) {
      report = null;
    }

    const runs = _getDryRuns();
    const run  = runs.find(r => r.id === _sessionRunId);
    if (run) { run.report = report; _saveDryRuns(runs); }
    if (report && window.klinchNotify) window.klinchNotify('Klinch', 'Your Dry Run coaching report is ready.');

    _renderReport(report);
  }

  function _renderReportLoading() {
    _view = 'report';
    _root().innerHTML = `
      <div class="iv-page-header">
        <div class="iv-page-title">Session Report</div>
      </div>
      <div class="dr-report-wrap">
        <div class="ivdp-ai-skeleton" style="max-width:640px;margin:40px auto 0">
          <div class="ivdp-skel-line w80"></div>
          <div class="ivdp-skel-line w60"></div>
          <div class="ivdp-skel-line w70"></div>
          <div class="ivdp-skel-line w50"></div>
          <div class="ivdp-skel-line w80"></div>
          <div class="ivdp-skel-line w60"></div>
        </div>
        <div class="dr-report-loading-label">Analysing your session…</div>
      </div>
    `;
  }

  function _renderReport(report) {
    const dryRuns  = _getDryRuns();
    const pastRuns = dryRuns
      .filter(r => r.id !== _sessionRunId && r.report)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let bodyHtml = '';

    if (!report) {
      bodyHtml = `<div class="ivdp-ai-error" style="margin-bottom:24px">Could not generate report. Your session has been saved.</div>`;
    } else {
      const score        = report.overall_score ?? '—';
      const strengths    = report.patterns?.strengths    || [];
      const improvements = report.patterns?.improvements || [];
      const fillerCount  = report.filler_words?.count    ?? 0;
      const fillerEx     = report.filler_words?.examples || [];
      const qFeedback    = report.question_feedback      || [];

      bodyHtml = `
        <div class="dr-report-hero">
          <div class="dr-score-badge">${score}<span class="dr-score-denom">/10</span></div>
          <div class="dr-report-summary">${_esc(report.summary || '')}</div>
        </div>

        <div class="dr-report-cols">
          <div class="dr-report-col dr-col-strengths">
            <div class="dr-report-col-label">Strengths</div>
            ${strengths.length
              ? strengths.map(s => `<div class="dr-report-col-item">✓ ${_esc(s)}</div>`).join('')
              : '<div class="dr-report-col-item dr-col-empty">None identified</div>'
            }
          </div>
          <div class="dr-report-col dr-col-improvements">
            <div class="dr-report-col-label">To Improve</div>
            ${improvements.length
              ? improvements.map(s => `<div class="dr-report-col-item">↗ ${_esc(s)}</div>`).join('')
              : '<div class="dr-report-col-item dr-col-empty">None identified</div>'
            }
          </div>
        </div>

        <div class="dr-report-section">
          <div class="dr-report-section-title">Filler Words</div>
          <div class="dr-filler-row">
            <span class="dr-filler-count">${fillerCount}</span>
            <span class="dr-filler-label">detected</span>
            ${fillerEx.length ? `<span class="dr-filler-examples">${fillerEx.map(f => `"${_esc(f)}"`).join(', ')}</span>` : ''}
          </div>
          ${report.talk_time_note ? `<div class="dr-talk-time-note">${_esc(report.talk_time_note)}</div>` : ''}
        </div>

        <div class="dr-report-section">
          <div class="dr-report-section-title">Question-by-Question</div>
          <div class="dr-qfeedback-list">
            ${qFeedback.map((qf, i) => `
              <details class="dr-qf-item">
                <summary class="dr-qf-summary">
                  <span class="dr-qf-num">Q${i + 1}</span>
                  <span class="dr-qf-question">${_esc(qf.question || '')}</span>
                  <span class="dr-qf-score">${qf.score ?? '—'}/10</span>
                </summary>
                <div class="dr-qf-body">
                  <div class="dr-qf-label">Your Answer</div>
                  <div class="dr-qf-answer">${_esc(qf.answer || '')}</div>
                  <div class="dr-qf-label" style="margin-top:10px">Feedback</div>
                  <div class="dr-qf-feedback">${_esc(qf.feedback || '')}</div>
                </div>
              </details>
            `).join('')}
          </div>
        </div>
      `;
    }

    const pastRunsHtml = pastRuns.length ? `
      <div class="dr-report-section">
        <div class="dr-report-section-title">Past Sessions</div>
        <div class="dr-history-list">
          ${pastRuns.map(r => `
            <div class="dr-history-row">
              <div class="dr-history-meta">
                <span class="dr-history-date">${new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                <span class="dr-history-stage">${_esc(r.stage)}</span>
                <span class="dr-history-mode">${r.mode === 'generic' ? 'Generic SDR' : 'Company-Specific'}</span>
              </div>
              <div class="dr-history-score">${r.report.overall_score}/10</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    _root().innerHTML = `
      <div class="iv-page-header">
        <div class="iv-page-title">Session Report</div>
      </div>
      <div class="dr-report-wrap">
        ${bodyHtml}
        ${pastRunsHtml}
        <button class="hero-cta" id="dr-new-btn" style="margin-top:32px;margin-bottom:48px">
          Start New Dry Run →
        </button>
      </div>
    `;

    _el('dr-new-btn').addEventListener('click', reset);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset() {
    _stopTimer();
    if (_mediaRecorder && _mediaRecorder.state !== 'inactive') { try { _mediaRecorder.stop(); } catch (_) {} }
    _mediaRecorder = null;
    if (_micStream) { _micStream.getTracks().forEach(t => t.stop()); _micStream = null; }
    if (_dgSocket)  { try { _dgSocket.close(); } catch (_) {} _dgSocket = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    _config          = null;
    _history         = [];
    _questionNum     = 0;
    _isRecording     = false;
    _sessionRunId    = null;
    _currentQuestion = null;
    _renderSetup();
  }

  return { reset };

})();
