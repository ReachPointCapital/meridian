/*
Run this SQL in Supabase SQL editor:

create table watchlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null,
  created_at timestamp with time zone default now(),
  unique(user_id, ticker)
);

create table notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null,
  content text,
  updated_at timestamp with time zone default now(),
  unique(user_id, ticker)
);

-- Enable RLS
alter table watchlists enable row level security;
alter table notes enable row level security;

-- Policies (users can only see their own data)
create policy "Users can manage own watchlist" on watchlists
  for all using (auth.uid() = user_id);

create policy "Users can manage own notes" on notes
  for all using (auth.uid() = user_id);
*/

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || ''
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
