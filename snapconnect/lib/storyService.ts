import { supabase } from './supabase';
import { SnapData } from './snapService';

export interface StoryData {
  id?: string;
  creator_id: string;
  snap_ids: string[];
  viewers?: string[];
  created_at?: string;
  expires_at?: string;
  creator?: {
    id: string;
    username: string;
    name: string | null;
  };
  snaps?: SnapData[];
  view_count?: number;
  is_viewed?: boolean;
}

export class StoryService {
  /**
   * Create a new story from snap IDs
   */
  static async createStory(snapIds: string[]): Promise<StoryData> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      if (!snapIds.length) throw new Error('At least one snap is required for a story');

      console.log('Creating story for user:', user.id, 'with snaps:', snapIds);

      const storyData = {
        creator_id: user.id,
        snap_ids: snapIds,
        viewers: [],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      console.log('Story data to insert:', storyData);

      const { data, error } = await supabase
        .from('stories')
        .insert([storyData])
        .select()
        .single();

      if (error) {
        console.error('Database error creating story:', error);
        throw error;
      }

      // Get creator data separately
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('id, username, name')
        .eq('id', user.id)
        .single();

      if (userDataError) {
        console.warn('Could not fetch creator data:', userDataError);
      }

      const enrichedData = {
        ...data,
        creator: userData || { id: user.id, username: '', name: '' }
      };

      console.log('Successfully created story:', enrichedData);
      return enrichedData as StoryData;
    } catch (error) {
      console.error('Create story error:', error);
      throw new Error(`Failed to create story: ${error}`);
    }
  }

  /**
   * Add snap to existing story (if recent) or create new story
   */
  static async addSnapToStory(snapId: string): Promise<StoryData> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Check if user has a recent story (within last 24 hours) that we can add to
      const { data: recentStories, error: fetchError } = await supabase
        .from('stories')
        .select('*')
        .eq('creator_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (recentStories && recentStories.length > 0) {
        // Add to existing story
        const existingStory = recentStories[0];
        const updatedSnapIds = [...existingStory.snap_ids, snapId];

        console.log('Updating existing story:', {
          storyId: existingStory.id,
          currentSnapIds: existingStory.snap_ids,
          newSnapId: snapId,
          updatedSnapIds
        });

        // First update the story
        const { data: updateData, error: updateError } = await supabase
          .from('stories')
          .update({ snap_ids: updatedSnapIds })
          .eq('id', existingStory.id)
          .select();

        console.log('Update result:', { updateData, updateError });

        if (updateError) {
          console.error('Error updating story:', updateError);
          throw updateError;
        }

        if (!updateData || updateData.length === 0) {
          console.error('Story update returned no data - story may not exist or no permission');
          throw new Error('Failed to update story - no rows affected');
        }

        // Then fetch the updated story
        const { data, error: fetchError } = await supabase
          .from('stories')
          .select()
          .eq('id', existingStory.id)
          .single();

        if (fetchError) {
          console.error('Error fetching updated story:', fetchError);
          throw fetchError;
        }

        // Get creator data separately
        const { data: userData, error: userFetchError } = await supabase
          .from('users')
          .select('id, username, name')
          .eq('id', data.creator_id)
          .single();

        if (userFetchError) {
          console.warn('Could not fetch creator data:', userFetchError);
        }

        const enrichedData = {
          ...data,
          creator: userData || { id: data.creator_id, username: '', name: '' }
        };

        console.log('Successfully updated story:', enrichedData);
        return enrichedData as StoryData;
      } else {
        // Create new story
        console.log('No recent stories found, creating new story for snap:', snapId);
        return await StoryService.createStory([snapId]);
      }
    } catch (error) {
      console.error('Add snap to story error:', error);
      throw new Error(`Failed to add snap to story: ${error}`);
    }
  }

  /**
   * Get user's own stories
   */
  static async getUserStories(userId?: string): Promise<StoryData[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const targetUserId = userId || user.id;

      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          creator:creator_id(id, username, name)
        `)
        .eq('creator_id', targetUserId)
        .gte('expires_at', new Date().toISOString()) // Only non-expired stories
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with snap data and view counts
      const enrichedStories = await Promise.all(
        (data as StoryData[]).map(async (story) => {
          try {
            // Get snap data for the story
            const { data: snapsData, error: snapsError } = await supabase
              .from('snaps')
              .select('*')
              .in('id', story.snap_ids)
              .order('created_at', { ascending: true });

            if (snapsError) {
              console.warn('Error fetching snaps for story:', snapsError);
            }

            return {
              ...story,
              snaps: snapsData as SnapData[] || [],
              view_count: story.viewers?.length || 0,
              is_viewed: story.viewers?.includes(user.id) || false,
            };
          } catch (error) {
            console.warn('Error enriching story:', error);
            return {
              ...story,
              snaps: [],
              view_count: story.viewers?.length || 0,
              is_viewed: story.viewers?.includes(user.id) || false,
            };
          }
        })
      );

      return enrichedStories;
    } catch (error) {
      console.error('Get user stories error:', error);
      throw error;
    }
  }

  /**
   * Get stories from friends
   */
  static async getFriendsStories(): Promise<StoryData[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      console.log('Getting friends stories for user:', user.id);

      // Get accepted friends
      const { data: friendships, error: friendsError } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendsError) throw friendsError;

      console.log('Raw friendships data:', friendships);

      // Extract friend IDs
      const friendIds = friendships?.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      ) || [];

      console.log('Friend IDs:', friendIds);

      if (friendIds.length === 0) {
        console.log('No friends found');
        return [];
      }

      // Get stories from friends (without the problematic join)
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .in('creator_id', friendIds)
        .gte('expires_at', new Date().toISOString()) // Only non-expired stories
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Raw friend stories data:', data);

      // Enrich with creator data and snap data
      const enrichedStories = await Promise.all(
        (data as StoryData[]).map(async (story) => {
          try {
            // Get creator data
            const { data: creatorData, error: creatorError } = await supabase
              .from('users')
              .select('id, username, name')
              .eq('id', story.creator_id)
              .single();

            if (creatorError) {
              console.warn('Error fetching creator for story:', creatorError);
            }

            // Get snap data for the story
            const { data: snapsData, error: snapsError } = await supabase
              .from('snaps')
              .select('*')
              .in('id', story.snap_ids)
              .order('created_at', { ascending: true });

            if (snapsError) {
              console.warn('Error fetching snaps for story:', snapsError);
            }

            console.log(`Story ${story.id} - snaps:`, snapsData?.length || 0);

            const isViewed = story.viewers?.includes(user.id) || false;
            
            console.log(`Story ${story.id} enrichment:`, {
              storyId: story.id,
              creator: creatorData?.username,
              viewers: story.viewers,
              currentUserId: user.id,
              isViewed
            });

            return {
              ...story,
              creator: creatorData || { id: story.creator_id, username: '', name: '' },
              snaps: snapsData as SnapData[] || [],
              view_count: story.viewers?.length || 0,
              is_viewed: isViewed,
            };
          } catch (error) {
            console.warn('Error enriching friend story:', error);
            return {
              ...story,
              creator: { id: story.creator_id, username: '', name: '' },
              snaps: [],
              view_count: story.viewers?.length || 0,
              is_viewed: story.viewers?.includes(user.id) || false,
            };
          }
        })
      );

      console.log('Enriched friend stories:', enrichedStories.map(s => ({
        id: s.id,
        creator: s.creator?.username,
        snapCount: s.snaps?.length || 0,
        snapIds: s.snap_ids
      })));

      return enrichedStories;
    } catch (error) {
      console.error('Get friends stories error:', error);
      throw error;
    }
  }

  /**
   * Get story by ID with full data
   */
  static async getStoryById(storyId: string): Promise<StoryData> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          creator:creator_id(id, username, name)
        `)
        .eq('id', storyId)
        .single();

      if (error) throw error;

      // Get snap data for the story
      const { data: snapsData, error: snapsError } = await supabase
        .from('snaps')
        .select('*')
        .in('id', data.snap_ids)
        .order('created_at', { ascending: true });

      if (snapsError) {
        console.warn('Error fetching snaps for story:', snapsError);
      }

      return {
        ...data as StoryData,
        snaps: snapsData as SnapData[] || [],
        view_count: data.viewers?.length || 0,
        is_viewed: data.viewers?.includes(user.id) || false,
      };
    } catch (error) {
      console.error('Get story by ID error:', error);
      throw new Error(`Failed to get story: ${error}`);
    }
  }

  /**
   * Mark story as viewed by current user
   */
  static async markStoryAsViewed(storyId: string): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      console.log(`Marking story ${storyId} as viewed by user ${user.id}`);

      // Get current story
      const { data: story, error: fetchError } = await supabase
        .from('stories')
        .select('viewers')
        .eq('id', storyId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          console.log(`Story ${storyId} not found or expired`);
          return;
        }
        throw fetchError;
      }

      console.log(`Current viewers for story ${storyId}:`, story.viewers);

      // Add user to viewers array if not already there
      const viewers = story.viewers || [];
      if (!viewers.includes(user.id)) {
        viewers.push(user.id);

        console.log(`Adding user ${user.id} to viewers. New viewers:`, viewers);

        const { error: updateError } = await supabase
          .from('stories')
          .update({ viewers })
          .eq('id', storyId);

        if (updateError) {
          console.error('Error updating story viewers:', updateError);
          throw updateError;
        }

        console.log(`Successfully marked story ${storyId} as viewed`);
      } else {
        console.log(`User ${user.id} already viewed story ${storyId}`);
      }
    } catch (error) {
      console.error('Mark story as viewed error:', error);
      throw error;
    }
  }

  /**
   * Delete story (and associated snaps if they're only in this story)
   */
  static async deleteStory(storyId: string): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Get story details first
      const { data: story, error: fetchError } = await supabase
        .from('stories')
        .select('creator_id, snap_ids')
        .eq('id', storyId)
        .single();

      if (fetchError) throw fetchError;

      // Check if user is the creator
      if (story.creator_id !== user.id) {
        throw new Error('Not authorized to delete this story');
      }

      // Delete story record
      const { error: deleteError } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

      if (deleteError) throw deleteError;

      console.log(`Story ${storyId} deleted successfully`);
    } catch (error) {
      console.error('Delete story error:', error);
      throw error;
    }
  }

  /**
   * Clean up expired stories
   */
  static async cleanupExpiredStories(): Promise<void> {
    try {
      const { data: expiredStories, error } = await supabase
        .from('stories')
        .select('id')
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      if (expiredStories && expiredStories.length > 0) {
        const { error: deleteError } = await supabase
          .from('stories')
          .delete()
          .lt('expires_at', new Date().toISOString());

        if (deleteError) throw deleteError;

        console.log(`Cleaned up ${expiredStories.length} expired stories`);
      }
    } catch (error) {
      console.error('Error cleaning up expired stories:', error);
      throw error;
    }
  }
} 