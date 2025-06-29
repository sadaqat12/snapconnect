import { create } from 'zustand';
import { supabase } from '../supabase';
import { Alert } from 'react-native';

export type Friend = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  status: 'pending' | 'accepted' | 'blocked' | 'none';
};

type DatabaseUser = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
};

type FriendshipResponse = {
  id: string;
  friend_id: string;
  user_id: string;
  friend: DatabaseUser;
  user: DatabaseUser;
  status: 'pending' | 'accepted' | 'blocked';
};

type RequestResponse = {
  id: string;
  user: DatabaseUser;
};

interface FriendsState {
  friends: Friend[];
  pendingRequests: Friend[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  sendFriendRequest: (email: string) => Promise<void>;
  acceptFriendRequest: (friendId: string) => Promise<void>;
  rejectFriendRequest: (friendId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Friend[]>;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  isLoading: false,
  error: null,

  fetchFriends: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      console.log('Fetching friends for user:', userId);

      // Get accepted friendships where the user is either the sender or receiver
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select(`
          id,
          friend_id,
          user_id,
          friend:friend_id(id, email, username, name, avatar_url),
          user:user_id(id, email, username, name, avatar_url),
          status
        `)
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (error) {
        console.error('Error fetching friends:', error);
        throw error;
      }

      console.log('Fetched friendships:', friendships);

      // Transform the data to our Friend type
              const friends = (friendships as unknown as FriendshipResponse[]).map(friendship => {
        const friend = friendship.user_id === userId
          ? friendship.friend
          : friendship.user;
        return {
          id: friend.id,
          email: friend.email,
          username: friend.username,
          name: friend.name,
          avatar_url: friend.avatar_url,
          status: friendship.status,
        };
      });

      console.log('Processed friends:', friends);
      set({ friends, isLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch friends:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  fetchPendingRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      console.log('Fetching pending requests for user:', userId);

      // Get pending friend requests sent to the current user
      const { data: requests, error } = await supabase
        .from('friendships')
        .select(`
          id,
          user:user_id(id, email, username, name, avatar_url)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending requests:', error);
        throw error;
      }

      console.log('Pending requests:', requests);

      const pendingRequests = (requests as unknown as RequestResponse[]).map(request => ({
        id: request.user.id,
        email: request.user.email,
        username: request.user.username,
        name: request.user.name,
        avatar_url: request.user.avatar_url,
        status: 'pending' as const,
      }));

      set({ pendingRequests, isLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch pending requests:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  sendFriendRequest: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      console.log('Sending friend request:', { userId, email });

      // First find the user by email
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('id, email, username, name')
        .eq('email', email)
        .single();

      if (userError) {
        console.error('Error finding user:', userError);
        throw new Error('User not found');
      }
      if (!targetUser) throw new Error('User not found');

      console.log('Found target user:', targetUser);

      // Check if trying to add yourself
      if (targetUser.id === userId) {
        throw new Error('Cannot send friend request to yourself');
      }

      // Check if friendship already exists (in either direction)
      const { data: existing, error: checkError } = await supabase
        .from('friendships')
        .select('id, status, user_id, friend_id')
        .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`);

      if (checkError) {
        console.error('Error checking existing friendship:', checkError);
        throw checkError;
      }

      console.log('Existing friendships:', existing);

      if (existing && existing.length > 0) {
        const friendship = existing[0];
        if (friendship.status === 'accepted') {
          throw new Error('You are already friends with this user');
        } else if (friendship.status === 'pending') {
          if (friendship.user_id === userId) {
            throw new Error('Friend request already sent');
          } else {
            throw new Error('This user has already sent you a friend request');
          }
        }
      }

      // Send friend request
      const { data: newFriendship, error: insertError } = await supabase
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: targetUser.id,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting friendship:', insertError);
        throw insertError;
      }

      console.log('Friend request sent successfully:', newFriendship);

      set({ isLoading: false });
      // Refresh both friends and pending requests
      await Promise.all([
        get().fetchFriends(),
        get().fetchPendingRequests()
      ]);
    } catch (error: any) {
      console.error('Failed to send friend request:', error);
      set({ error: error.message, isLoading: false });
      throw error; // Re-throw so the UI can handle it
    }
  },

  acceptFriendRequest: async (friendId: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      console.log('Accepting friend request:', {
        friendId,
        userId
      });

      // First verify the request exists
      const { data: request, error: checkError } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'pending')
        .single();

      if (checkError) {
        console.error('Error checking friend request:', checkError);
        throw new Error('Friend request not found');
      }

      if (!request) {
        throw new Error('Friend request not found');
      }

      console.log('Found friend request to accept:', request);

      // Update the friendship status
      const { data: updatedFriendship, error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', request.id)
        .select()
        .single();

      if (error) {
        console.error('Error accepting friend request:', error);
        throw error;
      }

      console.log('Friend request accepted successfully:', updatedFriendship);

      // Refresh friends and pending requests
      await Promise.all([
        get().fetchFriends(),
        get().fetchPendingRequests()
      ]);

      // Show success message
      Alert.alert('Success', 'Friend request accepted!');
      set({ isLoading: false });
    } catch (error: any) {
      console.error('Failed to accept friend request:', error);
      set({ error: error.message, isLoading: false });
      Alert.alert('Error', error.message);
    }
  },

  rejectFriendRequest: async (friendId: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (error) throw error;

      set({ isLoading: false });
      await get().fetchPendingRequests();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  searchUsers: async (query: string) => {
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      if (!query.trim()) return [];

      // Sanitize the search query
      const searchTerm = query.trim().toLowerCase();

      // Log the search attempt
      console.log('Starting user search:', {
        searchTerm,
        currentUserId: userId
      });

      // Get existing friendships to determine relationship status
      const { data: existingFriendships, error: friendshipError } = await supabase
        .from('friendships')
        .select('friend_id, user_id, status')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (friendshipError) {
        console.error('Error fetching friendships:', friendshipError);
      }

      // Create a map of user IDs to their relationship status
      const relationshipMap = new Map<string, 'accepted' | 'pending-sent' | 'pending-received'>();
      if (existingFriendships) {
        existingFriendships.forEach(friendship => {
          const otherUserId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;
          
          if (friendship.status === 'accepted') {
            relationshipMap.set(otherUserId, 'accepted');
          } else if (friendship.status === 'pending') {
            // Determine if we sent the request or received it
            if (friendship.user_id === userId) {
              relationshipMap.set(otherUserId, 'pending-sent'); // We sent the request
            } else {
              relationshipMap.set(otherUserId, 'pending-received'); // We received the request
            }
          }
        });
      }

      console.log('User relationship map:', Object.fromEntries(relationshipMap));

      // Helper function to format results with correct status
      const formatResults = (users: DatabaseUser[]) => {
        return users.map(user => {
          const relationship = relationshipMap.get(user.id);
          let status: 'pending' | 'accepted' | 'blocked' | 'none';
          
          console.log(`Formatting user ${user.username} (${user.id}) with relationship:`, relationship);
          
          if (!relationship) {
            // No relationship exists - show "Add Friend"
            status = 'none';
            console.log(`User ${user.username} has no relationship - setting status to 'none' (will show Add Friend)`);
          } else {
            switch (relationship) {
              case 'accepted':
                status = 'accepted';
                break;
              case 'pending-sent':
                status = 'pending'; // We sent a request, show "Pending"
                break;
              case 'pending-received':
                status = 'blocked'; // They sent us a request, show "Accept Request"
                break;
              default:
                status = 'none'; // Fallback to "Add Friend"
            }
          }

          console.log(`Final status for ${user.username}:`, status);

          return {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            avatar_url: user.avatar_url,
            status
          };
        });
      };

      // First try an exact match
      const { data: exactMatches, error: exactError } = await supabase
        .from('users')
        .select('id, email, username, name, avatar_url')
        .eq('username', searchTerm)
        .neq('id', userId)
        .limit(10); // Get more results to account for filtering

      if (exactError) {
        console.error('Exact match search error:', exactError);
      } else if (exactMatches && exactMatches.length > 0) {
        const filteredResults = formatResults(exactMatches as DatabaseUser[]);
        console.log('Found exact matches:', filteredResults);
        return filteredResults.slice(0, 5); // Limit to 5 results
      }

      // If no exact matches, try partial matches
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, username, name, avatar_url')
        .or(
          `username.ilike.${searchTerm}%,` +
          `username.ilike.%${searchTerm}%,` +
          `email.ilike.${searchTerm}%,` +
          `name.ilike.%${searchTerm}%`
        )
        .neq('id', userId)
        .limit(10); // Get more results to account for filtering

      if (error) {
        console.error('Partial match search error:', error);
        throw error;
      }

      if (users && users.length > 0) {
        const filteredResults = formatResults(users as DatabaseUser[]);
        console.log('Found partial matches:', filteredResults);
        return filteredResults.slice(0, 5); // Limit to 5 results
      }

      // Try one more time with a very loose match
      const { data: looseMatches, error: looseError } = await supabase
        .from('users')
        .select('id, email, username, name, avatar_url')
        .or(
          `username.ilike.%${searchTerm}%,` +
          `email.ilike.%${searchTerm}%,` +
          `name.ilike.%${searchTerm}%`
        )
        .neq('id', userId)
        .limit(10); // Get more results to account for filtering

      if (looseError) {
        console.error('Loose match search error:', looseError);
      } else if (looseMatches && looseMatches.length > 0) {
        const filteredResults = formatResults(looseMatches as DatabaseUser[]);
        console.log('Found loose matches:', filteredResults);
        return filteredResults.slice(0, 5); // Limit to 5 results
      }

      console.log('No users found for query after filtering:', searchTerm);
      return [];
    } catch (error: any) {
      console.error('Search failed:', error);
      set({ error: error.message });
      return [];
    }
  }
})); 