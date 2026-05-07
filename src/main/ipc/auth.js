'use strict';

const { ipcMain, shell } = require('electron');
const supabaseApi        = require('../api/supabase');

const REDIRECT_URL = 'klinch://auth/callback';

let _getMainWindow = null;

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

  ipcMain.handle('auth:sign-in-google', async () => {
    const { supabase } = supabaseApi;
    if (!supabase) return _unavailable();
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
      });
      if (error) return { ok: false, error: error.message };
      if (data?.url) {
        await shell.openExternal(data.url);
        return { ok: true };
      }
      return { ok: false, error: 'No OAuth URL returned from Supabase' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

// Called by main.js open-url / second-instance handlers when the custom-protocol
// redirect fires after Google OAuth completes in the system browser.
async function handleAuthCallback(url) {
  const { supabase } = supabaseApi;
  if (!supabase) return;
  try {
    const parsed = new URL(url);

    // PKCE code exchange
    const code = parsed.searchParams.get('code');
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.session) {
        _getMainWindow?.()?.webContents.send('auth:session', { ok: true, session: data.session, user: data.user });
      }
      return;
    }

    // Implicit / hash-based fallback
    const hash   = parsed.hash.slice(1);
    const params = new URLSearchParams(hash);
    const access_token  = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!error && data.session) {
        _getMainWindow?.()?.webContents.send('auth:session', { ok: true, session: data.session, user: data.user });
      }
    }
  } catch (err) {
    console.error('[auth] handleAuthCallback error:', err.message);
  }
}

module.exports = { init, handleAuthCallback };
