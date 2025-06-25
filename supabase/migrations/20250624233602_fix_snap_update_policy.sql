-- Drop existing update policy
drop policy if exists "Creators can update their snaps" on public.snaps;

-- Create new update policy that allows:
-- 1. Creators to update any field
-- 2. Recipients to update read_by array only
create policy "Users can update snaps they created or received" on public.snaps
  for update
  using (
    auth.uid()::text = creator_id::text OR
    auth.uid()::text = any(recipient_ids::text[])
  )
  with check (
    auth.uid()::text = creator_id::text OR
    (
      auth.uid()::text = any(recipient_ids::text[]) AND
      -- For recipients, only allow updating read_by
      auth.uid()::text != creator_id::text AND
      read_by is not null
    )
  ); 