import { create } from 'zustand';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabase';

export type Profile = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  travel_style_tags: string[] | null;
  preferences: Record<string, any> | null;
};

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  updateAvatar: (avatarUri: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      set({ profile, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      set({ profile, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateUsername: async (newUsername: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      // Validate username format
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(newUsername)) {
        throw new Error('Username must be 3-30 characters long and can only contain letters, numbers, and underscores');
      }

      // Check if username is taken
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', newUsername)
        .neq('id', userId)
        .single();

      if (existing) {
        throw new Error('Username is already taken');
      }

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // Update username
      const { data: profile, error } = await supabase
        .from('users')
        .update({ username: newUsername })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      set({ profile, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateAvatar: async (avatarUri: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      // Create unique filename
      const fileExt = avatarUri.split('.').pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

      // Create FormData for React Native file upload
      const formData = new FormData();
      
      // Add the file to FormData using the proper React Native format
      formData.append('file', {
        uri: avatarUri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      // Use fetch to upload directly to Supabase Storage REST API
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('Not authenticated');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Supabase URL not configured');

      const response = await fetch(`${supabaseUrl}/storage/v1/object/media/${fileName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      // Update user profile with new avatar URL
      const { data: profile, error } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      set({ profile, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
})); 