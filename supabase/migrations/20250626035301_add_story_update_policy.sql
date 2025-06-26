-- Add missing RLS policy to allow users to update their own stories
create policy "Users can update their own stories" on public.stories
  for update using (auth.uid()::text = creator_id::text); 