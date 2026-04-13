-- Creates support tables for capturing Spotify tracks during workouts

-- 1. Workout sessions track start/end metadata for each workout
create table if not exists public.workout_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_name text,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.workout_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_sessions'
      and policyname = 'Users manage workout sessions'
  ) then
    create policy "Users manage workout sessions"
      on public.workout_sessions
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 2. Tracks captured during an active session
create table if not exists public.workout_spotify_tracks (
  id uuid primary key default uuid_generate_v4(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  track_name text not null,
  artist_name text,
  album_name text,
  album_image_url text,
  track_id text,
  played_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.workout_spotify_tracks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_spotify_tracks'
      and policyname = 'Users manage spotify workout tracks'
  ) then
    create policy "Users manage spotify workout tracks"
      on public.workout_spotify_tracks
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create unique index if not exists workout_spotify_tracks_unique_track
  on public.workout_spotify_tracks (workout_session_id, track_id, played_at);

create index if not exists workout_spotify_tracks_session_idx
  on public.workout_spotify_tracks (workout_session_id);

-- Touch updated_at column automatically
create or replace function public.set_workout_session_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists workout_sessions_set_updated_at on public.workout_sessions;
create trigger workout_sessions_set_updated_at
before update on public.workout_sessions
for each row
execute function public.set_workout_session_updated_at();

