-- Drop existing storage policies
drop policy if exists "Users can upload media" on storage.objects;
drop policy if exists "Users can view media" on storage.objects;
drop policy if exists "Users can update own media" on storage.objects;
drop policy if exists "Users can delete own media" on storage.objects;

-- Create updated storage policies
create policy "Users can upload media" on storage.objects
  for insert with check (
    bucket_id = 'media' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view media" on storage.objects
  for select using (
    bucket_id = 'media' AND
    exists (
      select 1 from public.snaps
      where media_url like '%' || name AND (
        auth.uid()::text = creator_id::text OR
        auth.uid()::text = any(recipient_ids::text[])
      )
    )
  );

create policy "Users can update own media" on storage.objects
  for update using (
    bucket_id = 'media' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own media" on storage.objects
  for delete using (
    bucket_id = 'media' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  ); 