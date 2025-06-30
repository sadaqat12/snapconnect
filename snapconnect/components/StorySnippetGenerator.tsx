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
import { StorySnippetService, StorySnippetRequest, StorySnippetResponse } from '../lib/storySnippetService';

const { width } = Dimensions.get('window');

interface StorySnippetGeneratorProps {
  visible: boolean;
  onClose: () => void;
  storyId: string;
  storyTitle?: string;
}

export default function StorySnippetGenerator({
  visible,
  onClose,
  storyId,
  storyTitle,
}: StorySnippetGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [snippetResponse, setSnippetResponse] = useState<StorySnippetResponse | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<'adventurous' | 'reflective' | 'casual'>('casual');
  const [error, setError] = useState<string | null>(null);

  const styles = StorySnippetService.getAvailableStyles();

  const generateSnippet = async () => {
    setIsLoading(true);
    setError(null);
    setSnippetResponse(null);

    try {
      const request: StorySnippetRequest = {
        storyId,
        style: selectedStyle,
      };

      const response = await StorySnippetService.generateStorySnippet(request);
      setSnippetResponse(response);

      if (!response.success && response.error) {
        setError(response.error);
      }
    } catch (error) {
      console.error('Story snippet generation failed:', error);
      setError('Failed to generate travel blog. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySnippet = async () => {
    if (!snippetResponse?.snippet) return;

    try {
      const fullText = `${snippetResponse.title}\n\n${snippetResponse.snippet}`;
      await Clipboard.setStringAsync(fullText);
      Alert.alert('✅ Copied!', 'Travel blog copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy travel blog');
    }
  };



  const renderStyleSelector = () => (
    <View style={componentStyles.styleSelector}>
      <Text style={componentStyles.styleSelectorTitle}>Choose Writing Style:</Text>
      <View style={componentStyles.styleOptions}>
        {styles.map((style) => (
          <TouchableOpacity
            key={style.id}
            style={[
              componentStyles.styleOption,
              selectedStyle === style.id && componentStyles.styleOptionSelected,
            ]}
            onPress={() => setSelectedStyle(style.id)}
          >
            <Text style={componentStyles.styleIcon}>{style.icon}</Text>
            <Text style={[
              componentStyles.styleName,
              selectedStyle === style.id && componentStyles.styleNameSelected,
            ]}>
              {style.name}
            </Text>
            <Text style={componentStyles.styleDescription}>{style.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGeneratedSnippet = () => {
    if (!snippetResponse) return null;

    return (
      <View style={componentStyles.snippetContainer}>
        <View style={componentStyles.snippetHeader}>
          <Text style={componentStyles.snippetTitle}>{snippetResponse.title}</Text>
          <View style={componentStyles.snippetActions}>
            <TouchableOpacity
              style={componentStyles.actionButton}
              onPress={handleCopySnippet}
            >
              <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        
        <ScrollView style={componentStyles.snippetTextContainer} showsVerticalScrollIndicator={false}>
          <Text style={componentStyles.snippetText}>{snippetResponse.snippet}</Text>
        </ScrollView>

        {!snippetResponse.success && (
          <View style={componentStyles.fallbackNotice}>
            <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
            <Text style={componentStyles.fallbackText}>
              Using fallback content. Check your connection and try again.
            </Text>
          </View>
        )}
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
      <View style={componentStyles.modalOverlay}>
        <View style={componentStyles.modalContent}>
          {/* Header */}
          <View style={componentStyles.header}>
            <Text style={componentStyles.title}>📖 Story Snippet Generator</Text>
            <TouchableOpacity onPress={onClose} style={componentStyles.closeButton}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={componentStyles.content} showsVerticalScrollIndicator={false}>
            {!snippetResponse && !isLoading && (
              <View style={componentStyles.introSection}>
                <Text style={componentStyles.introText}>
                  Transform your story into a beautiful travel blog snippet! 
                  AI will analyze your photos, locations, and captions to create a cohesive narrative.
                </Text>
                
                {storyTitle && (
                  <View style={componentStyles.storyInfo}>
                    <Ionicons name="library-outline" size={20} color="#6366f1" />
                    <Text style={componentStyles.storyTitle}>{storyTitle}</Text>
                  </View>
                )}

                {renderStyleSelector()}

                <TouchableOpacity
                  style={componentStyles.generateButton}
                  onPress={generateSnippet}
                >
                  <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                  <Text style={componentStyles.generateButtonText}>Generate Travel Blog</Text>
                </TouchableOpacity>
              </View>
            )}

            {isLoading && (
              <View style={componentStyles.loadingSection}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={componentStyles.loadingText}>Creating your travel blog...</Text>
                <Text style={componentStyles.loadingSubtext}>
                  Analyzing photos, locations, and crafting your story
                </Text>
              </View>
            )}

            {error && (
              <View style={componentStyles.errorSection}>
                <Ionicons name="warning-outline" size={24} color="#EF4444" />
                <Text style={componentStyles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={componentStyles.retryButton}
                  onPress={generateSnippet}
                >
                  <Text style={componentStyles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {renderGeneratedSnippet()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const componentStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    height: '80%',
    width: '90%',
    maxWidth: 500,
    minHeight: 400,
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
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
    minHeight: 300,
  },
  introSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  introText: {
    fontSize: 18,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
    paddingHorizontal: 10,
  },
  storyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  storyTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: '600',
  },
  styleSelector: {
    width: '100%',
    marginBottom: 24,
    marginTop: 16,
  },
  styleSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  styleOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  styleOption: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1',
  },
  styleIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  styleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  styleNameSelected: {
    color: '#FFFFFF',
  },
  styleDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  generateButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingSection: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 16,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  errorSection: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  snippetContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
  },
  snippetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  snippetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
  },
  snippetActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#6366f1',
    padding: 10,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snippetTextContainer: {
    maxHeight: 300,
  },
  snippetText: {
    fontSize: 16,
    color: '#D1D5DB',
    lineHeight: 24,
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  fallbackText: {
    fontSize: 12,
    color: '#F59E0B',
    marginLeft: 8,
    flex: 1,
  },
}); 