-- Drop existing delete policy if it exists
drop policy if exists "Users can delete snaps they created or received" on public.snaps;

-- Create new delete policy that allows both creators and recipients to delete snaps
create policy "Users can delete snaps they created or received" on public.snaps
  for delete using (
    auth.uid()::text = creator_id::text OR
    auth.uid()::text = any(recipient_ids::text[])
  ); 