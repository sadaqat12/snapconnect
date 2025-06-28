import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

interface LocationInsight {
  id: string;
  name: string;
  category: string;
  description: string;
  distance: string;
  rating: number;
  insider_tip?: string;
  photo_worthy: boolean;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function DiscoverScreen() {
  // Location insights state
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [insights, setInsights] = useState<LocationInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [locationName, setLocationName] = useState<string>('');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: "Hi! I'm your travel advisor. I can help with credit card points, flight hacks, hotel deals, and travel planning. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is needed for local insights');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      // Reverse geocode to get location name
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      
      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const locationString = `${address.city || address.subregion}, ${address.region}`;
        setLocationName(locationString);
      }

      loadLocalInsights(currentLocation);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your location');
    }
  };

  const loadLocalInsights = async (userLocation: Location.LocationObject) => {
    setIsLoadingInsights(true);
    try {
      console.log('Loading local insights for location:', userLocation.coords);
      
      // Call the RAG-powered local-insights Edge Function
      const { data, error } = await supabase.functions.invoke('local-insights-rag', {
        body: {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
          locationName: locationName,
        },
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw error;
      }

      if (data.success && data.insights) {
        console.log('Received insights:', data.insights);
        setInsights(data.insights);
      } else {
        console.error('Invalid response from Edge Function:', data);
        throw new Error(data.error || 'Invalid response from server');
      }
    } catch (error) {
      console.error('Error loading insights:', error);
      
      // Fallback to mock data if Edge Function fails
      const fallbackInsights: LocationInsight[] = [
        {
          id: 'fallback-1',
          name: 'Local Coffee Shop',
          category: 'cafe',
          description: 'Great place to grab coffee and work',
          distance: '0.3 miles',
          rating: 4.5,
          insider_tip: 'Try their specialty drinks',
          photo_worthy: true,
        },
        {
          id: 'fallback-2',
          name: 'Nearby Park',
          category: 'nature',
          description: 'Perfect for a peaceful walk',
          distance: '0.5 miles',
          rating: 4.6,
          photo_worthy: true,
        },
        {
          id: 'fallback-3',
          name: 'Local Restaurant',
          category: 'restaurant',
          description: 'Popular spot with great reviews',
          distance: '0.4 miles',
          rating: 4.7,
          photo_worthy: false,
        },
        {
          id: 'fallback-4',
          name: 'Shopping Area',
          category: 'shopping',
          description: 'Browse local shops and boutiques',
          distance: '0.6 miles',
          rating: 4.4,
          photo_worthy: false,
        },
      ];
      
      setInsights(fallbackInsights);
      Alert.alert('Notice', 'Using offline recommendations. Check your internet connection for AI-powered insights.');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText.trim();
    setInputText('');
    setIsLoadingResponse(true);

    try {
      console.log('Sending message to travel advisor:', messageText);
      
      // Prepare conversation history for context
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.text
      }));

      // Call the RAG-enhanced travel-advisor Edge Function
      const { data, error } = await supabase.functions.invoke('travel-advisor-rag', {
        body: {
          message: messageText,
          conversation_history: conversationHistory,
        },
      });

      if (error) {
        console.error('Travel advisor error:', error);
        throw error;
      }

      let responseText = '';
      if (data.success && data.response) {
        responseText = data.response;
        
        // Show knowledge base usage if available
        if (data.knowledge_base_results > 0) {
          responseText += `\n\n📚 *Enhanced with ${data.knowledge_base_results} sources from my travel knowledge base*`;
        }
        
        console.log('Received RAG travel advice:', responseText);
        console.log('Knowledge base results:', data.knowledge_base_results);
      } else {
        console.error('Invalid response from RAG travel advisor:', data);
        responseText = data.response || "I'm having trouble accessing my knowledge base right now, but here's a quick tip: Always compare prices across multiple booking sites! 💡";
      }

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback response
      const fallbackResponses = [
        "I'm having connection issues, but here's a quick tip: Use incognito mode when searching for flights to avoid price tracking! 🕵️✈️",
        "Sorry, I'm offline right now! But remember: Tuesday-Thursday flights are usually cheaper than weekend flights! 💰",
        "Connection error! Quick tip while I'm down: Pack light to avoid baggage fees - roll your clothes instead of folding! 🎒",
        "I'm having trouble connecting, but here's some advice: Download offline maps before traveling to save on data charges! 📱🗺️",
      ];
      
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsLoadingResponse(false);
    }

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cafe': return '☕';
      case 'viewpoint': return '🌅';
      case 'art': return '🎨';
      case 'food': return '🍽️';
      case 'restaurant': return '🍜';
      case 'attraction': return '🏛️';
      default: return '📍';
    }
  };

  const renderInsightCard = (insight: LocationInsight) => (
    <Pressable key={insight.id} style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Text style={styles.categoryIcon}>{getCategoryIcon(insight.category)}</Text>
        <View style={styles.insightInfo}>
          <Text style={styles.insightName}>{insight.name}</Text>
          <Text style={styles.insightDescription}>{insight.description}</Text>
        </View>
        <View style={styles.insightMeta}>
          <Text style={styles.distance}>{insight.distance}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.ratingText}>{insight.rating}</Text>
          </View>
        </View>
      </View>
      
      {insight.insider_tip && (
        <View style={styles.insiderTip}>
          <Ionicons name="bulb" size={14} color="#6366f1" />
          <Text style={styles.tipText}>{insight.insider_tip}</Text>
        </View>
      )}
      
      {insight.photo_worthy && (
        <View style={styles.photoWorthy}>
          <Ionicons name="camera" size={14} color="#10B981" />
          <Text style={styles.photoWorthyText}>Photo-worthy spot</Text>
        </View>
      )}
    </Pressable>
  );

  const renderMessage = (message: ChatMessage) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text style={[
        styles.messageText,
        message.isUser ? styles.userMessageText : styles.aiMessageText,
      ]}>
        {message.text}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingInsights}
            onRefresh={getCurrentLocation}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>Your AI travel companion</Text>
        </View>

        {/* Location Insights Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>
              {locationName ? `Near ${locationName}` : 'Local Insights'}
            </Text>
            <Pressable onPress={getCurrentLocation} style={styles.refreshButton}>
              <Ionicons name="refresh" size={18} color="#6366f1" />
            </Pressable>
          </View>

          {isLoadingInsights ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Finding local gems...</Text>
            </View>
          ) : (
            <View style={styles.insightsContainer}>
              {insights.map(renderInsightCard)}
            </View>
          )}
        </View>

        {/* Travel Advisor Chat Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubbles" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Travel Advisor</Text>
          </View>

          <View style={styles.chatContainer}>
            {messages.map(renderMessage)}
            
            {isLoadingResponse && (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.typingText}>Advisor is typing...</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Chat Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about flights, hotels, points, travel hacks..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isLoadingResponse}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={inputText.trim() ? "#ffffff" : "#9CA3AF"} 
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
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
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  insightInfo: {
    flex: 1,
  },
  insightName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  insightMeta: {
    alignItems: 'flex-end',
  },
  distance: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  insiderTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 6,
  },
  tipText: {
    fontSize: 12,
    color: '#6366f1',
    flex: 1,
  },
  photoWorthy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoWorthyText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  chatContainer: {
    minHeight: 300,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    borderRadius: 12,
  },
  userMessageText: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
  },
  aiMessageText: {
    backgroundColor: '#374151',
    color: '#ffffff',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
}); 