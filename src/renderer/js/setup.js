// First-launch setup flow.
// Step 1: BlackHole detection + guided download.
// Step 2: Klinch Multi-Output device created automatically.
// Persists completion in localStorage.

(async () => {
  const modal       = document.getElementById('setup-modal');
  const continueBtn = document.getElementById('setup-continue-btn');

  const stepBH      = document.getElementById('step-bh');
  const bhNum       = document.getElementById('bh-num');
  const bhDownload  = document.getElementById('bh-download-btn');
  const bhCheck     = document.getElementById('bh-check-btn');

  const explainer   = document.getElementById('bh-explainer');
  const bhInfoBtn   = document.getElementById('bh-info-btn');
  const bhConfirm   = document.getElementById('bh-confirm-btn');
  const bhCancel    = document.getElementById('bh-cancel-btn');

  const stepMO      = document.getElementById('step-mo');
  const moNum       = document.getElementById('mo-num');
  const moGuide     = document.getElementById('mo-guide');
  const moCheck     = document.getElementById('mo-check-btn');

  if (!modal) return;

  // Show modal immediately (synchronously) if setup hasn't been completed.
  // This prevents a flash of main app content on reload (e.g., after onboarding)
  // while we wait for the async audio:setup-status IPC call.
  if (localStorage.getItem('klinch-setup-complete') !== '1') {
    modal.style.display = 'flex';
  }

  let bhDone = false;
  let moDone = false;

  // ── Render state ───────────────────────────────────────────────────────────

  function applyState() {
    stepBH.className = 'setup-step ' + (bhDone ? 'is-done' : 'is-active');
    bhNum.textContent = bhDone ? '✓' : '1';
    bhDownload.style.display = bhDone ? 'none' : '';
    bhCheck.style.display    = bhDone ? 'none' : '';

    const moActive = bhDone && !moDone;
    stepMO.className = 'setup-step ' + (moDone ? 'is-done' : moActive ? 'is-active' : '');
    moNum.textContent = moDone ? '✓' : '2';
    moGuide.style.display = 'none';
    moCheck.style.display = 'none';

    continueBtn.disabled = !(bhDone && moDone);
  }

  // ── Check + auto-create ────────────────────────────────────────────────────

  async function checkAndCreate() {
    const status = await window.klinch.invoke('audio:setup-status');
    console.log('[setup] status:', status);

    bhDone = status.blackholeInstalled;
    moDone = status.multiOutputReady;
    applyState();

    // Auto-create Multi-Output as soon as BlackHole is present
    if (bhDone && !moDone) {
      setMOStatus('Creating audio device…', false);
      const result = await window.klinch.invoke('audio:create-multi-output');
      if (result.ok) {
        moDone = true;
        applyState();
        console.log('[setup] Multi-Output created:', result.name);
      } else {
        setMOStatus('Setup failed — ' + result.error, true);
        moCheck.style.display = '';
        moCheck.textContent = 'Try again';
        console.error('[setup] create failed:', result.error);
      }
    }

    return { bhDone, moDone };
  }

  function setMOStatus(text, isError) {
    const desc = stepMO.querySelector('.setup-step-desc');
    if (desc) {
      desc.textContent = text;
      desc.style.color = isError ? 'var(--accent-pink)' : 'var(--text-secondary)';
    }
  }

  // ── Button handlers ────────────────────────────────────────────────────────

  bhDownload.addEventListener('click', () => {
    explainer.style.display = 'flex';
  });

  bhInfoBtn.addEventListener('click', () => {
    explainer.style.display = 'flex';
  });

  bhConfirm.addEventListener('click', async () => {
    explainer.style.display = 'none';
    await window.klinch.invoke('audio:open-blackhole-download');
    bhCheck.style.display = '';
  });

  bhCancel.addEventListener('click', () => {
    explainer.style.display = 'none';
  });

  bhCheck.addEventListener('click', async () => {
    bhCheck.textContent = 'Checking…';
    bhCheck.disabled = true;
    await checkAndCreate();
    bhCheck.textContent = "I've installed it — check again";
    bhCheck.disabled = false;
  });

  moCheck.addEventListener('click', async () => {
    moCheck.textContent = 'Retrying…';
    moCheck.disabled = true;
    await checkAndCreate();
    moCheck.textContent = 'Try again';
    moCheck.disabled = false;
  });

  continueBtn.addEventListener('click', () => {
    localStorage.setItem('klinch-setup-complete', '1');
    modal.style.display = 'none';
  });

  // ── Initial check ──────────────────────────────────────────────────────────

  const previouslyComplete = localStorage.getItem('klinch-setup-complete') === '1';
  if (previouslyComplete) {
    const status = await window.klinch.invoke('audio:setup-status');
    if (status.blackholeInstalled && status.multiOutputReady) {
      modal.style.display = 'none';
      window.klinch.send('app:initialized'); // Signal main: ready, no setup needed
      return;
    }
    localStorage.removeItem('klinch-setup-complete');
    modal.style.display = 'flex'; // status changed since last visit, show modal
  }

  await checkAndCreate();
  // modal already visible (either shown synchronously above or in the previouslyComplete edge case)
  window.klinch.send('app:initialized'); // Signal main: ready, show window with modal
})();
