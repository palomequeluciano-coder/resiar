-- Arena v27: matchmaking sin código.
create table if not exists public.arena_matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  mode text not null default 'duel_live' check (mode in ('duel_live','duel_async')),
  status text not null default 'searching' check (status in ('searching','matched','cancelled','expired')),
  access_snapshot text check (access_snapshot in ('full','limited')),
  filters jsonb not null default '{}'::jsonb,
  question_count integer not null default 10 check (question_count between 1 and 100),
  time_limit_sec integer not null default 600 check (time_limit_sec > 0),
  matched_match_id uuid references public.arena_matches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  unique(user_id, status)
);
create index if not exists arena_matchmaking_queue_search_idx on public.arena_matchmaking_queue(status, mode, created_at) where status = 'searching';
alter table public.arena_matchmaking_queue enable row level security;
drop policy if exists arena_matchmaking_queue_select_own on public.arena_matchmaking_queue;
create policy arena_matchmaking_queue_select_own on public.arena_matchmaking_queue for select to authenticated using (user_id = auth.uid());
grant select on public.arena_matchmaking_queue to authenticated;
