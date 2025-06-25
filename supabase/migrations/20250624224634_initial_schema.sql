-- SnapConnect Database Schema
-- =============================================
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "vector";

-- Drop existing tables if they exist
drop table if exists public.vectors;
drop table if exists public.stories;
drop table if exists public.snaps;
drop table if exists public.friendships;
drop table if exists public.users;

-- =============================================
-- TABLE: users
-- Stores basic profile info; authentication handled by Supabase Auth
-- =============================================
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  name text,
  travel_style_tags text[],
  preferences jsonb,
  created_at timestamptz default now()
);

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

-- Trigger to automatically create user record on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- TABLE: friendships
-- Simple directed friendship / follow model (could be symmetrical)
-- =============================================
create table public.friendships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  friend_id uuid not null references public.users(id) on delete cascade,
  status text default 'pending', -- pending | accepted | blocked
  created_at timestamptz default now(),
  constraint friendships_unique_pair unique (user_id, friend_id)
);

-- =============================================
-- TABLE: snaps
-- Ephemeral media messages (photo / video)
-- =============================================
create table public.snaps (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references public.users(id) on delete cascade,
  media_url text not null,
  media_type text not null, -- 'photo' | 'video'
  thumbnail_url text, -- for video previews
  caption text,
  location jsonb, -- { lat, lng, address }
  recipient_ids uuid[] not null, -- array of user_ids (for group snaps)
  read_by uuid[] default '{}',
  duration_seconds integer default 10, -- how long snap is visible
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- =============================================
-- TABLE: stories
-- 24-hour story collections referencing snaps
-- =============================================
create table public.stories (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references public.users(id) on delete cascade,
  snap_ids uuid[] not null, -- ordered list of snap ids
  viewers uuid[] default '{}',
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- Function to set story expiration
create or replace function set_story_expiration()
returns trigger as $$
begin
  new.expires_at := new.created_at + interval '24 hours';
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically set story expiration
create trigger set_story_expiration_trigger
  before insert on public.stories
  for each row
  execute function set_story_expiration();

-- =============================================
-- TABLE: vectors
-- Embeddings (RAG) – supports image, text, itinerary, etc.
-- =============================================
create table public.vectors (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null, -- id from snaps or other RAG entity
  context_type text not null, -- 'snap' | 'itinerary' | etc.
  embedding vector(1536) not null,
  created_at timestamptz default now()
);

-- Vector similarity index (L2 distance)
create index if not exists vectors_embedding_idx on public.vectors using ivfflat (embedding vector_l2_ops);

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create storage bucket for media (photos/videos)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.friendships enable row level security;
alter table public.snaps enable row level security;
alter table public.stories enable row level security;
alter table public.vectors enable row level security;

-- Users can read/write their own data
create policy "Users can view own profile" on public.users
  for select using (auth.uid()::text = id::text);
create policy "Users can update own profile" on public.users
  for update using (auth.uid()::text = id::text);
create policy "Users can view other users" on public.users
  for select using (true);

-- Snaps policies
create policy "Users can create snaps" on public.snaps
  for insert with check (auth.uid()::text = creator_id::text);
create policy "Users can view snaps sent to them or created by them" on public.snaps
  for select using (
    auth.uid()::text = creator_id::text OR 
    auth.uid()::text = any(recipient_ids::text[])
  );
create policy "Creators can update their snaps" on public.snaps
  for update using (auth.uid()::text = creator_id::text);
create policy "Users can delete snaps they created or received" on public.snaps
  for delete using (
    auth.uid()::text = creator_id::text OR
    auth.uid()::text = any(recipient_ids::text[])
  );

-- Friendships policies
create policy "Users can manage their friendships" on public.friendships
  for all using (auth.uid()::text = user_id::text);
create policy "Users can view friendships involving them" on public.friendships
  for select using (
    auth.uid()::text = user_id::text OR 
    auth.uid()::text = friend_id::text
  );

-- Stories policies
create policy "Users can create stories" on public.stories
  for insert with check (auth.uid()::text = creator_id::text);
create policy "Users can view stories from friends or own stories" on public.stories
  for select using (
    auth.uid()::text = creator_id::text OR
    exists (
      select 1 from public.friendships 
      where user_id::text = auth.uid()::text 
      and friend_id = creator_id 
      and status = 'accepted'
    )
  );

-- Storage policies
create policy "Users can upload media" on storage.objects
  for insert with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can view media" on storage.objects
  for select using (bucket_id = 'media');
create policy "Users can update own media" on storage.objects
  for update using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own media" on storage.objects
  for delete using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
