'use strict';

const { ipcMain } = require('electron');
const supabaseApi  = require('../api/supabase');

// Maps localStorage keys to Supabase table names
const TABLE = {
  klinch_interviews:   'interviews',
  klinch_applications: 'applications',
  klinch_dry_runs:     'dry_runs',
  klinch_resume:       'resumes',
  klinch_profile:      'profiles',
};

// Keys whose value is an array of objects each with an `id` field
const ARRAY_KEYS  = new Set(['klinch_interviews', 'klinch_applications', 'klinch_dry_runs']);
// Keys whose value is a single object keyed per-user
const SINGLE_KEYS = new Set(['klinch_resume', 'klinch_profile']);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function _userId() {
  const { supabase } = supabaseApi;
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch { return null; }
}

// ── Array table sync ──────────────────────────────────────────────────────────

async function _arrayUp(supabase, table, userId, arr) {
  if (!Array.isArray(arr)) return;
  const now = new Date().toISOString();

  if (arr.length > 0) {
    const hasUpdatedAt = table !== 'dry_runs';
    const rows = arr.map(item => {
      const row = { id: item.id, user_id: userId, data: item };
      if (hasUpdatedAt) row.updated_at = now;
      return row;
    });

    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // Delete rows that are no longer in the array (handles deletes)
  const ids = arr.map(item => item.id).filter(Boolean);
  if (ids.length > 0) {
    const { error } = await supabase.from(table).delete()
      .eq('user_id', userId)
      .not('id', 'in', `(${ids.join(',')})`);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw error;
  }
}

async function _arrayDown(supabase, table, userId) {
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return null; // no remote data → keep localStorage
  return data.map(row => row.data);
}

// ── Single-object table sync ──────────────────────────────────────────────────

async function _profileUp(supabase, userId, data) {
  const row = {
    id:                 userId,
    role_type:          data.role_type          || null,
    experience_years:   data.experience_years   || null,
    // Arrays stored comma-separated in the text column
    company_size:       Array.isArray(data.company_size) ? data.company_size.join(', ') : (data.company_size || null),
    challenge:          Array.isArray(data.challenge)    ? data.challenge.join(', ')    : (data.challenge    || null),
    job_search_status:  data.job_search_status  || null,
    strongest_asset:    data.strongest_asset    || null,
    improvement_area:   data.improvement_area   || null,
    tools:              data.tools              || null,
    salary_range:       data.salary_range       || null,
    additional_context: data.additional_context || null,
  };
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

async function _profileDown(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error?.code === 'PGRST116') return { profile: null, billing: null }; // row not found
  if (error) throw error;

  const profile = {
    completed:          true,
    role_type:          data.role_type          || null,
    experience_years:   data.experience_years   || null,
    company_size:       data.company_size ? data.company_size.split(', ') : [],
    challenge:          data.challenge    ? data.challenge.split(', ')    : [],
    job_search_status:  data.job_search_status  || null,
    strongest_asset:    data.strongest_asset    || null,
    improvement_area:   data.improvement_area   || null,
    tools:              data.tools              || null,
    salary_range:       data.salary_range       || null,
    additional_context: data.additional_context || null,
  };

  const billing = {
    stripe_customer_id: data.stripe_customer_id || null,
    plan:               data.plan               || null,
    credits:            data.credits            ?? null,
  };

  return { profile, billing };
}

async function _resumeUp(supabase, userId, data) {
  const row = { user_id: userId, data, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('resumes').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

async function _resumeDown(supabase, userId) {
  const { data, error } = await supabase
    .from('resumes')
    .select('data')
    .eq('user_id', userId)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data?.data ?? null;
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function init() {
  // supabase:sync-up — write-through after any localStorage write to a synced key
  ipcMain.handle('supabase:sync-up', async (_event, { key, data }) => {
    const { supabase } = supabaseApi;
    if (!supabase) return { ok: true }; // dev bypass — no-op

    const table  = TABLE[key];
    if (!table)  return { ok: true }; // not a synced key

    const userId = await _userId();
    if (!userId) return { ok: true }; // no session — skip silently

    try {
      if (ARRAY_KEYS.has(key))        await _arrayUp(supabase, table, userId, data);
      else if (key === 'klinch_profile') await _profileUp(supabase, userId, data);
      else if (key === 'klinch_resume')  await _resumeUp(supabase, userId, data);
      return { ok: true };
    } catch (err) {
      console.error(`[sync] sync-up "${key}":`, err.message);
      return { ok: false, error: err.message };
    }
  });

  // supabase:sync-down — fetch all records for current user from a table
  // Returns: { ok, data } where data is the localStorage-ready value, or null if no remote data.
  // For klinch_profile also returns billing sub-object.
  ipcMain.handle('supabase:sync-down', async (_event, { key }) => {
    const { supabase } = supabaseApi;
    if (!supabase) return { ok: true, data: null }; // dev bypass

    const userId = await _userId();
    if (!userId) return { ok: true, data: null };

    try {
      if (ARRAY_KEYS.has(key)) {
        const data = await _arrayDown(supabase, TABLE[key], userId);
        return { ok: true, data };
      }
      if (key === 'klinch_profile') {
        const { profile, billing } = await _profileDown(supabase, userId);
        return { ok: true, data: profile, billing };
      }
      if (key === 'klinch_resume') {
        const data = await _resumeDown(supabase, userId);
        return { ok: true, data };
      }
      return { ok: true, data: null };
    } catch (err) {
      console.error(`[sync] sync-down "${key}":`, err.message);
      return { ok: false, error: err.message, data: null };
    }
  });
}

module.exports = { init };
