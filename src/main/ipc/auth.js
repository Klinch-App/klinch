'use strict';

const { ipcMain } = require('electron');
const http        = require('http');
const supabaseApi  = require('../api/supabase');

let _getMainWindow = null;
let _oauthServer   = null;

function _unavailable() {
  return { ok: false, error: 'Supabase not configured — add SUPABASE_URL and SUPABASE_ANON_KEY to .env' };
}

function _devSession() {
  return { ok: true, session: { user: { id: 'dev', email: 'dev@local' } }, user: { id: 'dev', email: 'dev@local' } };
}

function init({ mainWindow }) {
  _getMainWindow = mainWindow;

  ipcMain.handle('auth:get-session', async () => {
    const { supabase } = supabaseApi;
    if (!supabase) return _devSession(); // no keys → bypass auth in dev
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { ok: false, error: error.message };
      return { ok: true, session: data.session, user: data.session?.user ?? null };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:sign-in', async (_event, { email, password }) => {
    const { supabase } = supabaseApi;
    if (!supabase) return _unavailable();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true, session: data.session, user: data.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:sign-up', async (_event, { email, password }) => {
    const { supabase } = supabaseApi;
    if (!supabase) return _unavailable();
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { ok: false, error: error.message };
      return {
        ok:                true,
        session:           data.session,
        user:              data.user,
        needsConfirmation: !data.session,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:sign-out', async () => {
    const { supabase } = supabaseApi;
    if (!supabase) return { ok: true };
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:change-password', async (_event, { currentPassword, newPassword }) => {
    const { supabase } = supabaseApi;
    if (!supabase) return _unavailable();
    try {
      const { data: sd } = await supabase.auth.getSession();
      const email = sd?.session?.user?.email;
      if (!email) return { ok: false, error: 'Not signed in.' };

      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verifyErr) return { ok: false, error: 'Current password is incorrect.' };

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('auth:delete-account', async () => {
    const { supabase } = supabaseApi;
    if (!supabase) return _unavailable();
    try {
      const { data: sd } = await supabase.auth.getSession();
      const userId = sd?.session?.user?.id;
      if (!userId) return { ok: false, error: 'Not signed in.' };

      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return { ok: false, error: 'Account deletion is not configured. Please contact support at support@tryklinch.com.' };
      }

      const { createClient } = require('@supabase/supabase-js');
      const admin = createClient(process.env.SUPABASE_URL, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return { ok: false, error: error.message };

      await supabase.auth.signOut();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Loopback OAuth server — starts a one-shot HTTP server on a random port so
  // Google can redirect to http://127.0.0.1:PORT after auth without needing a
  // custom URI scheme (which Google no longer accepts for new Desktop clients).
  ipcMain.handle('auth:start-oauth-server', () => {
    if (_oauthServer) { _oauthServer.close(); _oauthServer = null; }

    return new Promise((resolve) => {
      let port = null;
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Sign-in complete &mdash; you can close this tab and return to Klinch.</h2><script>window.close()</script></body></html>');
        server.close();
        _oauthServer = null;
        _getMainWindow?.()?.webContents.send('auth:oauth-callback', `http://127.0.0.1:${port}${req.url}`);
      });

      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        _oauthServer = server;
        resolve({ ok: true, port });
      });

      server.on('error', (err) => resolve({ ok: false, error: err.message }));
    });
  });

  // Token exchange with Google — runs in main so the client_secret never
  // touches the renderer process.
  ipcMain.handle('auth:exchange-google-code', async (_event, { code, redirectUri, verifier }) => {
    try {
      const params = new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID || '',
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        code_verifier: verifier,
      });
      if (process.env.GOOGLE_CLIENT_SECRET) {
        params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET);
      }
      const res  = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params,
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error_description || data.error || 'Token exchange failed.' };
      return { ok: true, id_token: data.id_token };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Session sync — called by renderer after it completes the OAuth exchange,
  // so the main-process Supabase client also has an active session for data ops.
  ipcMain.handle('auth:set-session', async (_event, { access_token, refresh_token }) => {
    const { supabase } = supabaseApi;
    if (!supabase) return _unavailable();
    try {
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) return { ok: false, error: error.message };
      return { ok: true, session: data.session };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

// Called by main.js open-url / second-instance handlers when the klinch://
// deep link fires after Google OAuth. Forwards the URL to the renderer so
// the renderer-side Supabase client (which holds the PKCE verifier) can
// complete the code exchange.
//
// open-url and second-instance can both fire for the same URL (macOS dev mode),
// so deduplicate: ignore a URL that was already forwarded within the last 5s.
let _lastCallbackUrl  = null;
let _lastCallbackTime = 0;

function handleAuthCallback(url) {
  const now = Date.now();
  if (url === _lastCallbackUrl && now - _lastCallbackTime < 5000) {
    console.log('[handleAuthCallback] duplicate — ignoring:', url);
    return;
  }
  _lastCallbackUrl  = url;
  _lastCallbackTime = now;
  console.log('[handleAuthCallback] forwarding to renderer:', url);
  _getMainWindow?.()?.webContents.send('auth:oauth-callback', url);
}

module.exports = { init, handleAuthCallback };
