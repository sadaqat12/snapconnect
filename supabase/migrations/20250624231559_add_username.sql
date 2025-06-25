-- Add username column to users table
alter table public.users
add column if not exists username text unique;

-- Update existing users with a default username based on their email
update public.users
set username = regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')
where username is null;

-- Make username not null after setting defaults
alter table public.users
alter column username set not null;

-- Add username format check constraint
alter table public.users
add constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,30}$');

-- Function to handle user creation on auth.signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  username_base text;
  username_attempt text;
  counter integer := 0;
begin
  -- Extract username base from email (everything before @)
  username_base := split_part(new.email, '@', 1);
  
  -- Replace any non-alphanumeric characters with underscore
  username_base := regexp_replace(username_base, '[^a-zA-Z0-9_]', '_', 'g');
  
  -- Initial attempt with just the base
  username_attempt := username_base;
  
  -- Keep trying with incrementing numbers until we find a unique username
  while exists (select 1 from public.users where username = username_attempt) loop
    counter := counter + 1;
    username_attempt := username_base || counter::text;
  end loop;

  insert into public.users (id, email, username)
  values (new.id, new.email, username_attempt);
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Drop existing policies
drop policy if exists "Users can view own profile" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Users can view other users" on public.users;

-- Create updated policies
create policy "Users can view own profile"
  on public.users
  for select
  using (auth.uid()::text = id::text);

create policy "Users can update own profile"
  on public.users
  for update
  using (auth.uid()::text = id::text);

create policy "Users can search other users"
  on public.users
  for select
  using (true);

-- Enable RLS on users table (in case it wasn't enabled)
alter table public.users enable row level security;
