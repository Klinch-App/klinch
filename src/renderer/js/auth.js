'use strict';

window.Auth = (() => {

  let _mode = 'signup'; // 'signup' | 'login'

  // ── Overlay lifecycle ──────────────────────────────────────────────────────

  function showAuthScreen() {
    const el = document.getElementById('auth-overlay');
    if (el) el.style.display = 'flex';
  }

  function _hideAuthScreen() {
    const el = document.getElementById('auth-overlay');
    if (el) el.style.display = 'none';
  }

  // ── After successful auth ──────────────────────────────────────────────────

  async function _onAuthSuccess() {
    // Always push profile to Supabase on login (covers first-login after onboarding)
    const localProfile = localStorage.getItem('klinch_profile');
    if (localProfile) {
      window.klinch.invoke('supabase:sync-up', { key: 'klinch_profile', data: JSON.parse(localProfile) }).catch(() => {});
    }

    // Check for first-login migration (localStorage has data, Supabase has none)
    const needsMigration = await window.Sync?.checkMigration?.();
    if (needsMigration) {
      _showSyncing(true);
      await window.Sync.migrateLocalToSupabase();
    }

    // Sync down — Supabase wins, merges into localStorage
    await window.Sync?.syncAllDown?.();

    _showSyncing(false);
    _hideAuthScreen();
    window._klinchInitApp?.();
  }

  function _showSyncing(visible) {
    const el = document.getElementById('auth-syncing');
    const form = document.getElementById('auth-form');
    const googleBtn = document.getElementById('auth-google-btn');
    const toggleRow = document.querySelector('.auth-toggle-row');
    if (!el) return;
    el.style.display = visible ? '' : 'none';
    if (form)      form.style.display      = visible ? 'none' : '';
    if (googleBtn) googleBtn.style.display = visible ? 'none' : '';
    if (toggleRow) toggleRow.style.display = visible ? 'none' : '';
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function _setError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? '' : 'none';
  }

  function _setLoading(loading) {
    const submitBtn  = document.getElementById('auth-submit-btn');
    const googleBtn  = document.getElementById('auth-google-btn');
    const emailInput = document.getElementById('auth-email');
    const pwInput    = document.getElementById('auth-password');
    if (submitBtn)  submitBtn.disabled  = loading;
    if (googleBtn)  googleBtn.disabled  = loading;
    if (emailInput) emailInput.disabled = loading;
    if (pwInput)    pwInput.disabled    = loading;
    if (submitBtn)  submitBtn.textContent = loading
      ? 'Please wait…'
      : _mode === 'signup' ? 'Create Account' : 'Log In';
  }

  function _updateMode() {
    const toggleMsg = document.getElementById('auth-toggle-msg');
    const toggleBtn = document.getElementById('auth-mode-toggle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const heading   = document.getElementById('auth-heading');
    const pwConfirm = document.getElementById('auth-password-confirm-wrap');

    if (_mode === 'signup') {
      if (heading)   heading.textContent   = 'Save your work.';
      if (submitBtn) submitBtn.textContent = 'Create Account';
      if (toggleMsg) toggleMsg.textContent = 'Already have an account?';
      if (toggleBtn) toggleBtn.textContent = 'Log In';
      if (pwConfirm) pwConfirm.style.display = '';
    } else {
      if (heading)   heading.textContent   = 'Welcome back.';
      if (submitBtn) submitBtn.textContent = 'Log In';
      if (toggleMsg) toggleMsg.textContent = "Don't have an account?";
      if (toggleBtn) toggleBtn.textContent = 'Sign Up';
      if (pwConfirm) pwConfirm.style.display = 'none';
    }
    _setError('');
  }

  // ── Bind events ────────────────────────────────────────────────────────────

  function _bind() {
    // Mode toggle
    document.getElementById('auth-mode-toggle')?.addEventListener('click', () => {
      _mode = _mode === 'signup' ? 'login' : 'signup';
      _updateMode();
    });

    // Google OAuth
    document.getElementById('auth-google-btn')?.addEventListener('click', async () => {
      _setError('');
      _setLoading(true);
      const res = await window.klinch.invoke('auth:sign-in-google');
      _setLoading(false);
      if (!res.ok) {
        _setError(res.error || 'Could not start Google sign-in.');
        return;
      }
      // Show a message while the browser window is open
      _setError('');
      const waitMsg = document.getElementById('auth-wait-msg');
      if (waitMsg) waitMsg.style.display = '';
    });

    // Email/password form
    document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      _setError('');

      const email    = document.getElementById('auth-email')?.value.trim() || '';
      const password = document.getElementById('auth-password')?.value     || '';
      const confirm  = document.getElementById('auth-password-confirm')?.value || '';

      if (!email || !password) { _setError('Please enter your email and password.'); return; }
      if (_mode === 'signup' && password !== confirm) { _setError('Passwords do not match.'); return; }
      if (password.length < 8) { _setError('Password must be at least 8 characters.'); return; }

      _setLoading(true);
      const channel = _mode === 'signup' ? 'auth:sign-up' : 'auth:sign-in';
      const res     = await window.klinch.invoke(channel, { email, password });
      _setLoading(false);

      if (!res.ok) { _setError(res.error || 'Something went wrong. Please try again.'); return; }

      if (res.needsConfirmation) {
        _setError('');
        const waitMsg = document.getElementById('auth-confirm-msg');
        if (waitMsg) { waitMsg.style.display = ''; }
        return;
      }

      _onAuthSuccess();
    });

    // Listen for OAuth callback result from main process
    window.klinch.on('auth:session', (data) => {
      if (data.ok && data.session) {
        const waitMsg = document.getElementById('auth-wait-msg');
        if (waitMsg) waitMsg.style.display = 'none';
        _onAuthSuccess();
      } else {
        _setError('Sign-in failed. Please try again.');
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    _bind();
    _updateMode();

    // Dev-only skip button — bypasses auth entirely
    if (window.klinch.isDev) {
      const devSkip = document.getElementById('auth-dev-skip');
      if (devSkip) {
        devSkip.style.display = '';
        devSkip.addEventListener('click', () => {
          localStorage.setItem('klinch_dev_auth_bypass', '1');
          _onAuthSuccess();
        });
      }
    }
  }

  return { showAuthScreen, init };
})();

window.Auth.init();
