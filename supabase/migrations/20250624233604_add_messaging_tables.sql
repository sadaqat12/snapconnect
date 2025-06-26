-- Add messaging tables for 1-on-1 and group chat functionality
-- =============================================

-- TABLE: conversations
-- Stores conversation metadata (1-on-1 or group chats)
-- =============================================
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  name text, -- optional name for group chats
  type text not null default 'direct', -- 'direct' | 'group'
  participants uuid[] not null, -- array of user_ids
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz default now()
);

-- TABLE: chat_messages  
-- Stores individual messages within conversations
-- =============================================
create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  message_type text not null, -- 'text' | 'snap'
  content text, -- text content for text messages
  snap_id uuid references public.snaps(id) on delete cascade, -- reference to snap for snap messages
  read_by uuid[] default '{}', -- array of user_ids who have read this message
  created_at timestamptz default now(),
  expires_at timestamptz -- only for snap messages, inherits from snap
);

-- Add indexes for better performance
create index if not exists conversations_participants_idx on public.conversations using gin (participants);
create index if not exists conversations_updated_at_idx on public.conversations (updated_at desc);
create index if not exists chat_messages_conversation_id_idx on public.chat_messages (conversation_id);
create index if not exists chat_messages_created_at_idx on public.chat_messages (created_at desc);

-- Function to update conversation's updated_at when messages are added
create or replace function update_conversation_timestamp()
returns trigger as $$
begin
  update public.conversations 
  set updated_at = now(), last_message_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$ language plpgsql;

-- Trigger to automatically update conversation timestamp
create trigger update_conversation_timestamp_trigger
  after insert on public.chat_messages
  for each row execute function update_conversation_timestamp();

-- Enable RLS on new tables
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;

-- Conversations policies
create policy "Users can view conversations they participate in" on public.conversations
  for select using (auth.uid()::text = any(participants::text[]));

create policy "Users can create conversations" on public.conversations
  for insert with check (auth.uid()::text = created_by::text);

create policy "Participants can update conversations" on public.conversations
  for update using (auth.uid()::text = any(participants::text[]));

-- Chat messages policies  
create policy "Users can view messages in their conversations" on public.chat_messages
  for select using (
    exists (
      select 1 from public.conversations 
      where id = conversation_id 
      and auth.uid()::text = any(participants::text[])
    )
  );

create policy "Users can send messages to their conversations" on public.chat_messages
  for insert with check (
    auth.uid()::text = sender_id::text and
    exists (
      select 1 from public.conversations 
      where id = conversation_id 
      and auth.uid()::text = any(participants::text[])
    )
  );

create policy "Users can update messages they sent" on public.chat_messages
  for update using (auth.uid()::text = sender_id::text);

-- Helper function to create or get direct conversation between two users
create or replace function get_or_create_direct_conversation(user1_id uuid, user2_id uuid)
returns uuid as $$
declare
  conversation_id uuid;
begin
  -- Try to find existing direct conversation between these users
  select id into conversation_id
  from public.conversations
  where type = 'direct'
    and participants @> array[user1_id, user2_id]
    and array_length(participants, 1) = 2;
  
  -- If no conversation exists, create one
  if conversation_id is null then
    insert into public.conversations (type, participants, created_by)
    values ('direct', array[user1_id, user2_id], user1_id)
    returning id into conversation_id;
  end if;
  
  return conversation_id;
end;
$$ language plpgsql security definer;

-- Helper function to create group conversation
create or replace function create_group_conversation(creator_id uuid, participant_ids uuid[], group_name text default null)
returns uuid as $$
declare
  conversation_id uuid;
  all_participants uuid[];
begin
  -- Ensure creator is included in participants
  all_participants := array_append(participant_ids, creator_id);
  all_participants := array(select distinct unnest(all_participants)); -- Remove duplicates
  
  insert into public.conversations (type, participants, created_by, name)
  values ('group', all_participants, creator_id, group_name)
  returning id into conversation_id;
  
  return conversation_id;
end;
$$ language plpgsql security definer; 