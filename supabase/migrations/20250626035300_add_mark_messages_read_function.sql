-- Add function to mark messages as read
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
    AND expires_at > NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID, UUID) TO authenticated;
