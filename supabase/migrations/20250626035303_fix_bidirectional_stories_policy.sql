-- Drop the existing unidirectional stories policy
drop policy if exists "Users can view stories from friends or own stories" on public.stories;

-- Create a new bidirectional policy that works regardless of who sent the friend request
create policy "Users can view stories from friends or own stories" on public.stories
  for select using (
    auth.uid()::text = creator_id::text OR
    exists (
      select 1 from public.friendships 
      where (
        (user_id::text = auth.uid()::text and friend_id = creator_id) OR
        (friend_id::text = auth.uid()::text and user_id = creator_id)
      )
      and status = 'accepted'
    )
  );

-- Also fix the snap policy for stories to be bidirectional
drop policy if exists "Friends can view snaps in stories" on public.snaps;

create policy "Friends can view snaps in stories" on public.snaps
  for select using (
    -- Allow if the snap is part of a story created by a friend (bidirectional check)
    exists (
      select 1 from public.stories s
      join public.friendships f on (
        (
          (f.user_id::text = auth.uid()::text and f.friend_id = s.creator_id) OR
          (f.friend_id::text = auth.uid()::text and f.user_id = s.creator_id)
        )
        and f.status = 'accepted'
      )
      where s.snap_ids @> array[public.snaps.id]
      and s.expires_at > now()
    )
  ); 