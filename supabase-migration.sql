-- JobSim Supabase Migration
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Applications
create table if not exists applications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  status text not null default 'researching',
  source text,
  url text,
  salary_range text,
  location text,
  notes text,
  date_applied timestamptz,
  date_created timestamptz not null default now(),
  date_updated timestamptz not null default now(),
  position int not null default 0
);

create table if not exists application_activity (
  id bigint generated always as identity primary key,
  application_id bigint not null references applications(id) on delete cascade,
  type text not null,
  note text,
  date_created timestamptz not null default now()
);

-- Contacts
create table if not exists contacts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  title text,
  company text,
  email text,
  linkedin_url text,
  how_connected text,
  notes text,
  outreach_status text not null default 'not_contacted',
  tags jsonb default '[]'::jsonb,
  date_created timestamptz not null default now(),
  date_updated timestamptz not null default now()
);

create table if not exists interactions (
  id bigint generated always as identity primary key,
  contact_id bigint not null references contacts(id) on delete cascade,
  note text not null,
  date_created timestamptz not null default now()
);

-- Skills
create table if not exists skills (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  priority text not null default 'medium',
  current_level text,
  target_level text,
  status text not null default 'not_started',
  resources text,
  date_created timestamptz not null default now()
);

create table if not exists learning_logs (
  id bigint generated always as identity primary key,
  skill_id bigint not null references skills(id) on delete cascade,
  topic text not null,
  time_spent int,
  notes text,
  date_created timestamptz not null default now()
);

-- Row Level Security: each user can only access their own data
alter table applications enable row level security;
alter table application_activity enable row level security;
alter table contacts enable row level security;
alter table interactions enable row level security;
alter table skills enable row level security;
alter table learning_logs enable row level security;

-- Applications policies
drop policy if exists "Users can view own applications" on applications;
create policy "Users can view own applications" on applications for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own applications" on applications;
create policy "Users can insert own applications" on applications for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own applications" on applications;
create policy "Users can update own applications" on applications for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own applications" on applications;
create policy "Users can delete own applications" on applications for delete using (auth.uid() = user_id);

-- Activity policies (via application ownership)
drop policy if exists "Users can view own activity" on application_activity;
create policy "Users can view own activity" on application_activity for select
  using (application_id in (select id from applications where user_id = auth.uid()));
drop policy if exists "Users can insert own activity" on application_activity;
create policy "Users can insert own activity" on application_activity for insert
  with check (application_id in (select id from applications where user_id = auth.uid()));

-- Contacts policies
drop policy if exists "Users can view own contacts" on contacts;
create policy "Users can view own contacts" on contacts for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own contacts" on contacts;
create policy "Users can insert own contacts" on contacts for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own contacts" on contacts;
create policy "Users can update own contacts" on contacts for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own contacts" on contacts;
create policy "Users can delete own contacts" on contacts for delete using (auth.uid() = user_id);

-- Interactions policies (via contact ownership)
drop policy if exists "Users can view own interactions" on interactions;
create policy "Users can view own interactions" on interactions for select
  using (contact_id in (select id from contacts where user_id = auth.uid()));
drop policy if exists "Users can insert own interactions" on interactions;
create policy "Users can insert own interactions" on interactions for insert
  with check (contact_id in (select id from contacts where user_id = auth.uid()));

-- Skills policies
drop policy if exists "Users can view own skills" on skills;
create policy "Users can view own skills" on skills for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own skills" on skills;
create policy "Users can insert own skills" on skills for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own skills" on skills;
create policy "Users can update own skills" on skills for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own skills" on skills;
create policy "Users can delete own skills" on skills for delete using (auth.uid() = user_id);

-- Learning logs policies (via skill ownership)
drop policy if exists "Users can view own learning logs" on learning_logs;
create policy "Users can view own learning logs" on learning_logs for select
  using (skill_id in (select id from skills where user_id = auth.uid()));
drop policy if exists "Users can insert own learning logs" on learning_logs;
create policy "Users can insert own learning logs" on learning_logs for insert
  with check (skill_id in (select id from skills where user_id = auth.uid()));

-- Indexes for performance
create index if not exists idx_applications_user on applications(user_id);
create index if not exists idx_contacts_user on contacts(user_id);
create index if not exists idx_skills_user on skills(user_id);
create index if not exists idx_app_activity_app on application_activity(application_id);
create index if not exists idx_interactions_contact on interactions(contact_id);
create index if not exists idx_learning_logs_skill on learning_logs(skill_id);

-- ─────────────────────────────────────────────────────────────
-- Fixes/audit additions
-- Everything below is idempotent — the whole file stays safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- Self-healing column guards. If a table already existed from an older run,
-- "create table if not exists" above silently skips it, so make sure every
-- column the deployed API (api/[...path].js) reads or writes actually exists.
alter table applications add column if not exists position int not null default 0;
alter table applications add column if not exists date_applied timestamptz;
alter table applications add column if not exists date_updated timestamptz not null default now();
alter table contacts add column if not exists tags jsonb default '[]'::jsonb;
alter table contacts add column if not exists date_updated timestamptz not null default now();
alter table learning_logs add column if not exists time_spent int;
alter table learning_logs add column if not exists notes text;

-- Child-table DELETE policies.
-- Note on cascades: the API only ever deletes parent rows (applications,
-- contacts, skills); the ON DELETE CASCADE actions still fire under RLS
-- because foreign-key referential-integrity triggers run as the table owner,
-- which bypasses RLS (no FORCE ROW LEVEL SECURITY here). These policies
-- additionally allow deleting individual child rows directly, so RLS does not
-- silently block that (RLS denies by default when no policy matches).
-- UPDATE policies are intentionally omitted: activity/interactions/logs are
-- append-only in the API.
drop policy if exists "Users can delete own activity" on application_activity;
create policy "Users can delete own activity" on application_activity for delete
  using (application_id in (select id from applications where user_id = auth.uid()));
drop policy if exists "Users can delete own interactions" on interactions;
create policy "Users can delete own interactions" on interactions for delete
  using (contact_id in (select id from contacts where user_id = auth.uid()));
drop policy if exists "Users can delete own learning logs" on learning_logs;
create policy "Users can delete own learning logs" on learning_logs for delete
  using (skill_id in (select id from skills where user_id = auth.uid()));

-- Supports the per-status position-count query run on every application insert
-- and the kanban board ordering.
create index if not exists idx_applications_user_status on applications(user_id, status);

-- Events Radar (job fairs / hiring events / info sessions)
create table if not exists events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  host text,
  event_type text default 'other',
  url text,
  source text default 'other',
  location text,
  is_virtual boolean,
  event_date text,
  description text,
  score int,
  score_reasons text,
  status text default 'new',
  notes text,
  date_discovered timestamptz not null default now(),
  unique (user_id, url)
);

alter table events enable row level security;

-- Events policies (mirror applications)
drop policy if exists "Users can view own events" on events;
create policy "Users can view own events" on events for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own events" on events;
create policy "Users can insert own events" on events for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own events" on events;
create policy "Users can update own events" on events for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own events" on events;
create policy "Users can delete own events" on events for delete using (auth.uid() = user_id);

create index if not exists idx_events_user on events(user_id);
