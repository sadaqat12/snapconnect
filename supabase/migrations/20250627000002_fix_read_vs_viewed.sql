-- Separate read vs viewed logic
-- =============================================

-- Create function to mark messages as "read" only (for read receipts) without marking as "viewed"
CREATE OR REPLACE FUNCTION mark_only_as_read(
  conversation_id UUID,
  user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update read_by array, do NOT update viewed_by
  UPDATE chat_messages 
  SET read_by = array_append(read_by, user_id)
  WHERE chat_messages.conversation_id = mark_only_as_read.conversation_id
    AND NOT (user_id = ANY(read_by))
    AND NOT is_expired;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_only_as_read(UUID, UUID) TO authenticated; 