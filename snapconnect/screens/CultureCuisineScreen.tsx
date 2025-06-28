import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CultureTip {
  id: string;
  category: 'etiquette' | 'customs' | 'language' | 'dining';
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

interface CuisineDish {
  id: string;
  name: string;
  description: string;
  category: 'main' | 'appetizer' | 'dessert' | 'drink';
  spiceLevel: number;
  mustTry: boolean;
  price: string;
}

export default function CultureCuisineScreen() {
  const [activeTab, setActiveTab] = useState<'culture' | 'cuisine'>('culture');

  // Mock data - in real implementation, this would come from AI/RAG system
  const cultureTips: CultureTip[] = [
    {
      id: '1',
      category: 'etiquette',
      title: 'Greeting Customs',
      description: 'Always greet with a firm handshake and maintain eye contact. Remove your hat when entering buildings.',
      importance: 'high',
    },
    {
      id: '2',
      category: 'dining',
      title: 'Dining Etiquette',
      description: 'Wait for the host to begin eating. Keep your hands visible on the table and avoid pointing with utensils.',
      importance: 'high',
    },
    {
      id: '3',
      category: 'customs',
      title: 'Tipping Culture',
      description: '15-20% is standard at restaurants. Tip taxi drivers 10-15% and hotel staff $1-2 per service.',
      importance: 'medium',
    },
    {
      id: '4',
      category: 'language',
      title: 'Useful Phrases',
      description: 'Learn "Please", "Thank you", "Excuse me", and "Do you speak English?" in the local language.',
      importance: 'medium',
    },
  ];

  const cuisineDishes: CuisineDish[] = [
    {
      id: '1',
      name: 'Signature Local Pasta',
      description: 'Traditional handmade pasta with local herbs and cheese, served with seasonal vegetables',
      category: 'main',
      spiceLevel: 2,
      mustTry: true,
      price: '$18-24',
    },
    {
      id: '2',
      name: 'Regional Street Food',
      description: 'Popular local street snack with unique spices and fresh ingredients',
      category: 'appetizer',
      spiceLevel: 4,
      mustTry: true,
      price: '$5-8',
    },
    {
      id: '3',
      name: 'Traditional Dessert',
      description: 'Sweet local dessert made with honey, nuts, and seasonal fruits',
      category: 'dessert',
      spiceLevel: 0,
      mustTry: false,
      price: '$6-10',
    },
    {
      id: '4',
      name: 'Local Specialty Drink',
      description: 'Refreshing traditional beverage perfect for the local climate',
      category: 'drink',
      spiceLevel: 1,
      mustTry: true,
      price: '$4-7',
    },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'etiquette': return '🤝';
      case 'customs': return '🏛️';
      case 'language': return '💬';
      case 'dining': return '🍽️';
      case 'main': return '🍝';
      case 'appetizer': return '🥗';
      case 'dessert': return '🍰';
      case 'drink': return '🥤';
      default: return '📍';
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const renderSpiceLevel = (level: number) => {
    return (
      <View style={styles.spiceContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons
            key={i}
            name="flame"
            size={12}
            color={i <= level ? '#EF4444' : '#374151'}
          />
        ))}
      </View>
    );
  };

  const renderCultureTip = (tip: CultureTip) => (
    <View key={tip.id} style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <Text style={styles.categoryIcon}>{getCategoryIcon(tip.category)}</Text>
        <View style={styles.tipInfo}>
          <Text style={styles.tipTitle}>{tip.title}</Text>
          <Text style={styles.tipCategory}>{tip.category}</Text>
        </View>
        <View style={[styles.importanceBadge, { backgroundColor: getImportanceColor(tip.importance) + '20' }]}>
          <Text style={[styles.importanceText, { color: getImportanceColor(tip.importance) }]}>
            {tip.importance}
          </Text>
        </View>
      </View>
      <Text style={styles.tipDescription}>{tip.description}</Text>
    </View>
  );

  const renderCuisineDish = (dish: CuisineDish) => (
    <View key={dish.id} style={styles.dishCard}>
      <View style={styles.dishHeader}>
        <Text style={styles.categoryIcon}>{getCategoryIcon(dish.category)}</Text>
        <View style={styles.dishInfo}>
          <View style={styles.dishTitleRow}>
            <Text style={styles.dishName}>{dish.name}</Text>
            {dish.mustTry && (
              <View style={styles.mustTryBadge}>
                <Text style={styles.mustTryText}>Must Try</Text>
              </View>
            )}
          </View>
          <Text style={styles.dishCategory}>{dish.category}</Text>
        </View>
        <Text style={styles.dishPrice}>{dish.price}</Text>
      </View>
      
      <Text style={styles.dishDescription}>{dish.description}</Text>
      
      <View style={styles.dishMeta}>
        <View style={styles.spiceLevelContainer}>
          <Text style={styles.spiceLabel}>Spice Level:</Text>
          {renderSpiceLevel(dish.spiceLevel)}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Culture & Cuisine Coach</Text>
        <Text style={styles.subtitle}>Learn local customs and discover authentic flavors</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'culture' && styles.activeTab]}
          onPress={() => setActiveTab('culture')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'culture' ? '#6366f1' : '#9CA3AF'} 
          />
          <Text style={[styles.tabText, activeTab === 'culture' && styles.activeTabText]}>
            Culture
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'cuisine' && styles.activeTab]}
          onPress={() => setActiveTab('cuisine')}
        >
          <Ionicons 
            name="restaurant" 
            size={20} 
            color={activeTab === 'cuisine' ? '#6366f1' : '#9CA3AF'} 
          />
          <Text style={[styles.tabText, activeTab === 'cuisine' && styles.activeTabText]}>
            Cuisine
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'culture' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cultural Tips & Etiquette</Text>
            <View style={styles.tipsContainer}>
              {cultureTips.map(renderCultureTip)}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Must-Try Local Dishes</Text>
            <View style={styles.dishesContainer}>
              {cuisineDishes.map(renderCuisineDish)}
            </View>
          </View>
        )}

        {/* Coming Soon Notice */}
        <View style={styles.comingSoonContainer}>
          <View style={styles.comingSoonCard}>
            <Ionicons name="construct" size={32} color="#F59E0B" />
            <Text style={styles.comingSoonTitle}>Feature Coming Soon!</Text>
            <Text style={styles.comingSoonText}>
              This feature will use AI to analyze your location and photos to provide personalized cultural insights and food recommendations.
            </Text>
          </View>
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#6366f1',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  tipsContainer: {
    gap: 12,
  },
  tipCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  tipInfo: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  tipCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  importanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  importanceText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tipDescription: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
  },
  dishesContainer: {
    gap: 12,
  },
  dishCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  dishHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dishInfo: {
    flex: 1,
  },
  dishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dishName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  mustTryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mustTryText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  dishCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  dishPrice: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
  dishDescription: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
    marginBottom: 12,
  },
  dishMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spiceLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spiceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  spiceContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  comingSoonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  comingSoonCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginTop: 12,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#F59E0B',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 