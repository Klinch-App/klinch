const { ipcMain } = require('electron');
const { streamFeedback, getCoachingCue, inferQuestions } = require('../api/claude');
const { randomUUID } = require('crypto');
const supabaseApi = require('../api/supabase');

let getMainWindow   = null;
let getOverlayWindow = null;

let sessionActive      = false;
let sessionTranscript  = [];
let currentInterviewId = null;
let utteranceCount     = 0;

const COACHING_EVERY = 3;

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

  // VAD-flushed candidate utterance — trigger coaching every COACHING_EVERY utterances
  ipcMain.on('interview:question', (_event, _text) => {
    if (!sessionActive) return;
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

  // Post-interview feedback — full Claude analysis returned to renderer
  ipcMain.handle('interview:feedback', async () => {
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

      // Fetch the matched interview record so we can include company/stage in pool rows
      let interviewRecord = null;
      try {
        const ivJson = await win.webContents.executeJavaScript(
          `JSON.stringify((JSON.parse(localStorage.getItem('klinch_interviews') || '[]')).find(function(iv){ return iv.id === ${JSON.stringify(currentInterviewId)}; }) || null)`
        );
        interviewRecord = JSON.parse(ivJson);
      } catch (_) {}

      contributeToPool(formatted, interviewRecord); // fire-and-forget
    }

    return feedback;
  });
}

async function contributeToPool(transcript, interviewRecord) {
  const { supabase } = supabaseApi;
  if (!supabase) return;

  try {
    const questions = await inferQuestions(transcript);
    if (!questions.length) return;

    const domain = interviewRecord?.company?.domain || null;
    const name   = interviewRecord?.company?.name   || null;
    const stage  = interviewRecord?.stage           || null;
    const now    = new Date().toISOString();

    const rows = questions.map(q => ({
      question:         q,
      company_domain:   domain,
      company_name:     name,
      interview_stage:  stage,
      created_at:       now,
    }));

    const { error } = await supabase.from('community_questions').insert(rows);
    if (error) console.error('[interview] community_questions insert:', error.message);
  } catch (err) {
    console.error('[interview] contributeToPool:', err.message);
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

module.exports = { init };
