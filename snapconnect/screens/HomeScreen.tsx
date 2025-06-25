import React from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>✈️ SnapConnect</Text>
          <Text style={styles.title}>Welcome Explorer!</Text>
          <Text style={styles.subtitle}>
            Ready to capture and share your adventures with AI-powered insights
          </Text>
        </View>

        <View style={styles.cardContainer}>
          <View style={styles.featureCard}>
            <Text style={styles.cardTitle}>🎯 Coming Soon</Text>
            <Text style={styles.cardContent}>
              📷  Camera & Ephemeral Snaps{'\n'}
              🤖  AI Travel Insights{'\n'}
              📚  Stories & Social Features{'\n'}
              📍  Location-based Recommendations{'\n'}
              🌟  Travel Caption Generator{'\n'}
              🗺️  Itinerary Snapshots
            </Text>
          </View>

          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Your Journey</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Snaps</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Stories</Text>
              </View>
            </View>
          </View>

          <Pressable onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  featureCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitle: {
    color: '#6366f1',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  cardContent: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 28,
  },
  statsCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statsTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#6366f1',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  signOutText: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16,
  },
}); 