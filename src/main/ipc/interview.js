const { ipcMain } = require('electron');
const { streamAnswer, streamFeedback } = require('../api/claude');
const { randomUUID } = require('crypto');

let getMainWindow = null;
let getOverlayWindow = null;

let sessionActive = false;
let currentMode = 'teleprompter';
let isProcessing = false;
let sessionTranscript = [];
let currentInterviewId = null;

function init({ mainWindow, overlayWindow }) {
  getMainWindow = mainWindow;
  getOverlayWindow = overlayWindow;
  registerHandlers();
}

function registerHandlers() {
  ipcMain.handle('interview:start', (_event, { interviewId } = {}) => {
    currentInterviewId = interviewId || null;
    sessionActive = true;
    isProcessing = false;
    sessionTranscript = [];
  });

  ipcMain.handle('interview:stop', () => {
    sessionActive = false;
    isProcessing = false;
  });

  // Accumulate speaker-labelled transcript entries for post-interview feedback
  ipcMain.on('interview:transcript-entry', (_event, entry) => {
    // entry: { speaker: 'interviewer'|'you', text: string, timestamp: number }
    sessionTranscript.push(entry);
  });

  // Overlay mode changes
  ipcMain.on('overlay:mode-changed', (_event, mode) => {
    currentMode = mode;
  });

  // VAD-flushed or manually triggered question from stt.js (interviewer utterance)
  ipcMain.on('interview:question', (_event, question) => {
    if (!sessionActive || isProcessing || !question?.trim()) return;
    handleQuestion(question.trim());
  });

  // Relay live interim transcript from main window to overlay
  ipcMain.on('interview:transcript', (_event, text) => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send('overlay:transcript', text);
    }
  });

  // Post-interview feedback — returns full Claude analysis to renderer
  ipcMain.handle('interview:feedback', async () => {
    if (sessionTranscript.length === 0) {
      return 'No transcript recorded for this session.';
    }
    const formatted = sessionTranscript
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e) => `${e.speaker === 'interviewer' ? 'Interviewer' : 'You'}: ${e.text}`)
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
      // Double-stringify so the payload is a safe JS string literal regardless of feedback content
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
    }

    return feedback;
  });
}

async function handleQuestion(question) {
  isProcessing = true;
  const mode = currentMode;
  const overlay = getOverlayWindow();

  if (!overlay || overlay.isDestroyed()) {
    isProcessing = false;
    return;
  }

  try {
    if (mode === 'teleprompter') {
      overlay.webContents.send('overlay:clear');
      await streamAnswer(question, mode, (token) => {
        if (!overlay.isDestroyed()) {
          overlay.webContents.send('overlay:append-token', token);
        }
      });
    } else {
      overlay.webContents.send('overlay:thinking');
      const fullText = await streamAnswer(question, mode, () => {});
      const bullets = parseBullets(fullText);
      if (!overlay.isDestroyed()) {
        overlay.webContents.send('overlay:set-text', { mode: 'bullets', bullets });
      }
    }
  } catch (err) {
    console.error('[interview] Claude error:', err.message);
  }

  if (!overlay.isDestroyed()) {
    overlay.webContents.send('overlay:response-done');
  }

  isProcessing = false;
}

function parseBullets(raw) {
  return raw
    .split('\n')
    .map((line) => line.replace(/^[•\-\*]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 4);
}

module.exports = { init };
