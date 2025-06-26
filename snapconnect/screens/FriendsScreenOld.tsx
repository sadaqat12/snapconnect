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
  Image,
  Pressable,
  Modal,
} from 'react-native';
import { useFriendsStore, Friend } from '../lib/stores/friendsStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SnapService, SnapData } from '../lib/snapService';
import SnapViewer from '../components/SnapViewer';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

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
  <Text style={styles.emptyText}>No users found</Text>
);

const EmptyFriendsList = () => (
  <Text style={styles.emptyText}>
    No friends yet. Search above to add friends!
  </Text>
);

export default function FriendsScreen() {
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

  useEffect(() => {
    loadData();

    // Set up periodic cleanup of old snaps
    const cleanupInterval = setInterval(async () => {
      try {
        await SnapService.cleanupOldSnaps();
        // Only reload data if cleanup was successful
        await loadData();
      } catch (error) {
        console.error('Periodic cleanup error:', error);
      }
    }, 5 * 60 * 1000); // Run every 5 minutes

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

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
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Get received snaps
      const receivedSnaps = await SnapService.getReceivedSnaps();
      console.log('Received snaps:', receivedSnaps);
      
      // Get conversations
      const { data: conversations, error: convError } = await supabase
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
        .eq('type', 'direct')
        .order('last_message_at', { ascending: false });

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
          // Add unread snap only if current user hasn't read it
          if (!snap.read_by?.includes(user.id)) {
            friend.unreadSnaps.push(snap);
          }
          
          // Update last contact time
          const snapTime = new Date(snap.created_at || Date.now());
          if (!friend.lastContact || snapTime > friend.lastContact) {
            friend.lastContact = snapTime;
          }
        }
      });

      // Process conversations
      if (conversations) {
        for (const conv of conversations) {
          const otherParticipant = conv.participants.find((p: string) => p !== user.id);
          const friend = friendsMap.get(otherParticipant);
          
          if (friend) {
            // Get unread message count
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
                : `${lastMsg.sender.name || lastMsg.sender.username} sent a snap`;
              friend.lastMessageTime = new Date(lastMsg.created_at);
            }
          }
        }
      }

      // Convert map to array and sort by activity
      const sortedFriends = Array.from(friendsMap.values()).sort((a, b) => {
        // Sort by total unread activity (snaps + messages)
        const aActivity = a.unreadSnaps.length + a.unreadMessages;
        const bActivity = b.unreadSnaps.length + b.unreadMessages;
        
        if (aActivity !== bActivity) {
          return bActivity - aActivity;
        }
        
        // Then by most recent activity
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

  const handleOpenSnap = (friend: FriendWithSnaps) => {
    if (friend.unreadSnaps.length > 0) {
      // Get the oldest unread snap
      const snap = friend.unreadSnaps[0];
      console.log('Opening snap:', {
        id: snap.id,
        mediaType: snap.media_type,
        mediaUrl: snap.media_url,
      });
      setSelectedSnap(snap);
      setIsSnapViewerVisible(true);
    }
  };

  const handleCloseSnap = () => {
    setIsSnapViewerVisible(false);
    setSelectedSnap(null);
  };

  const handleSnapViewed = async () => {
    // Update the local state to remove the viewed snap
    if (selectedSnap) {
      try {
        // Mark the snap as read in the database
        await SnapService.markSnapAsRead(selectedSnap.id!);
        
        // Update local state
        setFriendsWithSnaps(prev => 
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

        // Close the viewer
        handleCloseSnap();
      } catch (error: any) {
        // If the snap was already deleted, just update local state
        if (error.code === 'PGRST116') {
          setFriendsWithSnaps(prev => 
            prev.map(friend => ({
              ...friend,
              unreadSnaps: friend.unreadSnaps.filter(snap => snap.id !== selectedSnap.id),
            }))
          );
          handleCloseSnap();
        } else {
          console.error('Error marking snap as read:', error);
        }
      }
    }
  };

  const handleCleanupOldSnaps = async () => {
    try {
      setIsLoading(true);
      await SnapService.cleanupOldSnaps();
      await loadData(); // Refresh the list
      Alert.alert('Success', 'Old snaps have been cleaned up');
    } catch (error) {
      console.error('Error cleaning up snaps:', error);
      Alert.alert('Error', 'Failed to clean up old snaps');
    } finally {
      setIsLoading(false);
    }
  };

  const renderSearchResult = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSendRequest(item.email)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.name}>{item.name || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <Text style={styles.addButton}>Add Friend</Text>
    </TouchableOpacity>
  );

  const renderFriend = ({ item }: { item: FriendWithSnaps }) => (
    <TouchableOpacity
      style={[styles.card, item.unreadSnaps.length > 0 && styles.cardWithSnaps]}
      onPress={() => handleOpenSnap(item)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.name}>{item.name || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
        {item.lastContact && (
          <Text style={styles.lastContact}>
            Last contact: {item.lastContact.toLocaleDateString()}
          </Text>
        )}
      </View>
      {item.unreadSnaps.length > 0 && (
        <View style={styles.snapIndicator}>
          <Text style={styles.snapCount}>{item.unreadSnaps.length}</Text>
          <Text style={styles.snapIcon}>📸</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderPendingRequest = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
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
        <TouchableOpacity
          style={styles.cleanupButton}
          onPress={handleCleanupOldSnaps}
          disabled={isLoading}
        >
          <Text style={styles.cleanupButtonText}>🧹</Text>
        </TouchableOpacity>
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

              {/* Friends Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Friends</Text>
                <FlatList
                  data={friendsWithSnaps}
                  renderItem={renderFriend}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ListEmptyComponent={!isLoading ? <EmptyFriendsList /> : null}
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
          onClose={handleCloseSnap}
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
  },
  cardContent: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWithSnaps: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  snapIndicator: {
    backgroundColor: '#6366f1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapCount: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 4,
  },
  snapIcon: {
    fontSize: 16,
  },
  lastContact: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cleanupButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  cleanupButtonText: {
    fontSize: 20,
  },
}); 