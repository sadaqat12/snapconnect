import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  Pressable,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { Video, ResizeMode } from 'expo-av';
import { StoryData, StoryService } from '../lib/storyService';
import { SnapData } from '../lib/snapService';

interface StoryViewerProps {
  stories: StoryData[];
  initialStoryIndex: number;
  isVisible: boolean;
  onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function StoryViewer({ 
  stories, 
  initialStoryIndex, 
  isVisible, 
  onClose,
  onStoryViewed
}: StoryViewerProps) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  
  const progressAnimations = useRef<Animated.Value[]>([]);
  const videoRef = useRef<Video>(null);
  const panY = useRef(new Animated.Value(0)).current;
  
  const currentStory = stories[currentStoryIndex];
  const currentSnap = currentStory?.snaps?.[currentSnapIndex];

  // Update currentStoryIndex when initialStoryIndex changes
  useEffect(() => {
    console.log('StoryViewer: initialStoryIndex changed to:', initialStoryIndex);
    setCurrentStoryIndex(initialStoryIndex);
  }, [initialStoryIndex]);

  useEffect(() => {
    if (isVisible && currentStory) {
      console.log('StoryViewer: Starting story viewing for story index:', currentStoryIndex, 'Story ID:', currentStory.id);
      
      // Initialize progress animations for current story
      const snapCount = currentStory.snaps?.length || 0;
      progressAnimations.current = Array(snapCount).fill(0).map(() => new Animated.Value(0));
      
      // Start viewing the story
      startStoryViewing();
      
      // Mark story as viewed (skip for flashback stories)
      if (currentStory.id && !currentStory.id.startsWith('flashback-')) {
        StoryService.markStoryAsViewed(currentStory.id)
          .then(() => {
            // Notify parent component that story was viewed
            if (onStoryViewed) {
              onStoryViewed(currentStory.id!);
            }
          })
          .catch(console.error);
      }
    }
  }, [isVisible, currentStoryIndex]);

  useEffect(() => {
    if (isVisible && currentSnap) {
      setIsMediaLoading(true);
      startSnapProgress();
    }
  }, [currentSnapIndex, isVisible]);

  const startStoryViewing = () => {
    setCurrentSnapIndex(0);
  };

  const startSnapProgress = () => {
    if (!currentSnap || !progressAnimations.current[currentSnapIndex]) return;

    const duration = (currentSnap.duration_seconds || 10) * 1000;
    
    // Reset current animation
    progressAnimations.current[currentSnapIndex].setValue(0);
    
    // Start progress animation
    Animated.timing(progressAnimations.current[currentSnapIndex], {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        goToNextSnap();
      }
    });
  };

  const goToNextSnap = () => {
    const snapCount = currentStory?.snaps?.length || 0;
    
    if (currentSnapIndex < snapCount - 1) {
      // Next snap in current story
      setCurrentSnapIndex(prev => prev + 1);
    } else {
      // Next story
      goToNextStory();
    }
  };

  const goToPreviousSnap = () => {
    if (currentSnapIndex > 0) {
      // Previous snap in current story
      setCurrentSnapIndex(prev => prev - 1);
    } else {
      // Previous story
      goToPreviousStory();
    }
  };

  const goToNextStory = () => {
    // Mark current story as viewed before moving to next (skip for flashback stories)
    if (currentStory?.id && !currentStory.id.startsWith('flashback-')) {
      StoryService.markStoryAsViewed(currentStory.id)
        .then(() => {
          // Notify parent component that story was viewed
          if (onStoryViewed) {
            onStoryViewed(currentStory.id!);
          }
        })
        .catch(console.error);
    }
    
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      // End of stories
      onClose();
    }
  };

  const goToPreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      // First story, close
      onClose();
    }
  };

  const handleTap = (event: any) => {
    const { locationX } = event.nativeEvent;
    const screenCenter = screenWidth / 2;
    
    console.log('Story tap detected:', { locationX, screenCenter });
    
    // Stop current animation
    if (progressAnimations.current[currentSnapIndex]) {
      progressAnimations.current[currentSnapIndex].stopAnimation();
    }
    
    if (locationX > screenCenter) {
      // Tap right side - next
      console.log('Tapped right - going to next snap');
      goToNextSnap();
    } else {
      // Tap left side - previous
      console.log('Tapped left - going to previous snap');
      goToPreviousSnap();
    }
  };

  const handleLongPress = () => {
    console.log('Long press detected - pausing');
    // Pause all animations
    progressAnimations.current.forEach(animation => {
      animation.stopAnimation();
    });
  };

  const handlePressOut = () => {
    console.log('Press out - resuming');
    // Resume animation
    startSnapProgress();
  };

  const handlePanGesture = (event: any) => {
    const { translationY, velocityY } = event.nativeEvent;
    
    if (translationY > 0) {
      panY.setValue(translationY);
    }
    
    // If dragged down more than 100px or fast swipe down, close
    if (translationY > 100 || velocityY > 1000) {
      console.log('Swipe down detected - closing story');
      // Mark current story as viewed before closing
      if (currentStory?.id) {
        StoryService.markStoryAsViewed(currentStory.id)
          .then(() => {
            // Notify parent component that story was viewed
            if (onStoryViewed) {
              onStoryViewed(currentStory.id!);
            }
          })
          .catch(console.error);
      }
      onClose();
    }
  };

  const handleMediaLoad = () => {
    console.log('Media loaded');
    setIsMediaLoading(false);
    if (currentSnap?.media_type === 'video' && videoRef.current) {
      videoRef.current.playAsync();
    }
  };

  const handleMediaError = (error?: any) => {
    console.error('Media load error:', error);
    setIsMediaLoading(false);
  };

  const renderMedia = () => {
    if (!currentSnap) return null;

    console.log('Rendering media:', {
      mediaType: currentSnap.media_type,
      mediaUrl: currentSnap.media_url,
    });

    if (currentSnap.media_type === 'video') {
      return (
        <View style={styles.mediaWrapper}>
          <Video
            ref={videoRef}
            source={{ uri: currentSnap.media_url }}
            style={styles.media}
            resizeMode={ResizeMode.COVER}
            isLooping={false}
            onLoad={handleMediaLoad}
            onError={handleMediaError}
            shouldPlay={true}
          />
          {isMediaLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.mediaWrapper}>
          <Image
            source={{ uri: currentSnap.media_url }}
            style={styles.media}
            resizeMode="cover"
            onLoad={handleMediaLoad}
            onError={handleMediaError}
          />
          {isMediaLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
        </View>
      );
    }
  };

  const renderProgressBars = () => {
    const snapCount = currentStory?.snaps?.length || 0;
    
    return (
      <View style={styles.progressContainer}>
        {Array(snapCount).fill(0).map((_, index) => (
          <View key={index} style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground} />
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: index < currentSnapIndex 
                    ? '100%' 
                    : index === currentSnapIndex
                    ? progressAnimations.current[index]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }) || '0%'
                    : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {renderProgressBars()}
      <View style={styles.headerContent}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {currentStory?.creator?.name?.[0] || currentStory?.creator?.username?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>
              {currentStory?.creator?.name || currentStory?.creator?.username || 'Unknown'}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimeAgo(currentStory?.created_at)}
            </Text>
          </View>
        </View>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
    </View>
  );

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    
    // Simple: current time minus created time
    const diffMs = Date.now() - new Date(dateString).getTime();
    
    // If negative (future timestamp), just show "Just now"
    if (diffMs < 0) return 'Just now';
    
    // Calculate time units
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  if (!isVisible || !currentStory || !currentSnap) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.storyContainer}>
          {renderHeader()}
          
          <PanGestureHandler onGestureEvent={handlePanGesture}>
            <Animated.View style={[styles.snapContainer, { transform: [{ translateY: panY }] }]}>
              <Pressable
                style={styles.mediaContainer}
                onPress={handleTap}
                onLongPress={handleLongPress}
                onPressOut={handlePressOut}
              >
                {renderMedia()}
              </Pressable>
            </Animated.View>
          </PanGestureHandler>
          
          {/* Navigation hints */}
          <View style={styles.navigationHints}>
            <View style={styles.navHintLeft} />
            <View style={styles.navHintRight} />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  storyContainer: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 4,
  },
  progressBarContainer: {
    flex: 1,
    height: 3,
    position: 'relative',
  },
  progressBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
  },
  progressBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  snapContainer: {
    flex: 1,
  },
  mediaContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mediaWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  navigationHints: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    pointerEvents: 'none',
  },
  navHintLeft: {
    flex: 1,
  },
  navHintRight: {
    flex: 1,
  },
}); 