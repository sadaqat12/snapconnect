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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CaptionService, CaptionRequest, CaptionResponse } from '../lib/captionService';

const { width } = Dimensions.get('window');

interface CaptionHelperProps {
  visible: boolean;
  onClose: () => void;
  onApplyCaption: (caption: string) => void;
  imageUrl: string;
  location?: CaptionRequest['location'];
}

export default function CaptionHelper({
  visible,
  onClose,
  onApplyCaption,
  imageUrl,
  location,
}: CaptionHelperProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [captionResponse, setCaptionResponse] = useState<CaptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateCaptions = async () => {
    if (!imageUrl) return;

    setIsLoading(true);
    setError(null);
    setCaptionResponse(null);

    try {
      // Get user's travel profile for personalization
      const userProfile = await CaptionService.getUserTravelProfile();

      const request: CaptionRequest = {
        imageUrl,
        location,
        userProfile,
      };

      const response = await CaptionService.generateCaptions(request);
      setCaptionResponse(response);

      if (!response.success && response.error) {
        setError(response.error);
      }
    } catch (error) {
      console.error('Caption generation failed:', error);
      setError('Failed to generate captions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCaption = async (caption: string) => {
    try {
      await Clipboard.setStringAsync(caption);
      Alert.alert('✅ Copied!', 'Caption copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy caption');
    }
  };

  const handleApplyCaption = (caption: string) => {
    onApplyCaption(caption);
    onClose();
  };

  const renderCaptionOption = (caption: string, index: number) => {
    const getStyleLabel = (index: number) => {
      switch (index) {
        case 0: return 'Adventurous';
        case 1: return 'Reflective';
        case 2: return 'Fun & Casual';
        default: return 'Creative';
      }
    };

    return (
      <View key={index} style={styles.captionOption}>
        <View style={styles.captionHeader}>
          <Text style={styles.captionStyle}>{getStyleLabel(index)}</Text>
          <View style={styles.captionActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCopyCaption(caption)}
            >
              <Ionicons name="copy-outline" size={16} color="#6366f1" />
              <Text style={styles.actionText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.applyButton]}
              onPress={() => handleApplyCaption(caption)}
            >
              <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
              <Text style={[styles.actionText, styles.applyText]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.captionText}>{caption}</Text>
      </View>
    );
  };

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
            <Text style={styles.title}>✨ AI Caption Compass</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!captionResponse && !isLoading && (
              <View style={styles.introSection}>
                <Text style={styles.introText}>
                  Let AI create perfect travel captions for your photo using image analysis and location context.
                </Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateCaptions}
                >
                  <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                  <Text style={styles.generateButtonText}>Generate Captions</Text>
                </TouchableOpacity>
              </View>
            )}

            {isLoading && (
              <View style={styles.loadingSection}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Analyzing your photo...</Text>
                <Text style={styles.loadingSubtext}>
                  Creating personalized travel captions
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorSection}>
                <Ionicons name="warning-outline" size={24} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={generateCaptions}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {captionResponse && captionResponse.captions && (
              <View style={styles.captionsSection}>
                <Text style={styles.captionsTitle}>
                  Choose your perfect caption:
                </Text>
                {captionResponse.captions.map((caption, index) =>
                  renderCaptionOption(caption, index)
                )}
                
                {!captionResponse.success && (
                  <View style={styles.fallbackNotice}>
                    <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                    <Text style={styles.fallbackText}>
                      Using fallback captions. Check your connection and try again.
                    </Text>
                  </View>
                )}
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '70%',
    maxHeight: '90%',
    paddingBottom: 34, // Extra padding for safe area
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
    minHeight: 400, // Ensure minimum content height
  },
  introSection: {
    alignItems: 'center',
    paddingVertical: 30,
    minHeight: 200,
    justifyContent: 'center',
  },
  introText: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  generateButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    elevation: 3,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingSection: {
    alignItems: 'center',
    paddingVertical: 60,
    minHeight: 250,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  errorSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  captionsSection: {
    paddingVertical: 20,
    minHeight: 300,
  },
  captionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  captionOption: {
    backgroundColor: '#0f0f23',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
    minHeight: 80,
  },
  captionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  captionStyle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
  },
  captionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#6366f1',
    minWidth: 70,
  },
  applyButton: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
  },
  applyText: {
    color: '#FFFFFF',
  },
  captionText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    marginTop: 4,
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  fallbackText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
  },
}); 