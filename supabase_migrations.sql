-- Run this in the Supabase SQL editor

-- Fix community_questions insert policy.
-- The old policy required auth.role() = 'authenticated', which the main-process
-- Supabase client (using the anon key) does not satisfy when calling insert.
-- Community questions are fully anonymized so open inserts are safe.
drop policy if exists "auth insert" on community_questions;
create policy "open insert" on community_questions
  for insert with check (true);

GRANT ALL ON public.community_questions TO anon, authenticated;
