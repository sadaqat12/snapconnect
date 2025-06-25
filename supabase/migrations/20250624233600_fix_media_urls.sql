-- Update existing snaps to use production URL
update public.snaps
set media_url = replace(
  media_url,
  'http://127.0.0.1:54321/storage/v1/object/public',
  'https://zfwrwbtrdcnncyxvfcbd.supabase.co/storage/v1/object/public'
)
where media_url like 'http://127.0.0.1%'; 