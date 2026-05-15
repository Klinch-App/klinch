const { ipcMain } = require('electron');
const { streamFeedback, getCoachingCue, inferQuestions } = require('../api/claude');
const { randomUUID } = require('crypto');
const supabaseApi = require('../api/supabase');

let getMainWindow    = null;
let getOverlayWindow = null;

let sessionActive      = false;
let sessionTranscript  = [];
let currentInterviewId = null;
let utteranceCount     = 0;

const COACHING_EVERY = 3;

// ── Full-screen Ear mode state ────────────────────────────────────────────────

let earFsActive  = false;
let earFsPaused  = false;
let earRoleType  = '';

// Per-session tracking (reset on each ear:fs-start)
let earCuesGiven   = new Set();  // which cue types have fired this session
let earLastCueTime = 0;          // timestamp of most recent cue
const EAR_MIN_CUE_INTERVAL_MS = 150 * 1000; // 2.5 minutes between any two cues

// Filler word detection (rolling 60-second window)
let earFillerBuf  = []; // [{ time: ms }] — one entry per filler detected
const EAR_FILLER_WINDOW_MS  = 60 * 1000;
const EAR_FILLER_THRESHOLD  = 3;
const EAR_FILLER_RE         = /\b(um|uh)\b|\blike\b|\byou know\b/gi;

// WPM detection (rolling 30-second window)
let earWpmBuf = []; // [{ words: n, time: ms }]
const EAR_WPM_WINDOW_MS = 30 * 1000;
const EAR_WPM_THRESHOLD = 175; // words per minute

// Answer length tracking
let earAnswerWords     = 0;
let earAnswerStartTime = null;
let earLastUtteranceTime = null;
const EAR_ANSWER_GAP_MS     = 8000;  // gap > 8s = new answer started
const EAR_ANSWER_TOO_LONG_S = 180;   // 3 minutes

// ── Role-aware cue text ───────────────────────────────────────────────────────

function _roleCue(cueType) {
  const r   = (earRoleType || '').toLowerCase();
  const sdr = /\bsdr\b/.test(r) || r.includes('sales development');
  const ae  = /\bae\b/.test(r)  || r.includes('account executive');
  const se  = /\bse\b/.test(r)  || r.includes('solutions engineer') || r.includes('sales engineer');

  if (cueType === 'too-long') {
    if (sdr) return 'Keep it punchy — start wrapping up';
    if (se)  return 'Land the point — avoid over-explaining';
    if (ae)  return 'Start wrapping up — let them respond';
    return 'Start wrapping up';
  }
  return null;
}

// ── Cue delivery ──────────────────────────────────────────────────────────────

function _fireCue(type, text) {
  if (!earFsActive || earFsPaused)      return false;
  if (earCuesGiven.has(type))           return false;
  const now = Date.now();
  if (now - earLastCueTime < EAR_MIN_CUE_INTERVAL_MS) return false;

  earCuesGiven.add(type);
  earLastCueTime = now;

  const overlay = getOverlayWindow();
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send('overlay:coaching-cue', text);
  }
  console.log(`[ear] cue fired: [${type}] "${text}"`);
  return true;
}

// ── Full-screen Ear mode API (called by main.js) ──────────────────────────────

function setEarFsMode(active, roleType) {
  if (active) {
    earFsActive          = true;
    earFsPaused          = false;
    earRoleType          = roleType || '';
    earCuesGiven         = new Set();
    earLastCueTime       = 0;
    earFillerBuf         = [];
    earWpmBuf            = [];
    earAnswerWords       = 0;
    earAnswerStartTime   = null;
    earLastUtteranceTime = null;
  } else {
    earFsActive = false;
    earFsPaused = false;
    earRoleType = '';
  }
}

// ── Speech analysis per utterance ─────────────────────────────────────────────

function _analyzeEarUtterance(text) {
  if (!earFsActive || earFsPaused || !text?.trim()) return;

  const now   = Date.now();
  const words = text.trim().split(/\s+/);
  const wc    = words.length;

  // ── Filler word detection ───────────────────────────────────────────────────
  const fillers = text.match(EAR_FILLER_RE) || [];
  for (let i = 0; i < fillers.length; i++) {
    earFillerBuf.push({ time: now });
  }
  earFillerBuf = earFillerBuf.filter(f => now - f.time <= EAR_FILLER_WINDOW_MS);
  if (earFillerBuf.length >= EAR_FILLER_THRESHOLD) {
    _fireCue('fillers', 'Watch the filler words');
  }

  // ── WPM detection ──────────────────────────────────────────────────────────
  earWpmBuf.push({ words: wc, time: now });
  earWpmBuf = earWpmBuf.filter(e => now - e.time <= EAR_WPM_WINDOW_MS);
  const windowSecs = Math.min((now - earWpmBuf[0].time) / 1000, EAR_WPM_WINDOW_MS / 1000);
  if (windowSecs >= 10) {
    const totalWords = earWpmBuf.reduce((s, e) => s + e.words, 0);
    const wpm = (totalWords / windowSecs) * 60;
    if (wpm >= EAR_WPM_THRESHOLD) {
      _fireCue('fast', 'Slow down');
    }
  }

  // ── Answer length tracking ─────────────────────────────────────────────────
  const gap = earLastUtteranceTime ? now - earLastUtteranceTime : Infinity;

  if (gap > EAR_ANSWER_GAP_MS) {
    earAnswerWords     = 0;
    earAnswerStartTime = now;
  }

  if (!earAnswerStartTime) earAnswerStartTime = now;
  earAnswerWords += wc;
  earLastUtteranceTime = now;

  const answerDurationS = (now - earAnswerStartTime) / 1000;
  if (answerDurationS >= EAR_ANSWER_TOO_LONG_S) {
    _fireCue('too-long', _roleCue('too-long'));
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function init({ mainWindow, overlayWindow }) {
  getMainWindow    = mainWindow;
  getOverlayWindow = overlayWindow;
  registerHandlers();
}

function registerHandlers() {
  ipcMain.handle('interview:start', (_event, { interviewId } = {}) => {
    currentInterviewId = interviewId || null;
    sessionActive      = true;
    sessionTranscript  = [];
    utteranceCount     = 0;
  });

  ipcMain.handle('interview:stop', () => {
    sessionActive = false;
  });

  // Accumulate transcript entries for post-interview feedback
  ipcMain.on('interview:transcript-entry', (_event, entry) => {
    sessionTranscript.push(entry);
  });

  // VAD-flushed candidate utterance
  ipcMain.on('interview:question', (_event, text) => {
    if (!sessionActive) return;

    // Full-screen Ear mode: use rule-based cue engine
    if (earFsActive) {
      _analyzeEarUtterance(text);
      return; // skip Claude-based coaching in full-screen mode
    }

    // Passive mode: Claude coaching every COACHING_EVERY utterances
    utteranceCount++;
    if (utteranceCount % COACHING_EVERY === 0) {
      const chunk = sessionTranscript
        .slice(-6)
        .map((e) => e.text)
        .join(' ')
        .trim();
      if (chunk) triggerCoachingCue(chunk);
    }
  });

  // Full-screen Ear: pause / resume cue generation
  ipcMain.on('ear:fs-pause',  () => { earFsPaused = true;  });
  ipcMain.on('ear:fs-resume', () => { earFsPaused = false; });

  // Post-interview feedback — full Claude analysis returned to renderer
  ipcMain.handle('interview:feedback', async (_event, { interviewId: callerInterviewId } = {}) => {
    // Use session-state interviewId; fall back to caller-supplied if session was reset
    const resolvedInterviewId = currentInterviewId || callerInterviewId || null;
    if (!currentInterviewId && resolvedInterviewId) currentInterviewId = resolvedInterviewId;

    if (sessionTranscript.length === 0) {
      return 'No transcript recorded for this session.';
    }
    const formatted = sessionTranscript
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e) => `You: ${e.text}`)
      .join('\n');

    console.log('[interview] generating feedback for transcript:\n', formatted);
    let feedback = '';
    await streamFeedback(formatted, (token) => { feedback += token; });

    const sessionRecord = {
      session_id:   randomUUID(),
      interview_id: currentInterviewId,
      created_at:   new Date().toISOString(),
      transcript:   sessionTranscript.slice(),
      feedback,
    };

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      const payloadLiteral = JSON.stringify(JSON.stringify(sessionRecord));
      await win.webContents.executeJavaScript(`
        (function() {
          try {
            var record = JSON.parse(${payloadLiteral});
            var interviews = JSON.parse(localStorage.getItem('klinch_interviews') || '[]');
            var idx = interviews.findIndex(function(iv) { return iv.id === record.interview_id; });
            if (idx !== -1) {
              var sessions = interviews[idx].sessions || [];
              sessions.push({
                session_id: record.session_id,
                created_at: record.created_at,
                transcript: record.transcript,
                feedback:   record.feedback
              });
              interviews[idx] = Object.assign({}, interviews[idx], { sessions: sessions });
            } else {
              interviews.push(record);
            }
            localStorage.setItem('klinch_interviews', JSON.stringify(interviews));
          } catch(e) {
            console.error('[interview] session write failed', e);
          }
        })();
      `).catch((err) => console.error('[interview] executeJavaScript failed:', err.message));

      let interviewRecord = null;
      try {
        const ivJson = await win.webContents.executeJavaScript(
          `JSON.stringify((JSON.parse(localStorage.getItem('klinch_interviews') || '[]')).find(function(iv){ return iv.id === ${JSON.stringify(currentInterviewId)}; }) || null)`
        );
        interviewRecord = JSON.parse(ivJson);
      } catch (_) {}

      contributeToPool(formatted, interviewRecord);
    }

    return feedback;
  });
}

async function contributeToPool(transcript, interviewRecord) {
  // Use admin client (service role) — community_questions inserts need to bypass RLS
  const { supabaseAdmin } = supabaseApi;
  if (!supabaseAdmin) {
    console.log('[community] contributeToPool: no supabaseAdmin client — skipping');
    return;
  }

  const domain = interviewRecord?.company?.domain || null;
  const name   = interviewRecord?.company?.name   || null;
  const stage  = interviewRecord?.stage           || null;

  console.log('[community] contributeToPool called — company:', name, '| domain:', domain, '| stage:', stage, '| transcript chars:', transcript?.length || 0);

  if (!transcript || !transcript.trim()) {
    console.log('[community] empty transcript — skipping');
    return;
  }

  try {
    console.log('[community] calling inferQuestions…');
    const questions = await inferQuestions(transcript);
    console.log('[community] inferred', questions.length, 'questions:', questions);
    if (!questions.length) {
      console.log('[community] no questions inferred — skipping insert');
      return;
    }

    const now  = new Date().toISOString();
    const rows = questions.map(q => ({
      question:         q,
      company_domain:   domain,
      company_name:     name,
      interview_stage:  stage,
      created_at:       now,
    }));

    console.log('[community] inserting', rows.length, 'rows into community_questions…');
    const { data, error } = await supabaseAdmin.from('community_questions').insert(rows).select();
    if (error) {
      console.error('[community] insert failed — message:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    } else {
      console.log('[community] inserted OK —', data?.length ?? rows.length, 'rows saved');
    }
  } catch (err) {
    console.error('[community] contributeToPool threw:', err.message);
  }
}

async function triggerCoachingCue(transcript) {
  if (!sessionActive) return;
  const overlay = getOverlayWindow();
  if (!overlay || overlay.isDestroyed()) return;

  try {
    const cue = await getCoachingCue(transcript);
    if (cue && sessionActive && !overlay.isDestroyed()) {
      overlay.webContents.send('overlay:coaching-cue', cue);
    }
  } catch (err) {
    console.error('[interview] coaching cue error:', err.message);
  }
}

module.exports = { init, setEarFsMode };
