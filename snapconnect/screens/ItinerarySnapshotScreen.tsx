import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '../lib/supabase';
import { SnapService } from '../lib/snapService';
import { StoryService } from '../lib/storyService';
import { 
  TripOverviewTemplate, 
  StoryFormatTemplate 
} from '../components/ItineraryTemplates';

// Story format dimensions (9:16 aspect ratio)
const STORY_WIDTH = screenWidth * 0.8;
const STORY_HEIGHT = STORY_WIDTH * (16 / 9);

interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  description: string;
  location: string;
  type: 'flight' | 'hotel' | 'activity' | 'restaurant' | 'transport';
}

interface ItineraryDay {
  date: string;
  items: ItineraryItem[];
}

export default function ItinerarySnapshotScreen() {
  const [itineraryText, setItineraryText] = useState('');
  const [parsedItinerary, setParsedItinerary] = useState<ItineraryDay[]>([]);
  const [destination, setDestination] = useState<string | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'overview' | 'story'>('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharingToStory, setIsSharingToStory] = useState(false);
  const [isCapturingForStory, setIsCapturingForStory] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  const sampleItinerary = `March 15, 2024
9:00 AM - Flight to Paris (United 123 from JFK Terminal 4)
8:30 PM - Check into Hotel Le Marais (4 Rue de Braque)

March 16, 2024
8:00 AM - Breakfast at local café
10:00 AM - Eiffel Tower visit with elevator to top
1:00 PM - Lunch at Café de Flore (traditional French bistro)
3:30 PM - Seine River cruise with audio guide
7:00 PM - Dinner at Le Comptoir du Relais
9:30 PM - Evening stroll along Champs-Élysées

March 17, 2024
9:00 AM - Metro to Louvre Museum
10:00 AM - Louvre Museum guided tour
1:00 PM - Lunch at museum café
3:00 PM - Walk through Tuileries Garden
5:00 PM - Shopping at Galeries Lafayette
8:00 PM - Dinner at L'Ami Jean (Basque cuisine)

March 18, 2024
10:00 AM - Train to Versailles Palace
11:00 AM - Palace of Versailles tour
2:00 PM - Lunch at Versailles gardens
4:00 PM - Return train to Paris
7:00 PM - Farewell dinner at Le Grand Véfour`;

  // Mock parsed itinerary for demonstration
  const mockItinerary: ItineraryDay[] = [
    {
      date: 'March 15, 2024',
      items: [
        {
          id: '1',
          time: '9:00 AM',
          title: 'Flight to Paris',
          description: 'United 123 from JFK Terminal 4',
          location: 'New York → Paris',
          type: 'flight',
        },
        {
          id: '2',
          time: '8:30 PM',
          title: 'Hotel Check-in',
          description: 'Hotel Le Marais, 4 Rue de Brague',
          location: 'Le Marais District',
          type: 'hotel',
        },
      ],
    },
    {
      date: 'March 16, 2024',
      items: [
        {
          id: '3',
          time: '8:00 AM',
          title: 'Breakfast',
          description: 'Local café near hotel',
          location: 'Le Marais District',
          type: 'restaurant',
        },
        {
          id: '4',
          time: '10:00 AM',
          title: 'Eiffel Tower Visit',
          description: 'Elevator to top with pre-booked tickets',
          location: 'Champ de Mars',
          type: 'activity',
        },
        {
          id: '5',
          time: '1:00 PM',
          title: 'Lunch at Café de Flore',
          description: 'Traditional French bistro experience',
          location: 'Saint-Germain-des-Prés',
          type: 'restaurant',
        },
        {
          id: '6',
          time: '3:30 PM',
          title: 'Seine River Cruise',
          description: '2-hour sightseeing cruise with audio guide',
          location: 'Seine River',
          type: 'activity',
        },
        {
          id: '7',
          time: '7:00 PM',
          title: 'Dinner at Le Comptoir du Relais',
          description: 'Traditional French cuisine',
          location: 'Saint-Germain-des-Prés',
          type: 'restaurant',
        },
        {
          id: '8',
          time: '9:30 PM',
          title: 'Evening Stroll',
          description: 'Walk along Champs-Élysées',
          location: 'Champs-Élysées',
          type: 'activity',
        },
      ],
    },
    {
      date: 'March 17, 2024',
      items: [
        {
          id: '9',
          time: '9:00 AM',
          title: 'Metro to Louvre',
          description: 'Take metro line 1 to Palais-Royal',
          location: 'Metro Station',
          type: 'transport',
        },
        {
          id: '10',
          time: '10:00 AM',
          title: 'Louvre Museum Tour',
          description: 'Guided tour with museum highlights',
          location: 'Louvre Museum',
          type: 'activity',
        },
        {
          id: '11',
          time: '1:00 PM',
          title: 'Museum Café Lunch',
          description: 'Light lunch at museum café',
          location: 'Louvre Museum',
          type: 'restaurant',
        },
        {
          id: '12',
          time: '3:00 PM',
          title: 'Tuileries Garden Walk',
          description: 'Relaxing walk through historic gardens',
          location: 'Tuileries Garden',
          type: 'activity',
        },
        {
          id: '13',
          time: '5:00 PM',
          title: 'Shopping at Galeries Lafayette',
          description: 'French fashion and souvenirs',
          location: 'Galeries Lafayette',
          type: 'activity',
        },
        {
          id: '14',
          time: '8:00 PM',
          title: 'Dinner at L\'Ami Jean',
          description: 'Authentic Basque cuisine',
          location: 'Rue Malar',
          type: 'restaurant',
        },
      ],
    },
    {
      date: 'March 18, 2024',
      items: [
        {
          id: '15',
          time: '10:00 AM',
          title: 'Train to Versailles',
          description: 'RER C train to Versailles Palace',
          location: 'Gare d\'Austerlitz',
          type: 'transport',
        },
        {
          id: '16',
          time: '11:00 AM',
          title: 'Palace of Versailles Tour',
          description: 'Guided tour of palace and gardens',
          location: 'Palace of Versailles',
          type: 'activity',
        },
        {
          id: '17',
          time: '2:00 PM',
          title: 'Lunch at Versailles',
          description: 'Garden restaurant with palace views',
          location: 'Versailles Gardens',
          type: 'restaurant',
        },
        {
          id: '18',
          time: '4:00 PM',
          title: 'Return Train to Paris',
          description: 'RER C back to central Paris',
          location: 'Versailles Station',
          type: 'transport',
        },
        {
          id: '19',
          time: '7:00 PM',
          title: 'Farewell Dinner',
          description: 'Michelin-starred farewell dinner',
          location: 'Le Grand Véfour',
          type: 'restaurant',
        },
      ],
    },
  ];

  const loadSampleItinerary = () => {
    setItineraryText(sampleItinerary);
  };

  const processItinerary = async () => {
    if (!itineraryText.trim()) {
      Alert.alert('Error', 'Please enter your itinerary details');
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('🔄 Processing itinerary with AI...');
      
      // Call the AI-powered itinerary parser Edge Function
      const { data, error } = await supabase.functions.invoke('itinerary-parser', {
        body: {
          itineraryText: itineraryText.trim(),
        },
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw error;
      }

      if (data.success && data.itinerary && data.itinerary.length > 0) {
        console.log('✅ Successfully parsed itinerary:', data.itinerary);
        console.log('✅ AI extracted metadata:', { destination: data.destination, year: data.year });
        setParsedItinerary(data.itinerary);
        setDestination(data.destination);
        setYear(data.year);
        const successMessage = `Your itinerary has been processed! Found ${data.itinerary.length} days with activities.`;
        const metadataInfo = [];
        if (data.destination) metadataInfo.push(`Destination: ${data.destination}`);
        if (data.year) metadataInfo.push(`Year: ${data.year}`);
        
        Alert.alert('Success', metadataInfo.length > 0 
          ? `${successMessage}\n\n${metadataInfo.join(', ')}`
          : successMessage
        );
      } else {
        console.error('Invalid response from Edge Function:', data);
        throw new Error(data.error || 'No itinerary data returned');
      }
    } catch (error) {
      console.error('Error processing itinerary:', error);
      
      // Fallback to mock data if AI processing fails
      console.log('🔄 Using fallback mock data...');
      setParsedItinerary(mockItinerary);
      setDestination('Paris'); // Set mock destination for sample data
      setYear(2024); // Set mock year for sample data (since mock data has 2024 dates)
      Alert.alert(
        'Processing Notice', 
        'AI processing encountered an issue, but we\'ve loaded a sample itinerary for you to try the visual snapshots.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSnapshot = async () => {
    if (!parsedItinerary.length) {
      Alert.alert('Error', 'Please process your itinerary first');
      return;
    }

    setIsGenerating(true);

    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera roll access is required to save the snapshot');
        setIsGenerating(false);
        return;
      }

      // Capture the view as an image
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        throw new Error('Failed to capture snapshot');
      }

      // Save to camera roll
      await MediaLibrary.saveToLibraryAsync(uri);
      
      Alert.alert(
        'Success!', 
        'Your itinerary snapshot has been saved to your camera roll!',
        [
          { text: 'OK', style: 'default' }
        ]
      );
    } catch (error) {
      console.error('Error generating snapshot:', error);
      Alert.alert('Error', 'Failed to generate snapshot. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToStory = async () => {
    if (!parsedItinerary.length) {
      Alert.alert('Error', 'Please process your itinerary first');
      return;
    }

    if (selectedTemplate !== 'story') {
      Alert.alert('Story Format Required', 'Please select the "Story Format" template to share to your story.');
      return;
    }

    setIsSharingToStory(true);

    try {
      console.log('📸 Capturing itinerary snapshot for story...');
      
      // Enable story capture mode to apply story dimensions
      setIsCapturingForStory(true);
      
      // Wait for the layout to settle with story dimensions
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture the view as an image
      const uri = await viewShotRef.current?.capture?.();
      
      // Disable story capture mode to restore flexible layout
      setIsCapturingForStory(false);
      
      if (!uri) {
        throw new Error('Failed to capture snapshot');
      }

      console.log('✅ Snapshot captured:', uri);

      // Create a snap from the captured image
      console.log('📤 Creating snap from captured image...');
      const snap = await SnapService.createSnapFromMedia(
        uri,
        'photo',
        {
          caption: '✈️ My Travel Itinerary\n\nGenerated with SnapConnect',
          includeLocation: false,
          duration: 15, // Longer duration for itinerary reading
          recipients: [], // Stories don't have direct recipients
        },
        (stage, progress) => {
          console.log(`Story upload progress: ${stage}`);
        }
      );

      console.log('✅ Snap created:', snap.id);

      // Add snap to story with retry logic
      console.log('📚 Adding snap to story...');
      let retryCount = 0;
      const maxRetries = 3;
      let story;

      while (retryCount < maxRetries) {
        try {
          story = await StoryService.addSnapToStory(snap.id!);
          console.log('✅ Story created/updated:', story.id);
          break;
        } catch (error: any) {
          retryCount++;
          console.warn(`Retry ${retryCount}/${maxRetries} for story creation:`, error);
          if (retryCount >= maxRetries) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      Alert.alert(
        'Added to Story!',
        'Your travel itinerary has been shared to your story and will be visible to friends for 24 hours.',
        [
          { text: 'View Story', style: 'default' },
          { text: 'Great!', style: 'cancel' }
        ]
      );
    } catch (error: any) {
      console.error('Error sharing to story:', error);
      Alert.alert('Error', `Failed to share to story: ${error?.message || error}. Please try again.`);
    } finally {
      setIsSharingToStory(false);
      setIsCapturingForStory(false); // Ensure it's reset
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flight': return 'airplane';
      case 'hotel': return 'bed';
      case 'activity': return 'camera';
      case 'restaurant': return 'restaurant';
      case 'transport': return 'car';
      default: return 'location';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'flight': return '#6366f1';
      case 'hotel': return '#8B5CF6';
      case 'activity': return '#10B981';
      case 'restaurant': return '#F59E0B';
      case 'transport': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderItineraryItem = (item: ItineraryItem) => (
    <View key={item.id} style={styles.itineraryItem}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
      
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <View style={[styles.typeIcon, { backgroundColor: getTypeColor(item.type) + '20' }]}>
            <Ionicons name={getTypeIcon(item.type) as any} size={16} color={getTypeColor(item.type)} />
          </View>
          <Text style={styles.itemTitle}>{item.title}</Text>
        </View>
        
        <Text style={styles.itemDescription}>{item.description}</Text>
        
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={14} color="#9CA3AF" />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>
    </View>
  );

  const renderItineraryDay = (day: ItineraryDay, index: number) => (
    <View key={index} style={styles.dayContainer}>
      <Text style={styles.dayTitle}>{day.date}</Text>
      <View style={styles.dayItems}>
        {day.items.map(renderItineraryItem)}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Itinerary Snapshot</Text>
        <Text style={styles.subtitle}>Transform your travel plans into beautiful visuals</Text>
      </View>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <View style={styles.inputHeader}>
          <Text style={styles.sectionTitle}>Enter Your Itinerary</Text>
          <Pressable style={styles.sampleButton} onPress={loadSampleItinerary}>
            <Ionicons name="document-text" size={16} color="#6366f1" />
            <Text style={styles.sampleButtonText}>Load Sample</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.textInput}
          value={itineraryText}
          onChangeText={setItineraryText}
          placeholder="Paste your travel itinerary here or try this sample:

March 15, 2024
9:00 AM - Flight to Paris (United 123 from JFK Terminal 4)
8:30 PM - Check into Hotel Le Marais (4 Rue de Braque)

March 16, 2024
8:00 AM - Breakfast at local café
10:00 AM - Eiffel Tower visit with elevator to top
1:00 PM - Lunch at Café de Flore (traditional French bistro)
3:30 PM - Seine River cruise with audio guide
7:00 PM - Dinner at Le Comptoir du Relais
9:30 PM - Evening stroll along Champs-Élysées

March 17, 2024
9:00 AM - Metro to Louvre Museum
10:00 AM - Louvre Museum guided tour
1:00 PM - Lunch at museum café
3:00 PM - Walk through Tuileries Garden
5:00 PM - Shopping at Galeries Lafayette
8:00 PM - Dinner at L'Ami Jean (Basque cuisine)

March 18, 2024
10:00 AM - Train to Versailles Palace
11:00 AM - Palace of Versailles tour
2:00 PM - Lunch at Versailles gardens
4:00 PM - Return train to Paris
7:00 PM - Farewell dinner at Le Grand Véfour"
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />
        
        <Pressable 
          style={[styles.processButton, isProcessing && styles.processButtonDisabled]}
          onPress={processItinerary}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.processButtonText}>AI Processing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="analytics" size={20} color="#ffffff" />
              <Text style={styles.processButtonText}>Process with AI</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Parsed Itinerary Display }
      {parsedItinerary.length > 0 && (
        <View style={styles.resultSection}>
          <View style={styles.resultHeader}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Your Itinerary</Text>
          </View>
          
          <View style={styles.itineraryContainer}>
            {parsedItinerary.map(renderItineraryDay)}
          </View>
        </View>
      )}*/}

      {/* Template Selection */}
      <View style={styles.templatesSection}>
        <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Choose Template Style</Text>
        <View style={styles.templatesGrid}>
          <Pressable 
            style={[
              styles.templateCard,
              selectedTemplate === 'overview' && styles.templateCardSelected
            ]}
            onPress={() => setSelectedTemplate('overview')}
          >
            <Ionicons name="map" size={32} color="#6366f1" />
            <Text style={styles.templateTitle}>Trip Overview</Text>
            <Text style={styles.templateDescription}>Perfect for sharing your full journey</Text>
            {selectedTemplate === 'overview' && (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            )}
          </Pressable>
          

          <Pressable 
            style={[
              styles.templateCard,
              selectedTemplate === 'story' && styles.templateCardSelected
            ]}
            onPress={() => setSelectedTemplate('story')}
          >
            <Ionicons name="images" size={32} color="#F59E0B" />
            <Text style={styles.templateTitle}>Story Format</Text>
            <Text style={styles.templateDescription}>Story friendly cards</Text>
            {selectedTemplate === 'story' && (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Template Preview (Hidden ViewShot) */}
      {parsedItinerary.length > 0 && (
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Preview</Text>
            <View style={styles.buttonRow}>
              <Pressable 
                style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]} 
                onPress={generateSnapshot}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="download" size={20} color="#ffffff" />
                )}
              </Pressable>
              
              {selectedTemplate === 'story' && (
                <Pressable 
                  style={[styles.storyButton, isSharingToStory && styles.storyButtonDisabled]} 
                  onPress={shareToStory}
                  disabled={isSharingToStory}
                >
                  {isSharingToStory ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="share" size={16} color="#ffffff" />
                      <Text style={styles.storyButtonText}>Share</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
          
          <ViewShot 
            ref={viewShotRef}
            options={{ 
              format: "jpg", 
              quality: 0.9,
              result: "tmpfile",
              // Remove fixed dimensions to allow flexible preview
              // The capture will scale appropriately for stories
            }}
            style={isCapturingForStory ? styles.viewShotStoryMode : styles.viewShotContainer}
          >
            {selectedTemplate === 'overview' && (
              <TripOverviewTemplate 
                itinerary={parsedItinerary} 
                templateType="overview"
                destination={destination}
                year={year}
              />
            )}
            {selectedTemplate === 'story' && (
              <StoryFormatTemplate 
                itinerary={parsedItinerary} 
                templateType="story"
                destination={destination}
                year={year}
              />
            )}
          </ViewShot>
        </View>
      )}

      
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
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 0,
  },
  sampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  sampleButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  processButtonDisabled: {
    backgroundColor: '#4B5563',
  },
  processButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 44,
    height: 36,
  },
  generateButtonDisabled: {
    backgroundColor: '#4B5563',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  storyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    height: 36,
  },
  storyButtonDisabled: {
    backgroundColor: '#4B5563',
  },
  storyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  itineraryContainer: {
    gap: 20,
  },
  dayContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  dayItems: {
    gap: 12,
  },
  itineraryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeContainer: {
    minWidth: 70,
    marginRight: 12,
  },
  timeText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  itemContent: {
    flex: 1,
    backgroundColor: '#262640',
    borderRadius: 12,
    padding: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  itemDescription: {
    fontSize: 14,
    color: '#E5E7EB',
    marginBottom: 8,
    lineHeight: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  templatesSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  templatesGrid: {
    gap: 12,
  },
  templateCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    position: 'relative',
  },
  templateCardSelected: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 8,
  },
  templateDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  previewContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
    alignItems: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  viewShotContainer: {
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#0a0a0a', // Solid background for better capture
    alignSelf: 'center',
    borderRadius: 20,
    // Remove fixed dimensions to allow flexible preview
    // The capture will scale appropriately for stories
    minHeight: 400,
    maxWidth: screenWidth * 0.9,
    padding: 16,
  },
  viewShotStoryMode: {
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#0a0a0a',
    alignSelf: 'center',
    borderRadius: 20,
    // Story-optimized dimensions for capture
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    paddingVertical: 20,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
}); 