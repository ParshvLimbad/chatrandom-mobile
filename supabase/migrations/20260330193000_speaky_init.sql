create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 32),
  date_of_birth date not null,
  country_code text not null check (char_length(country_code) = 2),
  gender text not null check (gender in ('male', 'female', 'non_binary', 'other')),
  interests text[] not null default '{}',
  report_count integer not null default 0,
  match_join_count integer not null default 0,
  warning_seen_at timestamptz,
  banned_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country_filters text[] not null default '{}',
  gender_filters text[] not null default '{}',
  interest_filters text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('nudity', 'harassment', 'underage', 'spam')),
  mode text not null check (mode in ('video', 'voice', 'text')),
  match_id text not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, reported_id, match_id)
);

create table if not exists public.subscription_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entitlement_id text,
  product_id text,
  is_active boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists match_preferences_set_updated_at on public.match_preferences;
create trigger match_preferences_set_updated_at
before update on public.match_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists subscription_state_set_updated_at on public.subscription_state;
create trigger subscription_state_set_updated_at
before update on public.subscription_state
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.match_preferences enable row level security;
alter table public.user_reports enable row level security;
alter table public.subscription_state enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "match_preferences_select_own" on public.match_preferences;
create policy "match_preferences_select_own"
on public.match_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "match_preferences_insert_own" on public.match_preferences;
create policy "match_preferences_insert_own"
on public.match_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "match_preferences_update_own" on public.match_preferences;
create policy "match_preferences_update_own"
on public.match_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "subscription_state_select_own" on public.subscription_state;
create policy "subscription_state_select_own"
on public.subscription_state
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.increment_join_count()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.profiles
  set match_join_count = match_join_count + 1
  where id = auth.uid()
  returning match_join_count into next_count;

  if next_count is null then
    raise exception 'Profile not found for current user';
  end if;

  return jsonb_build_object('join_count', next_count);
end;
$$;

create or replace function public.submit_user_report(
  p_reported_user_id uuid,
  p_reason text,
  p_mode text,
  p_match_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer;
  warned boolean;
  banned boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() = p_reported_user_id then
    raise exception 'Users cannot report themselves';
  end if;

  insert into public.user_reports (
    reporter_id,
    reported_id,
    reason,
    mode,
    match_id
  )
  values (
    auth.uid(),
    p_reported_user_id,
    p_reason,
    p_mode,
    p_match_id
  )
  on conflict (reporter_id, reported_id, match_id) do nothing;

  select count(*)::integer
  into total_count
  from public.user_reports
  where reported_id = p_reported_user_id;

  warned := total_count >= 5 and total_count < 10;
  banned := total_count >= 10;

  update public.profiles
  set
    report_count = total_count,
    warning_seen_at = case
      when total_count >= 5 then coalesce(warning_seen_at, now())
      else warning_seen_at
    end,
    banned_at = case
      when total_count >= 10 then coalesce(banned_at, now())
      else banned_at
    end
  where id = p_reported_user_id;

  return jsonb_build_object(
    'report_count', total_count,
    'warned', warned,
    'banned', banned
  );
end;
$$;

grant execute on function public.increment_join_count() to authenticated;
grant execute on function public.submit_user_report(uuid, text, text, text) to authenticated;
