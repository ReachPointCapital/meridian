-- Meridian: database setup for Supabase.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- It is safe to run again: every statement is idempotent.
--
-- Two tables back the signed-in features. Each user can only ever read or write their own rows.
-- (The portfolio and custom tickers are stored in the browser, not in Supabase.)

-- Saved tickers (src/components/watchlist/Watchlist.jsx)
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

-- Per-ticker research notes (src/components/analysis/AnalysisTab.jsx)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  content text,
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.watchlists enable row level security;
alter table public.notes enable row level security;

-- "using" limits which rows a user can see, update or delete; "with check" limits what they can write.
drop policy if exists "Users manage their own watchlist" on public.watchlists;
create policy "Users manage their own watchlist" on public.watchlists
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own notes" on public.notes;
create policy "Users manage their own notes" on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
