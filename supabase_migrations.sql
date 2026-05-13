-- Run this in the Supabase SQL editor

-- Fix community_questions insert policy.
-- The old policy required auth.role() = 'authenticated', which the main-process
-- Supabase client (using the anon key) does not satisfy when calling insert.
-- Community questions are fully anonymized so open inserts are safe.
drop policy if exists "auth insert" on community_questions;
create policy "open insert" on community_questions
  for insert with check (true);

GRANT ALL ON public.community_questions TO anon, authenticated;

-- ── SESSION 1: Process/Interview parent-child model ───────────────────────────

-- Step 1: Wipe existing seed data
DELETE FROM public.interviews;

-- Step 2: Create processes table
CREATE TABLE IF NOT EXISTS public.processes (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT        NOT NULL,
  company_logo TEXT,
  role_title   TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'Active',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON public.processes TO anon, authenticated;

-- Step 3: Add process_id FK to interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES public.processes(id) ON DELETE CASCADE;

GRANT ALL ON public.interviews TO anon, authenticated;
