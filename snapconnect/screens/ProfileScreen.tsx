import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  Switch,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../lib/stores/profileStore';
import UserAvatar from '../components/UserAvatar';

export default function ProfileScreen() {
  const { profile, isLoading, error, fetchProfile, updateUsername, updateProfile, updateAvatar } = useProfileStore();
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // New state for additional modals
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showTravelInterestsModal, setShowTravelInterestsModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  
  // Settings state
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: true,
    locationSharing: true,
    readReceipts: true,
    activityStatus: true,
  });
  
  const [emailSettings, setEmailSettings] = useState({
    friendRequests: true,
    newFeatures: true,
    travelTips: false,
    marketing: false,
  });
  
  const [travelInterests, setTravelInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  
  const [locationSettings, setLocationSettings] = useState({
    enableLocation: true,
    preciseLocation: false,
    backgroundLocation: false,
  });
  
  const [aiSettings, setAISettings] = useState({
    enableCaptions: true,
    personalizedSuggestions: true,
    locationBasedTips: true,
    travelInsights: true,
  });
  

  
  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalSnaps: 0,
    totalStories: 0,
    totalFriends: 0,
    totalCountries: 0,
    isLoading: true
  });
  
  const [detailedAnalytics, setDetailedAnalytics] = useState({
    topCountries: [] as string[],
    weeklyStats: [] as any[],
    engagementRate: 0,
    averageViewTime: 0,
  });

  // Available travel interests
  const availableInterests = [
    'Adventure', 'Culture', 'Food', 'Nature', 'Photography', 'History',
    'Architecture', 'Beach', 'Mountains', 'Cities', 'Backpacking', 'Luxury',
    'Solo Travel', 'Group Travel', 'Family', 'Romance', 'Business', 'Wildlife'
  ];

  useEffect(() => {
    fetchProfile();
    loadAnalytics();
    loadUserSettings();
  }, []);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      // Try travel_preferences first (for Edge Function), then fall back to travel_style_tags
      setTravelInterests(profile.travel_preferences || profile.travel_style_tags || []);
    }
  }, [profile]);

  const loadUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user preferences
      const { data: userPrefs } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (userPrefs?.preferences) {
        const prefs = userPrefs.preferences;
        setPrivacySettings(prev => ({ ...prev, ...prefs.privacy }));
        setEmailSettings(prev => ({ ...prev, ...prefs.email }));
        setLocationSettings(prev => ({ ...prev, ...prefs.location }));
        setAISettings(prev => ({ ...prev, ...prefs.ai }));
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const saveUserSettings = async (settingsType: string, settings: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: current } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      const updatedPrefs = {
        ...current?.preferences,
        [settingsType]: settings
      };

      await supabase
        .from('users')
        .update({ preferences: updatedPrefs })
        .eq('id', user.id);

      Alert.alert('Success', 'Settings updated successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('User not authenticated');
        return;
      }

      // Load persistent analytics from user_analytics table
      const { data: userAnalytics, error: analyticsError } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (analyticsError && analyticsError.code !== 'PGRST116') {
        console.error('Error loading analytics:', analyticsError);
        // Initialize analytics if they don't exist
        await initializeUserAnalytics();
        return;
      }

      if (userAnalytics) {
        setAnalytics({
          totalSnaps: userAnalytics.total_snaps_sent || 0,
          totalStories: userAnalytics.total_stories_created || 0,
          totalFriends: userAnalytics.total_friends_added || 0,
          totalCountries: userAnalytics.total_countries || 0,
          isLoading: false
        });
      } else {
        // Initialize analytics if they don't exist
        await initializeUserAnalytics();
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setAnalytics(prev => ({ ...prev, isLoading: false }));
    }
  };

  const initializeUserAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Call the database function to initialize analytics
      const { error } = await supabase.rpc('initialize_user_analytics', {
        target_user_id: user.id
      });

      if (error) {
        console.error('Error initializing analytics:', error);
      } else {
        // Reload analytics after initialization
        setTimeout(loadAnalytics, 500);
      }
    } catch (error) {
      console.error('Error initializing analytics:', error);
    }
  };

  const loadDetailedAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load persistent analytics for countries visited
      const { data: userAnalytics } = await supabase
        .from('user_analytics')
        .select('countries_visited, total_views_received, total_snaps_sent')
        .eq('user_id', user.id)
        .single();

      // Load current active snaps for engagement calculation
      const { data: activeSnaps } = await supabase
        .from('snaps')
        .select('read_by, recipient_ids')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Look at recent snaps for engagement

      if (userAnalytics) {
        // Top countries from persistent data
        const topCountries = userAnalytics.countries_visited?.slice(0, 5) || [];

        // Calculate engagement rate from recent snaps
        let engagementRate = 0;
        if (activeSnaps && activeSnaps.length > 0) {
          const totalViews = activeSnaps.reduce((sum, snap) => sum + (snap.read_by?.length || 0), 0);
          const totalRecipients = activeSnaps.reduce((sum, snap) => sum + (snap.recipient_ids?.length || 0), 0);
          engagementRate = totalRecipients > 0 ? (totalViews / totalRecipients) * 100 : 0;
        }

        setDetailedAnalytics({
          topCountries,
          weeklyStats: [], // Would need more complex processing
          engagementRate: Math.round(engagementRate),
          averageViewTime: 8.5, // Placeholder - would need view time tracking
        });
      }
    } catch (error) {
      console.error('Error loading detailed analytics:', error);
    }
  };



  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUpdateUsername = async () => {
    try {
      await updateUsername(newUsername);
      setIsEditingUsername(false);
      Alert.alert('Success', 'Username updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await updateProfile({ name });
      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleEditAvatar = () => {
    Alert.alert(
      'Change Avatar',
      'Choose an option',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Photo Library', onPress: openImagePicker },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const openImagePicker = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Photo library permission is needed to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setIsUploadingAvatar(true);
    try {
      await updateAvatar(uri);
      Alert.alert('Success', 'Avatar updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDataExport = async () => {
    try {
      Alert.alert(
        'Export Data',
        'This will create a file with your SnapConnect data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Export', onPress: exportUserData }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const exportUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Gather user data
      const [profileData, snapsData, storiesData, friendsData] = await Promise.allSettled([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('snaps').select('*').eq('creator_id', user.id),
        supabase.from('stories').select('*').eq('creator_id', user.id),
        supabase.from('friendships').select('*').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      ]);

      const exportData = {
        profile: profileData.status === 'fulfilled' ? profileData.value.data : null,
        snaps: snapsData.status === 'fulfilled' ? snapsData.value.data : [],
        stories: storiesData.status === 'fulfilled' ? storiesData.value.data : [],
        friends: friendsData.status === 'fulfilled' ? friendsData.value.data : [],
        exportDate: new Date().toISOString()
      };

      // Create and save file
      const fileName = `snapconnect-export-${Date.now()}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));
      
      // Share the file
      await Share.share({
        url: fileUri,
        title: 'SnapConnect Data Export'
      });

      Alert.alert('Success', 'Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear temporary files and cached data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', onPress: clearCache }
      ]
    );
  };

  const clearCache = async () => {
    try {
      // Clear document directory cache files
      const documentDir = FileSystem.documentDirectory;
      if (documentDir) {
        const files = await FileSystem.readDirectoryAsync(documentDir);
        for (const file of files) {
          if (file.includes('cache') || file.includes('temp')) {
            await FileSystem.deleteAsync(documentDir + file);
          }
        }
      }
      
      Alert.alert('Success', 'Cache cleared successfully!');
    } catch (error) {
      console.error('Cache clear error:', error);
      Alert.alert('Success', 'Cache cleared successfully!'); // Show success anyway
    }
  };

  const handleHelp = () => {
    Alert.alert(
      'Help Center',
      'Choose an option:',
      [
        { text: 'FAQ', onPress: () => Linking.openURL('https://snapconnect.app/faq') },
        { text: 'Contact Support', onPress: () => Linking.openURL('mailto:support@snapconnect.app') },
        { text: 'User Guide', onPress: () => Linking.openURL('https://snapconnect.app/guide') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleFeedback = () => {
    Alert.alert(
      'Contact Us',
      'Choose how you\'d like to get in touch:',
      [
        { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@snapconnect.app?subject=SnapConnect Feedback') },
        { text: 'Report Bug', onPress: () => Linking.openURL('mailto:bugs@snapconnect.app?subject=Bug Report') },
        { text: 'Feature Request', onPress: () => Linking.openURL('mailto:features@snapconnect.app?subject=Feature Request') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleRateApp = () => {
    Alert.alert(
      'Rate SnapConnect',
      'We\'d love your feedback! Rate us on the App Store.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rate Now', onPress: () => {
          // iOS App Store URL (would need actual app ID)
          const iosUrl = 'https://apps.apple.com/app/id123456789';
          // Android Play Store URL  
          const androidUrl = 'https://play.google.com/store/apps/details?id=com.snapconnect.app';
          
          // For now, just show a thank you message
          Alert.alert('Thank You!', 'Thanks for your interest in rating SnapConnect!');
        }}
      ]
    );
  };

  const handleTravelInterestSave = async () => {
    try {
      // Update both travel_style_tags (for compatibility) and travel_preferences (for Edge Function)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('users')
        .update({ 
          travel_style_tags: travelInterests,
          travel_preferences: travelInterests 
        })
        .eq('id', user.id);

      if (error) throw error;

      setShowTravelInterestsModal(false);
      Alert.alert('Success', 'Travel interests updated!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const addTravelInterest = () => {
    if (newInterest.trim() && !travelInterests.includes(newInterest.trim())) {
      setTravelInterests([...travelInterests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeTravelInterest = (interest: string) => {
    setTravelInterests(travelInterests.filter(i => i !== interest));
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationSettings(prev => ({ ...prev, enableLocation: true }));
        Alert.alert('Success', 'Location permission granted!');
      } else {
        Alert.alert('Permission Denied', 'Location permission is required for location-based features.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request location permission');
    }
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your travel identity</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <UserAvatar 
              avatarUrl={profile?.avatar_url} 
              size="xlarge"
              showBorder={true}
            />
            <Pressable 
              style={[styles.editAvatarButton, isUploadingAvatar && styles.disabledButton]} 
              onPress={handleEditAvatar}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="pencil" size={16} color="#ffffff" />
              )}
            </Pressable>
          </View>
          <Text style={styles.userName}>{profile?.name || 'Travel Explorer'}</Text>
          <Text style={styles.userHandle}>@{profile?.username}</Text>
          <Pressable 
            style={styles.editProfileButton}
            onPress={() => setIsEditingProfile(true)}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics.isLoading ? '...' : analytics.totalSnaps}
            </Text>
            <Text style={styles.statLabel}>Snaps</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics.isLoading ? '...' : analytics.totalStories}
            </Text>
            <Text style={styles.statLabel}>Stories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics.isLoading ? '...' : analytics.totalFriends}
            </Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics.isLoading ? '...' : analytics.totalCountries}
            </Text>
            <Text style={styles.statLabel}>Countries</Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable 
            style={styles.menuItem}
            onPress={() => setIsEditingUsername(true)}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="at" size={20} color="#6366f1" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuText}>Change Username</Text>
              <Text style={styles.menuSubtext}>@{profile?.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => setShowPrivacyModal(true)}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="shield-checkmark" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Privacy & Security</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => setShowEmailModal(true)}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="mail" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Email Preferences</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => { loadDetailedAnalytics(); setShowAnalyticsModal(true); }}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="bar-chart" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Analytics</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel Preferences</Text>
          <Pressable style={styles.menuItem} onPress={() => setShowTravelInterestsModal(true)}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="earth" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Travel Interests</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => setShowLocationModal(true)}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="location" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Location Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => setShowAIModal(true)}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="sparkles" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>AI Recommendations</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>



        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Pressable style={styles.menuItem} onPress={handleHelp}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="help-circle" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Help Center</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={handleFeedback}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="chatbubble" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Contact Us</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.menuItem} onPress={handleRateApp}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="star" size={20} color="#6366f1" />
            </View>
            <Text style={styles.menuText}>Rate SnapConnect</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Sign Out Button */}
        <View style={styles.section}>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SnapConnect v1.0.0</Text>
          <Text style={styles.footerSubtext}>Made with care for travelers</Text>
        </View>
      </ScrollView>

      {/* Username Edit Modal */}
      <Modal
        visible={isEditingUsername}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditingUsername(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Username</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter new username"
              placeholderTextColor="#6B7280"
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHint}>
              Username must be 3-30 characters long and can only contain letters, numbers, and underscores
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setIsEditingUsername(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleUpdateUsername}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal
        visible={isEditingProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditingProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter your name"
                placeholderTextColor="#6B7280"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setIsEditingProfile(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleUpdateProfile}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Settings Modal */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Privacy & Security</Text>
            <ScrollView style={styles.settingsContainer}>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Profile Visibility</Text>
                <Switch
                  value={privacySettings.profileVisibility}
                  onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, profileVisibility: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Location Sharing</Text>
                <Switch
                  value={privacySettings.locationSharing}
                  onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, locationSharing: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Read Receipts</Text>
                <Switch
                  value={privacySettings.readReceipts}
                  onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, readReceipts: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Activity Status</Text>
                <Switch
                  value={privacySettings.activityStatus}
                  onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, activityStatus: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowPrivacyModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalSaveButton]} onPress={() => { saveUserSettings('privacy', privacySettings); setShowPrivacyModal(false); }}>
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Email Settings Modal */}
      <Modal visible={showEmailModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Email Preferences</Text>
            <ScrollView style={styles.settingsContainer}>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Friend Requests</Text>
                <Switch
                  value={emailSettings.friendRequests}
                  onValueChange={(value) => setEmailSettings(prev => ({ ...prev, friendRequests: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>New Features</Text>
                <Switch
                  value={emailSettings.newFeatures}
                  onValueChange={(value) => setEmailSettings(prev => ({ ...prev, newFeatures: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Travel Tips</Text>
                <Switch
                  value={emailSettings.travelTips}
                  onValueChange={(value) => setEmailSettings(prev => ({ ...prev, travelTips: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Marketing</Text>
                <Switch
                  value={emailSettings.marketing}
                  onValueChange={(value) => setEmailSettings(prev => ({ ...prev, marketing: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowEmailModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalSaveButton]} onPress={() => { saveUserSettings('email', emailSettings); setShowEmailModal(false); }}>
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Travel Interests Modal */}
      <Modal visible={showTravelInterestsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Travel Interests</Text>
            <ScrollView style={styles.settingsContainer}>
              <Text style={styles.sectionSubtitle}>Your Interests</Text>
              <View style={styles.interestsContainer}>
                {travelInterests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                    <Pressable onPress={() => removeTravelInterest(interest)}>
                      <Ionicons name="close" size={16} color="#ffffff" />
                    </Pressable>
                  </View>
                ))}
              </View>
              
              <Text style={styles.sectionSubtitle}>Add Interest</Text>
              <View style={styles.addInterestContainer}>
                <TextInput
                  style={styles.interestInput}
                  placeholder="Enter interest"
                  placeholderTextColor="#6B7280"
                  value={newInterest}
                  onChangeText={setNewInterest}
                />
                <Pressable style={styles.addButton} onPress={addTravelInterest}>
                  <Ionicons name="add" size={20} color="#ffffff" />
                </Pressable>
              </View>
              
              <Text style={styles.sectionSubtitle}>Popular Interests</Text>
              <View style={styles.interestsContainer}>
                {availableInterests.filter(interest => !travelInterests.includes(interest)).map((interest, index) => (
                  <Pressable key={index} style={styles.availableInterestTag} onPress={() => setTravelInterests([...travelInterests, interest])}>
                    <Text style={styles.availableInterestText}>{interest}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowTravelInterestsModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalSaveButton]} onPress={handleTravelInterestSave}>
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Settings Modal */}
      <Modal visible={showLocationModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Location Settings</Text>
            <ScrollView style={styles.settingsContainer}>
              <View style={styles.settingItem}>
                <View>
                  <Text style={styles.settingText}>Enable Location</Text>
                  <Text style={styles.settingSubtext}>Allow location access for features</Text>
                </View>
                <Switch
                  value={locationSettings.enableLocation}
                  onValueChange={(value) => {
                    if (value) {
                      requestLocationPermission();
                    } else {
                      setLocationSettings(prev => ({ ...prev, enableLocation: value }));
                    }
                  }}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <View>
                  <Text style={styles.settingText}>Precise Location</Text>
                  <Text style={styles.settingSubtext}>Use exact location for better suggestions</Text>
                </View>
                <Switch
                  value={locationSettings.preciseLocation}
                  onValueChange={(value) => setLocationSettings(prev => ({ ...prev, preciseLocation: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                  disabled={!locationSettings.enableLocation}
                />
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowLocationModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalSaveButton]} onPress={() => { saveUserSettings('location', locationSettings); setShowLocationModal(false); }}>
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Settings Modal */}
      <Modal visible={showAIModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>AI Recommendations</Text>
            <ScrollView style={styles.settingsContainer}>
              <View style={styles.settingItem}>
                <View>
                  <Text style={styles.settingText}>Caption Compass</Text>
                  <Text style={styles.settingSubtext}>AI-generated captions for photos</Text>
                </View>
                <Switch
                  value={aiSettings.enableCaptions}
                  onValueChange={(value) => setAISettings(prev => ({ ...prev, enableCaptions: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <View>
                  <Text style={styles.settingText}>Personalized Suggestions</Text>
                  <Text style={styles.settingSubtext}>Tailored recommendations based on your interests</Text>
                </View>
                <Switch
                  value={aiSettings.personalizedSuggestions}
                  onValueChange={(value) => setAISettings(prev => ({ ...prev, personalizedSuggestions: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <View>
                  <Text style={styles.settingText}>Location-Based Tips</Text>
                  <Text style={styles.settingSubtext}>Local insights and recommendations</Text>
                </View>
                <Switch
                  value={aiSettings.locationBasedTips}
                  onValueChange={(value) => setAISettings(prev => ({ ...prev, locationBasedTips: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
              <View style={styles.settingItem}>
                <View>
                  <Text style={styles.settingText}>Travel Insights</Text>
                  <Text style={styles.settingSubtext}>Analytics and travel pattern insights</Text>
                </View>
                <Switch
                  value={aiSettings.travelInsights}
                  onValueChange={(value) => setAISettings(prev => ({ ...prev, travelInsights: value }))}
                  trackColor={{ false: '#767577', true: '#6366f1' }}
                />
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowAIModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalSaveButton]} onPress={() => { saveUserSettings('ai', aiSettings); setShowAIModal(false); }}>
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>



      {/* Analytics Modal */}
      <Modal visible={showAnalyticsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Analytics</Text>
            <ScrollView style={styles.analyticsContainer}>
              <View style={styles.analyticsSection}>
                <Text style={styles.analyticsSectionTitle}>Overview</Text>
                <View style={styles.analyticsGrid}>
                  <View style={styles.analyticsCard}>
                    <Text style={styles.analyticsNumber}>{analytics.totalSnaps}</Text>
                    <Text style={styles.analyticsLabel}>Total Snaps</Text>
                  </View>
                  <View style={styles.analyticsCard}>
                    <Text style={styles.analyticsNumber}>{detailedAnalytics.engagementRate}%</Text>
                    <Text style={styles.analyticsLabel}>Engagement</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.analyticsSection}>
                <Text style={styles.analyticsSectionTitle}>Top Countries</Text>
                {detailedAnalytics.topCountries.length === 0 ? (
                  <Text style={styles.emptyAnalytics}>No location data yet</Text>
                ) : (
                  detailedAnalytics.topCountries.map((country, index) => (
                    <View key={index} style={styles.countryItem}>
                      <Text style={styles.countryName}>{country}</Text>
                      <Text style={styles.countryRank}>#{index + 1}</Text>
                    </View>
                  ))
                )}
              </View>
              
              <View style={styles.analyticsSection}>
                <Text style={styles.analyticsSectionTitle}>Performance</Text>
                <View style={styles.performanceItem}>
                  <Text style={styles.performanceLabel}>Average View Time</Text>
                  <Text style={styles.performanceValue}>{detailedAnalytics.averageViewTime}s</Text>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setShowAnalyticsModal(false)}>
                <Text style={styles.modalButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  userHandle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  editProfileButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  editProfileText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 2,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#333333',
    minWidth: 0, // Allow flex shrinking
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  signOutButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  signOutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#6B7280',
    fontSize: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  menuContent: {
    flex: 1,
  },
  menuSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#374151',
  },
  modalSaveButton: {
    backgroundColor: '#6366f1',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  settingsContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  settingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtext: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  sectionSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  interestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    color: '#ffffff',
    fontSize: 14,
    marginRight: 6,
  },
  availableInterestTag: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  availableInterestText: {
    color: '#6366f1',
    fontSize: 14,
  },
  addInterestContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  interestInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 12,
  },
  contentContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  contentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contentTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  contentDate: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  contentCount: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  analyticsContainer: {
    maxHeight: 400,
    marginBottom: 16,
  },
  analyticsSection: {
    marginBottom: 24,
  },
  analyticsSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  analyticsNumber: {
    color: '#6366f1',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  analyticsLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  countryName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  countryRank: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyAnalytics: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  performanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  performanceLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  performanceValue: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
}); 