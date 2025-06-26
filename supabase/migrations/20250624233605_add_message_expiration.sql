-- Add expiration logic for text messages to maintain ephemeral nature
-- =============================================

-- Function to set expiration time for text messages  
create or replace function set_text_message_expiration()
returns trigger as $$
begin
  -- For text messages, set expiration to 24 hours after creation
  if NEW.message_type = 'text' and NEW.expires_at is null then
    NEW.expires_at = NEW.created_at + interval '24 hours';
  end if;
  
  -- For snap messages, inherit expiration from the snap
  if NEW.message_type = 'snap' and NEW.snap_id is not null and NEW.expires_at is null then
    NEW.expires_at = (
      select expires_at 
      from public.snaps 
      where id = NEW.snap_id
    );
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Trigger to automatically set expiration for new messages
create trigger set_message_expiration_trigger
  before insert on public.chat_messages
  for each row execute function set_text_message_expiration();

-- Function to clean up expired messages (similar to snap cleanup)
create or replace function cleanup_expired_messages()
returns void as $$
begin
  -- Delete expired messages
  delete from public.chat_messages
  where expires_at <= now();
  
  -- Also cleanup any orphaned snaps
  delete from public.snaps
  where expires_at <= now()
    and (read_by @> recipient_ids or array_length(read_by, 1) = array_length(recipient_ids, 1));
end;
$$ language plpgsql security definer;

-- Optional: Add a periodic cleanup job (can be called from client or scheduled)
-- This would typically be called from your application code periodically 