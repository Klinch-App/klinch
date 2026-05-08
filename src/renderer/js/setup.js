(async () => {
  const modal = document.getElementById('setup-modal');
  if (!modal) return;

  async function requestMic() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((t) => t.stop());
  }

  // Previously completed — silently re-verify mic permission is still granted
  if (localStorage.getItem('klinch_setup_complete') === '1') {
    try {
      await requestMic();
      modal.style.display = 'none';
      window.klinch.send('app:initialized');
      return;
    } catch (_) {
      localStorage.removeItem('klinch_setup_complete');
    }
  }

  // Show modal synchronously so the main window renders with it already visible
  modal.style.display = 'flex';
  renderPrompt();
  window.klinch.send('app:initialized');

  function renderPrompt() {
    modal.innerHTML = `
      <div class="setup-card">
        <h2 class="setup-heading">Microphone access required</h2>
        <p class="setup-body">Klinch needs your microphone to transcribe your responses in real time. Your audio is processed locally and never stored.</p>
        <button id="mic-grant-btn" class="setup-continue-btn">Allow Microphone</button>
      </div>
    `;
    document.getElementById('mic-grant-btn').addEventListener('click', async () => {
      const btn = document.getElementById('mic-grant-btn');
      btn.disabled = true;
      btn.textContent = 'Requesting access…';
      try {
        await requestMic();
        localStorage.setItem('klinch_setup_complete', '1');
        modal.style.display = 'none';
      } catch (_) {
        renderError();
      }
    });
  }

  function renderError() {
    modal.innerHTML = `
      <div class="setup-card">
        <h2 class="setup-heading">Microphone access denied</h2>
        <p class="setup-body">Klinch requires microphone access to function. Open System Settings → Privacy &amp; Security → Microphone, enable access for Klinch, then relaunch the app.</p>
      </div>
    `;
  }
})();
