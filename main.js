require('dotenv').config();
const { app, BrowserWindow, nativeTheme, screen, ipcMain, globalShortcut, session } = require('electron');
const path = require('path');
const interview      = require('./src/main/ipc/interview');
const audio          = require('./src/main/ipc/audio');
const interviewsData = require('./src/main/ipc/interviews-data');

nativeTheme.themeSource = 'dark';

let mainWindow = null;
let overlayWindow = null;

const OVERLAY_W = 680;
const OVERLAY_H = 110;

// ─── Main window ────────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#08061A',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'ultra-dark',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

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
    width: OVERLAY_W,
    height: OVERLAY_H,
    x: Math.round((width - OVERLAY_W) / 2),
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
    overlayWindow.setSize(OVERLAY_W, Math.round(height));
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

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Auto-approve microphone permissions for Web Speech API + getUserMedia
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'microphone');
  });

  createMainWindow();

  audio.init();
  interviewsData.init();

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
