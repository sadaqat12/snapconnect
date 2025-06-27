import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { SnapService, SnapData } from '../lib/snapService';
import SnapViewer from '../components/SnapViewer';
import UserAvatar from '../components/UserAvatar';
import { useFriendsStore, Friend } from '../lib/stores/friendsStore';

// Navigation types
export type ChatStackParamList = {
  ChatList: undefined;
  Chat: {
    conversationId: string;
    conversationName: string;
    participants: string[];
    isGroup: boolean;
  };
};

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_url?: string;
  message_type: 'text' | 'snap';
  content?: string;
  snap_id?: string;
  snap_data?: SnapData;
  created_at: string;
  read_by: string[];
  expires_at?: string;
  saved_by?: string[];
  viewed_by?: string[];
  is_expired?: boolean;
}

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId, conversationName, participants, isGroup } = route.params;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedSnap, setSelectedSnap] = useState<SnapData | null>(null);
  const [isSnapViewerVisible, setIsSnapViewerVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const realtimeChannel = useRef<any>(null);

  useEffect(() => {
    initializeChat();
    setupRealtimeSubscription();
    
    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
      }
    };
  }, [conversationId]);

  // Mark messages as read AND viewed when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (currentUser && conversationId) {
        markMessagesAsRead();
        markAllMessagesAsViewed(); // This is the key change - opening chat = viewing all messages
      }
    }, [currentUser, conversationId])
  );

  // Listen for when user is actually leaving the screen (back button, navigation)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      console.log('🚪 User leaving chat screen, triggering message cleanup...');
      // Trigger cleanup when actually leaving the screen
      cleanupExpiredMessages();
    });

    return unsubscribe;
  }, [navigation]);

  const cleanupExpiredMessages = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_expired_messages');
      if (error) throw error;
      console.log('Expired messages cleaned up');
      // Refresh messages after cleanup to remove any that became expired
      await loadMessages();
    } catch (error) {
      console.error('Error cleaning up expired messages:', error);
    }
  };

  const initializeChat = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');
      setCurrentUser(user);

      // Load chat messages
      await loadMessages();
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    realtimeChannel.current = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          const newMessage = payload.new as ChatMessage;
          
          // Only add non-expired messages
          if (!newMessage.is_expired) {
            // Prevent duplicate messages by checking if message already exists
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                return prev; // Don't add duplicate
              }
              return [...prev, newMessage];
            });
            
            // Auto-scroll to bottom
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('Message updated:', payload);
          const updatedMessage = payload.new as ChatMessage;
          
          setMessages(prev => {
            if (updatedMessage.is_expired) {
              // Remove expired messages
              return prev.filter(msg => msg.id !== updatedMessage.id);
            } else {
              // Update existing message
              return prev.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
              );
            }
          });
        }
      )
      .subscribe();
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:sender_id(id, username, name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .eq('is_expired', false) // Only load non-expired messages
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process messages and load snap data for snap messages
      const processedMessages = await Promise.all(
        data.map(async (msg: any) => {
          if (msg.message_type === 'snap' && msg.snap_id) {
            try {
              const snapData = await SnapService.getSnapById(msg.snap_id);
              return {
                ...msg,
                sender_name: msg.sender.name || msg.sender.username,
                sender_avatar_url: msg.sender.avatar_url,
                snap_data: snapData,
              };
            } catch (error) {
              console.error('Error loading snap data:', error);
              return {
                ...msg,
                sender_name: msg.sender.name || msg.sender.username,
                sender_avatar_url: msg.sender.avatar_url,
              };
            }
          }
          return {
            ...msg,
            sender_name: msg.sender.name || msg.sender.username,
            sender_avatar_url: msg.sender.avatar_url,
          };
        })
      );

      setMessages(processedMessages);
      
      // Mark all messages as read for the current user
      await markMessagesAsRead();
      
      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!currentUser) return;
    
    try {
      // Create a simple function to mark only as "read" not "viewed"
      const { error } = await supabase.rpc('mark_only_as_read', {
        conversation_id: conversationId,
        user_id: currentUser.id
      });

      if (error) {
        console.error('Error marking messages as read:', error);
      }
    } catch (error) {
      console.error('Error in markMessagesAsRead:', error);
    }
  };

  const markAllMessagesAsViewed = async () => {
    if (!currentUser) return;
    
    console.log('🔍 Marking ALL messages as viewed in conversation:', {
      userId: currentUser.id,
      conversationId
    });
    
    try {
      const { error } = await supabase
        .rpc('mark_all_messages_as_viewed', {
          conversation_id: conversationId,
          user_id: currentUser.id
        });

      if (error) {
        console.error('❌ Error marking all messages as viewed:', error);
      } else {
        console.log('✅ Successfully marked all messages as viewed in conversation');
        
        // Update local state - mark all non-expired messages as viewed by current user
        setMessages(prev => 
          prev.map(msg => {
            if (!msg.is_expired && !(msg.viewed_by || []).includes(currentUser.id)) {
              return {
                ...msg,
                viewed_by: [...(msg.viewed_by || []), currentUser.id]
              };
            }
            return msg;
          })
        );
        
        // Note: Cleanup will happen when user leaves the chat, not while viewing
      }
    } catch (error) {
      console.error('❌ Error in markAllMessagesAsViewed:', error);
    }
  };

  const markMessageAsViewed = async (messageId: string) => {
    if (!currentUser) return;
    
    console.log('🔍 Marking individual message as viewed:', {
      messageId,
      userId: currentUser.id,
      conversationId
    });
    
    try {
      const { error } = await supabase
        .rpc('mark_message_as_viewed', {
          message_id: messageId,
          user_id: currentUser.id
        });

      if (error) {
        console.error('❌ Error marking message as viewed:', error);
      } else {
        console.log('✅ Successfully marked message as viewed:', messageId);
        
        // Update local state to reflect the change
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  viewed_by: [...(msg.viewed_by || []), currentUser.id].filter((id, index, arr) => arr.indexOf(id) === index)
                }
              : msg
          )
        );
        
        // Note: Cleanup will happen when user leaves the chat, not while viewing
      }
    } catch (error) {
      console.error('❌ Error in markMessageAsViewed:', error);
    }
  };

  const toggleMessageSaved = async (messageId: string) => {
    if (!currentUser) return;
    
    try {
      const { data: isSaved, error } = await supabase
        .rpc('toggle_message_saved', {
          message_id: messageId,
          user_id: currentUser.id
        });

      if (error) {
        console.error('Error toggling message saved:', error);
        Alert.alert('Error', 'Failed to save message');
      } else {
        // Update local state to reflect the change
        setMessages(prev => 
          prev.map(msg => {
            if (msg.id === messageId) {
              const currentSavedBy = msg.saved_by || [];
              const newSavedBy = isSaved 
                ? [...currentSavedBy, currentUser.id].filter((id, index, arr) => arr.indexOf(id) === index)
                : currentSavedBy.filter(id => id !== currentUser.id);
              
              return {
                ...msg,
                saved_by: newSavedBy,
                is_expired: false, // Saved messages don't expire
              };
            }
            return msg;
          })
        );
        
        // Show feedback to user
        Alert.alert(
          isSaved ? 'Message Saved' : 'Message Unsaved',
          isSaved 
            ? 'This message will be preserved and won\'t expire.' 
            : 'This message will now expire when everyone has viewed it.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error in toggleMessageSaved:', error);
      Alert.alert('Error', 'Failed to save message');
    }
  };

  const sendTextMessage = async () => {
    if (!newMessage.trim() || !currentUser || isSending) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    
    try {
      const messageData = {
        conversation_id: conversationId,
        sender_id: currentUser.id,
        message_type: 'text' as const,
        content: messageContent,
        read_by: [currentUser.id],
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([messageData])
        .select(`
          *,
          sender:sender_id(id, username, name)
        `)
        .single();

      if (error) throw error;

      // Immediately add the message to local state
      const newChatMessage: ChatMessage = {
        ...data,
        sender_name: currentUser.user_metadata?.name || currentUser.email || 'You',
      };

      setMessages(prev => [...prev, newChatMessage]);
      setNewMessage('');

      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const sendSnapMessage = async () => {
    if (!currentUser) return;

    try {
      // Open camera/gallery picker
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.type === 'video' ? 'video' : 'photo';

        setIsSending(true);

        // Create snap with conversation participants as recipients
        const snap = await SnapService.createSnapFromMedia(
          asset.uri,
          mediaType,
          {
            caption: `Chat ${mediaType}`,
            recipients: participants,
            duration: mediaType === 'photo' ? 10 : 30,
            includeLocation: false,
          }
        );

        // Send chat message referencing the snap
        const messageData = {
          conversation_id: conversationId,
          sender_id: currentUser.id,
          message_type: 'snap' as const,
          snap_id: snap.id,
          read_by: [currentUser.id],
          expires_at: snap.expires_at,
        };

        const { data, error } = await supabase
          .from('chat_messages')
          .insert([messageData])
          .select(`
            *,
            sender:sender_id(id, username, name)
          `)
          .single();

        if (error) throw error;

        // Immediately add the message to local state
        const newChatMessage: ChatMessage = {
          ...data,
          sender_name: currentUser.user_metadata?.name || currentUser.email || 'You',
          snap_data: snap,
        };

        setMessages(prev => [...prev, newChatMessage]);

        // Auto-scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending snap:', error);
      Alert.alert('Error', 'Failed to send snap');
    } finally {
      setIsSending(false);
    }
  };

  const handleSnapPress = (message: ChatMessage) => {
    if (message.snap_data) {
      setSelectedSnap(message.snap_data);
      setIsSnapViewerVisible(true);
    }
  };

  const handleSnapViewed = async () => {
    if (selectedSnap && currentUser) {
      try {
        await SnapService.markSnapAsRead(selectedSnap.id!);
        setIsSnapViewerVisible(false);
        setSelectedSnap(null);
        
        // Update local message state
        setMessages(prev => 
          prev.map(msg => 
            msg.snap_id === selectedSnap.id 
              ? { ...msg, read_by: [...(msg.read_by || []), currentUser.id] }
              : msg
          )
        );
      } catch (error) {
        console.error('Error marking snap as read:', error);
        setIsSnapViewerVisible(false);
        setSelectedSnap(null);
      }
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.sender_id === currentUser?.id;
    const isExpired = item.is_expired;
    const isSaved = item.saved_by && item.saved_by.includes(currentUser?.id || '');
    const isViewed = item.viewed_by && item.viewed_by.includes(currentUser?.id || '');
    const savedByOthers = item.saved_by && item.saved_by.filter(id => id !== currentUser?.id);
    const viewedByOthers = item.viewed_by && item.viewed_by.filter(id => id !== currentUser?.id);

    // Don't render expired messages
    if (isExpired) {
      return null;
    }

    const handleMessagePress = () => {
      if (item.message_type === 'text') {
        // Text messages are already viewed when opening chat, tap does nothing special
        console.log('Text message tapped:', item.id, '(already viewed by opening chat)');
        // No need to call markMessageAsViewed here since it happens on chat open
      } else {
        // Handle snap press - this also marks as viewed through the snap viewer
        console.log('Snap message tapped:', item.id);
        handleSnapPress(item);
      }
    };

    const handleMessageLongPress = () => {
      // Toggle saved state on long press
      toggleMessageSaved(item.id);
    };

    return (
      <Pressable
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage
        ]}
        onPress={handleMessagePress}
        onLongPress={handleMessageLongPress}
        delayLongPress={500}
      >
        {!isOwnMessage && isGroup && (
          <View style={styles.senderInfo}>
            <UserAvatar 
              avatarUrl={item.sender_avatar_url} 
              size="small" 
              style={styles.messageAvatar} 
            />
            <Text style={styles.senderName}>{item.sender_name}</Text>
          </View>
        )}
        
        {item.message_type === 'text' ? (
          <View style={[
            styles.textMessageBubble,
            isOwnMessage ? styles.ownTextBubble : styles.otherTextBubble,
            isSaved && styles.savedMessageBubble,
            !isViewed && !isOwnMessage && styles.unviewedMessageBubble
          ]}>
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.content}
            </Text>
            
            {/* Saved indicator */}
            {isSaved && (
              <View style={styles.messageIndicators}>
                {item.saved_by?.includes(currentUser.id) && (
                  <Ionicons name="bookmark" size={14} color="#10B981" style={styles.savedIndicator} />
                )}
              </View>
            )}
          </View>
        ) : (
          <Pressable
            style={[
              styles.snapMessageBubble,
              isOwnMessage ? styles.ownSnapBubble : styles.otherSnapBubble,
              isSaved && styles.savedSnapBubble
            ]}
            onPress={handleMessagePress}
            onLongPress={handleMessageLongPress}
            delayLongPress={500}
          >
            <Text style={styles.snapIcon}>
              {item.snap_data?.media_type === 'video' ? '🎥' : '📸'}
            </Text>
            <Text style={styles.snapText}>
              {isSaved ? 'Saved Snap' : 'Tap to view'}
            </Text>
            {isSaved && <Ionicons name="bookmark" size={12} color="#10B981" style={styles.savedIndicator} />}
          </Pressable>
        )}
        
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          
          {/* Show status indicators for own messages */}
          {isOwnMessage && (
            <View style={styles.statusIndicators}>
                             {savedByOthers && savedByOthers.length > 0 && (
                 <Text style={styles.statusIndicator}>
                   <Ionicons name="bookmark" size={12} color="#10B981" /> {savedByOthers.length}
                 </Text>
               )}
               {viewedByOthers && viewedByOthers.length > 0 && (
                 <Text style={styles.statusIndicator}>
                   <Ionicons name="eye" size={12} color="#6366f1" /> {viewedByOthers.length}
                 </Text>
               )}
            </View>
          )}
        </View>
        
        {/* Long press hint for new users - now shows for all messages since viewing happens on chat open */}
        {!isOwnMessage && (
          <Text style={styles.hintText}>
            Long press to save
          </Text>
        )}
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>←</Text>
      </Pressable>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>{conversationName}</Text>
        <Text style={styles.headerSubtitle}>
          {isGroup ? `${participants.length} members` : 'Active now'}
        </Text>
        <Text style={styles.chatInfo}>
          Messages disappear after all open chat • Long press to save
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#6B7280"
            multiline
            maxLength={500}
          />
          
          <View style={styles.inputActions}>
            <Pressable
              style={styles.snapButton}
              onPress={sendSnapMessage}
              disabled={isSending}
            >
              <Ionicons name="camera" size={20} color="#ffffff" />
            </Pressable>
            
            <Pressable
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendTextMessage}
              disabled={!newMessage.trim() || isSending}
            >
              <Ionicons name="send" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Snap Viewer */}
      {selectedSnap && (
        <SnapViewer
          snap={selectedSnap}
          isVisible={isSnapViewerVisible}
          onClose={() => {
            setIsSnapViewerVisible(false);
            setSelectedSnap(null);
          }}
          onSnapViewed={handleSnapViewed}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1a1a2e',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backIcon: {
    fontSize: 24,
    color: '#6366f1',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 4,
  },
  messageAvatar: {
    marginRight: 8,
  },
  senderName: {
    fontSize: 12,
    color: '#6366f1',
  },
  textMessageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 4,
  },
  ownTextBubble: {
    backgroundColor: '#6366f1',
  },
  otherTextBubble: {
    backgroundColor: '#1f1f1f',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#ffffff',
  },
  snapMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 4,
  },
  ownSnapBubble: {
    backgroundColor: '#1e1e38',
    borderColor: '#6366f1',
  },
  otherSnapBubble: {
    backgroundColor: '#1f1f1f',
    borderColor: '#9CA3AF',
  },
  expiredSnapBubble: {
    backgroundColor: '#2d1b1b',
    borderColor: '#6B7280',
    opacity: 0.6,
  },
  snapIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  snapText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#ffffff',
    maxHeight: 100,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
  savedMessageBubble: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  unviewedMessageBubble: {
    opacity: 0.7,
    borderColor: '#fbbf24',
    borderWidth: 1,
  },
  messageIndicators: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  savedIndicator: {
    fontSize: 12,
    color: '#10b981',
  },
  savedSnapBubble: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  hintText: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  chatInfo: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  messagesContent: {
    paddingBottom: 12,
  },
}); 