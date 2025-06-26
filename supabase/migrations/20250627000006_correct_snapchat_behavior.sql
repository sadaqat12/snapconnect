-- Implement correct Snapchat behavior: messages expire when recipient leaves chat
-- =============================================

-- Restore the auto-trigger to mark sender as viewed when sending
CREATE OR REPLACE FUNCTION auto_mark_sender_viewed()
RETURNS trigger AS $$
BEGIN
  -- Automatically add sender to viewed_by array
  NEW.viewed_by = array_append(NEW.viewed_by, NEW.sender_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-marking sender as viewed
CREATE TRIGGER auto_mark_sender_viewed_trigger
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW 
  EXECUTE FUNCTION auto_mark_sender_viewed();

-- Update cleanup logic to expire messages when all NON-SENDER participants have viewed
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
DECLARE
  msg_record RECORD;
  participant_count INTEGER;
  non_sender_viewed_count INTEGER;
  non_sender_participants UUID[];
BEGIN
  -- For each non-expired message, check if it should expire
  FOR msg_record IN 
    SELECT 
      cm.id,
      cm.conversation_id,
      cm.sender_id,
      cm.viewed_by,
      cm.saved_by,
      c.participants
    FROM chat_messages cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.is_expired = false
  LOOP
    -- Get all participants except the sender
    non_sender_participants := array_remove(msg_record.participants, msg_record.sender_id);
    participant_count := array_length(non_sender_participants, 1);
    
    -- Count how many non-sender participants have viewed the message
    SELECT COUNT(*)::INTEGER INTO non_sender_viewed_count
    FROM unnest(msg_record.viewed_by) AS viewer_id
    WHERE viewer_id = ANY(non_sender_participants);
    
    -- If no one saved it AND all NON-SENDER participants have viewed it, mark as expired
    IF COALESCE(array_length(msg_record.saved_by, 1), 0) = 0 
       AND non_sender_viewed_count >= participant_count THEN
      
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
GRANT EXECUTE ON FUNCTION auto_mark_sender_viewed() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_messages() TO authenticated; 