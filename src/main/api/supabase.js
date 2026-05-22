/*
 * SUPABASE SCHEMA — run in Supabase SQL editor to create tables
 *
 * -- profiles (extends auth.users)
 * create table profiles (
 *   id uuid references auth.users primary key,
 *   role_type text,
 *   experience_years text,
 *   company_size text,
 *   challenge text,
 *   job_search_status text,
 *   strongest_asset text,
 *   improvement_area text,
 *   tools text,
 *   salary_range text,
 *   additional_context text,
 *   stripe_customer_id text,
 *   plan text default 'free',
 *   credits integer default 3,
 *   created_at timestamptz default now()
 * );
 *
 * -- interviews
 * create table interviews (
 *   id uuid primary key,
 *   user_id uuid references auth.users,
 *   data jsonb,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 *
 * -- applications
 * create table applications (
 *   id uuid primary key,
 *   user_id uuid references auth.users,
 *   data jsonb,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 *
 * -- dry_runs
 * create table dry_runs (
 *   id uuid primary key,
 *   user_id uuid references auth.users,
 *   data jsonb,
 *   created_at timestamptz default now()
 * );
 *
 * -- resumes
 * create table resumes (
 *   user_id uuid references auth.users primary key,
 *   data jsonb,
 *   updated_at timestamptz default now()
 * );
 *
 * Row-level security — enable RLS and add policies so users only see their own rows:
 *   alter table profiles    enable row level security;
 *   alter table interviews  enable row level security;
 *   alter table applications enable row level security;
 *   alter table dry_runs    enable row level security;
 *   alter table resumes     enable row level security;
 *
 *   create policy "own rows" on profiles    for all using (auth.uid() = id);
 *   create policy "own rows" on interviews  for all using (auth.uid() = user_id);
 *   create policy "own rows" on applications for all using (auth.uid() = user_id);
 *   create policy "own rows" on dry_runs    for all using (auth.uid() = user_id);
 *   create policy "own rows" on resumes     for all using (auth.uid() = user_id);
 *
 * -- community_questions (shared anonymized interview question pool — no user_id, public read)
 * create table community_questions (
 *   id              uuid primary key default gen_random_uuid(),
 *   question        text not null,
 *   company_domain  text,
 *   company_name    text,
 *   interview_stage text,
 *   created_at      timestamptz default now()
 * );
 *
 *   alter table community_questions enable row level security;
 *   -- anyone can read; only authenticated users (service role via insert from main process) can write
 *   create policy "public read"  on community_questions for select using (true);
 *   create policy "auth insert"  on community_questions for insert with check (auth.role() = 'authenticated');
 */

'use strict';

const path = require('path');
const fs   = require('fs');

let supabase      = null; // anon client — used for auth flows
let supabaseAdmin = null; // service-role client — bypasses RLS, used for data sync

function init() {
  const url        = process.env.SUPABASE_URL;
  const key        = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[auth] SUPABASE_URL or SUPABASE_ANON_KEY not set — Supabase unavailable');
    return;
  }

  // Persist Supabase session to a file in the user-data directory.
  // Requires electron's `app` module — init() must be called after app.whenReady().
  const { app } = require('electron');
  const SESSION_PATH = path.join(app.getPath('userData'), 'klinch-auth.json');

  function _read() {
    try { return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')); }
    catch { return {}; }
  }
  function _write(data) {
    try { fs.writeFileSync(SESSION_PATH, JSON.stringify(data), 'utf8'); }
    catch (err) { console.error('[auth] session write failed:', err.message); }
  }

  const storage = {
    getItem:    (key)        => _read()[key] ?? null,
    setItem:    (key, value) => { const d = _read(); d[key] = value; _write(d); },
    removeItem: (key)        => { const d = _read(); delete d[key]; _write(d); },
  };

  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(url, key, {
    auth: {
      storage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
      flowType:           'pkce',
    },
  });

  if (serviceKey) {
    supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log('[auth] Supabase admin client initialized (service role)');
  } else {
    console.warn('[auth] SUPABASE_SERVICE_ROLE_KEY not set — data sync will be blocked by RLS when unauthenticated');
  }

  console.log('[auth] Supabase client initialized');
}

module.exports = {
  get supabase()      { return supabase; },
  get supabaseAdmin() { return supabaseAdmin; },
  init,
};
