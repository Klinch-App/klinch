'use strict';

window.Auth = (() => {

  // Renderer-side Supabase client — lives here so window.localStorage is
  // available for the PKCE code verifier across the OAuth round-trip.
  // _supaAuth is the GoTrueClient (.auth), where signInWithOAuth etc. live.
  const _supaAuth = window.supabase?.createClient(
    window.klinch.supabaseUrl,
    window.klinch.supabaseAnonKey,
    { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: false } }
  )?.auth ?? null;

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
    const ageWrap     = document.getElementById('auth-age-wrap');
    const ageBox      = document.getElementById('auth-age-checkbox');
    const privacyWrap = document.getElementById('auth-privacy-wrap');

    if (_mode === 'signup') {
      if (heading)      heading.textContent       = 'Save your work.';
      if (submitBtn)    submitBtn.textContent      = 'Create Account';
      if (toggleMsg)    toggleMsg.textContent      = 'Already have an account?';
      if (toggleBtn)    toggleBtn.textContent      = 'Log In';
      if (pwConfirm)    pwConfirm.style.display    = '';
      if (ageWrap)      ageWrap.style.display      = '';
      if (privacyWrap)  privacyWrap.style.display  = '';
    } else {
      if (heading)      heading.textContent       = 'Welcome back.';
      if (submitBtn)    submitBtn.textContent      = 'Log In';
      if (toggleMsg)    toggleMsg.textContent      = "Don't have an account?";
      if (toggleBtn)    toggleBtn.textContent      = 'Sign Up';
      if (pwConfirm)    pwConfirm.style.display    = 'none';
      if (ageWrap)      ageWrap.style.display      = 'none';
      if (ageBox)       ageBox.checked             = false;
      if (privacyWrap)  privacyWrap.style.display  = 'none';
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

    // Terms / Privacy links
    document.getElementById('auth-terms-link')?.addEventListener('click', () => {
      window.klinch.invoke('shell:open-external', { url: 'https://tryklinch.com/terms' });
    });
    document.getElementById('auth-privacy-link')?.addEventListener('click', () => {
      window.klinch.invoke('shell:open-external', { url: 'https://tryklinch.com/privacy' });
    });

    // Direct Google PKCE OAuth — bypasses the Supabase OAuth proxy entirely.
    // We build the Google auth URL ourselves, exchange the code directly with
    // Google's token endpoint (no client_secret needed for installed-app PKCE),
    // then hand the resulting ID token to Supabase via signInWithIdToken.
    async function _generatePKCE() {
      const raw = new Uint8Array(32);
      crypto.getRandomValues(raw);
      const verifier = btoa(String.fromCharCode(...raw))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      return { verifier, challenge };
    }

    async function _generateNonce() {
      const raw = new Uint8Array(16);
      crypto.getRandomValues(raw);
      const rawNonce = btoa(String.fromCharCode(...raw))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
      const hashedNonce = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      return { rawNonce, hashedNonce };
    }

    const googleBtn = document.getElementById('auth-google-btn');
    googleBtn?.addEventListener('click', async () => {
      _setError('');
      _setLoading(true);

      if (!_supaAuth) {
        _setError('Supabase not configured.');
        _setLoading(false);
        return;
      }
      if (!window.klinch.googleClientId) {
        _setError('Google sign-in is not configured.');
        _setLoading(false);
        return;
      }

      const serverRes = await window.klinch.invoke('auth:start-oauth-server');
      if (!serverRes.ok) {
        _setError('Could not start sign-in server. Please try again.');
        _setLoading(false);
        return;
      }
      const redirectUri = `http://127.0.0.1:${serverRes.port}`;

      const { verifier, challenge } = await _generatePKCE();
      const { rawNonce, hashedNonce } = await _generateNonce();
      sessionStorage.setItem('google_pkce_verifier', verifier);
      sessionStorage.setItem('google_oauth_nonce', rawNonce);
      sessionStorage.setItem('google_redirect_uri', redirectUri);

      const params = new URLSearchParams({
        client_id:             window.klinch.googleClientId,
        redirect_uri:          redirectUri,
        response_type:         'code',
        scope:                 'openid email profile',
        code_challenge:        challenge,
        code_challenge_method: 'S256',
        nonce:                 hashedNonce,
        access_type:           'offline',
        prompt:                'select_account',
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

      _setLoading(false);
      await window.klinch.invoke('shell:open-external', { url: authUrl });
      const waitMsg = document.getElementById('auth-wait-msg');
      if (waitMsg) waitMsg.style.display = '';
    });

    // Deep-link callback forwarded from main process after Google redirects
    // back to klinch://auth/callback.
    const _removeOAuthListener = window.klinch.on('auth:oauth-callback', async (callbackUrl) => {
      _removeOAuthListener();
      const waitMsg = document.getElementById('auth-wait-msg');
      const parsed  = new URL(callbackUrl);

      const urlError = parsed.searchParams.get('error');
      if (urlError) {
        _setError(parsed.searchParams.get('error_description') || urlError);
        if (waitMsg) waitMsg.style.display = 'none';
        return;
      }

      const code        = parsed.searchParams.get('code');
      const verifier    = sessionStorage.getItem('google_pkce_verifier');
      const rawNonce    = sessionStorage.getItem('google_oauth_nonce');
      const redirectUri = sessionStorage.getItem('google_redirect_uri');
      sessionStorage.removeItem('google_pkce_verifier');
      sessionStorage.removeItem('google_oauth_nonce');
      sessionStorage.removeItem('google_redirect_uri');

      if (!code) {
        _setError('Google sign-in did not return a code. Please try again.');
        if (waitMsg) waitMsg.style.display = 'none';
        return;
      }

      // Token exchange runs in the main process so the client_secret stays out
      // of the renderer.
      const exchangeRes = await window.klinch.invoke('auth:exchange-google-code', { code, redirectUri, verifier });
      if (!exchangeRes.ok || !exchangeRes.id_token) {
        _setError(exchangeRes.error || 'Google sign-in failed.');
        if (waitMsg) waitMsg.style.display = 'none';
        return;
      }

      // Hand the ID token to Supabase — creates/links the account and returns a session.
      const { data, error } = await _supaAuth.signInWithIdToken({
        provider: 'google',
        token:    exchangeRes.id_token,
        nonce:    rawNonce,
      });

      if (error || !data?.session) {
        _setError(error?.message || 'Sign-in failed. Please try again.');
        if (waitMsg) waitMsg.style.display = 'none';
        return;
      }

      await window.klinch.invoke('auth:set-session', {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (waitMsg) waitMsg.style.display = 'none';
      _onAuthSuccess();
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
      if (_mode === 'signup' && !document.getElementById('auth-age-checkbox')?.checked) {
        _setError('You must be 18 or older to use Klinch.');
        return;
      }

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
