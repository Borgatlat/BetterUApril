-- Create run_kudos table
create table if not exists public.run_kudos (
    id uuid default gen_random_uuid() primary key,
    run_id uuid references public.runs(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(run_id, user_id)
);

-- Add RLS policies
alter table public.run_kudos enable row level security;

-- Allow users to view kudos for any run
create policy "Users can view run kudos"
    on public.run_kudos for select
    using (true);

-- Allow users to create kudos for any run
create policy "Users can create run kudos"
    on public.run_kudos for insert
    with check (auth.uid() = user_id);

-- Allow users to delete their own kudos
create policy "Users can delete their own run kudos"
    on public.run_kudos for delete
    using (auth.uid() = user_id);

-- Create indexes
create index if not exists run_kudos_run_id_idx on public.run_kudos(run_id);
create index if not exists run_kudos_user_id_idx on public.run_kudos(user_id);
create index if not exists run_kudos_created_at_idx on public.run_kudos(created_at);

-- Add function to get kudos count
create or replace function public.get_run_kudos_count(run_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
    select count(*)
    from public.run_kudos
    where run_kudos.run_id = $1;
$$;

-- Add function to check if user has kudosed
create or replace function public.has_user_kudosed_run(run_id uuid, user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists(
        select 1
        from public.run_kudos
        where run_kudos.run_id = $1
        and run_kudos.user_id = $2
    );
$$; 