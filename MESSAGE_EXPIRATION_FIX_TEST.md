# Message Expiration Fix Test

## Issue Fixed
Messages were disappearing after 2 seconds while users were still actively viewing the chat.

## Root Cause
The `markAllMessagesAsViewed()` and `markMessageAsViewed()` functions had automatic cleanup timers:
- `markAllMessagesAsViewed()`: 2-second delay before cleanup
- `markMessageAsViewed()`: 1-second delay before cleanup

These timers would trigger `cleanupExpiredMessages()` while users were still in the chat.

## Solution Implemented
1. **Removed automatic cleanup timers** from both functions
2. **Added cleanup on screen blur** using `useFocusEffect` return function
3. **Messages now only disappear when leaving the chat**, not while viewing

## Test Steps

### Test 1: Basic Message Expiration
1. User A sends a text message to User B
2. User B opens the chat (message gets marked as "viewed")
3. **WAIT 5+ seconds while staying in chat**
4. ✅ **Expected**: Message should still be visible
5. User B navigates away from chat (back to friends list)
6. User B reopens the chat
7. ✅ **Expected**: Message should now be gone (expired)

### Test 2: Saved Messages Don't Expire
1. User A sends a text message to User B
2. User B opens the chat
3. User B long-presses the message to save it (green border + 💾 icon)
4. User B leaves the chat and reopens it
5. ✅ **Expected**: Saved message should still be visible

### Test 3: Multiple Users Viewing
1. User A sends message to group chat (User B, User C)
2. User B opens chat (marks as viewed for User B)
3. User B leaves chat and reopens
4. ✅ **Expected**: Message still visible (User C hasn't viewed yet)
5. User C opens chat (marks as viewed for User C)
6. User C leaves chat and reopens
7. ✅ **Expected**: Message should now be gone (all users viewed)

## Code Changes Made

### 1. Removed Automatic Cleanup Timers
```typescript
// BEFORE (in markAllMessagesAsViewed):
setTimeout(() => {
  cleanupExpiredMessages();
}, 2000);

// AFTER:
// Note: Cleanup will happen when user leaves the chat, not while viewing
```

### 2. Added Cleanup on Screen Blur
```typescript
useFocusEffect(
  React.useCallback(() => {
    if (currentUser && conversationId) {
      markMessagesAsRead();
      markAllMessagesAsViewed();
    }
    
    // Return cleanup function that runs when leaving the screen
    return () => {
      console.log('🚪 User leaving chat, triggering message cleanup...');
      cleanupExpiredMessages();
    };
  }, [currentUser, conversationId])
);
```

## Debug Logs to Watch
- `🚪 User leaving chat, triggering message cleanup...` - When user leaves chat
- `Expired messages cleaned up` - When cleanup function runs
- Message state updates in real-time subscriptions

## Expected Behavior
✅ Messages stay visible while actively viewing chat  
✅ Messages disappear only when leaving chat (if all users have viewed)  
✅ Saved messages never disappear  
✅ Real-time updates work correctly  
✅ No more premature message expiration 