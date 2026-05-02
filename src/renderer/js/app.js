// ── Sidebar navigation ────────────────────────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  // Show the matching page div, hide all others
  document.querySelectorAll('[id^="page-"]').forEach(p => {
    p.style.display = p.id === `page-${page}` ? '' : 'none';
  });

  if (page === 'interviews' && window.InterviewsPage) window.InterviewsPage.refresh();
  if (page === 'companies' && window.CompaniesPage)  window.CompaniesPage.refresh();
}
window.navigateTo = navigateTo;

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ── Dashboard stat card click-throughs ────────────────────────────────────────
document.querySelectorAll('.card[data-nav]').forEach(card => {
  card.addEventListener('click', () => navigateTo(card.dataset.nav));
});

// ── Overlay launch button ─────────────────────────────────────────────────────
const launchBtn = document.getElementById('btn-launch-overlay');
if (launchBtn) {
  launchBtn.addEventListener('click', async () => {
    await window.klinch.invoke('overlay:launch');
    launchBtn.textContent = 'Klinch Ear Active';
    launchBtn.style.opacity = '0.6';
    launchBtn.style.cursor = 'default';
  });

  window.klinch.on('overlay:closed', () => {
    launchBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="3" width="12" height="8" rx="2"/>
        <circle cx="7" cy="7" r="2"/>
      </svg>
      Launch Klinch Ear`;
    launchBtn.style.opacity = '';
    launchBtn.style.cursor = '';
  });
}

// ── Interview panel ───────────────────────────────────────────────────────────
const btnStart       = document.getElementById('btn-start-interview');
const btnStop        = document.getElementById('btn-stop-interview');
const deviceDot      = document.getElementById('device-dot');
const deviceLabel    = document.getElementById('device-label');
const transcriptBody = document.getElementById('transcript-body');

// Each entry: { speaker: 'interviewer'|'you', text: string }
let transcriptLines = [];
const MAX_LINES = 8;

function renderTranscript(interimText = null, interimSpeaker = null) {
  if (!transcriptBody) return;

  const lines = transcriptLines.map((l) => {
    const prefix = l.speaker === 'interviewer' ? 'Interviewer' : 'You';
    return `${prefix}: ${l.text}`;
  });

  if (interimText) {
    const prefix = interimSpeaker === 'interviewer' ? 'Interviewer' : 'You';
    lines.push(`${prefix}: ${interimText}…`);
  }

  transcriptBody.textContent = lines.join('\n') || 'Transcript will appear here once Klinch Ear is active…';
}

if (btnStart) {
  btnStart.addEventListener('click', async () => {
    btnStart.disabled = true;
    btnStart.textContent = 'Starting Klinch Ear…';

    await window.klinch.invoke('overlay:launch');

    const ok = await window.STT.startSession();
    if (ok) {
      btnStart.style.display = 'none';
      btnStop.style.display  = '';
    }
    btnStart.disabled = false;
    btnStart.textContent = 'Start Klinch Ear';
  });
}

if (btnStop) {
  btnStop.addEventListener('click', async () => {
    await window.STT.stopSession();
    btnStop.style.display  = 'none';
    btnStart.style.display = '';
    transcriptLines = [];
    renderTranscript();
  });
}

// ── Live transcript display ───────────────────────────────────────────────────

document.addEventListener('stt:interim', (e) => {
  renderTranscript(e.detail.text, e.detail.speaker);
});

document.addEventListener('stt:final', (e) => {
  transcriptLines.push({ speaker: e.detail.speaker, text: e.detail.text });
  if (transcriptLines.length > MAX_LINES) transcriptLines.shift();
  renderTranscript();
});

// ── Device status badge ───────────────────────────────────────────────────────

document.addEventListener('stt:device-status', (e) => {
  const status = e.detail;
  if (!deviceDot) return;
  deviceDot.className = 'device-dot';
  if (status === 'blackhole') {
    deviceDot.classList.add('ok');
    if (deviceLabel) deviceLabel.textContent = 'Audio device: BlackHole + mic ✓';
  } else if (status === 'fallback') {
    deviceDot.classList.add('warn');
    if (deviceLabel) deviceLabel.textContent = 'Audio device: Default mic (BlackHole not found)';
  } else {
    deviceDot.classList.add('error');
    if (deviceLabel) deviceLabel.textContent = 'Audio device: Error — check microphone permissions';
  }
});
