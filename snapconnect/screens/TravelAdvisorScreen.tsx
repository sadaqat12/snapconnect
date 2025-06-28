import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function TravelAdvisorScreen() {
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
    // Scroll to bottom when messages change
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

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
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        text: "Hi! I'm your travel advisor. I can help with credit card points, flight hacks, hotel deals, and travel planning. What would you like to know?",
        isUser: false,
        timestamp: new Date(),
      }
    ]);
  };

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

  const quickQuestions = [
    "How to get the best flight deals?",
    "Best credit cards for travel points?",
    "Cheapest hotels booking strategy?",
    "Travel hacks for Europe?",
  ];

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Travel Advisor</Text>
        <Text style={styles.subtitle}>Expert advice powered by AI</Text>
        <Pressable onPress={clearChat} style={styles.clearButton}>
          <Ionicons name="refresh-outline" size={18} color="#6366f1" />
          <Text style={styles.clearText}>Clear Chat</Text>
        </Pressable>
      </View>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <View style={styles.quickQuestionsContainer}>
          <Text style={styles.quickQuestionsTitle}>Quick Questions:</Text>
          <View style={styles.quickQuestionsGrid}>
            {quickQuestions.map((question, index) => (
              <Pressable
                key={index}
                style={styles.quickQuestionButton}
                onPress={() => handleQuickQuestion(question)}
              >
                <Text style={styles.quickQuestionText}>{question}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Chat Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
      >
        {messages.map(renderMessage)}
        
        {isLoadingResponse && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.typingText}>Advisor is typing...</Text>
          </View>
        )}
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

      {/* Help Section */}
      <View style={styles.helpContainer}>
        <View style={styles.helpCard}>
          <Ionicons name="information-circle" size={16} color="#6366f1" />
          <Text style={styles.helpText}>
            Ask me anything about travel! I have knowledge about flights, hotels, credit card points, and travel hacks.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    marginBottom: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  clearText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  quickQuestionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  quickQuestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  quickQuestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickQuestionButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  quickQuestionText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  chatContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    padding: 16,
    borderRadius: 18,
  },
  userMessageText: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
  },
  aiMessageText: {
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#333333',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  typingText: {
    fontSize: 14,
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
  helpContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    color: '#6366f1',
    lineHeight: 16,
  },
}); 