-- Fix sender auto-viewed issue - senders should not be automatically marked as viewed
-- =============================================

-- Drop the trigger that automatically marks sender as viewed
DROP TRIGGER IF EXISTS auto_mark_sender_viewed_trigger ON public.chat_messages;

-- Drop the function as well
DROP FUNCTION IF EXISTS auto_mark_sender_viewed();

-- The sender should only be marked as "viewed" when they actually open the chat
-- This way messages won't expire immediately when the recipient opens the chat 