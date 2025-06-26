-- Fix immediate expiration - messages should only expire when leaving chat
-- =============================================

-- Update mark_all_messages_as_viewed to NOT immediately expire messages
CREATE OR REPLACE FUNCTION mark_all_messages_as_viewed(
  conversation_id UUID,
  user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark all non-expired messages as viewed by this user
  -- Do NOT check for expiration here - that happens in cleanup_expired_messages
  UPDATE chat_messages 
  SET viewed_by = array_append(viewed_by, user_id)
  WHERE chat_messages.conversation_id = mark_all_messages_as_viewed.conversation_id
    AND NOT (user_id = ANY(viewed_by))
    AND NOT is_expired;
END;
$$;

-- Update mark_message_as_viewed to NOT immediately expire messages
CREATE OR REPLACE FUNCTION mark_message_as_viewed(
  message_id UUID,
  user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add user to viewed_by array if not already present
  -- Do NOT check for expiration here - that happens in cleanup_expired_messages
  UPDATE chat_messages 
  SET viewed_by = array_append(viewed_by, user_id)
  WHERE id = message_id
    AND NOT (user_id = ANY(viewed_by))
    AND NOT is_expired;
END;
$$;

-- Update cleanup_expired_messages to handle the expiration logic
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
DECLARE
  msg_record RECORD;
  participant_count INTEGER;
BEGIN
  -- For each non-expired message, check if it should expire
  FOR msg_record IN 
    SELECT 
      cm.id,
      cm.conversation_id,
      cm.viewed_by,
      cm.saved_by,
      c.participants
    FROM chat_messages cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.is_expired = false
  LOOP
    -- Get participant count
    participant_count := array_length(msg_record.participants, 1);
    
    -- If no one saved it AND all participants have viewed it, mark as expired
    IF COALESCE(array_length(msg_record.saved_by, 1), 0) = 0 
       AND array_length(msg_record.viewed_by, 1) >= participant_count THEN
      
      UPDATE chat_messages 
      SET is_expired = true
      WHERE id = msg_record.id;
      
    END IF;
  END LOOP;
  
  -- Delete messages that are marked as expired
  DELETE FROM public.chat_messages
  WHERE is_expired = true;
  
  -- Also cleanup any orphaned snaps (keep existing logic)
  DELETE FROM public.snaps
  WHERE expires_at <= now()
    AND (read_by @> recipient_ids OR array_length(read_by, 1) = array_length(recipient_ids, 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_all_messages_as_viewed(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_viewed(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_messages() TO authenticated; 