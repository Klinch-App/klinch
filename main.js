require('dotenv').config();
process.env.KLINCH_IS_DEV = process.argv.includes('--dev') ? '1' : '';
const { app, BrowserWindow, nativeTheme, screen, ipcMain, globalShortcut, session, Notification } = require('electron');
const path = require('path');
const interview      = require('./src/main/ipc/interview');
const audio          = require('./src/main/ipc/audio');
const interviewsData = require('./src/main/ipc/interviews-data');
const resumeData     = require('./src/main/ipc/resume');
const billing        = require('./src/main/ipc/billing');
const supabaseApi    = require('./src/main/api/supabase');
const authIpc        = require('./src/main/ipc/auth');
const syncIpc        = require('./src/main/ipc/sync');

// Register klinch:// custom protocol for OAuth callback (must happen before app ready)
app.setAsDefaultProtocolClient('klinch');

nativeTheme.themeSource = 'dark';

let mainWindow = null;
let overlayWindow = null;

const OVERLAY_H = 170;

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

  const { width } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width,
    height: OVERLAY_H,
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

// Overlay renderer → resize window (e.g. when switching to bullet mode)
ipcMain.on('overlay:resize', (_event, height) => {
  if (!overlayWindow?.isDestroyed()) {
    overlayWindow.setSize(overlayWindow.getBounds().width, Math.round(height));
  }
});

// Main window → push content to overlay (relay channel for direct renderer→overlay pushes)
ipcMain.on('overlay:set-text', (_event, data) => {
  overlayWindow?.webContents.send('overlay:set-text', data);
});
ipcMain.on('overlay:append-token', (_event, token) => {
  overlayWindow?.webContents.send('overlay:append-token', token);
});
ipcMain.on('overlay:clear', () => {
  overlayWindow?.webContents.send('overlay:clear');
});
ipcMain.on('overlay:update-settings', (_event, settings) => {
  overlayWindow?.webContents.send('overlay:settings', settings);
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

  audio.init();
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

// Restore system audio output before quit — covers force-quit, Cmd+Q, and
// window close while a session is still active.
let quitting = false;
app.on('before-quit', (e) => {
  if (quitting) return;
  e.preventDefault();
  quitting = true;
  audio.forceRestoreOutput().finally(() => app.quit());
});
