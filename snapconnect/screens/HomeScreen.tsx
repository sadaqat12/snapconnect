import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>SnapConnect</Text>
          <Text style={styles.subtitle}>Your travel story starts here</Text>
        </View>
        
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="rocket" size={24} color="#6366f1" />
            <Text style={styles.cardTitle}>Coming Soon</Text>
          </View>
          <Text style={styles.cardContent}>
            Camera & Ephemeral Snaps{'\n'}
            Stories & Social Features{'\n'}
            AI Travel Recommendations{'\n'}
            Location-based Content{'\n'}
            Itinerary Snapshots
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  subtitle: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#6366f1',
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 8,
  },
  cardContent: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 28,
  },
}); 