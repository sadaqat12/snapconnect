import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFriendsStore, Friend } from '../lib/stores/friendsStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SnapService, SnapData } from '../lib/snapService';
import SnapViewer from '../components/SnapViewer';
import UserAvatar from '../components/UserAvatar';
import { supabase } from '../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

interface Conversation {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  participants: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message?: {
    content?: string;
    message_type: 'text' | 'snap';
    sender_name: string;
    created_at: string;
  };
  unread_count: number;
  participant_names: string[];
}

interface FriendWithActivity extends Friend {
  unreadSnaps: SnapData[];
  lastContact?: Date;
  conversation?: Conversation;
  unreadMessages: number;
  lastMessage?: string;
  lastMessageTime?: Date;
}

const EmptySearchResults = () => (
  <Text style={styles.emptyText}>
    No new users found. They might already be your friend or have a pending request.
  </Text>
);

const EmptyFriendsList = () => (
  <Text style={styles.emptyText}>
    No friends yet. Search above to add friends!
  </Text>
);

export default function FriendsScreen() {
  const navigation = useNavigation<any>();
  const {
    friends,
    pendingRequests,
    isLoading: isFriendsLoading,
    error,
    fetchFriends,
    fetchPendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    searchUsers,
  } = useFriendsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friendsWithActivity, setFriendsWithActivity] = useState<FriendWithActivity[]>([]);
  const [selectedSnap, setSelectedSnap] = useState<SnapData | null>(null);
  const [isSnapViewerVisible, setIsSnapViewerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showGroupChatModal, setShowGroupChatModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [groupName, setGroupName] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Add state for group conversations
  const [groupConversations, setGroupConversations] = useState<Conversation[]>([]);

  const realtimeChannel = useRef<any>(null);

  useEffect(() => {
    initializeScreen();
    setupRealtimeSubscription();

    // Set up periodic cleanup of old snaps
    const cleanupInterval = setInterval(async () => {
      try {
        await SnapService.cleanupOldSnaps();
        await cleanupExpiredMessages();
        await loadData();
      } catch (error) {
        console.error('Periodic cleanup error:', error);
      }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(cleanupInterval);
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
      }
    };
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const initializeScreen = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');
      setCurrentUser(user);
      await loadData();
    } catch (error) {
      console.error('Error initializing screen:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    realtimeChannel.current = supabase
      .channel('friends_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        () => loadData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => loadData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'snaps',
        },
        () => loadData()
      )
      .subscribe();
  };

  const loadData = async () => {
    try {
      await Promise.all([fetchFriends(), fetchPendingRequests()]);
      await loadFriendActivity();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadFriendActivity = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Get received snaps
      const receivedSnaps = await SnapService.getReceivedSnaps();
      
      // Get ALL conversations (both direct and group)
      const { data: allConversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          last_message:chat_messages(
            content,
            message_type,
            created_at,
            sender:sender_id(username, name)
          )
        `)
        .contains('participants', [user.id])
        .order('last_message_at', { ascending: false });

      if (convError) {
        console.error('Error loading conversations:', convError);
      }

      // Separate direct and group conversations
      const directConversations = allConversations?.filter(conv => conv.type === 'direct') || [];
      const groupConvs = allConversations?.filter(conv => conv.type === 'group') || [];
      
      // Process group conversations with participant info
      const processedGroupConvs = await Promise.all(
        groupConvs.map(async (conv) => {
          // Get participant info for group conversations
          const { data: participantInfo } = await supabase
            .from('users')
            .select('id, username, name, avatar_url')
            .in('id', conv.participants);

          const participantNames = participantInfo
            ?.filter(p => p.id !== user.id)
            .map(p => p.name || p.username) || [];

          // Get unread count for this conversation
          const { data: unreadMessages } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('conversation_id', conv.id)
            .not('read_by', 'cs', `{${user.id}}`);

          return {
            ...conv,
            participant_names: participantNames,
            unread_count: unreadMessages?.length || 0,
          };
        })
      );

      setGroupConversations(processedGroupConvs);

      if (convError) {
        console.error('Error loading conversations:', convError);
      }
      
      // Group snaps and conversations by friend
      const friendsMap = new Map<string, FriendWithActivity>();
      
      // Initialize map with friends
      friends.forEach(friend => {
        friendsMap.set(friend.id, {
          ...friend,
          unreadSnaps: [],
          lastContact: undefined,
          unreadMessages: 0,
          lastMessage: undefined,
          lastMessageTime: undefined,
        });
      });

      // Process snaps
      receivedSnaps.forEach(snap => {
        const friend = friendsMap.get(snap.creator_id);
        if (friend) {
          if (!snap.read_by?.includes(user.id)) {
            friend.unreadSnaps.push(snap);
          }
          
          const snapTime = new Date(snap.created_at || Date.now());
          if (!friend.lastContact || snapTime > friend.lastContact) {
            friend.lastContact = snapTime;
          }
        }
      });

      // Process direct conversations
      if (directConversations) {
        for (const conv of directConversations) {
          const otherParticipant = conv.participants.find((p: string) => p !== user.id);
          const friend = friendsMap.get(otherParticipant);
          
          if (friend) {
            const { data: unreadMessages } = await supabase
              .from('chat_messages')
              .select('id')
              .eq('conversation_id', conv.id)
              .not('read_by', 'cs', `{${user.id}}`);

            friend.conversation = conv;
            friend.unreadMessages = unreadMessages?.length || 0;
            
            if (conv.last_message?.[0]) {
              const lastMsg = conv.last_message[0];
              friend.lastMessage = lastMsg.message_type === 'text' 
                ? lastMsg.content 
                : `sent a snap`;
              friend.lastMessageTime = new Date(lastMsg.created_at);
            }
          }
        }
      }

      // Sort by activity
      const sortedFriends = Array.from(friendsMap.values()).sort((a, b) => {
        const aActivity = a.unreadSnaps.length + a.unreadMessages;
        const bActivity = b.unreadSnaps.length + b.unreadMessages;
        
        if (aActivity !== bActivity) {
          return bActivity - aActivity;
        }
        
        const aTime = Math.max(
          a.lastContact?.getTime() || 0,
          a.lastMessageTime?.getTime() || 0
        );
        const bTime = Math.max(
          b.lastContact?.getTime() || 0,
          b.lastMessageTime?.getTime() || 0
        );
        
        return bTime - aTime;
      });

      setFriendsWithActivity(sortedFriends);
    } catch (error) {
      console.error('Error loading friend activity:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim()) {
      setIsSearching(true);
      const results = await searchUsers(text);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const handleSendRequest = async (email: string) => {
    try {
      await sendFriendRequest(email);
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('Success', 'Friend request sent!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleFriendPress = (friend: FriendWithActivity) => {
    // If there are unread snaps, show the snap first
    if (friend.unreadSnaps.length > 0) {
      const snap = friend.unreadSnaps[0];
      setSelectedSnap(snap);
      setIsSnapViewerVisible(true);
    } else {
      // Otherwise, open chat
      startDirectChat(friend);
    }
  };

  const startDirectChat = async (friend: Friend) => {
    if (!currentUser) return;

    try {
      const { data: conversationId, error } = await supabase.rpc(
        'get_or_create_direct_conversation',
        {
          user1_id: currentUser.id,
          user2_id: friend.id,
        }
      );

      if (error) throw error;

      navigation.navigate('Chat', {
        conversationId,
        conversationName: friend.name || friend.username,
        participants: [currentUser.id, friend.id],
        isGroup: false,
      });
    } catch (error) {
      console.error('Error starting direct chat:', error);
      Alert.alert('Error', 'Failed to start chat');
    }
  };

  const createGroupChat = async () => {
    if (!currentUser || selectedFriends.length === 0) {
      Alert.alert('Error', 'Please select at least one friend');
      return;
    }

    try {
      const participantIds = selectedFriends.map(f => f.id);
      const groupNameToUse = groupName.trim() || 
        selectedFriends.map(f => f.name || f.username).join(', ');

      const { data: conversationId, error } = await supabase.rpc(
        'create_group_conversation',
        {
          creator_id: currentUser.id,
          participant_ids: participantIds,
          group_name: groupNameToUse,
        }
      );

      if (error) throw error;

      navigation.navigate('Chat', {
        conversationId,
        conversationName: groupNameToUse,
        participants: [currentUser.id, ...participantIds],
        isGroup: true,
      });

      setShowGroupChatModal(false);
      setSelectedFriends([]);
      setGroupName('');
      
      // Refresh data to show new group chat
      await loadData();
    } catch (error) {
      console.error('Error creating group chat:', error);
      Alert.alert('Error', 'Failed to create group chat');
    }
  };

  const handleGroupChatPress = (conversation: Conversation) => {
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      conversationName: conversation.name || 'Group Chat',
      participants: conversation.participants,
      isGroup: true,
    });
  };

  const toggleFriendSelection = (friend: Friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f.id === friend.id);
      if (isSelected) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleSnapViewed = async () => {
    if (selectedSnap && currentUser) {
      try {
        await SnapService.markSnapAsRead(selectedSnap.id!);
        setIsSnapViewerVisible(false);
        setSelectedSnap(null);
        
        setFriendsWithActivity(prev => 
          prev.map(friend => {
            if (friend.unreadSnaps.some(snap => snap.id === selectedSnap.id)) {
              return {
                ...friend,
                unreadSnaps: friend.unreadSnaps.filter(snap => snap.id !== selectedSnap.id),
              };
            }
            return friend;
          })
        );
      } catch (error) {
        console.error('Error marking snap as read:', error);
        setIsSnapViewerVisible(false);
        setSelectedSnap(null);
      }
    }
  };

  const cleanupExpiredMessages = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_expired_messages');
      if (error) throw error;
      console.log('Expired messages cleaned up');
    } catch (error) {
      console.error('Error cleaning up expired messages:', error);
    }
  };

  const handleCleanupOldSnaps = async () => {
    try {
      setIsLoading(true);
      await SnapService.cleanupOldSnaps();
      await cleanupExpiredMessages();
      await loadData();
      Alert.alert('Success', 'Old snaps and messages have been cleaned up');
    } catch (error) {
      console.error('Error cleaning up:', error);
      Alert.alert('Error', 'Failed to clean up old content');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastActivityTime = (friend: FriendWithActivity) => {
    const lastTime = Math.max(
      friend.lastContact?.getTime() || 0,
      friend.lastMessageTime?.getTime() || 0
    );
    
    if (lastTime === 0) return '';
    
    const date = new Date(lastTime);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderSearchResult = ({ item }: { item: Friend }) => {
    const getButtonConfig = () => {
      switch (item.status) {
        case 'accepted':
          return { text: 'Friends', style: styles.addButton, onPress: () => {}, disabled: true };
        case 'pending':
          return { text: 'Pending', style: styles.addButton, onPress: () => {}, disabled: true };
        case 'blocked': // Using 'blocked' as placeholder for "Accept Request"
          return { 
            text: 'Accept Request', 
            style: styles.addButton, 
            onPress: () => acceptFriendRequest(item.id),
            disabled: false 
          };
        default:
          return { 
            text: 'Add Friend', 
            style: styles.addButton, 
            onPress: () => handleSendRequest(item.email),
            disabled: false 
          };
      }
    };

    const buttonConfig = getButtonConfig();

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={buttonConfig.onPress}
        disabled={buttonConfig.disabled}
      >
        <UserAvatar avatarUrl={item.avatar_url} size="medium" style={styles.avatar} />
        <View style={styles.cardContent}>
          <Text style={styles.name}>{item.name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        <Text style={[
          buttonConfig.style,
          buttonConfig.disabled && { opacity: 0.5 }
        ]}>
          {buttonConfig.text}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFriend = ({ item }: { item: FriendWithActivity }) => {
    const totalActivity = item.unreadSnaps.length + item.unreadMessages;
    const hasActivity = totalActivity > 0;
    
    return (
      <TouchableOpacity
        style={[styles.card, hasActivity && styles.cardWithActivity]}
        onPress={() => handleFriendPress(item)}
        onLongPress={() => startDirectChat(item)}
      >
        <UserAvatar avatarUrl={item.avatar_url} size="medium" style={styles.avatar} />
        <View style={styles.cardContent}>
          <View style={styles.friendHeader}>
            <Text style={styles.name}>{item.name || item.username}</Text>
            <Text style={styles.activityTime}>
              {formatLastActivityTime(item)}
            </Text>
          </View>
          
          <Text style={styles.username}>@{item.username}</Text>
          
          {item.lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          )}
        </View>
        
        <View style={styles.activityContainer}>
          {item.unreadSnaps.length > 0 && (
            <View style={styles.activityBadge}>
              <Ionicons name="camera" size={12} color="#ffffff" />
              <Text style={styles.activityText}>{item.unreadSnaps.length}</Text>
            </View>
          )}
          {item.unreadMessages > 0 && (
            <View style={styles.activityBadge}>
              <Ionicons name="chatbubble" size={12} color="#ffffff" />
              <Text style={styles.activityText}>{item.unreadMessages}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderPendingRequest = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <UserAvatar avatarUrl={item.avatar_url} size="medium" style={styles.avatar} />
      <View style={styles.cardContent}>
        <Text style={styles.name}>{item.name || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => acceptFriendRequest(item.id)}
        >
          <Text style={styles.actionButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => rejectFriendRequest(item.id)}
        >
          <Text style={styles.actionButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGroupChat = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.card, item.unread_count > 0 && styles.cardWithActivity]}
      onPress={() => handleGroupChatPress(item)}
    >
      <View style={[styles.avatar, { backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.name, { color: '#ffffff', fontSize: 14 }]}>
          {item.name ? item.name.substring(0, 2).toUpperCase() : 'GC'}
        </Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.friendHeader}>
          <Text style={styles.name}>{item.name || 'Group Chat'}</Text>
          {item.unread_count > 0 && (
            <View style={styles.activityBadge}>
              <Text style={styles.activityText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        <Text style={styles.email}>
          {item.participant_names.join(', ')} • {item.participants.length} members
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderGroupChatModal = () => (
    <Modal
      visible={showGroupChatModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowGroupChatModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Group Chat</Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={() => {
                setShowGroupChatModal(false);
                setSelectedFriends([]);
                setGroupName('');
              }}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.groupNameInput}
            placeholder="Group name (optional)"
            placeholderTextColor="#6B7280"
            value={groupName}
            onChangeText={setGroupName}
          />

          <FlatList
            data={friends}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.friendItem,
                  selectedFriends.some(f => f.id === item.id) && styles.selectedFriendItem
                ]}
                onPress={() => toggleFriendSelection(item)}
              >
                <UserAvatar avatarUrl={item.avatar_url} size="small" style={styles.avatar} />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{item.name || item.username}</Text>
                  <Text style={styles.friendUsername}>@{item.username}</Text>
                </View>
                {selectedFriends.some(f => f.id === item.id) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No friends found. Add some friends to create a group!
              </Text>
            }
          />

          <View style={styles.modalFooter}>
            <Text style={styles.selectedCount}>
              Selected: {selectedFriends.length}
            </Text>
            <Pressable
              style={[
                styles.createButton,
                selectedFriends.length === 0 && styles.createButtonDisabled
              ]}
              onPress={createGroupChat}
              disabled={selectedFriends.length === 0}
            >
              <Text style={styles.createButtonText}>Create Group</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends & Chats</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowGroupChatModal(true)}
          >
            <Ionicons name="people" size={20} color="#6366f1" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCleanupOldSnaps}
            disabled={isLoading}
          >
            <Ionicons name="trash" size={20} color="#6366f1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by email or name..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {isSearching && (
          <ActivityIndicator style={styles.searchSpinner} color="#6366f1" />
        )}
      </View>

      {/* Search Results */}
      {searchQuery.trim() !== '' && (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          style={styles.list}
          ListEmptyComponent={!isSearching ? <EmptySearchResults /> : null}
        />
      )}

      {/* Main Content */}
      {searchQuery.trim() === '' && (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {/* Pending Requests Section */}
              {pendingRequests.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Pending Requests</Text>
                  <FlatList
                    data={pendingRequests}
                    renderItem={renderPendingRequest}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Group Chats Section */}
              {groupConversations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Group Chats</Text>
                  <FlatList
                    data={groupConversations}
                    renderItem={renderGroupChat}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Friends Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Friends</Text>
                <FlatList
                  data={friendsWithActivity}
                  renderItem={renderFriend}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ListEmptyComponent={!isFriendsLoading ? <EmptyFriendsList /> : null}
                />
              </View>
            </>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          style={styles.list}
        />
      )}

      {/* Loading Indicator */}
      {(isLoading || isFriendsLoading) && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}

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

      {renderGroupChatModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1a1a2e',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0d0d1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  searchContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#333333',
  },
  searchSpinner: {
    position: 'absolute',
    right: 32,
  },
  list: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333333',
  },
  cardWithActivity: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  cardContent: {
    flex: 1,
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  username: {
    fontSize: 14,
    color: '#6366f1',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  lastMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  activityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 50,
    justifyContent: 'center',
  },
  activityText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  addButton: {
    color: '#6366f1',
    fontWeight: '600',
    marginLeft: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    marginLeft: 16,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#6366f1',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  avatar: {
    marginRight: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  groupNameInput: {
    backgroundColor: '#0d0d1a',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#0d0d1a',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  selectedFriendItem: {
    backgroundColor: '#1e1e38',
    borderColor: '#6366f1',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  friendUsername: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  checkmark: {
    fontSize: 20,
    color: '#6366f1',
    marginLeft: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  selectedCount: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  createButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonDisabled: {
    backgroundColor: '#374151',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 