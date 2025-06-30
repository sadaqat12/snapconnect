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
        // Remove explicit timestamps - let database handle them automatically
        // created_at: defaults to now() in UTC
        // expires_at: automatically calculated as (created_at + 24 hours)
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

      console.log('🔄 Adding snap to story:', { snapId, userId: user.id });

      // Check if user has a recent story (within last 24 hours) that we can add to
      const { data: recentStories, error: fetchError } = await supabase
        .from('stories')
        .select('*')
        .eq('creator_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('❌ Error fetching recent stories:', fetchError);
        throw fetchError;
      }

      console.log('📖 Recent stories found:', recentStories?.length || 0);

      if (recentStories && recentStories.length > 0) {
        // Add to existing story
        const existingStory = recentStories[0];
        const updatedSnapIds = [...existingStory.snap_ids, snapId];

        console.log('➕ Updating existing story:', {
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

        console.log('🔄 Update result:', { updateData, updateError });

        if (updateError) {
          console.error('❌ Error updating story:', updateError);
          throw updateError;
        }

        if (!updateData || updateData.length === 0) {
          console.error('❌ Story update returned no data - story may not exist or no permission');
          throw new Error('Failed to update story - no rows affected');
        }

        // Then fetch the updated story with creator data
        const { data: finalStory, error: fetchError } = await supabase
          .from('stories')
          .select(`
            *,
            creator:creator_id(id, username, name)
          `)
          .eq('id', existingStory.id)
          .single();

        if (fetchError) {
          console.error('❌ Error fetching updated story:', fetchError);
          throw fetchError;
        }

        console.log('✅ Successfully updated existing story:', finalStory.id);
        return finalStory as StoryData;
      } else {
        // Create new story
        console.log('📚 Creating new story for user:', user.id);
        
        const newStoryData = {
          creator_id: user.id,
          snap_ids: [snapId],
          // Remove explicit timestamps - let database handle them automatically
          // created_at: defaults to now() in UTC
          // expires_at: automatically calculated as (created_at + 24 hours)
        };

        // Create story with database-managed timestamps
        console.log('📚 Creating story with snap:', snapId);

        const { data: newStory, error: createError } = await supabase
          .from('stories')
          .insert(newStoryData)
          .select(`
            *,
            creator:users(id, name, username, avatar_url)
          `)
          .single();

        if (createError) {
          console.error('❌ Error creating story:', createError);
          throw createError;
        }

        // Manually fetch snaps for the new story
        const { data: snapsData, error: snapsError } = await supabase
          .from('snaps')
          .select('*')
          .in('id', newStory.snap_ids)
          .order('created_at', { ascending: true });

        if (snapsError) {
          console.warn('Error fetching snaps for new story:', snapsError);
        }

        const enrichedStory = {
          ...newStory,
          snaps: snapsData || [],
        };

        console.log('✅ New story created:', enrichedStory);
        return enrichedStory;
      }
    } catch (error: any) {
      console.error('❌ Add snap to story error:', error);
      throw new Error(`Failed to add snap to story: ${error?.message || error}`);
    }
  }

  /**
   * Get all stories visible to the current user (friends + own)
   */
  static async getUserStories(): Promise<StoryData[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return [];

      console.log('🔍 Fetching stories for user:', user.id);

      // Get stories from friends and own stories
      const { data: stories, error } = await supabase
        .from('stories')
        .select(`
          *,
          creator:users(id, name, username, avatar_url)
        `)
        .gte('expires_at', new Date().toISOString()) // Only non-expired stories
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching stories:', error);
        return [];
      }

      console.log('📚 Fetched stories from database:', stories?.length || 0);

      // Manually enrich stories with snap data since we can't use automatic joins
      if (stories && stories.length > 0) {
        const enrichedStories = await Promise.all(
          stories.map(async (story) => {
            try {
              // Get snap data for this story
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
                snaps: snapsData || [],
                view_count: story.viewers?.length || 0, // Add consistent view count
              };
            } catch (error) {
              console.warn('Error enriching story:', error);
              return {
                ...story,
                snaps: [],
                view_count: story.viewers?.length || 0, // Add consistent view count
              };
            }
          })
        );

        return enrichedStories;
      }

      return stories || [];
    } catch (error) {
      console.error('❌ Error in getUserStories:', error);
      return [];
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
      // Add a small delay to ensure any recent database updates are reflected
      await new Promise(resolve => setTimeout(resolve, 100));
      
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

            // Use the new function to check if story is fully viewed
            const { data: isViewedResult, error: viewedError } = await supabase
              .rpc('is_story_fully_viewed', {
                story_id_param: story.id,
                user_id_param: user.id
              });

            const isViewed = viewedError ? (story.viewers?.includes(user.id) || false) : (isViewedResult || false);
            
            console.log(`Story ${story.id} enrichment:`, {
              storyId: story.id,
              creator: creatorData?.username,
              viewers: story.viewers,
              viewersCount: story.viewers?.length || 0,
              currentUserId: user.id,
              isViewed,
              isViewedFromFunction: isViewedResult,
              viewedError: viewedError?.message,
              viewersArray: JSON.stringify(story.viewers)
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
            // Fallback to legacy logic if there's an error
            const isViewed = story.viewers?.includes(user.id) || false;
            
            return {
              ...story,
              creator: { id: story.creator_id, username: '', name: '' },
              snaps: [],
              view_count: story.viewers?.length || 0,
              is_viewed: isViewed,
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

      // Use the new function to check if story is fully viewed
      const { data: isViewedResult, error: viewedError } = await supabase
        .rpc('is_story_fully_viewed', {
          story_id_param: data.id,
          user_id_param: user.id
        });

      const isViewed = viewedError ? (data.viewers?.includes(user.id) || false) : (isViewedResult || false);

      return {
        ...data as StoryData,
        snaps: snapsData as SnapData[] || [],
        view_count: data.viewers?.length || 0,
        is_viewed: isViewed,
      };
    } catch (error) {
      console.error('Get story by ID error:', error);
      throw new Error(`Failed to get story: ${error}`);
    }
  }

  /**
   * Mark story as viewed by current user - Simple logic!
   */
  static async markStoryAsViewed(storyId: string): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      console.log(`Marking story ${storyId} as viewed by user ${user.id}`);

      // Get current story viewers
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

      // Simple logic: check if user is already in viewers array
      const currentViewers = story.viewers || [];
      if (!currentViewers.includes(user.id)) {
        // Add user to viewers array
        const newViewers = [...currentViewers, user.id];
        
        // Update with PostgreSQL UUID casting
        const { error: updateError } = await supabase
          .from('stories')
          .update({ 
            viewers: newViewers
          })
          .eq('id', storyId);

        if (updateError) {
          console.error('Error updating viewers:', updateError);
          // Don't throw - just log so story viewing continues
        } else {
          console.log(`✅ Added user ${user.id} to story ${storyId} viewers`);
        }
      } else {
        console.log(`User ${user.id} already viewed story ${storyId}`);
      }
    } catch (error) {
      console.error('Mark story as viewed error:', error);
      // Don't throw - just log so story viewing continues
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