import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  screen: string;
  status: 'active' | 'coming-soon';
}

const features: FeatureCard[] = [
  {
    id: 'local-insights',
    title: 'Local Insights',
    description: 'Discover hidden gems and local favorites near you',
    icon: 'location',
    color: '#10B981',
    screen: 'LocalInsights',
    status: 'active',
  },
  {
    id: 'travel-advisor',
    title: 'Travel Advisor',
    description: 'Get expert advice on flights, hotels, and travel hacks',
    icon: 'chatbubbles',
    color: '#6366f1',
    screen: 'TravelAdvisor',
    status: 'active',
  },
  {
    id: 'culture-cuisine',
    title: 'Culture & Cuisine Coach',
    description: 'Learn local customs, etiquette, and must-try dishes',
    icon: 'restaurant',
    color: '#F59E0B',
    screen: 'CultureCuisine',
    status: 'active',
  },
  {
    id: 'itinerary-snapshot',
    title: 'Itinerary Snapshot',
    description: 'Transform your travel plans into shareable visuals',
    icon: 'map',
    color: '#EF4444',
    screen: 'ItinerarySnapshot',
    status: 'active',
  },
];

export default function DiscoverScreen() {
  const navigation = useNavigation();

  const handleFeaturePress = (feature: FeatureCard) => {
    // Navigate to feature screen
    navigation.navigate(feature.screen as never);
  };

  const renderFeatureCard = (feature: FeatureCard) => (
    <Pressable
      key={feature.id}
      style={styles.featureCard}
      onPress={() => handleFeaturePress(feature)}
    >
      <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
        <Ionicons name={feature.icon} size={32} color={feature.color} />
      </View>
      
              <View style={styles.featureContent}>
          <View style={styles.featureHeader}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
          </View>
          <Text style={styles.featureDescription}>{feature.description}</Text>
        </View>
      
              <View style={styles.featureArrow}>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color="#9CA3AF" 
          />
        </View>
    </Pressable>
  );

  return (
    <ScrollView style={styles.container}>
             {/* Header */}
       <View style={styles.header}>
         <Text style={styles.title}>Discover</Text>
         <Text style={styles.subtitle}>Your AI-powered travel companion</Text>
       </View>

       {/* Info Section */}
       <View style={styles.infoContainer}>
         <View style={styles.infoCard}>
           <Ionicons name="information-circle" size={20} color="#6366f1" />
           <Text style={styles.infoText}>
             AI-powered features for personalized travel insights.
           </Text>
         </View>
       </View>

       {/* Features Grid */}
      <View style={styles.featuresContainer}>
        <Text style={styles.sectionTitle}>AI Travel Features</Text>
        <View style={styles.featuresGrid}>
          {features.map(renderFeatureCard)}
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
    paddingTop: 50,
    paddingBottom: 12,
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
  featuresContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  featuresGrid: {
    gap: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  featureCardDisabled: {
    opacity: 0.6,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  comingSoonBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  featureDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  featureArrow: {
    marginLeft: 12,
  },
  infoContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6366f1',
    lineHeight: 20,
  },
}); 