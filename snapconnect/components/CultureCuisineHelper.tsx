import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  CultureCuisineService, 
  CultureTip, 
  CuisineDish, 
  CultureCuisineResponse 
} from '../lib/cultureCuisineService';

const { width } = Dimensions.get('window');

interface CultureCuisineHelperProps {
  visible: boolean;
  onClose: () => void;
  imageUrl: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
    country?: string;
    city?: string;
  };
}

export default function CultureCuisineHelper({
  visible,
  onClose,
  imageUrl,
  location,
}: CultureCuisineHelperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<CultureCuisineResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'culture' | 'cuisine'>('culture');
  const [error, setError] = useState<string | null>(null);

  const analyzeImage = async () => {
    if (!imageUrl) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await CultureCuisineService.getCultureCuisineRecommendations({
        imageUrl,
        location,
        analysisType: 'both',
      });
      setResponse(result);

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (error) {
      console.error('Culture & Cuisine analysis failed:', error);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
          🏛️ {dish.culturalSignificance}
        </Text>
      )}
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🎭 Culture & Cuisine Coach</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Image Preview */}
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageUrl }} style={styles.previewImage} />
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!response && !isLoading && (
              <View style={styles.introSection}>
                <Text style={styles.introText}>
                  Get AI-powered cultural insights and cuisine recommendations based on your photo and location.
                </Text>
                <TouchableOpacity
                  style={styles.analyzeButton}
                  onPress={analyzeImage}
                >
                  <Ionicons name="analytics" size={20} color="#FFFFFF" />
                  <Text style={styles.analyzeButtonText}>Analyze Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {isLoading && (
              <View style={styles.loadingSection}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Analyzing your photo...</Text>
                <Text style={styles.loadingSubtext}>
                  AI is discovering cultural tips and cuisine recommendations
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorSection}>
                <Ionicons name="warning-outline" size={24} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={analyzeImage}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {response && (
              <>
                {/* AI Analysis */}
                {response.imageAnalysis && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisSectionTitle}>🤖 AI Analysis</Text>
                    <Text style={styles.analysisText}>{response.imageAnalysis}</Text>
                  </View>
                )}

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'culture' && styles.activeTab]}
                    onPress={() => setActiveTab('culture')}
                  >
                    <Ionicons 
                      name="people" 
                      size={16} 
                      color={activeTab === 'culture' ? '#6366f1' : '#9CA3AF'} 
                    />
                    <Text style={[styles.tabText, activeTab === 'culture' && styles.activeTabText]}>
                      Culture
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'cuisine' && styles.activeTab]}
                    onPress={() => setActiveTab('cuisine')}
                  >
                    <Ionicons 
                      name="restaurant" 
                      size={16} 
                      color={activeTab === 'cuisine' ? '#6366f1' : '#9CA3AF'} 
                    />
                    <Text style={[styles.tabText, activeTab === 'cuisine' && styles.activeTabText]}>
                      Cuisine
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Culture Tips */}
                {activeTab === 'culture' && response.cultureTips && (
                  <View style={styles.tipsSection}>
                    <Text style={styles.sectionTitle}>Cultural Tips</Text>
                    {response.cultureTips.map(renderCultureTip)}
                  </View>
                )}

                {/* Cuisine Recommendations */}
                {activeTab === 'cuisine' && response.cuisineDishes && (
                  <View style={styles.dishesSection}>
                    <Text style={styles.sectionTitle}>Local Cuisine</Text>
                    {response.cuisineDishes.map(renderCuisineDish)}
                  </View>
                )}

                {/* Recommendations */}
                {response.recommendations && (
                  <View style={styles.recommendationsSection}>
                    <Text style={styles.recommendationsSectionTitle}>💡 Recommendations</Text>
                    <Text style={styles.recommendationsText}>{response.recommendations}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  imagePreview: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  introSection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  introText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSection: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
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
  errorSection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  analysisSection: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  analysisSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 13,
    color: '#E5E7EB',
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  activeTab: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#6366f1',
  },
  tipsSection: {
    marginBottom: 20,
  },
  dishesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  tipCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  tipInfo: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  tipCategory: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  importanceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  importanceText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tipDescription: {
    fontSize: 13,
    color: '#E5E7EB',
    lineHeight: 18,
    marginBottom: 6,
  },
  tipContext: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  dishCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  dishHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dishInfo: {
    flex: 1,
  },
  dishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dishName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  mustTryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mustTryText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
  },
  dishCategory: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  dishPrice: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  dishDescription: {
    fontSize: 13,
    color: '#E5E7EB',
    lineHeight: 18,
    marginBottom: 8,
  },
  dishMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  spiceLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spiceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  spiceContainer: {
    flexDirection: 'row',
    gap: 1,
  },
  culturalSignificance: {
    fontSize: 11,
    color: '#F59E0B',
    lineHeight: 15,
  },
  recommendationsSection: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  recommendationsSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 8,
  },
  recommendationsText: {
    fontSize: 13,
    color: '#E5E7EB',
    lineHeight: 18,
  },
}); 