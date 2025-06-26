import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Image, Platform, ActivityIndicator, Modal, FlatList, TextInput } from 'react-native';
import { CameraView, Camera, VideoQuality, VideoCodec } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { SnapService } from '../lib/snapService';
import { StoryService } from '../lib/storyService';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { useFriendsStore, Friend } from '../lib/stores/friendsStore';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flashMode, setFlashMode] = useState<'on' | 'off' | 'auto'>('off');
  const [isRecording, setIsRecording] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [capturedMediaType, setCapturedMediaType] = useState<'photo' | 'video'>('photo');
  const [pressStartTime, setPressStartTime] = useState<number>(0);
  const [isImagePickerActive, setIsImagePickerActive] = useState(false);
  const shouldStartRecordingRef = useRef<boolean>(false);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<any>(null);

  // New state for friend selection
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const { friends, searchUsers, fetchFriends } = useFriendsStore();

  // Check if running in simulator
  const isSimulator = Constants.isDevice === false;

  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [minRecordingDuration] = useState<number>(500); // Minimum 500ms recording duration



  useEffect(() => {
    if (isSimulator) {
      // Skip permission requests in simulator
      setHasPermission(true);
    } else {
      requestPermissions();
    }
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    setHasPermission(cameraStatus === 'granted' && mediaStatus === 'granted');
  };

  const takePictureSimulator = () => {
    // Mock photo for simulator
    const mockImageUrl = `https://picsum.photos/400/800?random=${Date.now()}`;
    setCapturedMedia(mockImageUrl);
    setCapturedMediaType('photo');
    setIsPreview(true);
    Alert.alert('Simulator Mode', 'Mock photo captured! On a real device, this would be your actual photo.');
  };

  const startRecordingSimulator = () => {
    setIsRecording(true);
    Alert.alert('Simulator Mode', 'Mock video recording started! On a real device, this would record actual video.');
    
    // Don't auto-stop - let the user control when to stop
    // The timeout-based auto-stop was causing issues with user interaction
  };

  const stopRecordingSimulator = () => {
    if (!isRecording) return;
    
    setIsRecording(false);
    const mockVideoUrl = `https://picsum.photos/400/800?random=${Date.now()}`;
    setCapturedMedia(mockVideoUrl);
    setCapturedMediaType('video');
    setIsPreview(true);
    console.log('📱 Simulator: Mock video preview showing');
  };

  const handlePressIn = () => {
    // Don't handle press if ImagePicker is active
    if (isImagePickerActive) {
      console.log('🚫 Ignoring press - ImagePicker is active');
      return;
    }
    
    console.log('🔴 PRESS IN DETECTED');
    setPressStartTime(Date.now());
    shouldStartRecordingRef.current = true;
    
    // Start recording after 300ms hold (like Snapchat)
    recordingTimeoutRef.current = setTimeout(() => {
      console.log('⏰ TIMEOUT REACHED - shouldStartRecording:', shouldStartRecordingRef.current);
      if (shouldStartRecordingRef.current && !isImagePickerActive) {
        console.log('🎥 STARTING RECORDING');
        startRecording();
      }
    }, 300);
  };

  const handlePressOut = () => {
    // Don't handle press if ImagePicker is active
    if (isImagePickerActive) {
      console.log('🚫 Ignoring press out - ImagePicker is active');
      return;
    }
    
    console.log('🔵 PRESS OUT DETECTED');
    const pressDuration = Date.now() - pressStartTime;
    console.log('⏱️ Press duration:', pressDuration, 'ms, isRecording:', isRecording);
    
    // Clear the recording timeout
    if (recordingTimeoutRef.current) {
      console.log('🚫 Clearing timeout');
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    shouldStartRecordingRef.current = false;
    
    if (isRecording) {
      // If we're currently recording, stop it regardless of duration
      console.log('🛑 STOPPING RECORDING');
      stopRecording();
    } else if (pressDuration < 300) {
      // Quick tap and not recording - take photo
      console.log('📸 QUICK TAP - taking photo');
      takePicture();
    } else {
      // Long press but recording never started (likely an error)
      console.log('❓ Long press but recording never started - taking photo as fallback');
      takePicture();
    }
    
    setPressStartTime(0);
  };

  const takePicture = async () => {
    if (isSimulator) {
      takePictureSimulator();
      return;
    }

    if (cameraRef.current && !isRecording) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          exif: true,
        });
        setCapturedMedia(photo.uri);
        setCapturedMediaType('photo');
        setIsPreview(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
        console.error(error);
      }
    }
  };

  const startRecording = async () => {
    console.log('🎬 startRecording called, isSimulator:', isSimulator, 'isRecording:', isRecording);
    
    if (isSimulator) {
      startRecordingSimulator();
      return;
    }

    // Use ImagePicker for reliable video recording
    try {
      setIsImagePickerActive(true); // Prevent press handler interference
      console.log('🎥 Opening video recorder...');
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        const video = result.assets[0];
        console.log('🎉 Video recorded successfully!', video.uri);
        setCapturedMedia(video.uri);
        setCapturedMediaType('video');
        setIsPreview(true);
      } else {
        console.log('❌ Video recording cancelled');
      }
    } catch (error) {
      console.error('Video recording error:', error);
      Alert.alert('Error', 'Failed to record video');
    } finally {
      setIsImagePickerActive(false); // Re-enable press handlers
    }
  };

  const stopRecording = async () => {
    // This function is no longer needed since ImagePicker handles everything
    // But we keep it for compatibility with the existing press handlers
    console.log('🛑 stopRecording called - but using ImagePicker now');
  };

  const showMockVideoPreview = () => {
    console.log('🎥 Showing mock video preview');
    // Create a mock video preview for demonstration
    setCapturedMedia(`https://picsum.photos/400/800?random=${Date.now()}`);
    setCapturedMediaType('video');
    setIsPreview(true);
    console.log('📱 Mock video preview displayed');
  };

  const saveSnap = async () => {
    if (!capturedMedia) return;

    try {
      setIsUploading(true);
      setUploadProgress('Preparing...');

      if (!isSimulator) {
        // Save to device gallery (only on real device)
        await MediaLibrary.saveToLibraryAsync(capturedMedia);
        
        // Upload to cloud storage and create snap record
        const snap = await SnapService.createSnapFromMedia(
          capturedMedia,
          capturedMediaType,
          {
            caption: `${capturedMediaType === 'photo' ? 'Photo' : 'Video'} Travel moment captured with SnapConnect!`,
            recipients: [],
            duration: 10,
            includeLocation: true,
          },
          (stage, progress) => {
            setUploadProgress(stage);
          }
        );

        Alert.alert(
          'Snap Created!',
          `Your ${capturedMediaType} has been processed and is ready to share!`,
          [
            { text: 'Share with Friends', onPress: handleSendToFriends },
            { text: 'Add to Story', onPress: handleAddToStory },
            { text: 'Save Only', onPress: handleSaveOnly },
          ]
        );
      } else {
        // Simulator mode
        setUploadProgress('Simulating upload...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Fake delay
        
        Alert.alert('Saved!', 'Simulator: Photo would be saved to gallery.');
      }
    } catch (error) {
      Alert.alert('Upload Error', `Failed to save snap: ${error}`);
      console.error(error);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const resetCamera = () => {
    // Clean up any active timeouts
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    setCapturedMedia(null);
    setIsPreview(false);
    setIsUploading(false);
    setUploadProgress('');
    setCapturedMediaType('photo');
    setIsRecording(false);
    setRecordingStartTime(0); // Reset recording start time
    // Recording promise removed since we're using file-based approach
    shouldStartRecordingRef.current = false;
    setPressStartTime(0);
  };

  const handleSendToFriends = async () => {
    if (!capturedMedia) return;
    setShowFriendModal(true);
  };

  const handleAddToStory = async () => {
    if (!capturedMedia) return;
    createAndUploadSnap('story');
  };

  const handleSaveOnly = async () => {
    if (!capturedMedia) return;
    
    try {
      setIsUploading(true);
      setUploadProgress('Saving to gallery...');
      
      if (!isSimulator) {
        await MediaLibrary.saveToLibraryAsync(capturedMedia);
        Alert.alert('Saved!', 'Photo saved to your gallery only.');
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        Alert.alert('Saved!', 'Simulator: Photo would be saved to gallery.');
      }
      
      resetCamera();
    } catch (error) {
      Alert.alert('Error', 'Failed to save photo');
    } finally {
      setIsUploading(false);
    }
  };

  // Fetch friends on mount
  useEffect(() => {
    fetchFriends();
  }, []);

  // Handle friend search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = await searchUsers(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  // Toggle friend selection
  const toggleFriendSelection = (friend: Friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f.id === friend.id);
      if (isSelected) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  // Send snap to selected friends
  const handleSendSnap = async () => {
    if (!selectedFriends.length) {
      Alert.alert('Select Friends', 'Please select at least one friend to send the snap to.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress('Preparing to send...');

      // Create and upload snap with selected friends' IDs
      await createAndUploadSnap('friends', selectedFriends.map(f => f.id));

      // Reset selections and close modal
      setSelectedFriends([]);
      setShowFriendModal(false);
      setSearchQuery('');
      setSearchResults([]);

    } catch (error) {
      Alert.alert('Error', 'Failed to send snap. Please try again.');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  // Update createAndUploadSnap to accept recipient IDs
  const createAndUploadSnap = async (type: 'friends' | 'story', recipientIds?: string[]) => {
    if (!capturedMedia) return;

    try {
      setIsUploading(true);

      if (!isSimulator) {
        // Save to gallery first
        await MediaLibrary.saveToLibraryAsync(capturedMedia);
        
        if (type === 'story') {
          // Create snap first for story
          setUploadProgress('Creating story snap...');
          const snap = await SnapService.createSnapFromMedia(
            capturedMedia,
            capturedMediaType,
            {
              caption: `${capturedMediaType === 'photo' ? 'Photo' : 'Video'} Story`,
              includeLocation: true,
              duration: capturedMediaType === 'photo' ? 10 : 30,
              recipients: [], // Stories don't have direct recipients
            },
            (stage, progress) => {
              setUploadProgress(stage);
            }
          );

          // Add snap to story
          setUploadProgress('Adding to story...');
          const story = await StoryService.addSnapToStory(snap.id!);

          Alert.alert(
            'Added to Story!',
            `Your ${capturedMediaType} has been added to your story and will be visible to friends for 24 hours.`,
            [{ text: 'Great!', style: 'default' }]
          );
        } else {
          // Regular snap to friends
          const snap = await SnapService.createSnapFromMedia(
            capturedMedia,
            capturedMediaType,
            {
              caption: `${capturedMediaType === 'photo' ? 'Photo' : 'Video'} Shared via SnapConnect`,
              includeLocation: true,
              duration: capturedMediaType === 'photo' ? 10 : 30,
              recipients: recipientIds,
            },
            (stage, progress) => {
              setUploadProgress(stage);
            }
          );

          Alert.alert(
            'Success!',
            `Your ${capturedMediaType} has been sent to ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}!`,
            [{ text: 'Awesome!', style: 'default' }]
          );
        }
      } else {
        // Simulator mode
        setUploadProgress('Simulating upload...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const message = type === 'story' 
          ? 'Mock story created!'
          : 'Mock snap sent to friends!';
          
        Alert.alert('📱 Simulator', message, [
          { text: 'Done', onPress: resetCamera }
        ]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', `Failed to ${type === 'story' ? 'add to story' : 'send snap'}: ${error}`);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const toggleCameraType = () => {
    setCameraType(current => 
      current === 'back' ? 'front' : 'back'
    );
  };

  const toggleFlash = () => {
    setFlashMode(current => 
      current === 'off' ? 'on' : 'off'
    );
  };

  // Add friend selection modal
  const renderFriendSelectionModal = () => (
    <Modal
      visible={showFriendModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFriendModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send to Friends</Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={() => {
                setShowFriendModal(false);
                setSelectedFriends([]);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={handleSearch}
          />

          <FlatList
            data={searchQuery ? searchResults : friends}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.friendItem,
                  selectedFriends.some(f => f.id === item.id) && styles.friendItemSelected
                ]}
                onPress={() => toggleFriendSelection(item)}
              >
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{item.name || item.username}</Text>
                  <Text style={styles.friendUsername}>@{item.username}</Text>
                </View>
                {selectedFriends.some(f => f.id === item.id) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchQuery 
                    ? 'No friends found. Try a different search.'
                    : 'No friends yet. Add some friends to share snaps!'}
                </Text>
              </View>
            }
          />

          <View style={styles.modalFooter}>
            <Text style={styles.selectedCount}>
              Selected: {selectedFriends.length}
            </Text>
            <Pressable
              style={[
                styles.sendButton,
                !selectedFriends.length && styles.sendButtonDisabled
              ]}
              onPress={handleSendSnap}
              disabled={!selectedFriends.length}
            >
              <Text style={styles.sendButtonText}>Send Snap</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
                  <Text style={styles.logo}>SnapConnect</Text>
        <Text style={styles.title}>Camera Access Required</Text>
          <Text style={styles.subtitle}>
            {isSimulator 
              ? 'Loading simulator camera mode...'
              : 'We need camera and media permissions to capture your travel moments'
            }
          </Text>
          {!isSimulator && (
            <Pressable style={styles.button} onPress={requestPermissions}>
              <Text style={styles.buttonText}>Grant Permissions</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (hasPermission === false && !isSimulator) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.logo}>SnapConnect</Text>
                      <Text style={styles.title}>Permissions Required</Text>
          <Text style={styles.subtitle}>
            Please enable camera and media permissions in your device settings to start capturing snaps
          </Text>
          <Pressable style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isPreview && capturedMedia) {
    console.log('🖼️ SHOWING PREVIEW - capturedMedia:', capturedMedia, 'mediaType:', capturedMediaType);
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          {capturedMediaType === 'video' ? (
            <Video
              source={{ uri: capturedMedia }}
              style={styles.previewImage}
              resizeMode={ResizeMode.COVER}
              shouldPlay={true}
              isLooping={true}
              useNativeControls={false}
            />
          ) : (
            <Image source={{ uri: capturedMedia }} style={styles.previewImage} />
          )}
          
          <View style={styles.previewOverlay}>
            {/* Header */}
            <View style={styles.previewHeader}>
              <Pressable style={styles.closeButton} onPress={resetCamera}>
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>

            {/* Bottom Action Buttons */}
            <View style={styles.bottomActions}>
              <Pressable 
                style={styles.bottomButton}
                onPress={() => handleSaveOnly()}
                disabled={isUploading}
              >
                <Ionicons name="download" size={20} color="#ffffff" />
              </Pressable>

              <Pressable 
                style={styles.bottomButton}
                onPress={() => handleAddToStory()}
                disabled={isUploading}
              >
                <Text style={styles.bottomButtonText}>+ Story</Text>
              </Pressable>

              <Pressable 
                style={styles.bottomButton}
                onPress={() => handleSendToFriends()}
                disabled={isUploading}
              >
                <Text style={styles.bottomButtonText}>Send to →</Text>
              </Pressable>
            </View>

            {/* Upload Progress */}
            {isUploading && (
              <View style={styles.uploadProgressContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.uploadProgressText}>{uploadProgress}</Text>
              </View>
            )}
          </View>

          {/* Friend Selection Modal */}
          {renderFriendSelectionModal()}
        </View>
      </View>
    );
  }

  // Simulator Mock Camera UI
  if (isSimulator) {
    return (
      <View style={styles.container}>
        <View style={styles.mockCameraContainer}>
          <View style={styles.cameraOverlay}>
            {/* Header */}
            <View style={styles.header}>
                        <Text style={styles.logoText}>SnapConnect</Text>
          <Text style={styles.simulatorBadge}>Simulator Mode</Text>
              <View style={styles.headerControls}>
                <Pressable style={styles.flashButton} onPress={toggleFlash}>
                  <Text style={styles.controlText}>
                    {flashMode === 'on' ? '⚡' : '🔆'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Mock Camera Preview */}
            <View style={styles.mockPreview}>
              <Ionicons name="camera" size={48} color="#9CA3AF" />
              <Text style={styles.mockText}>Mock Camera Preview</Text>
              <Text style={styles.mockSubtext}>
                Simulator mode - photos will be demo images
              </Text>
              <Text style={styles.mockSubtext}>
                Camera: {cameraType} | Flash: {flashMode}
              </Text>
            </View>

            {/* Camera Controls */}
            <View style={styles.controls}>
              <Pressable style={styles.flipButton} onPress={toggleCameraType}>
                <Text style={styles.controlText}>🔄</Text>
              </Pressable>
              
              <View style={styles.captureButtons}>
                <Pressable 
                  style={[styles.captureButton, isRecording && styles.recording]} 
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                >
                  <View style={[styles.captureInner, isRecording && styles.captureInnerRecording]} />
                  {isRecording && (
                    <View style={styles.recordingPulse} />
                  )}
                </Pressable>
              </View>
              
              <View style={styles.placeholder} />
            </View>

            {isRecording && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingText}>● MOCK REC</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Real Camera UI (Physical Device)
  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing={cameraType}
        flash={flashMode}
        ref={cameraRef}
      >
        <View style={styles.cameraOverlay}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>✈️ SnapConnect</Text>
            <View style={styles.headerControls}>
              <Pressable style={styles.flashButton} onPress={toggleFlash}>
                <Text style={styles.controlText}>
                  {flashMode === 'on' ? '⚡' : '🔆'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Camera Controls */}
          <View style={styles.controls}>
            <Pressable style={styles.flipButton} onPress={toggleCameraType}>
              <Text style={styles.controlText}>🔄</Text>
            </Pressable>
            
            <View style={styles.captureButtons}>
              <Pressable 
                style={[styles.captureButton, isRecording && styles.recording]} 
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
              >
                <View style={[styles.captureInner, isRecording && styles.captureInnerRecording]} />
                {isRecording && (
                  <View style={styles.recordingPulse} />
                )}
              </Pressable>
            </View>
            
            <View style={styles.placeholder} />
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingText}>● REC</Text>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerControls: {
    flexDirection: 'row',
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 24,
    color: '#ffffff',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  flipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtons: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    marginBottom: 12,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  captureInnerRecording: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 0.8 }],
  },
  recordingPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#dc2626',
    opacity: 0.5,
  },
  videoButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(220,38,38,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recording: {
    backgroundColor: '#dc2626',
  },
  videoText: {
    fontSize: 20,
    color: '#ffffff',
  },
  placeholder: {
    width: 60,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(220,38,38,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  previewHeader: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'flex-start',
  },
  previewControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  discardButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(220,38,38,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIcon: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  mockCameraContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  mockCameraIcon: {
    fontSize: 128,
    color: '#ffffff',
    marginBottom: 24,
  },
  mockText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  mockSubtext: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  mockPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simulatorBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: 'rgba(220,38,38,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  uploadProgressContainer: {
    position: 'absolute',
    bottom: 160,
    left: 24,
    right: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  uploadProgressText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 44,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 50,
    paddingTop: 20,
  },
  bottomButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  bottomButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  searchInput: {
    backgroundColor: '#0d0d1a',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0d0d1a',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  friendItemSelected: {
    backgroundColor: '#1e1e38',
    borderColor: '#6366f1',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  friendUsername: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  checkmark: {
    fontSize: 20,
    color: '#6366f1',
    marginLeft: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  selectedCount: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  sendButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 16,
  },
}); 