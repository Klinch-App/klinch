// ── DOM refs ──────────────────────────────────────────────────────────────────
const cueEl           = document.getElementById('cue-text');
const topbar          = document.getElementById('ear-fs-topbar');
const bottombar       = document.getElementById('ear-fs-bottombar');
const dot             = document.getElementById('ear-fs-dot');
const minimizeBtn     = document.getElementById('ear-fs-minimize-btn');
const pauseBtn        = document.getElementById('ear-fs-pause');
const resumeBtn       = document.getElementById('ear-fs-resume');
const endBtn          = document.getElementById('ear-fs-end');
const cancelBtn       = document.getElementById('ear-fs-cancel');
const confirmBackdrop = document.getElementById('ear-fs-confirm-backdrop');
const confirmCancel   = document.getElementById('ear-fs-confirm-cancel');
const confirmOk       = document.getElementById('ear-fs-confirm-ok');
const cancelBackdrop  = document.getElementById('ear-fs-cancel-backdrop');
const cancelNo        = document.getElementById('ear-fs-cancel-no');
const cancelYes       = document.getElementById('ear-fs-cancel-yes');

// ── Cue display (passive + full-screen modes) ─────────────────────────────────

let dismissTimer = null;

window.klinch.on('overlay:coaching-cue', (cue) => {
  if (!cue?.trim()) return;

  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  cueEl.className = 'cue-text';
  cueEl.textContent = cue.trim();
  void cueEl.offsetWidth; // force reflow so animation restarts on replacement cues
  cueEl.classList.add('visible');

  dismissTimer = setTimeout(_dismissCue, 5000);
});

function _dismissCue() {
  if (dismissTimer !== null) { clearTimeout(dismissTimer); dismissTimer = null; }
  cueEl.classList.remove('visible');
  cueEl.classList.add('fading');
  dismissTimer = setTimeout(() => {
    cueEl.className = 'cue-text';
    cueEl.textContent = '';
    dismissTimer = null;
  }, 3000);
}

// Escape: dismiss current cue — does NOT exit full-screen
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (confirmBackdrop.classList.contains('visible')) { _closeConfirm(); return; }
  if (cancelBackdrop.classList.contains('visible'))  { _closeCancelConfirm(); return; }
  if (cueEl.textContent.trim()) _dismissCue();
});

// ── Full-screen mode activation / deactivation ───────────────────────────────

window.klinch.on('ear:fs-mode', () => {
  topbar.classList.add('visible');
  bottombar.classList.add('visible');
  document.getElementById('ear-fs-bottom-glow').classList.add('visible');
  document.getElementById('ear-fs-toast').classList.add('active');
});

window.klinch.on('ear:fs-fade-out', () => {
  document.body.classList.add('fading-out');
});

// ── Session state → status dot ────────────────────────────────────────────────

window.klinch.on('ear:fs-session-state', (state) => {
  dot.className = 'ear-fs-dot';
  if (state === 'recording')    dot.classList.add('recording');
  else if (state === 'paused')  dot.classList.add('paused');
  else if (state === 'stopped') dot.classList.add('stopped');
  else if (state === 'error')   dot.classList.add('error');
  // 'idle' leaves dot dim (no class added)
});

// ── Mouse event pass-through management ──────────────────────────────────────
// When mouse is over interactive UI elements, disable click-through so buttons
// receive clicks. Otherwise clicks fall through to the video call underneath.

function _enableMouse()  { window.klinch.send('overlay:set-ignore-mouse', false); }
function _disableMouse() { window.klinch.send('overlay:set-ignore-mouse', true); }

topbar.addEventListener('mouseenter',          _enableMouse);
topbar.addEventListener('mouseleave',          _disableMouse);
bottombar.addEventListener('mouseenter',       _enableMouse);
bottombar.addEventListener('mouseleave',       _disableMouse);
confirmBackdrop.addEventListener('mouseenter', _enableMouse);
confirmBackdrop.addEventListener('mouseleave', _disableMouse);
cancelBackdrop.addEventListener('mouseenter',  _enableMouse);
cancelBackdrop.addEventListener('mouseleave',  _disableMouse);

// ── Control buttons ───────────────────────────────────────────────────────────

pauseBtn.addEventListener('click', () => {
  window.klinch.send('ear:fs-pause');
  pauseBtn.style.display  = 'none';
  resumeBtn.style.display = '';
});

resumeBtn.addEventListener('click', () => {
  window.klinch.send('ear:fs-resume');
  resumeBtn.style.display = 'none';
  pauseBtn.style.display  = '';
});

endBtn.addEventListener('click', _showConfirm);
cancelBtn.addEventListener('click', _showCancelConfirm);

minimizeBtn.addEventListener('click', () => {
  window.klinch.send('ear:fs-minimize');
});

// ── End confirmation ──────────────────────────────────────────────────────────

const completeLabel = document.getElementById('ear-fs-complete-label');
const completeBox   = document.getElementById('ear-fs-complete-box');
let _markComplete = false;

function _showConfirm() {
  _markComplete = false;
  completeBox?.classList.remove('checked');
  confirmBackdrop.classList.add('visible');
  _enableMouse();
}

function _closeConfirm() {
  confirmBackdrop.classList.remove('visible');
  _disableMouse();
}

completeLabel?.addEventListener('click', () => {
  _markComplete = !_markComplete;
  completeBox.classList.toggle('checked', _markComplete);
});

confirmCancel.addEventListener('click', _closeConfirm);

confirmOk.addEventListener('click', () => {
  const markComplete = _markComplete;
  _closeConfirm();
  window.klinch.send('ear:fs-end', { markComplete });
});

// ── Cancel confirmation ───────────────────────────────────────────────────────

function _showCancelConfirm() {
  cancelBackdrop.classList.add('visible');
  _enableMouse();
}

function _closeCancelConfirm() {
  cancelBackdrop.classList.remove('visible');
  _disableMouse();
}

cancelNo.addEventListener('click', _closeCancelConfirm);

cancelYes.addEventListener('click', () => {
  _closeCancelConfirm();
  window.klinch.send('ear:fs-cancel');
});
