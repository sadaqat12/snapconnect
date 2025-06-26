-- Implement view-based message expiration with save functionality
-- =============================================

-- Add new columns to chat_messages table
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS saved_by uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS viewed_by uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_expired boolean DEFAULT false;

-- Create index for better performance on new columns
CREATE INDEX IF NOT EXISTS chat_messages_saved_by_idx ON public.chat_messages USING gin (saved_by);
CREATE INDEX IF NOT EXISTS chat_messages_viewed_by_idx ON public.chat_messages USING gin (viewed_by);

-- Drop the old expiration trigger and function
DROP TRIGGER IF EXISTS set_message_expiration_trigger ON public.chat_messages;
DROP FUNCTION IF EXISTS set_text_message_expiration();

-- Create new function to handle view-based expiration
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
  UPDATE chat_messages 
  SET viewed_by = array_append(viewed_by, user_id)
  WHERE id = message_id
    AND NOT (user_id = ANY(viewed_by))
    AND NOT is_expired;
    
  -- Mark message as expired if all participants have viewed it and it's not saved
  UPDATE chat_messages 
  SET is_expired = true
  WHERE id = message_id
    AND array_length(saved_by, 1) IS NULL -- No one has saved it
    AND (
      -- For direct messages: both participants have viewed it
      (SELECT array_length(participants, 1) FROM conversations WHERE id = conversation_id) = 2
      AND array_length(viewed_by, 1) >= 2
    ) OR (
      -- For group messages: all participants have viewed it
      (SELECT array_length(participants, 1) FROM conversations WHERE id = conversation_id) > 2
      AND array_length(viewed_by, 1) >= (SELECT array_length(participants, 1) FROM conversations WHERE id = conversation_id)
    );
END;
$$;

-- Create function to save/unsave messages
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
    
    -- If no one has saved it and all have viewed it, mark as expired
    UPDATE chat_messages 
    SET is_expired = true
    WHERE id = message_id
      AND array_length(saved_by, 1) IS NULL
      AND (
        -- Check if all participants have viewed it
        (SELECT array_length(participants, 1) FROM conversations WHERE id = conversation_id) = 2
        AND array_length(viewed_by, 1) >= 2
      ) OR (
        (SELECT array_length(participants, 1) FROM conversations WHERE id = conversation_id) > 2
        AND array_length(viewed_by, 1) >= (SELECT array_length(participants, 1) FROM conversations WHERE id = conversation_id)
      );
    
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

-- Update the mark_messages_as_read function to use view-based logic
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
    
  -- For each message, also mark as viewed
  UPDATE chat_messages 
  SET viewed_by = array_append(viewed_by, user_id)
  WHERE chat_messages.conversation_id = mark_messages_as_read.conversation_id
    AND NOT (user_id = ANY(viewed_by))
    AND NOT is_expired;
END;
$$;

-- Update cleanup function to handle new expiration logic
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
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
GRANT EXECUTE ON FUNCTION mark_message_as_viewed(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_message_saved(UUID, UUID) TO authenticated; 