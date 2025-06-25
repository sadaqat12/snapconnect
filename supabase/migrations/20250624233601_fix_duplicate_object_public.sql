-- Fix URLs with duplicate object/public
update public.snaps
set media_url = replace(
  media_url,
  '/object/public/object/public/',
  '/object/public/'
)
where media_url like '%/object/public/object/public/%'; 