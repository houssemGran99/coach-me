-- Mourabbi: initial schema. Every table has Row Level Security; users only ever see their own rows.
-- Public reads of shared practices go through a server route using the service role, never through RLS.

create extension if not exists pgcrypto;

-- Shared trigger to keep updated_at fresh.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles ------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'fr' check (language in ('fr', 'ar', 'en')),
  default_age_group text check (default_age_group in
    ('U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U19','senior')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- practices (the owner's personal library) ----------------------------------------------------
create table public.practices (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  data jsonb not null,
  source text not null check (source in ('template', 'ai', 'user')),
  review_status text not null check (review_status in ('pending', 'reviewed', 'ai_draft', 'edited_by_owner')),
  parent_template_id text,
  -- Addition to the brief: the owner's private notes live outside `data` so they can never leak into a snapshot.
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index practices_owner_idx on public.practices (owner, created_at desc) where deleted_at is null;
create trigger practices_updated before update on public.practices
  for each row execute function public.set_updated_at();

-- sessions ------------------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  reflection jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_owner_idx on public.sessions (owner, created_at desc);
create trigger sessions_updated before update on public.sessions
  for each row execute function public.set_updated_at();

-- shared_practices: snapshots behind public links ---------------------------------------------
create table public.shared_practices (
  id text primary key check (char_length(id) >= 12),
  owner uuid not null references auth.users (id) on delete cascade,
  -- Addition to the brief: which library practice or template this link came from ("Update link").
  practice_id text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  views integer not null default 0
);
create index shared_practices_owner_idx on public.shared_practices (owner, created_at desc);
create index shared_practices_source_idx on public.shared_practices (owner, practice_id) where revoked_at is null;

-- generations: log of every model call, for prompt tuning ------------------------------------
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('session', 'practice')),
  input jsonb not null,
  output jsonb,
  valid boolean not null,
  retries integer not null default 0,
  created_at timestamptz not null default now()
);
create index generations_owner_idx on public.generations (owner, created_at desc);

-- reports: "Report this practice" on the public page ------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  shared_id text not null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

-- Row Level Security --------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.practices enable row level security;
alter table public.sessions enable row level security;
alter table public.shared_practices enable row level security;
alter table public.generations enable row level security;
alter table public.reports enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy practices_select on public.practices for select to authenticated using (owner = auth.uid());
create policy practices_insert on public.practices for insert to authenticated with check (owner = auth.uid());
create policy practices_update on public.practices for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy practices_delete on public.practices for delete to authenticated using (owner = auth.uid());

create policy sessions_select on public.sessions for select to authenticated using (owner = auth.uid());
create policy sessions_insert on public.sessions for insert to authenticated with check (owner = auth.uid());
create policy sessions_update on public.sessions for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy sessions_delete on public.sessions for delete to authenticated using (owner = auth.uid());

-- No anonymous policies on shared_practices: the public page reads through the server with the service role.
create policy shared_select on public.shared_practices for select to authenticated using (owner = auth.uid());
create policy shared_insert on public.shared_practices for insert to authenticated with check (owner = auth.uid());
create policy shared_update on public.shared_practices for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- Owners can read their own generation log; only the service role writes it.
create policy generations_select on public.generations for select to authenticated using (owner = auth.uid());

-- reports: no policies at all. Only the service role (which bypasses RLS) can write or read.

-- Belt and braces: anonymous callers get no table privileges.
revoke all on public.profiles, public.practices, public.sessions, public.shared_practices, public.generations, public.reports from anon;
revoke all on public.reports from authenticated;
revoke insert, update, delete on public.generations from authenticated;

-- View counter used by the public route (service role only).
create or replace function public.increment_share_views(share_id text) returns void
language sql security definer set search_path = public as $$
  update public.shared_practices set views = views + 1 where id = share_id and revoked_at is null;
$$;
revoke all on function public.increment_share_views(text) from public, anon, authenticated;
grant execute on function public.increment_share_views(text) to service_role;
