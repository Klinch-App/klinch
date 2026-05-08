const cueEl = document.getElementById('cue-text');
let dismissTimer = null;

window.klinch.on('overlay:coaching-cue', (cue) => {
  if (!cue?.trim()) return;

  // Clear any in-progress auto-dismiss
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  // Reset classes and text, force reflow so animation restarts on replacement cues
  cueEl.className = 'cue-text';
  cueEl.textContent = cue.trim();
  void cueEl.offsetWidth;
  cueEl.classList.add('visible');

  // Fade out after 5 seconds
  dismissTimer = setTimeout(() => {
    cueEl.classList.remove('visible');
    cueEl.classList.add('fading');
    dismissTimer = setTimeout(() => {
      cueEl.className = 'cue-text';
      cueEl.textContent = '';
      dismissTimer = null;
    }, 600); // matches cue-out animation duration
  }, 5000);
});
