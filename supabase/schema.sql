-- NotProtonDB initial schema for Supabase PostgreSQL.
-- Run this entire file in Supabase → SQL Editor.
-- Public client apps use the anon/publishable key only. Never expose service_role.

create extension if not exists pgcrypto;

create type public.compatibility_result as enum (
  'works',
  'minor_issues',
  'major_issues',
  'does_not_work'
);

create type public.game_review_state as enum ('pending', 'approved', 'rejected');

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  normalized_title text generated always as (lower(regexp_replace(trim(title), '\s+', ' ', 'g'))) stored,
  steam_app_id text unique,
  gog_id text,
  epic_id text,
  other_store_ids jsonb not null default '{}'::jsonb,
  developer text,
  publisher text,
  release_year integer,
  review_state public.game_review_state not null default 'pending',
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint games_title_length check (char_length(trim(title)) between 1 and 160),
  constraint games_release_year check (release_year is null or release_year between 1970 and 2100)
);

create unique index if not exists games_normalized_title_unique
  on public.games(normalized_title);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  result public.compatibility_result not null,
  mac_model text not null,
  chip text not null,
  memory_gb integer,
  macos_version text not null,
  crossover_version text not null,
  notproton_version text not null,
  storefront text not null default 'Steam',
  game_version text,
  resolution text,
  average_fps integer,
  session_minutes integer,
  multiplayer_status text,
  launch_options text,
  notes text,
  tested_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_mac_model_length check (char_length(trim(mac_model)) between 1 and 120),
  constraint report_chip_length check (char_length(trim(chip)) between 1 and 80),
  constraint report_macos_length check (char_length(trim(macos_version)) between 1 and 80),
  constraint report_crossover_length check (char_length(trim(crossover_version)) between 1 and 80),
  constraint report_notproton_length check (char_length(trim(notproton_version)) between 1 and 80),
  constraint report_memory check (memory_gb is null or memory_gb between 4 and 512),
  constraint report_fps check (average_fps is null or average_fps between 1 and 1000),
  constraint report_session check (session_minutes is null or session_minutes between 1 and 100000),
  constraint report_notes_length check (notes is null or char_length(notes) <= 4000),
  constraint report_options_length check (launch_options is null or char_length(launch_options) <= 1000)
);

create index if not exists reports_game_created_idx on public.reports(game_id, created_at desc);
create index if not exists reports_user_idx on public.reports(user_id);

create table if not exists public.report_votes (
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

-- Public game catalogue view; pending suggestions are not exposed to anonymous visitors.
alter table public.games enable row level security;
alter table public.reports enable row level security;
alter table public.report_votes enable row level security;

drop policy if exists "Anyone can read approved games" on public.games;
create policy "Anyone can read approved games"
  on public.games for select
  using (review_state = 'approved' or submitted_by = auth.uid());

drop policy if exists "Signed-in users can suggest games" on public.games;
create policy "Signed-in users can suggest games"
  on public.games for insert to authenticated
  with check (submitted_by = auth.uid() and review_state = 'pending');

drop policy if exists "Owners can read reports" on public.reports;
create policy "Owners can read reports"
  on public.reports for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.games g
      where g.id = reports.game_id and g.review_state = 'approved'
    )
  );

drop policy if exists "Signed-in users can submit reports for approved games" on public.reports;
create policy "Signed-in users can submit reports for approved games"
  on public.reports for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.games g
      where g.id = reports.game_id and g.review_state = 'approved'
    )
  );

drop policy if exists "Users can update their own reports" on public.reports;
create policy "Users can update their own reports"
  on public.reports for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own reports" on public.reports;
create policy "Users can delete their own reports"
  on public.reports for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Votes are publicly readable" on public.report_votes;
create policy "Votes are publicly readable"
  on public.report_votes for select
  using (true);

drop policy if exists "Users can vote once per report" on public.report_votes;
create policy "Users can vote once per report"
  on public.report_votes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can change their own vote" on public.report_votes;
create policy "Users can change their own vote"
  on public.report_votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Aggregate ratings from individual reports. No report is treated as proof of
-- a flawless experience; the UI shows sample size and the distribution.
create or replace view public.game_compatibility
with (security_invoker = true)
as
select
  g.id as game_id,
  count(r.id)::integer as report_count,
  count(r.id) filter (where r.result = 'works')::integer as works_count,
  count(r.id) filter (where r.result = 'minor_issues')::integer as minor_issues_count,
  count(r.id) filter (where r.result = 'major_issues')::integer as major_issues_count,
  count(r.id) filter (where r.result = 'does_not_work')::integer as does_not_work_count,
  round(
    100.0 * count(r.id) filter (where r.result in ('works', 'minor_issues'))
    / nullif(count(r.id), 0)
  )::integer as positive_percent,
  max(r.tested_at) as last_tested
from public.games g
left join public.reports r on r.game_id = g.id
where g.review_state = 'approved'
group by g.id;

grant usage on schema public to anon, authenticated;
grant select on public.games to anon, authenticated;
grant insert on public.games to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select on public.reports to anon;
grant select, insert, update on public.report_votes to authenticated;
grant select on public.report_votes to anon;
grant select on public.game_compatibility to anon, authenticated;

-- Admin approval is intentionally performed from the Supabase dashboard for
-- the MVP: review pending game suggestions, then set review_state='approved'.
