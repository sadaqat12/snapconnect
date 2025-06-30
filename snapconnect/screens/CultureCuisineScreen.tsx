import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  CultureCuisineService, 
  CultureTip, 
  CuisineDish, 
  CultureCuisineResponse 
} from '../lib/cultureCuisineService';

export default function CultureCuisineScreen() {
  const [activeTab, setActiveTab] = useState<'culture' | 'cuisine'>('culture');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [response, setResponse] = useState<CultureCuisineResponse | null>(null);
  // Load initial recommendations on mount
  useEffect(() => {
    if (!hasLoadedOnce) {
      loadRecommendations('both');
      setHasLoadedOnce(true);
    }
  }, [hasLoadedOnce]);

  const loadRecommendations = async (analysisType: 'culture' | 'cuisine' | 'both') => {
    setIsLoading(true);
    try {
      console.log('🎭 Loading recommendations for:', analysisType);
      const result = await CultureCuisineService.getCultureCuisineRecommendations({
        analysisType,
      });
      setResponse(result);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      Alert.alert('Error', 'Failed to load recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab: 'culture' | 'cuisine') => {
    setActiveTab(tab);
    if (response && response.analysisType !== 'both') {
      // If we don't have data for this tab, load it
      if ((tab === 'culture' && !response.cultureTips) || 
          (tab === 'cuisine' && !response.cuisineDishes)) {
        loadRecommendations(tab);
      }
    }
  };



  const handleRefresh = () => {
    loadRecommendations(activeTab === 'culture' ? 'culture' : activeTab === 'cuisine' ? 'cuisine' : 'both');
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'etiquette': return '🤝';
      case 'customs': return '🏛️';
      case 'language': return '💬';
      case 'dining': return '🍽️';
      case 'traditions': return '🎭';
      case 'main': return '🍝';
      case 'appetizer': return '🥗';
      case 'dessert': return '🍰';
      case 'drink': return '🥤';
      case 'snack': return '🍿';
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
      {tip.context && (
        <Text style={styles.tipContext}>📍 {tip.context}</Text>
      )}
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

      {dish.culturalSignificance && (
        <Text style={styles.culturalSignificance}>
          🏛️ Cultural Note: {dish.culturalSignificance}
        </Text>
      )}

      {dish.ingredients && dish.ingredients.length > 0 && (
        <Text style={styles.ingredients}>
          🥘 Key Ingredients: {dish.ingredients.join(', ')}
        </Text>
      )}

      {dish.allergens && dish.allergens.length > 0 && (
        <Text style={styles.allergens}>
          ⚠️ Contains: {dish.allergens.join(', ')}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Culture & Cuisine Coach</Text>
        <Text style={styles.subtitle}>
          {response?.location ? `Insights for ${response.location}` : 'Location-based cultural and culinary insights'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Pressable style={styles.actionButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="#6366f1" />
          <Text style={styles.actionButtonText}>Refresh Recommendations</Text>
        </Pressable>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'culture' && styles.activeTab]}
          onPress={() => handleTabChange('culture')}
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
          onPress={() => handleTabChange('cuisine')}
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

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Getting local insights...</Text>
          <Text style={styles.loadingSubtext}>
            AI is discovering local cultural tips and cuisine recommendations
          </Text>
        </View>
      )}

      {/* Content */}
      {!isLoading && response && (
        <ScrollView style={styles.content}>
          {/* AI Analysis Results */}
          {response.imageAnalysis && (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisSectionTitle}>🤖 AI Image Analysis</Text>
              <Text style={styles.analysisText}>{response.imageAnalysis}</Text>
            </View>
          )}

          {/* Personalized Recommendations */}
          {response.recommendations && (
            <View style={styles.recommendationsSection}>
              <Text style={styles.recommendationsSectionTitle}>💡 Personalized Recommendations</Text>
              <Text style={styles.recommendationsText}>{response.recommendations}</Text>
            </View>
          )}

          {/* Culture Tips */}
          {activeTab === 'culture' && response.cultureTips && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cultural Tips & Etiquette</Text>
              <View style={styles.tipsContainer}>
                {response.cultureTips.map(renderCultureTip)}
              </View>
            </View>
          )}

          {/* Cuisine Recommendations */}
          {activeTab === 'cuisine' && response.cuisineDishes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Must-Try Local Dishes</Text>
              <View style={styles.dishesContainer}>
                {response.cuisineDishes.map(renderCuisineDish)}
              </View>
            </View>
          )}

          {/* Error State */}
          {!response.success && response.error && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={32} color="#EF4444" />
              <Text style={styles.errorTitle}>Service Temporarily Unavailable</Text>
              <Text style={styles.errorText}>{response.error}</Text>
              <Pressable style={styles.retryButton} onPress={handleRefresh}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
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
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    gap: 8,
  },
  actionButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  analysisSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  analysisSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
  },
  recommendationsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  recommendationsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 8,
  },
  recommendationsText: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
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
    marginBottom: 8,
  },
  tipContext: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
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
    marginBottom: 8,
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
  culturalSignificance: {
    fontSize: 12,
    color: '#F59E0B',
    lineHeight: 16,
    marginBottom: 6,
  },
  ingredients: {
    fontSize: 12,
    color: '#10B981',
    lineHeight: 16,
    marginBottom: 4,
  },
  allergens: {
    fontSize: 12,
    color: '#EF4444',
    lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 18,
    color: '#EF4444',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 