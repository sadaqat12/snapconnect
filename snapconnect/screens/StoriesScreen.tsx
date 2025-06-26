import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StoryData, StoryService } from '../lib/storyService';
import StoryViewer from '../components/StoryViewer';
import { supabase } from '../lib/supabase';

export default function StoriesScreen() {
  const [myStories, setMyStories] = useState<StoryData[]>([]);
  const [friendStories, setFriendStories] = useState<StoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStories, setSelectedStories] = useState<StoryData[]>([]);
  const [initialStoryIndex, setInitialStoryIndex] = useState(0);
  const [isStoryViewerVisible, setIsStoryViewerVisible] = useState(false);
  
  const realtimeChannel = useRef<any>(null);

  useEffect(() => {
    loadStories();
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
        () => loadStories()
      )
      .subscribe();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStories();
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

  const handleAddStoryPress = () => {
    // Navigate to camera to create story
    Alert.alert(
      '📸 Create Story',
      'Go to Camera tab to take a photo or video for your story!',
      [{ text: 'OK' }]
    );
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesRow}>
                {/* Add Story Button */}
                <Pressable style={styles.addStoryCard} onPress={handleAddStoryPress}>
                  <View style={styles.addStoryContent}>
                    <Text style={styles.addStoryIcon}>➕</Text>
                    <Text style={styles.addStoryText}>Add Story</Text>
                  </View>
                </Pressable>

                {/* My Stories */}
                {myStories.map((story, index) => {
                  const thumbnailUrl = getStoryThumbnail(story);
                  return (
                    <Pressable 
                      key={story.id} 
                      style={styles.myStoryCard}
                      onPress={() => handleMyStoryPress(story, index)}
                    >
                      {thumbnailUrl ? (
                        <Image source={{ uri: thumbnailUrl }} style={styles.storyThumbnailImage} />
                      ) : (
                        <View style={styles.storyThumbnailPlaceholder}>
                          <Text style={styles.storyThumbnailEmoji}>📸</Text>
                        </View>
                      )}
                      <View style={styles.storyStats}>
                        <Text style={styles.viewCount}>👀 {story.view_count || 0}</Text>
                        <Text style={styles.timestamp}>{formatTimeAgo(story.created_at)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
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
                  return (
                    <Pressable 
                      key={story.id} 
                      style={styles.friendStoryCard}
                      onPress={() => handleFriendStoryPress(story, index)}
                    >
                      <View style={[styles.storyRing, !story.is_viewed && styles.unviewedRing]}>
                        {thumbnailUrl ? (
                          <Image source={{ uri: thumbnailUrl }} style={styles.friendStoryThumbnailImage} />
                        ) : (
                          <Text style={styles.friendStoryThumbnail}>📸</Text>
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
          </>
        )}

        {/* Story Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Story Insights</Text>
          <View style={styles.insightsCard}>
            <View style={styles.insightRow}>
              <Text style={styles.insightIcon}>📊</Text>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Total Views Today</Text>
                <Text style={styles.insightValue}>20 views</Text>
              </View>
            </View>
            <View style={styles.insightRow}>
              <Text style={styles.insightIcon}>🔥</Text>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Most Popular Story</Text>
                <Text style={styles.insightValue}>Mountain Adventure (12 views)</Text>
              </View>
            </View>
            <View style={styles.insightRow}>
              <Text style={styles.insightIcon}>⏰</Text>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Stories Expire In</Text>
                <Text style={styles.insightValue}>6 hours</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Pressable style={styles.actionButton} onPress={handleAddStoryPress}>
            <Text style={styles.actionIcon}>📱</Text>
            <Text style={styles.actionText}>Create Story from Camera Roll</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleAddStoryPress}>
            <Text style={styles.actionIcon}>🎥</Text>
            <Text style={styles.actionText}>Record Video Story</Text>
          </Pressable>
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
  addStoryCard: {
    width: 100,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStoryContent: {
    alignItems: 'center',
  },
  addStoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  addStoryText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionText: {
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
}); 