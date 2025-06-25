import { create } from 'zustand';
import { supabase } from '../supabase';
import { Alert } from 'react-native';

export type Friend = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  status: 'pending' | 'accepted' | 'blocked';
};

type DatabaseUser = {
  id: string;
  email: string;
  username: string;
  name: string | null;
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
          friend:friend_id(id, email, username, name),
          user:user_id(id, email, username, name),
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
          user:user_id(id, email, username, name)
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

      // First find the user by email
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('email', email)
        .single();

      if (userError) throw userError;
      if (!users) throw new Error('User not found');

      // Check if friendship already exists
      const { data: existing, error: checkError } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${userId},friend_id.eq.${users.id}),and(user_id.eq.${users.id},friend_id.eq.${userId})`)
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      if (existing) throw new Error('Friendship already exists');

      // Send friend request
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: users.id,
          status: 'pending'
        });

      if (insertError) throw insertError;

      set({ isLoading: false });
      await get().fetchPendingRequests();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
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

      // First try an exact match
      const { data: exactMatches, error: exactError } = await supabase
        .from('users')
        .select('id, email, username, name')
        .eq('username', searchTerm)
        .neq('id', userId)
        .limit(5);

      if (exactError) {
        console.error('Exact match search error:', exactError);
      } else if (exactMatches && exactMatches.length > 0) {
        console.log('Found exact matches:', exactMatches);
        return (exactMatches as DatabaseUser[]).map(user => ({
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          status: 'pending' as const
        }));
      }

      // If no exact matches, try partial matches
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, username, name')
        .or(
          `username.ilike.${searchTerm}%,` +
          `username.ilike.%${searchTerm}%,` +
          `email.ilike.${searchTerm}%,` +
          `name.ilike.%${searchTerm}%`
        )
        .neq('id', userId)
        .limit(5);

      if (error) {
        console.error('Partial match search error:', error);
        throw error;
      }

      console.log('Search results:', {
        query: searchTerm,
        resultsCount: users?.length || 0,
        results: users
      });

      if (!users || users.length === 0) {
        // Try one more time with a very loose match
        const { data: looseMatches, error: looseError } = await supabase
          .from('users')
          .select('id, email, username, name')
          .or(
            `username.ilike.%${searchTerm}%,` +
            `email.ilike.%${searchTerm}%,` +
            `name.ilike.%${searchTerm}%`
          )
          .neq('id', userId)
          .limit(5);

        if (looseError) {
          console.error('Loose match search error:', looseError);
        } else if (looseMatches && looseMatches.length > 0) {
          console.log('Found loose matches:', looseMatches);
          return (looseMatches as DatabaseUser[]).map(user => ({
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            status: 'pending' as const
          }));
        }

        console.log('No users found for query:', searchTerm);
        return [];
      }

      return (users as DatabaseUser[]).map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        status: 'pending' as const
      }));
    } catch (error: any) {
      console.error('Search failed:', error);
      set({ error: error.message });
      return [];
    }
  }
})); 