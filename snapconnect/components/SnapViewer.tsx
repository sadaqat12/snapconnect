import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
  Text,
  Modal,
  Pressable,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SnapData, SnapService } from '../lib/snapService';

interface SnapViewerProps {
  snap: SnapData;
  isVisible: boolean;
  onClose: () => void;
  onSnapViewed?: () => void;
}

export default function SnapViewer({ snap, isVisible, onClose, onSnapViewed }: SnapViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const progressAnimation = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (isVisible) {
      console.log('Opening snap with details:', {
        id: snap.id,
        mediaType: snap.media_type,
        mediaUrl: snap.media_url,
        caption: snap.caption,
        location: snap.location,
        duration: snap.duration_seconds,
      });

      // Test if the URL is accessible
      fetch(snap.media_url)
        .then(response => {
          console.log('Media URL fetch response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            url: response.url,
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        })
        .catch(error => {
          console.error('Media URL fetch error:', {
            error: error.message,
            url: snap.media_url,
          });
        });
      
      // Start countdown animation
      Animated.timing(progressAnimation, {
        toValue: 0,
        duration: (snap.duration_seconds || 10) * 1000,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          handleSnapTimeout();
        }
      });

      // Auto-close after duration
      const timer = setTimeout(() => {
        handleSnapTimeout();
      }, (snap.duration_seconds || 10) * 1000);

      return () => {
        clearTimeout(timer);
        progressAnimation.setValue(1);
      };
    }
  }, [isVisible]);

  const handleSnapTimeout = () => {
    // Only handle timeout if the viewer is still visible
    if (isVisible) {
      handleClose();
    }
  };

  const handleClose = () => {
    // Always notify parent that snap was viewed before closing
    onSnapViewed?.();
    onClose();
  };

  const handleTap = () => {
    // Skip the snap animation and mark as viewed
    progressAnimation.setValue(0);
    handleClose();
  };

  const handleLoad = () => {
    console.log('Media loaded successfully:', {
      mediaType: snap.media_type,
      mediaUrl: snap.media_url,
    });
    setIsLoading(false);
    if (snap.media_type === 'video' && videoRef.current) {
      videoRef.current.playAsync();
    }
  };

  const handleError = (error?: any) => {
    console.error('Failed to load media:', {
      mediaType: snap.media_type,
      mediaUrl: snap.media_url,
      error: error?.nativeEvent || error,
    });
    setIsLoading(false);
    setError('Failed to load snap');
  };

  const renderMedia = () => {
    console.log('Rendering media component:', {
      mediaType: snap.media_type,
      mediaUrl: snap.media_url,
    });

    if (snap.media_type === 'video') {
      return (
        <Video
          ref={videoRef}
          source={{ uri: snap.media_url }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          isLooping={false}
          onLoad={handleLoad}
          onError={handleError}
          shouldPlay={true}
          onLoadStart={() => console.log('Video load started')}
          onReadyForDisplay={() => console.log('Video ready for display')}
        />
      );
    } else {
      return (
        <Image
          source={{ uri: snap.media_url }}
          style={styles.media}
          resizeMode="cover"
          onLoad={handleLoad}
          onError={handleError}
          onLoadStart={() => console.log('Image load started')}
          onProgress={(e) => console.log('Image loading progress:', e.nativeEvent)}
        />
      );
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Progress Bar */}
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />

        {/* Media Content */}
        <Pressable style={styles.mediaContainer} onPress={handleTap}>
          {renderMedia()}

          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.loadingText}>Loading snap...</Text>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorSubtext}>URL: {snap.media_url}</Text>
              <Text style={styles.errorSubtext}>Tap to close</Text>
            </View>
          )}

          {/* Caption */}
          {snap.caption && (
            <View style={styles.captionContainer}>
              <Text style={styles.caption}>{snap.caption}</Text>
            </View>
          )}

          {/* Location */}
          {snap.location?.address && (
            <View style={styles.locationContainer}>
              <Text style={styles.location}>📍 {snap.location.address}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  progressBar: {
    height: 2,
    backgroundColor: '#ffffff',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  caption: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  location: {
    color: '#ffffff',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 12,
  },
  errorSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
  },
}); 