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

-- Enable RLS on friendships table
alter table public.friendships enable row level security;
