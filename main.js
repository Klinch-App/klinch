require('dotenv').config();
process.env.KLINCH_IS_DEV = process.argv.includes('--dev') ? '1' : '';
const { app, BrowserWindow, nativeTheme, screen, ipcMain, globalShortcut, session, Notification } = require('electron');
const path = require('path');
const interview      = require('./src/main/ipc/interview');
const interviewsData = require('./src/main/ipc/interviews-data');
const resumeData     = require('./src/main/ipc/resume');
const billing        = require('./src/main/ipc/billing');
const supabaseApi    = require('./src/main/api/supabase');
const authIpc        = require('./src/main/ipc/auth');
const syncIpc        = require('./src/main/ipc/sync');

// Register klinch:// custom protocol for OAuth callback (must happen before app ready)
app.setAsDefaultProtocolClient('klinch');

nativeTheme.themeSource = 'dark';

let mainWindow    = null;
let overlayWindow = null;

// Full-screen Ear mode state
let earFsReturnTo    = null; // 'dashboard' | 'interviews'
let earFsInterviewId = null;


// ─── Main window ────────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#08061A',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

  // Show only after the renderer signals initialization is complete,
  // then fade the window in so the macOS window-appear animation and
  // any first-paint artifacts are invisible.
  let _shown = false;
  const _show = () => {
    if (_shown || !mainWindow || mainWindow.isDestroyed()) return;
    _shown = true;
    mainWindow.setOpacity(0);
    mainWindow.show();
    let step = 0;
    const STEPS = 8;
    const tick = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      step++;
      mainWindow.setOpacity(step / STEPS);
      if (step < STEPS) setTimeout(tick, 16); // ~130ms total
    };
    setTimeout(tick, 16);
  };
  ipcMain.once('app:initialized', _show);
  setTimeout(_show, 4000); // Safety fallback

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Overlay window ──────────────────────────────────────────────────────────

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Sit above fullscreen apps (Zoom, Teams)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Default: clicks pass through to whatever's behind the overlay
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.loadFile(path.join(__dirname, 'src/renderer/overlay.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    unregisterOverlayShortcuts();
    mainWindow?.webContents.send('overlay:closed');
  });

  registerOverlayShortcuts();
}

function closeOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
}

// ─── Global shortcuts ─────────────────────────────────────────────────────────

// Overlay hotkeys — active only while overlay is open (candidate is speaking, not typing)
const SHORTCUT_MAP = {
  'Space':  'pause',
  'R':      'replay',
  'X':      'dismiss',
  'Escape': 'dismiss',
  'M':      'toggle-mode',
  'Up':     'speed-up',
  'Down':   'speed-down',
};

function registerOverlayShortcuts() {
  for (const [key, action] of Object.entries(SHORTCUT_MAP)) {
    try {
      globalShortcut.register(key, () => {
        overlayWindow?.webContents.send('overlay:hotkey', action);
      });
    } catch (err) {
      console.warn(`Could not register shortcut "${key}":`, err.message);
    }
  }
}

function unregisterOverlayShortcuts() {
  for (const key of Object.keys(SHORTCUT_MAP)) {
    try { globalShortcut.unregister(key); } catch (_) {}
  }
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

// Renderer → fire a native notification via main process
ipcMain.on('notify', (_event, { title, body }) => {
  _fireMainNotification(title, body);
});

// Renderer → launch / close overlay
ipcMain.handle('overlay:launch', () => createOverlayWindow());
ipcMain.handle('overlay:close',  () => closeOverlayWindow());

// Renderer → focus the main window (used before showing in-app modals during active sessions)
ipcMain.handle('window:focus', () => { mainWindow?.focus(); });

// Overlay renderer → toggle click-through for interactive areas
ipcMain.on('overlay:set-ignore-mouse', (_event, ignore) => {
  if (!overlayWindow?.isDestroyed()) {
    if (ignore) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      overlayWindow.setIgnoreMouseEvents(false);
    }
  }
});

// ─── Full-screen Ear mode ─────────────────────────────────────────────────────

// Renderer → launch overlay in full-screen Ear mode
ipcMain.handle('ear:fullscreen-launch', (_event, { interviewId, returnTo, roleType } = {}) => {
  earFsReturnTo    = returnTo    || 'dashboard';
  earFsInterviewId = interviewId || null;

  // Tell the cue engine which role type to use
  interview.setEarFsMode(true, roleType || '');

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    // Overlay already open — drop passive-mode shortcuts before activating full-screen
    unregisterOverlayShortcuts();
    overlayWindow.webContents.send('ear:fs-mode');
    overlayWindow.webContents.send('ear:fs-session-state', 'idle');
    return;
  }

  _createFullscreenOverlay();
});

function _createFullscreenOverlay() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  overlayWindow = new BrowserWindow({
    width, height, x: 0, y: 0,
    transparent:  true,
    frame:        false,
    alwaysOnTop:  true,
    skipTaskbar:  false,
    resizable:    false,
    focusable:    false,
    hasShadow:    false,
    show:         false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.loadFile(path.join(__dirname, 'src/renderer/overlay.html'));

  // setOpacity() does not work on macOS for transparent windows — use CSS fade instead
  overlayWindow.webContents.once('did-finish-load', () => {
    overlayWindow.show();
    overlayWindow.webContents.send('ear:fs-mode');
    overlayWindow.webContents.send('ear:fs-session-state', 'idle');
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    mainWindow?.webContents.send('overlay:closed');
  });
  // No global shortcuts in full-screen Ear mode — keys must stay available for the video call
}

function _fadeOutOverlay(callback) {
  if (!overlayWindow || overlayWindow.isDestroyed()) { callback?.(); return; }
  // setOpacity() does not work on macOS for transparent windows — CSS handles the fade
  overlayWindow.webContents.send('ear:fs-fade-out');
  setTimeout(() => callback?.(), 500);
}

// Overlay → user clicked Start button
ipcMain.on('ear:fs-start', () => {
  mainWindow?.webContents.send('ear:do-start', { interviewId: earFsInterviewId });
  overlayWindow?.webContents.send('ear:fs-session-state', 'recording');
});

// Overlay → user clicked Pause
ipcMain.on('ear:fs-pause', () => {
  overlayWindow?.webContents.send('ear:fs-session-state', 'paused');
  // interview.js registers its own ear:fs-pause handler to pause cue generation
});

// Overlay → user clicked Resume
ipcMain.on('ear:fs-resume', () => {
  overlayWindow?.webContents.send('ear:fs-session-state', 'recording');
  // interview.js registers its own ear:fs-resume handler to resume cue generation
});

// Overlay → user confirmed End session
ipcMain.on('ear:fs-end', (_event, { markComplete } = {}) => {
  overlayWindow?.webContents.send('ear:fs-session-state', 'stopped');

  // Stop STT and generate feedback in main window before fading out
  mainWindow?.webContents.send('ear:do-stop', { interviewId: earFsInterviewId });

  const returnTo    = earFsReturnTo;
  const interviewId = earFsInterviewId;
  earFsReturnTo    = null;
  earFsInterviewId = null;
  interview.setEarFsMode(false, '');

  // Fade out overlay, then close and notify main window
  _fadeOutOverlay(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send('ear:fs-closed', { returnTo, interviewId, markComplete: !!markComplete });
  });
});

// Overlay → user clicked Minimize (no exit modal, session may continue from dashboard)
ipcMain.on('ear:fs-minimize', () => {
  earFsReturnTo    = null;
  earFsInterviewId = null;
  interview.setEarFsMode(false, '');
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  mainWindow?.webContents.send('ear:fs-minimized');
});



// ─── Interview reminder scheduler ────────────────────────────────────────────

const firedReminders    = new Set();
const firedCompletions  = new Set();

function _fireMainNotification(title, body) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

function startReminderScheduler() {
  setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
      const [interviewsJson, settingsJson] = await Promise.all([
        mainWindow.webContents.executeJavaScript('localStorage.getItem("klinch_interviews")'),
        mainWindow.webContents.executeJavaScript('localStorage.getItem("klinch_settings")'),
      ]);

      const settings = settingsJson ? JSON.parse(settingsJson) : {};
      if (settings.notifications_enabled === false) return;

      const interviews = interviewsJson ? JSON.parse(interviewsJson) : [];
      const now = Date.now();

      for (const iv of interviews) {
        if (iv.status !== 'pending' || !iv.scheduled_at) continue;

        const t       = new Date(iv.scheduled_at).getTime();
        const diff    = t - now;
        const company = iv.company?.name || 'your interview';
        const timeStr = new Date(iv.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        const checks = [
          { key: '24h', target: 86400000, body: `Interview tomorrow — ${company} at ${timeStr}` },
          { key: '1h',  target:  3600000, body: `Interview in 1 hour — ${company}. You've got this.` },
          { key: '5m',  target:   300000, body: `Your ${company} interview starts in 5 minutes.` },
        ];

        for (const { key, target, body } of checks) {
          const id = `${iv.id}-${key}`;
          if (!firedReminders.has(id) && diff > target - 90000 && diff <= target + 90000) {
            firedReminders.add(id);
            _fireMainNotification('Klinch', body);
          }
        }

        // Auto-complete: interview is still pending but ended > 30 min ago
        const completionKey = `${iv.id}-complete`;
        if (!firedCompletions.has(completionKey) && diff < -1800000) {
          firedCompletions.add(completionKey);
          mainWindow.webContents.executeJavaScript(
            `window._completeInterview && window._completeInterview(${JSON.stringify(iv.id)})`
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[scheduler]', err.message);
    }
  }, 60000);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Auto-approve microphone permissions for Web Speech API + getUserMedia
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'microphone');
  });

  createMainWindow();
  startReminderScheduler();

  supabaseApi.init();
  authIpc.init({ mainWindow: () => mainWindow });
  syncIpc.init();

  interviewsData.init();
  resumeData.init();
  billing.init();

  // Wire interview pipeline IPC (Claude, STT relay, session management)
  interview.init({
    mainWindow: () => mainWindow,
    overlayWindow: () => overlayWindow,
  });

  // Cmd+Return: manual trigger — tells stt.js to flush current buffer immediately
  // Registered globally (not just when overlay is open) so it works any time a session is active
  try {
    globalShortcut.register('CommandOrControl+Return', () => {
      mainWindow?.webContents.send('interview:manual-trigger');
    });
  } catch (err) {
    console.warn('Could not register Cmd+Return shortcut:', err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  unregisterOverlayShortcuts();
  try { globalShortcut.unregister('CommandOrControl+Return'); } catch (_) {}
  if (process.platform !== 'darwin') app.quit();
});

// macOS: handle klinch:// custom-protocol redirect from OAuth browser flow
app.on('open-url', (event, url) => {
  event.preventDefault();
  authIpc.handleAuthCallback(url);
});

