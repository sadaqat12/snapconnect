import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';

// Import polyfills - temporarily disabled for debugging
// import './polyfills/cssInteropHack';

// Import Supabase client
import { supabase } from './lib/supabase';

// Import screens
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import CameraScreen from './screens/CameraScreen';
import FriendsScreen from './screens/FriendsScreen';
import ChatScreen from './screens/ChatScreen';
import StoriesScreen from './screens/StoriesScreen';
import ProfileScreen from './screens/ProfileScreen';

// Navigation types
export type MainTabParamList = {
  Camera: undefined;
  Friends: undefined;
  Stories: undefined;
  Profile: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  Chat: {
    conversationId: string;
    conversationName: string;
    participants: string[];
    isGroup: boolean;
  };
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

// Navigators
const MainTabs = createBottomTabNavigator<MainTabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();

// Loading screen component
function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 48, fontWeight: '700', color: '#ffffff', marginBottom: 24 }}>SnapConnect</Text>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={{ color: '#9CA3AF', marginTop: 20, fontSize: 18 }}>Loading your adventure...</Text>
    </View>
  );
}

// Auth stack navigator
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

// Friends stack navigator to handle chat navigation
function FriendsStackNavigator() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatList" component={FriendsScreen} />
      <ChatStack.Screen name="Chat" component={ChatScreen} />
    </ChatStack.Navigator>
  );
}

// Main tabs navigator with professional icons
function MainTabsNavigator() {
  return (
    <MainTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#333333',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          
          if (route.name === 'Camera') {
            iconName = focused ? 'camera' : 'camera-outline';
          } else if (route.name === 'Friends') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Stories') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <Ionicons name={iconName} size={size || 24} color={color} />;
        },
      })}
    >
      <MainTabs.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{ tabBarLabel: 'Camera' }}
      />
      <MainTabs.Screen 
        name="Friends" 
        component={FriendsStackNavigator}
        options={{ tabBarLabel: 'Friends' }}
      />
      <MainTabs.Screen 
        name="Stories" 
        component={StoriesScreen}
        options={{ tabBarLabel: 'Stories' }}
      />
      <MainTabs.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </MainTabs.Navigator>
  );
}

// Main App component
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error.message);
        } else if (isMounted) {
          setSession(session);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isMounted) {
          setSession(session);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {session ? <MainTabsNavigator /> : <AuthStackNavigator />}
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
