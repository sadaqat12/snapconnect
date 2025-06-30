import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet, Modal, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';

type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: email.trim().toLowerCase(), 
        password 
      });
      
      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const DemoGuideModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showDemoGuide}
      onRequestClose={() => setShowDemoGuide(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Welcome to SnapConnect! 🚀</Text>
            <Pressable 
              onPress={() => setShowDemoGuide(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSubtitle}>Your AI-Powered Travel Social Media Platform</Text>
            
            <View style={styles.featureSection}>
              <Text style={styles.sectionTitle}>📸 Core Social Features</Text>
              <Text style={styles.featureText}>• Send ephemeral snaps that disappear after viewing</Text>
              <Text style={styles.featureText}>• Create and share travel stories with friends</Text>
              <Text style={styles.featureText}>• AR filters and travel-themed effects</Text>
              <Text style={styles.featureText}>• Real-time messaging and group chats</Text>
            </View>

            <View style={styles.featureSection}>
              <Text style={styles.sectionTitle}>🤖 AI Travel Companion</Text>
              <Text style={styles.featureText}>• Caption Compass: AI generates perfect captions for your travel photos</Text>
              <Text style={styles.featureText}>• Travel Advisor: Chat with AI for expert travel advice, flight hacks, and hotel deals</Text>
              <Text style={styles.featureText}>• Local Insights: Discover hidden gems and personalized recommendations</Text>
              <Text style={styles.featureText}>• Culture & Cuisine Coach: Get cultural tips and food recommendations from photos</Text>
            </View>

            <View style={styles.featureSection}>
              <Text style={styles.sectionTitle}>✨ Smart Features</Text>
              <Text style={styles.featureText}>• Story Snippet Generator: Transform your stories into travel blog narratives</Text>
              <Text style={styles.featureText}>• Itinerary Snapshots: Turn travel plans into shareable infographics</Text>
              <Text style={styles.featureText}>• Location-based recommendations with GPS integration</Text>
              <Text style={styles.featureText}>• Personalized content based on your travel preferences</Text>
            </View>

            <View style={styles.featureSection}>
              <Text style={styles.sectionTitle}>🎯 How It Works</Text>
              <Text style={styles.featureText}>1. Sign up and set your travel preferences</Text>
              <Text style={styles.featureText}>2. Connect with friends and start sharing travel moments</Text>
              <Text style={styles.featureText}>3. Use AI features to enhance your content and discover new places</Text>
              <Text style={styles.featureText}>4. Explore the Discover page for travel insights and advice</Text>
            </View>

            <Pressable 
              onPress={() => setShowDemoGuide(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Get Started!</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>SnapConnect</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              placeholder="Enter your password"
              placeholderTextColor="#6B7280"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              editable={!loading}
            />
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </Pressable>
        </View>

        {/* Demo Guide Button */}
        <View style={styles.demoGuideContainer}>
          <Pressable 
            onPress={() => setShowDemoGuide(true)}
            style={styles.demoGuideButton}
          >
            <Text style={styles.demoGuideText}>📱 Demo Guide</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text style={styles.footerLink}>Sign Up</Text>
            </Text>
          </Pressable>
        </View>
      </View>

      <DemoGuideModal />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  logo: {
    fontSize: 42,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 16,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#4B5563',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 18,
  },
  demoGuideContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  demoGuideButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  demoGuideText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 16,
  },
  footerLink: {
    color: '#6366f1',
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalScroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 24,
    textAlign: 'center',
  },
  featureSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 8,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 18,
  },
}); 