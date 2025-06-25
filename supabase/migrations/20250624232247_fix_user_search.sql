-- First, let's check if we have the right policies
select * from pg_policies where schemaname = 'public' and tablename = 'users';

-- Drop all existing RLS policies for users table
drop policy if exists "Users can view own profile" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Users can view other users" on public.users;
drop policy if exists "Users can search other users" on public.users;

-- Create a simpler, more permissive policy for now (we can make it more restrictive later)
create policy "Allow all user reads"
  on public.users
  for select
  to authenticated
  using (true);

create policy "Allow users to update their own profile"
  on public.users
  for update
  to authenticated
  using (auth.uid()::text = id::text);

-- Make sure RLS is enabled
alter table public.users enable row level security;

-- Let's see what users we have
select id, email, username, name from public.users;

-- Make sure the auth.users trigger is working
select 
  users.id as user_id,
  users.email as user_email,
  users.username as user_username,
  auth.email as auth_email
from public.users as users
right join auth.users as auth
  on users.id::text = auth.id::text;

-- Fix any missing user records
insert into public.users (id, email, username)
select 
  auth.id,
  auth.email,
  regexp_replace(split_part(auth.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g') as username
from auth.users as auth
left join public.users as users
  on users.id::text = auth.id::text
where users.id is null;

-- Add updated_at column to friendships table
alter table public.friendships
add column if not exists updated_at timestamptz;

-- Update existing friendships to have updated_at set
update public.friendships
set updated_at = created_at
where updated_at is null;

-- Make updated_at not null
alter table public.friendships
alter column updated_at set default now();
alter table public.friendships
alter column updated_at set not null;

-- Drop all existing RLS policies for friendships
drop policy if exists "Users can manage their friendships" on public.friendships;
drop policy if exists "Users can view friendships involving them" on public.friendships;

-- Create updated friendship policies
create policy "Users can manage their friendships"
  on public.friendships
  for all
  to authenticated
  using (
    auth.uid()::text = user_id::text OR 
    auth.uid()::text = friend_id::text
  );

-- Add trigger to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_friendships_updated_at
  before update on public.friendships
  for each row
  execute function update_updated_at_column();

-- Enable RLS on friendships table
alter table public.friendships enable row level security;

-- Drop and recreate the policy to allow viewing other users
drop policy if exists "Users can view other users" on public.users;
create policy "Users can view other users" on public.users
  for select using (true);
