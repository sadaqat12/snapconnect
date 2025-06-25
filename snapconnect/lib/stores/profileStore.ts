import { create } from 'zustand';
import { supabase } from '../supabase';

export type Profile = {
  id: string;
  email: string;
  username: string;
  name: string | null;
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
})); 