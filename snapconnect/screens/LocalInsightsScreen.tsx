import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

interface LocationInsight {
  id: string;
  name: string;
  category: string;
  description: string;
  distance: string;
  rating: number;
  insider_tip?: string;
  photo_worthy: boolean;
}

export default function LocalInsightsScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [insights, setInsights] = useState<LocationInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [locationName, setLocationName] = useState<string>('');

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is needed for local insights');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      // Reverse geocode to get location name
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      
      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const locationString = `${address.city || address.subregion}, ${address.region}`;
        setLocationName(locationString);
      }

      loadLocalInsights(currentLocation);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your location');
    }
  };

  const loadLocalInsights = async (userLocation: Location.LocationObject) => {
    setIsLoadingInsights(true);
    try {
      console.log('Loading local insights for location:', userLocation.coords);
      
      // Call the RAG-powered local-insights Edge Function
      const { data, error } = await supabase.functions.invoke('local-insights-rag', {
        body: {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
          locationName: locationName,
        },
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw error;
      }

      if (data.success && data.insights) {
        console.log('Received insights:', data.insights);
        setInsights(data.insights);
      } else {
        console.error('Invalid response from Edge Function:', data);
        throw new Error(data.error || 'Invalid response from server');
      }
    } catch (error) {
      console.error('Error loading insights:', error);
      
      // Fallback to mock data if Edge Function fails
      const fallbackInsights: LocationInsight[] = [
        {
          id: 'fallback-1',
          name: 'Local Coffee Shop',
          category: 'cafe',
          description: 'Great place to grab coffee and work',
          distance: '0.3 miles',
          rating: 4.5,
          insider_tip: 'Try their specialty drinks',
          photo_worthy: true,
        },
        {
          id: 'fallback-2',
          name: 'Nearby Park',
          category: 'nature',
          description: 'Perfect for a peaceful walk',
          distance: '0.5 miles',
          rating: 4.6,
          photo_worthy: true,
        },
        {
          id: 'fallback-3',
          name: 'Local Restaurant',
          category: 'restaurant',
          description: 'Popular spot with great reviews',
          distance: '0.4 miles',
          rating: 4.7,
          photo_worthy: false,
        },
        {
          id: 'fallback-4',
          name: 'Shopping Area',
          category: 'shopping',
          description: 'Browse local shops and boutiques',
          distance: '0.6 miles',
          rating: 4.4,
          photo_worthy: false,
        },
      ];
      
      setInsights(fallbackInsights);
      Alert.alert('Notice', 'Using offline recommendations. Check your internet connection for AI-powered insights.');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cafe': return '☕';
      case 'viewpoint': return '🌅';
      case 'art': return '🎨';
      case 'food': return '🍽️';
      case 'restaurant': return '🍜';
      case 'attraction': return '🏛️';
      case 'nature': return '🌳';
      case 'shopping': return '🛍️';
      default: return '📍';
    }
  };

  const renderInsightCard = (insight: LocationInsight) => (
    <Pressable key={insight.id} style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Text style={styles.categoryIcon}>{getCategoryIcon(insight.category)}</Text>
        <View style={styles.insightInfo}>
          <Text style={styles.insightName}>{insight.name}</Text>
          <Text style={styles.insightDescription}>{insight.description}</Text>
        </View>
        <View style={styles.insightMeta}>
          <Text style={styles.distance}>{insight.distance}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.ratingText}>{insight.rating}</Text>
          </View>
        </View>
      </View>
      
      {insight.insider_tip && (
        <View style={styles.insiderTip}>
          <Ionicons name="bulb" size={14} color="#6366f1" />
          <Text style={styles.tipText}>{insight.insider_tip}</Text>
        </View>
      )}
      
      {insight.photo_worthy && (
        <View style={styles.photoWorthy}>
          <Ionicons name="camera" size={14} color="#10B981" />
          <Text style={styles.photoWorthyText}>Photo-worthy spot</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isLoadingInsights}
          onRefresh={getCurrentLocation}
          tintColor="#6366f1"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Local Insights</Text>
        <Text style={styles.subtitle}>
          {locationName ? `Near ${locationName}` : 'Discover hidden gems nearby'}
        </Text>
      </View>

      {/* Refresh Button */}
      <View style={styles.actionContainer}>
        <Pressable onPress={getCurrentLocation} style={styles.refreshButton}>
          <Ionicons name="refresh" size={18} color="#6366f1" />
          <Text style={styles.refreshText}>Update Location</Text>
        </Pressable>
      </View>

      {/* Insights Section */}
      <View style={styles.section}>
        {isLoadingInsights ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Finding local gems...</Text>
          </View>
        ) : (
          <View style={styles.insightsContainer}>
            {insights.length > 0 ? (
              insights.map(renderInsightCard)
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color="#6B7280" />
                <Text style={styles.emptyTitle}>No insights found</Text>
                <Text style={styles.emptyText}>
                  We couldn't find local recommendations for your area. Try refreshing your location.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Help Section */}
      <View style={styles.helpContainer}>
        <View style={styles.helpCard}>
          <Ionicons name="information-circle" size={20} color="#6366f1" />
          <Text style={styles.helpText}>
            Our AI analyzes your location to surface hidden gems, local favorites, and photo-worthy spots that most tourists miss.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  refreshText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  insightInfo: {
    flex: 1,
  },
  insightName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  insightMeta: {
    alignItems: 'flex-end',
  },
  distance: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  insiderTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 6,
  },
  tipText: {
    fontSize: 12,
    color: '#6366f1',
    flex: 1,
  },
  photoWorthy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoWorthyText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  helpContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#6366f1',
    lineHeight: 20,
  },
}); 