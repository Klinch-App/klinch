// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  mode: 'teleprompter', // 'teleprompter' | 'bullets'
  paused: false,
  speed: 80,            // words per minute (scroll rate)
  opacity: 0.82,
  fontSize: 18,
  fontColor: '#ffffff',
  fontFace: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  fullText: '',
  bullets: [],
  scrollPx: 0,          // current scroll offset
  rafId: null,
  hasContent: false,
  overlayState: 'idle', // 'idle' | 'listening' | 'responding'
};

// ─── Elements ─────────────────────────────────────────────────────────────────

const controls           = document.getElementById('controls');
const statusDot          = document.getElementById('status-dot');
const speedLabel         = document.getElementById('speed-label');
const btnSpeedUp         = document.getElementById('btn-speed-up');
const btnSpeedDown       = document.getElementById('btn-speed-down');
const btnMode            = document.getElementById('btn-mode');
const btnPause           = document.getElementById('btn-pause');
const btnDismiss         = document.getElementById('btn-dismiss');
const tpTrack            = document.getElementById('tp-track');
const tpText             = document.getElementById('tp-text');
const bulletsList        = document.getElementById('bullets');
const pauseBadge         = document.getElementById('pause-badge');
const overlayCard        = document.getElementById('overlay-card');
const listeningIndicator = document.getElementById('listening-indicator');

// ─── Click-through: enable mouse events only over the controls bar ────────────
// mousemove fires even when ignoreMouseEvents is active (because forward:true)

document.addEventListener('mousemove', (e) => {
  const overControls = !!document.elementFromPoint(e.clientX, e.clientY)?.closest('#controls');
  window.klinch.send('overlay:set-ignore-mouse', !overControls);
});

// ─── Button handlers ──────────────────────────────────────────────────────────

btnMode.addEventListener('click', () => toggleMode());
btnPause.addEventListener('click', () => togglePause());
btnSpeedUp.addEventListener('click', () => adjustSpeed(10));
btnSpeedDown.addEventListener('click', () => adjustSpeed(-10));
btnDismiss.addEventListener('click', () => window.klinch.invoke('overlay:close'));

// ─── IPC from main process ────────────────────────────────────────────────────

// Hotkeys forwarded from globalShortcut
window.klinch.on('overlay:hotkey', (action) => {
  switch (action) {
    case 'pause':       togglePause(); break;
    case 'replay':      replay(); break;
    case 'dismiss':     clearContent(); break;
    case 'toggle-mode': toggleMode(); break;
    case 'speed-up':    adjustSpeed(10); break;
    case 'speed-down':  adjustSpeed(-10); break;
  }
});

// Full text push (used when not streaming)
window.klinch.on('overlay:set-text', ({ mode, text, bullets }) => {
  if (mode === 'bullets' && bullets) {
    if (state.mode !== 'bullets') switchToMode('bullets');
    loadBullets(bullets);
  } else {
    if (state.mode !== 'teleprompter') switchToMode('teleprompter');
    loadText(text || '');
  }
});

// Streaming token append (Claude response)
window.klinch.on('overlay:append-token', (token) => {
  if (!state.hasContent) {
    // First token — transition to responding state
    tpText.innerHTML = '';
    tpText.style.opacity = '';
    state.fullText = '';
    state.hasContent = true;
    setRespondingState();
    if (!state.paused) startScroll();
  }
  state.fullText += token;
  tpText.textContent = state.fullText;
  if (!state.paused && state.mode === 'teleprompter') snapScrollToEnd();
});

// Clear current suggestion (dismiss hotkey or new question while idle)
window.klinch.on('overlay:clear', () => clearContent());

// Settings update from side panel
window.klinch.on('overlay:settings', (s) => applySettings(s));

// Live interim transcript — user is speaking, show listening state only
window.klinch.on('overlay:transcript', () => {
  if (state.overlayState !== 'listening') setListeningState();
});

// New question detected — if a response was showing, fade it out
window.klinch.on('overlay:thinking', () => {
  stopScroll();
  if (state.hasContent) {
    fadeAndClear(() => setListeningState());
  } else {
    setListeningState();
  }
});

// Answer delivery complete — stay in responding state
window.klinch.on('overlay:response-done', () => {
  // Nothing to do; content stays visible
});

// ─── Overlay state management ─────────────────────────────────────────────────

function setIdleState() {
  state.overlayState = 'idle';
  listeningIndicator.classList.remove('visible');
  statusDot.classList.remove('active');
}

function setListeningState() {
  state.overlayState = 'listening';
  listeningIndicator.classList.add('visible');
  statusDot.classList.remove('active');
}

function setRespondingState() {
  state.overlayState = 'responding';
  listeningIndicator.classList.remove('visible');
  statusDot.classList.add('active');
}

// Fade out current content then invoke callback
function fadeAndClear(callback) {
  if (!state.hasContent) {
    _resetContent();
    callback?.();
    return;
  }
  tpText.classList.add('tp-fade-out');
  setTimeout(() => {
    tpText.classList.remove('tp-fade-out');
    tpText.style.opacity = '';
    _resetContent();
    callback?.();
  }, 320);
}

// Reset content state without touching overlay state
function _resetContent() {
  stopScroll();
  state.fullText = '';
  state.bullets = [];
  state.scrollPx = 0;
  state.hasContent = false;

  tpText.innerHTML = '';
  tpText.style.transform = 'translateX(0)';
  bulletsList.innerHTML = '';

  if (state.paused) {
    state.paused = false;
    btnPause.textContent = '⏸';
    pauseBadge.classList.remove('show');
  }

  window.klinch.send('overlay:resize', 110);
}

// ─── Core actions ─────────────────────────────────────────────────────────────

function toggleMode() {
  switchToMode(state.mode === 'teleprompter' ? 'bullets' : 'teleprompter');
}

function switchToMode(mode) {
  state.mode = mode;
  window.klinch.send('overlay:mode-changed', mode); // keeps main process in sync for Claude prompt selection
  stopScroll();

  if (mode === 'teleprompter') {
    btnMode.textContent = 'Teleprompter';
    btnMode.classList.remove('on');
    tpTrack.style.display = 'block';
    bulletsList.style.display = 'none';
    window.klinch.send('overlay:resize', 110);
    if (state.hasContent && !state.paused) startScroll();
  } else {
    btnMode.textContent = 'Bullets';
    btnMode.classList.add('on');
    tpTrack.style.display = 'none';
    bulletsList.style.display = 'flex';
    resizeForBullets();
    revealBullets();
  }
}

function togglePause() {
  state.paused = !state.paused;
  btnPause.textContent = state.paused ? '▶' : '⏸';
  pauseBadge.classList.toggle('show', state.paused);

  if (state.paused) {
    stopScroll();
  } else if (state.mode === 'teleprompter' && state.hasContent) {
    startScroll();
  }
}

function replay() {
  state.scrollPx = 0;
  tpText.style.transform = 'translateX(0)';
  if (!state.paused && state.mode === 'teleprompter' && state.hasContent) startScroll();
}

function clearContent() {
  if (state.hasContent) {
    fadeAndClear(() => setListeningState());
  } else {
    _resetContent();
    setListeningState();
  }
}

function adjustSpeed(delta) {
  state.speed = Math.max(20, Math.min(300, state.speed + delta));
  speedLabel.textContent = `${state.speed} wpm`;
  if (!state.paused && state.mode === 'teleprompter' && state.hasContent) {
    stopScroll();
    startScroll();
  }
}

// ─── Content loaders ──────────────────────────────────────────────────────────

function loadText(text) {
  state.fullText = text;
  state.scrollPx = 0;
  state.hasContent = true;
  tpText.style.opacity = '';
  tpText.textContent = text;
  tpText.style.transform = 'translateX(0)';
  setRespondingState();
  if (!state.paused) startScroll();
}

function loadBullets(bullets) {
  state.bullets = bullets;
  bulletsList.innerHTML = '';
  bullets.forEach((b) => {
    const li = document.createElement('li');
    li.className = 'bullet';
    li.innerHTML = `<span class="bullet-pip"></span><span>${b}</span>`;
    bulletsList.appendChild(li);
  });
  state.hasContent = true;
  setRespondingState();
  resizeForBullets();
  revealBullets();
}

function revealBullets() {
  const items = bulletsList.querySelectorAll('.bullet');
  items.forEach((item, i) => {
    item.classList.remove('show');
    setTimeout(() => item.classList.add('show'), i * 160);
  });
}

function resizeForBullets() {
  const h = 32 + state.bullets.length * 44 + 28; // controls + items + padding
  window.klinch.send('overlay:resize', Math.min(Math.max(h, 110), 240));
}

// ─── Teleprompter scroll ──────────────────────────────────────────────────────

function startScroll() {
  stopScroll();
  if (state.mode !== 'teleprompter' || !state.hasContent || state.paused) return;

  // pixels per millisecond derived from WPM (avg 5 chars/word, ~6px/char at 18px font)
  const pxPerMs = (state.speed * 5 * 6) / (60 * 1000);

  let last = null;

  function tick(ts) {
    if (state.paused) return;
    if (!last) last = ts;
    const dt = Math.min(ts - last, 50); // cap dt to avoid jump after tab switch
    last = ts;

    const trackW = tpTrack.offsetWidth;
    const textW  = tpText.scrollWidth;
    const max    = Math.max(0, textW - trackW);

    if (state.scrollPx < max) {
      state.scrollPx = Math.min(state.scrollPx + pxPerMs * dt, max);
      tpText.style.transform = `translateX(-${state.scrollPx}px)`;
      state.rafId = requestAnimationFrame(tick);
    } else {
      // Reached end — stop scrolling naturally
      tpText.style.transform = `translateX(-${max}px)`;
      state.rafId = null;
    }
  }

  state.rafId = requestAnimationFrame(tick);
}

function stopScroll() {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

function snapScrollToEnd() {
  const trackW = tpTrack.offsetWidth;
  const textW  = tpText.scrollWidth;
  const max    = Math.max(0, textW - trackW);
  state.scrollPx = max;
  tpText.style.transform = `translateX(-${max}px)`;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function applySettings(s) {
  if (s.opacity !== undefined) {
    state.opacity = s.opacity;
    overlayCard.style.background = `rgba(8, 6, 26, ${s.opacity})`;
  }
  if (s.fontSize !== undefined) {
    state.fontSize = s.fontSize;
    tpText.style.fontSize = `${s.fontSize}px`;
    bulletsList.querySelectorAll('.bullet').forEach(b => {
      b.style.fontSize = `${s.fontSize}px`;
    });
  }
  if (s.fontColor !== undefined) {
    state.fontColor = s.fontColor;
    tpText.style.color = s.fontColor;
    bulletsList.querySelectorAll('.bullet').forEach(b => {
      b.style.color = s.fontColor;
    });
  }
  if (s.fontFace !== undefined) {
    state.fontFace = s.fontFace;
    tpText.style.fontFamily = s.fontFace;
    bulletsList.querySelectorAll('.bullet').forEach(b => {
      b.style.fontFamily = s.fontFace;
    });
  }
  if (s.speed !== undefined) adjustSpeed(s.speed - state.speed);
}
