-- Function to mark all messages in a conversation as viewed when opening chat
-- =============================================

-- Create function to mark ALL messages in a conversation as viewed (Snapchat behavior)
CREATE OR REPLACE FUNCTION mark_all_messages_as_viewed(
  conversation_id UUID,
  user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  participant_count INTEGER;
  msg_record RECORD;
BEGIN
  -- Get participant count for this conversation
  SELECT array_length(participants, 1) INTO participant_count
  FROM conversations 
  WHERE id = conversation_id;
  
  -- Mark all non-expired messages as viewed by this user
  UPDATE chat_messages 
  SET viewed_by = array_append(viewed_by, user_id)
  WHERE chat_messages.conversation_id = mark_all_messages_as_viewed.conversation_id
    AND NOT (user_id = ANY(viewed_by))
    AND NOT is_expired;
  
  -- Now check each message to see if it should expire
  -- (when all participants have viewed it and it's not saved)
  FOR msg_record IN 
    SELECT id, viewed_by, saved_by 
    FROM chat_messages 
    WHERE chat_messages.conversation_id = mark_all_messages_as_viewed.conversation_id
      AND NOT is_expired
  LOOP
    -- If no one saved it AND all participants have viewed it, mark as expired
    IF COALESCE(array_length(msg_record.saved_by, 1), 0) = 0 
       AND array_length(msg_record.viewed_by, 1) >= participant_count THEN
      
      UPDATE chat_messages 
      SET is_expired = true
      WHERE id = msg_record.id;
      
    END IF;
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_all_messages_as_viewed(UUID, UUID) TO authenticated; 