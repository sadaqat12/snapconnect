-- Add policy to allow friends to view snaps that are part of stories
create policy "Friends can view snaps in stories" on public.snaps
  for select using (
    -- Allow if the snap is part of a story created by a friend
    exists (
      select 1 from public.stories s
      join public.friendships f on (
        f.user_id::text = auth.uid()::text 
        and f.friend_id = s.creator_id 
        and f.status = 'accepted'
      )
      where s.snap_ids @> array[public.snaps.id]
      and s.expires_at > now()
    )
  ); 