import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StoryData, StoryService } from '../lib/storyService';
import StoryViewer from '../components/StoryViewer';
import StorySnippetGenerator from '../components/StorySnippetGenerator';
import { supabase } from '../lib/supabase';

interface FlashbackSnap {
  id: string;
  media_url: string;
  created_at: string;
  location?: string;
  caption?: string;
  years_ago: number;
}

export default function StoriesScreen() {
  const [myStories, setMyStories] = useState<StoryData[]>([]);
  const [friendStories, setFriendStories] = useState<StoryData[]>([]);
  const [flashbackSnaps, setFlashbackSnaps] = useState<FlashbackSnap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStories, setSelectedStories] = useState<StoryData[]>([]);
  const [initialStoryIndex, setInitialStoryIndex] = useState(0);
  const [isStoryViewerVisible, setIsStoryViewerVisible] = useState(false);
  
  // Story Snippet Generator state
  const [isSnippetGeneratorVisible, setIsSnippetGeneratorVisible] = useState(false);
  const [selectedStoryForSnippet, setSelectedStoryForSnippet] = useState<StoryData | null>(null);
  
  // Analytics state
  const [storyInsights, setStoryInsights] = useState({
    totalViewsToday: 0,
    mostPopularStory: { name: 'No stories', views: 0 },
    nextExpiryHours: 0,
    isLoading: true
  });
  
  const realtimeChannel = useRef<any>(null);

  useEffect(() => {
    loadStories();
    loadFlashbackSnaps();
    setupRealtimeSubscription();
    
    // Cleanup old stories periodically
    const cleanupInterval = setInterval(async () => {
      try {
        await StoryService.cleanupExpiredStories();
        await loadStories(); // Refresh after cleanup
      } catch (error) {
        console.error('Story cleanup error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(cleanupInterval);
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
      }
    };
  }, []);

  // Refresh stories when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadStories();
      loadFlashbackSnaps();
    }, [])
  );

  const setupRealtimeSubscription = () => {
    realtimeChannel.current = supabase
      .channel('stories_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories',
        },
        (payload) => {
          console.log('Stories table change detected:', payload);
          loadStories();
        }
      )
      .subscribe((status) => {
        console.log('Stories realtime subscription status:', status);
      });
  };

  const loadStories = async () => {
    try {
      setIsLoading(true);
      
      // Load user's own stories and friends' stories in parallel
      const [userStoriesResult, friendStoriesResult] = await Promise.allSettled([
        StoryService.getUserStories(),
        StoryService.getFriendsStories(),
      ]);

      if (userStoriesResult.status === 'fulfilled') {
        console.log('Loaded user stories:', userStoriesResult.value.length);
        setMyStories(userStoriesResult.value);
        // Calculate insights after loading stories
        calculateStoryInsights(userStoriesResult.value);
      } else {
        console.error('Error loading user stories:', userStoriesResult.reason);
      }

      if (friendStoriesResult.status === 'fulfilled') {
        console.log('Loaded friend stories:', friendStoriesResult.value.length);
        console.log('Friend stories data:', friendStoriesResult.value.map(s => ({
          id: s.id,
          creator: s.creator?.username,
          snapCount: s.snaps?.length || 0,
          isViewed: s.is_viewed,
          viewers: s.viewers
        })));
        setFriendStories(friendStoriesResult.value);
      } else {
        console.error('Error loading friend stories:', friendStoriesResult.reason);
      }
    } catch (error) {
      console.error('Error loading stories:', error);
      Alert.alert('Error', 'Failed to load stories. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStoryInsights = (stories: StoryData[]) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let totalViewsToday = 0;
      let mostPopularStory = { name: 'No stories', views: 0 };
      let nextExpiryHours = 24;

      stories.forEach(story => {
        // Count views for stories created today
        if (story.created_at) {
          const storyDate = new Date(story.created_at);
          if (storyDate >= todayStart) {
            const viewCount = story.viewers?.length || 0;
            totalViewsToday += viewCount;
            
            // Track most popular story
            if (viewCount > mostPopularStory.views) {
              mostPopularStory = {
                name: story.id ? `Story ${story.id.substring(0, 8)}` : 'Popular Story',
                views: viewCount
              };
            }
          }

          // Calculate time until next expiry
          const expiryTime = new Date(story.created_at);
          expiryTime.setHours(expiryTime.getHours() + 24);
          const hoursUntilExpiry = Math.max(0, Math.ceil((expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60)));
          
          if (hoursUntilExpiry < nextExpiryHours && hoursUntilExpiry > 0) {
            nextExpiryHours = hoursUntilExpiry;
          }
        }
      });

      // If no stories expire soon, show 24 hours
      if (stories.length === 0) {
        nextExpiryHours = 0;
      }

      setStoryInsights({
        totalViewsToday,
        mostPopularStory,
        nextExpiryHours,
        isLoading: false
      });
    } catch (error) {
      console.error('Error calculating story insights:', error);
      setStoryInsights(prev => ({ ...prev, isLoading: false }));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStories(), loadFlashbackSnaps()]);
  };

  const handleMyStoryPress = (story: StoryData, index: number) => {
    setSelectedStories(myStories);
    setInitialStoryIndex(index);
    setIsStoryViewerVisible(true);
  };

  const handleFriendStoryPress = (story: StoryData, index: number) => {
    console.log('Friend story pressed:', {
      storyId: story.id,
      creator: story.creator?.username,
      snapCount: story.snaps?.length || 0,
      snapIds: story.snap_ids,
      snaps: story.snaps?.map(s => ({ id: s.id, media_url: s.media_url })),
      index
    });

    // Check if story has snaps
    if (!story.snaps || story.snaps.length === 0) {
      console.log('Story has no snaps - snap_ids:', story.snap_ids);
      Alert.alert('Story Empty', `This story has no content to view.\nStory ID: ${story.id}\nSnap IDs: ${story.snap_ids?.join(', ') || 'none'}`);
      return;
    }

    setSelectedStories(friendStories);
    setInitialStoryIndex(index);
    setIsStoryViewerVisible(true);
  };

  const loadFlashbackSnaps = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11
      const currentDay = today.getDate();

      // Query for snaps from the same month/day in previous years
      const { data: snaps, error } = await supabase
        .from('snaps')
        .select('id, media_url, created_at, location, caption')
        .eq('creator_id', user.id)
        .gte('created_at', new Date(today.getFullYear() - 5, 0, 1).toISOString()) // Last 5 years
        .lt('created_at', new Date(today.getFullYear(), 0, 1).toISOString()) // Before this year
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading flashback snaps:', error);
        return;
      }

      let flashbacks: FlashbackSnap[] = [];

      if (snaps) {
        // Filter snaps to same month/day and calculate years ago
        flashbacks = snaps
          .filter(snap => {
            const snapDate = new Date(snap.created_at);
            return snapDate.getMonth() + 1 === currentMonth && snapDate.getDate() === currentDay;
          })
          .map(snap => {
            const snapDate = new Date(snap.created_at);
            const yearsAgo = today.getFullYear() - snapDate.getFullYear();
            return {
              ...snap,
              years_ago: yearsAgo
            };
          })
          .slice(0, 5); // Limit to 5 flashbacks
      }

      // If no real flashbacks, add sample data for demonstration
      if (flashbacks.length === 0) {
        flashbacks = generateSampleFlashbacks(today);
      }

      console.log('Loaded flashback snaps:', flashbacks.length);
      setFlashbackSnaps(flashbacks);
    } catch (error) {
      console.error('Error loading flashback snaps:', error);
    }
  };

  const generateSampleFlashbacks = (today: Date): FlashbackSnap[] => {
    const sampleImages = [
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=600&fit=crop',
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=600&fit=crop'
    ];

    const sampleLocations = [
      'Santorini, Greece',
      'Banff National Park, Canada', 
      'Tropical Beach Paradise',
      'Mountain Lake Retreat',
      'European Countryside'
    ];

    const sampleCaptions = [
      'Chasing sunsets and dreams ✨',
      'Nature therapy at its finest 🏔️',
      'Paradise found 🏝️',
      'Peaceful moments by the lake',
      'Wandering through cobblestone streets'
    ];

    return Array.from({ length: 3 }, (_, index) => {
      const yearsAgo = index + 1;
      const flashbackDate = new Date(today.getFullYear() - yearsAgo, today.getMonth(), today.getDate());
      
      return {
        id: `sample-${index}`,
        media_url: sampleImages[index],
        created_at: flashbackDate.toISOString(),
        location: sampleLocations[index],
        caption: sampleCaptions[index],
        years_ago: yearsAgo
      };
    });
  };

  const handleFlashbackPress = async (snap: FlashbackSnap) => {
    try {
      // Get current user for proper attribution
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'current-user';
      
      // Convert flashback snap to StoryData format for StoryViewer
      const flashbackStory: StoryData = {
        id: `flashback-${snap.id}`,
        creator_id: userId,
        snap_ids: [snap.id],
        created_at: snap.created_at,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        view_count: 0,
        viewers: [],
        is_viewed: true, // Mark as viewed since it's a flashback
        snaps: [{
          id: snap.id,
          creator_id: userId,
          recipient_ids: [],
          media_url: snap.media_url,
          media_type: 'photo',
          created_at: snap.created_at,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          location: snap.location ? {
            lat: 0,
            lng: 0,
            address: snap.location
          } : undefined,
          caption: `🕰️ ${snap.years_ago} year${snap.years_ago !== 1 ? 's' : ''} ago${snap.location ? ` • ${snap.location}` : ''}\n\n${snap.caption || 'Travel Memory'}`
        }],
        creator: {
          id: userId,
          username: 'You',
          name: 'You'
        }
      };

      // Create a special flashback stories array
      const flashbackStories = [flashbackStory];
      
      // Set up the story viewer for flashback
      setSelectedStories(flashbackStories);
      setInitialStoryIndex(0);
      setIsStoryViewerVisible(true);
    } catch (error) {
      console.error('Error opening flashback:', error);
      // Fallback to alert if StoryViewer fails
      const isSample = snap.id.startsWith('sample-');
      Alert.alert(
        '🕰️ Travel Memory',
        isSample 
          ? `✨ Sample Memory\nFrom ${snap.years_ago} year${snap.years_ago !== 1 ? 's' : ''} ago at ${snap.location}!\n\n${snap.caption}\n\n💡 This is demo data. Start creating travel stories to build your own flashback timeline!`
          : `From ${snap.years_ago} year${snap.years_ago !== 1 ? 's' : ''} ago${snap.location ? ` at ${snap.location}` : ''}!\n\n${snap.caption || 'What a great memory!'}`
      );
    }
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    
    return `${diffHours}h ago`;
  };

  const getStoryThumbnail = (story: StoryData) => {
    const firstSnap = story.snaps?.[0];
    if (firstSnap?.media_url) {
      return firstSnap.media_url;
    }
    return null;
  };

  // Story Snippet Generator handlers
  const handleGenerateSnippet = (story: StoryData) => {
    setSelectedStoryForSnippet(story);
    setIsSnippetGeneratorVisible(true);
  };

  const handleCloseSnippetGenerator = () => {
    setIsSnippetGeneratorVisible(false);
    setSelectedStoryForSnippet(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories</Text>
        <Text style={styles.subtitle}>Share your 24-hour adventures</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#6366f1']}
          />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading stories...</Text>
          </View>
        ) : (
          <>
            {/* My Stories Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Stories</Text>
              {myStories.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No stories yet. Go to Camera tab to create your first story!
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesRow}>
                  {/* My Stories */}
                  {myStories.map((story, index) => {
                    const thumbnailUrl = getStoryThumbnail(story);
                    return (
                      <View key={story.id} style={styles.myStoryContainer}>
                        <Pressable 
                          style={styles.myStoryCard}
                          onPress={() => handleMyStoryPress(story, index)}
                        >
                          {thumbnailUrl ? (
                            <Image source={{ uri: thumbnailUrl }} style={styles.storyThumbnailImage} />
                          ) : (
                            <View style={styles.storyThumbnailPlaceholder}>
                              <Ionicons name="camera" size={24} color="#9CA3AF" />
                            </View>
                          )}
                          <View style={styles.storyStats}>
                            <Text style={styles.viewCount}>👀 {story.view_count || 0}</Text>
                            <Text style={styles.timestamp}>{formatTimeAgo(story.created_at)}</Text>
                          </View>
                        </Pressable>
                        
                        {/* Generate Travel Blog Button */}
                        <Pressable 
                          style={styles.snippetButton}
                          onPress={() => handleGenerateSnippet(story)}
                        >
                          <Ionicons name="create-outline" size={16} color="#6366f1" />
                          <Text style={styles.snippetButtonText}>Blog</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Friends Stories Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Friends' Adventures</Text>
              {friendStories.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No friend stories yet. Add some friends who post stories!
                  </Text>
                </View>
              ) : (
                <View style={styles.friendStoriesGrid}>
                  {friendStories.map((story, index) => {
                  const thumbnailUrl = getStoryThumbnail(story);
                  
                  // Debug logging for viewed state
                  console.log(`Story UI Debug - ${story.creator?.username}: viewed=${story.is_viewed}, viewers=${story.viewers?.length || 0}`);
                  
                  return (
                    <Pressable 
                      key={story.id} 
                      style={styles.friendStoryCard}
                      onPress={() => handleFriendStoryPress(story, index)}
                    >
                      <View style={[
                        styles.storyRing, 
                        !story.is_viewed && styles.unviewedRing,
                        story.is_viewed && styles.viewedRing
                      ]}>
                        {thumbnailUrl ? (
                          <Image 
                            source={{ uri: thumbnailUrl }} 
                            style={[
                              styles.friendStoryThumbnailImage,
                              story.is_viewed && styles.viewedThumbnail
                            ]} 
                          />
                        ) : (
                          <View style={styles.friendStoryThumbnailPlaceholder}>
                            <Ionicons name="camera" size={20} color="#9CA3AF" />
                          </View>
                        )}
                      </View>
                      <View style={styles.friendStoryInfo}>
                        <View style={styles.friendHeader}>
                          <View style={styles.friendAvatarContainer}>
                            <Text style={styles.friendAvatar}>
                              {story.creator?.name?.[0] || story.creator?.username?.[0] || '?'}
                            </Text>
                          </View>
                          <View style={styles.friendDetails}>
                            <Text style={styles.friendName}>
                              {story.creator?.name || story.creator?.username || 'Unknown'}
                            </Text>
                            <Text style={styles.friendTimestamp}>{formatTimeAgo(story.created_at)}</Text>
                          </View>
                        </View>
                        {!story.is_viewed && <View style={styles.newIndicator} />}
                      </View>
                    </Pressable>
                  );
                })}
                </View>
                            )}
            </View>

            {/* Flashback Explorer Section */}
            <View style={styles.section}>
              <View style={styles.flashbackHeader}>
                <Text style={styles.sectionTitle}>🕰️ Flashback Explorer</Text>
                <Text style={styles.flashbackSubtitle}>Travel memories from this day</Text>
              </View>
              {flashbackSnaps.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="time-outline" size={48} color="#6B7280" />
                  <Text style={styles.emptyText}>
                    No memories from this day in previous years
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Keep creating travel stories to build your memory timeline!
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesRow}>
                  {flashbackSnaps.map((snap, index) => (
                    <Pressable 
                      key={snap.id} 
                      style={styles.flashbackSnapCard}
                      onPress={() => handleFlashbackPress(snap)}
                    >
                      <Image source={{ uri: snap.media_url }} style={styles.flashbackSnapImage} />
                      <View style={styles.flashbackOverlay}>
                        <View style={styles.flashbackBadge}>
                          <Text style={styles.flashbackYears}>
                            {snap.years_ago}y ago
                          </Text>
                        </View>
                      </View>
                      <View style={styles.flashbackSnapInfo}>
                        <Text style={styles.flashbackSnapCaption} numberOfLines={1}>
                          {snap.caption || snap.location || 'Travel Memory'}
                        </Text>
                        <Text style={styles.flashbackSnapTimestamp}>
                          {new Date(snap.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </>
        )}

        {/* Story Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Story Insights</Text>
          <View style={styles.insightsCard}>
            <View style={styles.insightRow}>
              <View style={styles.insightIconContainer}>
                <Ionicons name="bar-chart" size={20} color="#6366f1" />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Total Views Today</Text>
                <Text style={styles.insightValue}>
                  {storyInsights.isLoading ? '...' : `${storyInsights.totalViewsToday} views`}
                </Text>
              </View>
            </View>
            <View style={styles.insightRow}>
              <View style={styles.insightIconContainer}>
                <Ionicons name="trending-up" size={20} color="#6366f1" />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Most Popular Story</Text>
                <Text style={styles.insightValue}>
                  {storyInsights.isLoading 
                    ? '...' 
                    : `${storyInsights.mostPopularStory.name} (${storyInsights.mostPopularStory.views} views)`
                  }
                </Text>
              </View>
            </View>
            <View style={styles.insightRow}>
              <View style={styles.insightIconContainer}>
                <Ionicons name="time" size={20} color="#6366f1" />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Stories Expire In</Text>
                <Text style={styles.insightValue}>
                  {storyInsights.isLoading 
                    ? '...' 
                    : storyInsights.nextExpiryHours === 0 
                      ? 'No active stories' 
                      : `${storyInsights.nextExpiryHours} hours`
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
      
      {/* Story Viewer */}
      <StoryViewer
        stories={selectedStories}
        initialStoryIndex={initialStoryIndex}
        isVisible={isStoryViewerVisible}
        onClose={() => {
          setIsStoryViewerVisible(false);
          // Add a small delay to ensure database update is propagated
          setTimeout(() => {
            console.log('Reloading stories after viewing...');
            loadStories();
          }, 500);
        }}
        onStoryViewed={(storyId) => {
          console.log('Story viewed callback triggered for:', storyId);
          // Immediately refresh stories when a story is viewed
          loadStories();
        }}
      />

      {/* Story Snippet Generator */}
      <StorySnippetGenerator
        visible={isSnippetGeneratorVisible}
        onClose={handleCloseSnippetGenerator}
        storyId={selectedStoryForSnippet?.id || ''}
        storyTitle={`Story from ${selectedStoryForSnippet?.created_at ? formatTimeAgo(selectedStoryForSnippet.created_at) : ''}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  storiesRow: {
    flexDirection: 'row',
  },

  myStoryCard: {
    width: 100,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
  },
  storyThumbnail: {
    flex: 1,
    fontSize: 40,
    textAlign: 'center',
    lineHeight: 80,
  },
  storyStats: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  viewCount: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  timestamp: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  friendStoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  friendStoryCard: {
    width: '48%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  storyRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  unviewedRing: {
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  viewedRing: {
    borderColor: '#4B5563',
    opacity: 0.7,
  },
  friendStoryThumbnail: {
    fontSize: 32,
  },
  friendStoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    fontSize: 16,
    marginRight: 8,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  friendTimestamp: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  newIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  insightsCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 4,
  },
  insightValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 16,
  },
  storyThumbnailImage: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
  },
  storyThumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  storyThumbnailEmoji: {
    fontSize: 32,
  },
  friendStoryThumbnailImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  viewedThumbnail: {
    opacity: 0.6,
  },
  friendAvatarContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
  },
  friendStoryThumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  insightIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flashbackHeader: {
    marginBottom: 16,
  },
  flashbackSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  flashbackSnapCard: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
    marginRight: 12,
    position: 'relative',
  },
  flashbackSnapImage: {
    flex: 1,
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  flashbackOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  flashbackBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  flashbackYears: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  flashbackSnapInfo: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  flashbackSnapCaption: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  flashbackSnapTimestamp: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  
  // Story Snippet Generator styles
  myStoryContainer: {
    flexDirection: 'column',
    marginRight: 12,
  },
  snippetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  snippetButtonText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

}); 