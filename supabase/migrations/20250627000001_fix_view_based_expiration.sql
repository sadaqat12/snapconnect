-- Fix view-based message expiration logic
-- =============================================

-- Drop and recreate the mark_message_as_viewed function with proper logic
CREATE OR REPLACE FUNCTION mark_message_as_viewed(
  message_id UUID,
  user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  participant_count INTEGER;
  viewed_count INTEGER;
  saved_count INTEGER;
BEGIN
  -- Add user to viewed_by array if not already present
  UPDATE chat_messages 
  SET viewed_by = array_append(viewed_by, user_id)
  WHERE id = message_id
    AND NOT (user_id = ANY(viewed_by))
    AND NOT is_expired;
  
  -- Get conversation participant count and current viewed/saved counts
  SELECT 
    array_length(c.participants, 1),
    array_length(cm.viewed_by, 1),
    COALESCE(array_length(cm.saved_by, 1), 0)
  INTO participant_count, viewed_count, saved_count
  FROM chat_messages cm
  JOIN conversations c ON c.id = cm.conversation_id
  WHERE cm.id = message_id;
  
  -- Mark message as expired if:
  -- 1. No one has saved it (saved_count = 0)
  -- 2. All participants have viewed it (viewed_count >= participant_count)
  IF saved_count = 0 AND viewed_count >= participant_count THEN
    UPDATE chat_messages 
    SET is_expired = true
    WHERE id = message_id;
  END IF;
END;
$$;

-- Update the mark_messages_as_read function to properly handle viewed_by
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  conversation_id UUID,
  user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update messages to add user_id to read_by array if not already present
  UPDATE chat_messages 
  SET read_by = array_append(read_by, user_id)
  WHERE chat_messages.conversation_id = mark_messages_as_read.conversation_id
    AND NOT (user_id = ANY(read_by))
    AND NOT is_expired;
    
  -- For each message, also mark as viewed and check expiration
  UPDATE chat_messages 
  SET viewed_by = array_append(viewed_by, user_id)
  WHERE chat_messages.conversation_id = mark_messages_as_read.conversation_id
    AND NOT (user_id = ANY(viewed_by))
    AND NOT is_expired;
  
  -- Check each message for expiration after marking as viewed
  UPDATE chat_messages 
  SET is_expired = true
  WHERE chat_messages.conversation_id = mark_messages_as_read.conversation_id
    AND NOT is_expired
    AND COALESCE(array_length(saved_by, 1), 0) = 0 -- No one has saved it
    AND array_length(viewed_by, 1) >= (
      SELECT array_length(participants, 1) 
      FROM conversations 
      WHERE id = mark_messages_as_read.conversation_id
    );
END;
$$;

-- Fix the toggle_message_saved function with proper logic
CREATE OR REPLACE FUNCTION toggle_message_saved(
  message_id UUID,
  user_id UUID
)
RETURNS boolean -- returns true if message is now saved, false if unsaved
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_saved boolean;
  participant_count INTEGER;
  viewed_count INTEGER;
BEGIN
  -- Check if user has already saved this message
  SELECT user_id = ANY(saved_by) INTO is_saved
  FROM chat_messages 
  WHERE id = message_id;
  
  IF is_saved THEN
    -- Remove user from saved_by array
    UPDATE chat_messages 
    SET saved_by = array_remove(saved_by, user_id)
    WHERE id = message_id;
    
    -- Get current counts after removing save
    SELECT 
      array_length(c.participants, 1),
      COALESCE(array_length(cm.viewed_by, 1), 0)
    INTO participant_count, viewed_count
    FROM chat_messages cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.id = message_id;
    
    -- If no one has saved it and all have viewed it, mark as expired
    UPDATE chat_messages 
    SET is_expired = true
    WHERE id = message_id
      AND COALESCE(array_length(saved_by, 1), 0) = 0 -- No one has it saved
      AND viewed_count >= participant_count; -- All have viewed
    
    RETURN false;
  ELSE
    -- Add user to saved_by array and unmark as expired
    UPDATE chat_messages 
    SET saved_by = array_append(saved_by, user_id),
        is_expired = false
    WHERE id = message_id;
    
    RETURN true;
  END IF;
END;
$$;

-- Create a trigger to automatically mark sender as "viewed" when message is created
CREATE OR REPLACE FUNCTION auto_mark_sender_viewed()
RETURNS trigger AS $$
BEGIN
  -- Automatically add sender to viewed_by array
  NEW.viewed_by = array_append(NEW.viewed_by, NEW.sender_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-marking sender as viewed
DROP TRIGGER IF EXISTS auto_mark_sender_viewed_trigger ON public.chat_messages;
CREATE TRIGGER auto_mark_sender_viewed_trigger
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW 
  EXECUTE FUNCTION auto_mark_sender_viewed(); 