-- SnapConnect Database Schema
-- =============================================
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "pgvector";

-- =============================================
-- TABLE: users
-- Stores basic profile info; authentication handled by Supabase Auth
-- =============================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  name text,
  travel_style_tags text[],
  preferences jsonb,
  created_at timestamptz default now()
);

-- =============================================
-- TABLE: friendships
-- Simple directed friendship / follow model (could be symmetrical)
-- =============================================
create table if not exists public.friendships (
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
create table if not exists public.snaps (
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
create table if not exists public.stories (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references public.users(id) on delete cascade,
  snap_ids uuid[] not null, -- ordered list of snap ids
  viewers uuid[] default '{}',
  created_at timestamptz default now(),
  expires_at timestamptz generated always as (created_at + interval '24 hours') stored
);

-- =============================================
-- TABLE: vectors
-- Embeddings (RAG) – supports image, text, itinerary, etc.
-- =============================================
create table if not exists public.vectors (
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

-- =============================================
-- TODO: Row Level Security (RLS) policies will be added after tables are verified
-- ============================================= 