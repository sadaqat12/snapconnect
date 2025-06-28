import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UserAvatarProps {
  avatarUrl?: string | null;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  style?: ViewStyle;
  showBorder?: boolean;
}

const SIZES = {
  small: 32,
  medium: 48,
  large: 64,
  xlarge: 96,
};

const ICON_SIZES = {
  small: 16,
  medium: 24,
  large: 32,
  xlarge: 48,
};

export default function UserAvatar({ 
  avatarUrl, 
  size = 'medium', 
  style,
  showBorder = false 
}: UserAvatarProps) {
  const avatarSize = SIZES[size];
  const iconSize = ICON_SIZES[size];

  const containerStyle = [
    styles.container,
    {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
    },
    showBorder && styles.border,
    style,
  ];

  if (avatarUrl) {
    return (
      <View style={containerStyle}>
        <Image 
          source={{ uri: avatarUrl }} 
          style={[
            styles.image,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            }
          ]}
          onError={(error) => {
            console.warn('Failed to load avatar:', error);
          }}
        />
      </View>
    );
  }

  // Default placeholder
  return (
    <View style={[containerStyle, styles.placeholder]}>
      <Ionicons name="person" size={iconSize} color="#9CA3AF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  border: {
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  image: {
    backgroundColor: '#f3f4f6',
  },
  placeholder: {
    backgroundColor: '#f3f4f6',
  },
}); 