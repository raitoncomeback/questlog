-- ============================================================
-- QuestLog v2 — Supabase Schema + RLS
-- Paste this entire file into Supabase SQL Editor and run it.
-- ============================================================

-- Ensure UUID extension
create extension if not exists "uuid-ossp" schema extensions;

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default 'Adventurer',
  title      text not null default 'Newcomer',
  created_at date not null default current_date
);

-- Auto-create profile + settings + funnel on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Adventurer'));

  insert into public.user_settings (user_id)
  values (new.id);

  insert into public.funnel (user_id)
  values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. USER_SETTINGS (XP, streak, API key — one row per user)
-- ============================================================
create table public.user_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  total_xp         integer not null default 0,
  streak_current   integer not null default 0,
  streak_best      integer not null default 0,
  streak_last      date,
  api_key          text default ''
);

-- ============================================================
-- 3. SKILL_DATA (per-user, per-skill XP + streak)
-- ============================================================
create table public.skill_data (
  user_id       uuid not null references auth.users(id) on delete cascade,
  skill_id      text not null,
  xp            integer not null default 0,
  streak_count  integer not null default 0,
  streak_last   date,
  primary key (user_id, skill_id)
);

-- ============================================================
-- 4. TASKS
-- ============================================================
create table public.tasks (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  title         text not null,
  skill         text not null,
  difficulty    text not null default 'Common',
  notes         text default '',
  funnel        text default '',
  status        text not null default 'active',
  created_at    date not null default current_date,
  due           date not null default current_date,
  completed_at  date,
  repeat        text not null default 'none',
  repeat_days   integer[] default '{}',
  parent_id     text default '',
  primary key (user_id, id)
);

-- ============================================================
-- 5. DAYS (heatmap — completions per day)
-- ============================================================
create table public.days (
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  completions  integer not null default 1,
  primary key (user_id, date)
);

-- ============================================================
-- 6. FUNNEL (single row per user)
-- ============================================================
create table public.funnel (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  applications  integer not null default 0,
  responses     integer not null default 0,
  interviews    integer not null default 0,
  offers        integer not null default 0
);

-- ============================================================
-- 7. PROJECTS
-- ============================================================
create table public.projects (
  user_id  uuid not null references auth.users(id) on delete cascade,
  id       text not null,
  name     text not null,
  stage    integer not null default 0,
  primary key (user_id, id)
);

-- ============================================================
-- 8. DAILY_QUESTS
-- ============================================================
create table public.daily_quests (
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  quests   jsonb not null default '[]'::jsonb,
  primary key (user_id, date)
);

-- ============================================================
-- 9. REFLECTIONS (Feature 4 — evening check-in)
-- ============================================================
create table public.reflections (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  mood       integer not null,
  energy     integer not null,
  note       text default '',
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ============================================================
-- 10. PROJECT_STAGE_LOG (Feature 5 — weekly review tracking)
-- ============================================================
create table public.project_stage_log (
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    text not null,
  project_name  text not null,
  old_stage     integer not null,
  new_stage     integer not null,
  changed_at    timestamptz not null default now(),
  primary key (user_id, project_id, new_stage)
);

-- ============================================================
-- 11. LEVELUP_LOG (Feature 5 — track level-ups)
-- ============================================================
create table public.levelup_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  kind       text not null,
  skill_id   text default '',
  level      integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date, kind, skill_id, level)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.user_settings      enable row level security;
alter table public.skill_data         enable row level security;
alter table public.tasks              enable row level security;
alter table public.days               enable row level security;
alter table public.funnel             enable row level security;
alter table public.projects           enable row level security;
alter table public.daily_quests       enable row level security;
alter table public.reflections        enable row level security;
alter table public.project_stage_log  enable row level security;
alter table public.levelup_log        enable row level security;

-- Profiles
create policy "profiles_select"  on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert"  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update"  on public.profiles for update using (auth.uid() = id);

-- User settings
create policy "settings_select"  on public.user_settings for select using (auth.uid() = user_id);
create policy "settings_insert"  on public.user_settings for insert with check (auth.uid() = user_id);
create policy "settings_update"  on public.user_settings for update using (auth.uid() = user_id);

-- Skill data
create policy "skills_select"   on public.skill_data for select using (auth.uid() = user_id);
create policy "skills_insert"   on public.skill_data for insert with check (auth.uid() = user_id);
create policy "skills_update"   on public.skill_data for update using (auth.uid() = user_id);
create policy "skills_delete"   on public.skill_data for delete using (auth.uid() = user_id);

-- Tasks
create policy "tasks_select"    on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert"    on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update"    on public.tasks for update using (auth.uid() = user_id);
create policy "tasks_delete"    on public.tasks for delete using (auth.uid() = user_id);

-- Days
create policy "days_select"     on public.days for select using (auth.uid() = user_id);
create policy "days_insert"     on public.days for insert with check (auth.uid() = user_id);
create policy "days_update"     on public.days for update using (auth.uid() = user_id);
create policy "days_delete"     on public.days for delete using (auth.uid() = user_id);

-- Funnel
create policy "funnel_select"   on public.funnel for select using (auth.uid() = user_id);
create policy "funnel_insert"   on public.funnel for insert with check (auth.uid() = user_id);
create policy "funnel_update"   on public.funnel for update using (auth.uid() = user_id);

-- Projects
create policy "projects_select" on public.projects for select using (auth.uid() = user_id);
create policy "projects_insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects_update" on public.projects for update using (auth.uid() = user_id);
create policy "projects_delete" on public.projects for delete using (auth.uid() = user_id);

-- Daily quests
create policy "quests_select"   on public.daily_quests for select using (auth.uid() = user_id);
create policy "quests_insert"   on public.daily_quests for insert with check (auth.uid() = user_id);
create policy "quests_update"   on public.daily_quests for update using (auth.uid() = user_id);
create policy "quests_delete"   on public.daily_quests for delete using (auth.uid() = user_id);

-- Reflections
create policy "reflections_select" on public.reflections for select using (auth.uid() = user_id);
create policy "reflections_insert" on public.reflections for insert with check (auth.uid() = user_id);

-- Project stage log
create policy "psl_select"      on public.project_stage_log for select using (auth.uid() = user_id);
create policy "psl_insert"      on public.project_stage_log for insert with check (auth.uid() = user_id);

-- Levelup log
create policy "lvl_select"      on public.levelup_log for select using (auth.uid() = user_id);
create policy "lvl_insert"      on public.levelup_log for insert with check (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_tasks_user_status  on public.tasks (user_id, status);
create index idx_tasks_user_due     on public.tasks (user_id, due);
create index idx_tasks_user_skill   on public.tasks (user_id, skill);
create index idx_days_user_date     on public.days (user_id, date);
create index idx_reflections_user   on public.reflections (user_id, date);
create index idx_psl_user_date      on public.project_stage_log (user_id, changed_at);
create index idx_lvl_user_date      on public.levelup_log (user_id, date);
