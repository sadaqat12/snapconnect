import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';

export default function StoriesScreen() {
  // Mock data - will be replaced with real data later
  const myStories = [
    { id: '1', thumbnail: '🏔️', views: 12, timestamp: '2h ago' },
    { id: '2', thumbnail: '🍜', views: 8, timestamp: '5h ago' },
  ];

  const friendStories = [
    { id: '3', name: 'Sarah', avatar: '👩‍🦰', thumbnail: '🌴', timestamp: '1h ago', viewed: false },
    { id: '4', name: 'Mike', avatar: '👨‍💻', thumbnail: '🍕', timestamp: '3h ago', viewed: true },
    { id: '5', name: 'Emma', avatar: '👩‍🎨', thumbnail: '🎨', timestamp: '4h ago', viewed: false },
    { id: '6', name: 'Alex', avatar: '👨‍🚀', thumbnail: '🚀', timestamp: '6h ago', viewed: true },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories</Text>
        <Text style={styles.subtitle}>Share your 24-hour adventures</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* My Stories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Stories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesRow}>
            {/* Add Story Button */}
            <Pressable style={styles.addStoryCard}>
              <View style={styles.addStoryContent}>
                <Text style={styles.addStoryIcon}>➕</Text>
                <Text style={styles.addStoryText}>Add Story</Text>
              </View>
            </Pressable>

            {/* My Stories */}
            {myStories.map((story) => (
              <Pressable key={story.id} style={styles.myStoryCard}>
                <Text style={styles.storyThumbnail}>{story.thumbnail}</Text>
                <View style={styles.storyStats}>
                  <Text style={styles.viewCount}>👀 {story.views}</Text>
                  <Text style={styles.timestamp}>{story.timestamp}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Friends Stories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friends' Adventures</Text>
          <View style={styles.friendStoriesGrid}>
            {friendStories.map((story) => (
              <Pressable key={story.id} style={styles.friendStoryCard}>
                <View style={[styles.storyRing, !story.viewed && styles.unviewedRing]}>
                  <Text style={styles.friendStoryThumbnail}>{story.thumbnail}</Text>
                </View>
                <View style={styles.friendStoryInfo}>
                  <View style={styles.friendHeader}>
                    <Text style={styles.friendAvatar}>{story.avatar}</Text>
                    <View style={styles.friendDetails}>
                      <Text style={styles.friendName}>{story.name}</Text>
                      <Text style={styles.friendTimestamp}>{story.timestamp}</Text>
                    </View>
                  </View>
                  {!story.viewed && <View style={styles.newIndicator} />}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

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
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionIcon}>📱</Text>
            <Text style={styles.actionText}>Create Story from Camera Roll</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionIcon}>🎥</Text>
            <Text style={styles.actionText}>Record Video Story</Text>
          </Pressable>
        </View>
      </ScrollView>
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
}); 