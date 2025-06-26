# 🧪 Message Expiration Testing Guide

## 🔧 **What Was Fixed**

### **Problem:**
- Messages weren't expiring after being viewed
- `markMessagesAsRead` was auto-marking all messages as "viewed" when entering chat
- Database logic had issues with empty array checking

### **Solution:**
1. **Separated Read vs Viewed**: "Read" = read receipts, "Viewed" = expiration trigger
2. **Fixed Database Logic**: Proper empty array checking with `COALESCE(array_length(saved_by, 1), 0) = 0`
3. **Auto-sender Viewed**: Sender automatically marked as having "viewed" their own messages
4. **Enhanced Frontend**: Better debugging and cleanup triggering

## 🧪 **How to Test**

### **Test 1: Basic Text Message Expiration**
1. **Setup**: Have two users in a direct chat
2. **Send**: User A sends a text message to User B
3. **View**: User B taps the message to view it
4. **Result**: Message should disappear for both users after a few seconds

**Debug Output to Look For:**
```
🔍 Marking message as viewed: {messageId: "...", userId: "...", conversationId: "..."}
✅ Successfully marked message as viewed: <messageId>
Expired messages cleaned up
```

### **Test 2: Message Saving**
1. **Send**: User A sends a message
2. **Save**: User B long-presses to save the message
3. **View**: User B taps to view the message
4. **Result**: Message should NOT expire (green border with 💾 icon)

### **Test 3: Group Chat Expiration**
1. **Setup**: Create a group chat with 3+ users
2. **Send**: User A sends a message
3. **Partial View**: Only User B views it (not User C)
4. **Result**: Message should stay visible
5. **Complete View**: User C also views it
6. **Result**: Message should now expire for everyone

### **Test 4: Real-time Updates**
1. **Setup**: Two devices/browsers with same conversation open
2. **Send**: Send message from Device A
3. **View**: View message on Device B
4. **Result**: Message should disappear on both devices simultaneously

## 🔍 **Debug Console Output**

**Look for these logs in your browser/app console:**

### **When Sending:**
```
✅ Message sent successfully
```

### **When Viewing:**
```
Text message tapped: <messageId> isViewed: false
🔍 Marking message as viewed: {messageId: "...", userId: "...", conversationId: "..."}
✅ Successfully marked message as viewed: <messageId>
```

### **When Expiring:**
```
Expired messages cleaned up
Message updated: {is_expired: true}
```

### **Real-time Events:**
```
New message received: {...}
Message updated: {...}
```

## 🚨 **Troubleshooting**

### **If Messages Don't Expire:**
1. Check console for error messages
2. Verify both users have actually tapped/viewed the message
3. Make sure message isn't saved (no green border)
4. Check if real-time subscription is working

### **If Messages Expire Too Fast:**
1. Check if `markMessagesAsRead` is incorrectly marking as viewed
2. Verify sender auto-viewed trigger isn't affecting recipients

### **If Saving Doesn't Work:**
1. Look for "💾 Message Saved" alert
2. Check for green border around saved messages
3. Verify long-press is working (500ms delay)

## 🎯 **Expected Behavior Summary**

✅ **Working Correctly:**
- Text messages expire after ALL participants tap them
- Saved messages never expire (green border + 💾)
- Sender automatically considered "viewed" for their own messages
- Real-time updates when messages expire
- Status indicators (👁️ viewed count, 💾 saved count)

❌ **Not Working:**
- Messages disappearing before being tapped
- Messages not disappearing after being tapped by all
- Save function not preventing expiration
- Missing real-time updates

## 📱 **Quick Test Sequence**

1. **Open Chat** → Messages load but don't auto-expire
2. **Tap Message** → Console shows "marking as viewed"
3. **Wait 1-2 seconds** → Message should disappear
4. **Long Press Message** → Should see save alert + green border
5. **View Saved Message** → Should NOT disappear

**Success = Messages behave like Snapchat! 🎉** 