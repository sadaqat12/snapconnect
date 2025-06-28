import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock parsed itinerary for demonstration
  const mockItinerary: ItineraryDay[] = [
    {
      date: 'March 15, 2024',
      items: [
        {
          id: '1',
          time: '9:00 AM',
          title: 'Flight to Paris',
          description: 'Departure from JFK Terminal 4',
          location: 'New York → Paris',
          type: 'flight',
        },
        {
          id: '2',
          time: '8:30 PM',
          title: 'Hotel Check-in',
          description: 'Hotel Le Marais, Room 304',
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
          time: '10:00 AM',
          title: 'Eiffel Tower Visit',
          description: 'Pre-booked tickets for elevator to top',
          location: 'Champ de Mars',
          type: 'activity',
        },
        {
          id: '4',
          time: '1:00 PM',
          title: 'Lunch at Café de Flore',
          description: 'Traditional French bistro experience',
          location: 'Saint-Germain-des-Prés',
          type: 'restaurant',
        },
        {
          id: '5',
          time: '3:00 PM',
          title: 'Seine River Cruise',
          description: '2-hour sightseeing cruise with audio guide',
          location: 'Seine River',
          type: 'activity',
        },
      ],
    },
  ];

  const processItinerary = () => {
    if (!itineraryText.trim()) {
      Alert.alert('Error', 'Please enter your itinerary details');
      return;
    }

    setIsProcessing(true);
    
    // Simulate AI processing
    setTimeout(() => {
      setParsedItinerary(mockItinerary);
      setIsProcessing(false);
      Alert.alert('Success', 'Your itinerary has been processed! You can now generate a visual snapshot.');
    }, 2000);
  };

  const generateSnapshot = () => {
    Alert.alert(
      'Feature Coming Soon',
      'The visual snapshot generation feature will be available in the next update. It will create beautiful, shareable graphics of your itinerary.'
    );
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
        <Text style={styles.sectionTitle}>Enter Your Itinerary</Text>
        <TextInput
          style={styles.textInput}
          value={itineraryText}
          onChangeText={setItineraryText}
          placeholder="Paste your travel itinerary here... 

Example:
March 15 - Flight to Paris at 9:00 AM from JFK
8:30 PM - Check into Hotel Le Marais

March 16 - 10:00 AM Eiffel Tower visit
1:00 PM Lunch at Café de Flore..."
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
              <Text style={styles.processButtonText}>Processing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="analytics" size={20} color="#ffffff" />
              <Text style={styles.processButtonText}>Process Itinerary</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Parsed Itinerary Display */}
      {parsedItinerary.length > 0 && (
        <View style={styles.resultSection}>
          <View style={styles.resultHeader}>
            <Text style={styles.sectionTitle}>Your Itinerary</Text>
            <Pressable style={styles.generateButton} onPress={generateSnapshot}>
              <Ionicons name="image" size={18} color="#ffffff" />
              <Text style={styles.generateButtonText}>Generate Visual</Text>
            </Pressable>
          </View>
          
          <View style={styles.itineraryContainer}>
            {parsedItinerary.map(renderItineraryDay)}
          </View>
        </View>
      )}

      {/* Template Examples */}
      <View style={styles.templatesSection}>
        <Text style={styles.sectionTitle}>Example Templates</Text>
        <View style={styles.templatesGrid}>
          <Pressable style={styles.templateCard}>
            <Ionicons name="map" size={32} color="#6366f1" />
            <Text style={styles.templateTitle}>Trip Overview</Text>
            <Text style={styles.templateDescription}>Perfect for sharing your full journey</Text>
          </Pressable>
          
          <Pressable style={styles.templateCard}>
            <Ionicons name="calendar" size={32} color="#10B981" />
            <Text style={styles.templateTitle}>Daily Schedule</Text>
            <Text style={styles.templateDescription}>Detailed day-by-day breakdown</Text>
          </Pressable>
          
          <Pressable style={styles.templateCard}>
            <Ionicons name="images" size={32} color="#F59E0B" />
            <Text style={styles.templateTitle}>Story Format</Text>
            <Text style={styles.templateDescription}>Instagram-friendly story cards</Text>
          </Pressable>
        </View>
      </View>

      {/* Coming Soon Notice */}
      <View style={styles.comingSoonContainer}>
        <View style={styles.comingSoonCard}>
          <Ionicons name="construct" size={32} color="#EF4444" />
          <Text style={styles.comingSoonTitle}>Feature In Development!</Text>
          <Text style={styles.comingSoonText}>
            This feature will use AI to parse your travel plans and generate beautiful, shareable visual snapshots for your social media and trip planning.
          </Text>
        </View>
      </View>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
  comingSoonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  comingSoonCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 12,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 