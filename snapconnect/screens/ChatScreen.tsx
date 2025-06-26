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
import { supabase } from '../lib/supabase';
import { SnapService, SnapData } from '../lib/snapService';
import SnapViewer from '../components/SnapViewer';
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
  message_type: 'text' | 'snap';
  content?: string;
  snap_id?: string;
  snap_data?: SnapData;
  created_at: string;
  read_by: string[];
  expires_at?: string;
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
    
    // Set up periodic cleanup of expired messages
    const cleanupInterval = setInterval(async () => {
      try {
        await cleanupExpiredMessages();
        await loadMessages(); // Refresh messages after cleanup
      } catch (error) {
        console.error('Message cleanup error:', error);
      }
    }, 2 * 60 * 1000); // Run every 2 minutes
    
    return () => {
      clearInterval(cleanupInterval);
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
      }
    };
  }, [conversationId]);

  // Mark messages as read when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (currentUser && conversationId) {
        markMessagesAsRead();
      }
    }, [currentUser, conversationId])
  );

  const cleanupExpiredMessages = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_expired_messages');
      if (error) throw error;
      console.log('Expired messages cleaned up');
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
      )
      .subscribe();
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:sender_id(id, username, name)
        `)
        .eq('conversation_id', conversationId)
        .gte('expires_at', new Date().toISOString()) // Only load non-expired messages
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
                snap_data: snapData,
              };
            } catch (error) {
              console.error('Error loading snap data:', error);
              return {
                ...msg,
                sender_name: msg.sender.name || msg.sender.username,
              };
            }
          }
          return {
            ...msg,
            sender_name: msg.sender.name || msg.sender.username,
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
      // Use RPC function to mark messages as read
      const { error } = await supabase
        .rpc('mark_messages_as_read', {
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
    const isExpired = item.expires_at && new Date(item.expires_at) < new Date();

    // Don't render expired messages
    if (isExpired) {
      return null;
    }

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        {!isOwnMessage && isGroup && (
          <Text style={styles.senderName}>{item.sender_name}</Text>
        )}
        
        {item.message_type === 'text' ? (
          <View style={[
            styles.textMessageBubble,
            isOwnMessage ? styles.ownTextBubble : styles.otherTextBubble
          ]}>
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.content}
            </Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.snapMessageBubble,
              isOwnMessage ? styles.ownSnapBubble : styles.otherSnapBubble,
              isExpired && styles.expiredSnapBubble
            ]}
            onPress={() => !isExpired && handleSnapPress(item)}
                         disabled={isExpired || false}
          >
            <Text style={styles.snapIcon}>
              {isExpired ? '⏰' : item.snap_data?.media_type === 'video' ? '🎥' : '📸'}
            </Text>
            <Text style={styles.snapText}>
              {isExpired ? 'Expired' : 'Tap to view'}
            </Text>
          </Pressable>
        )}
        
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
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
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
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
              <Text style={styles.snapButtonIcon}>📸</Text>
            </Pressable>
            
            <Pressable
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendTextMessage}
              disabled={!newMessage.trim() || isSending}
            >
              <Text style={styles.sendButtonIcon}>
                {isSending ? '⏳' : '➤'}
              </Text>
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
  senderName: {
    fontSize: 12,
    color: '#6366f1',
    marginBottom: 4,
    marginLeft: 12,
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
    paddingVertical: 12,
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
  snapButtonIcon: {
    fontSize: 20,
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
  sendButtonIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
}); 