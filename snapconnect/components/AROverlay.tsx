import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { ARElement } from './ARFilterPanel';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AROverlayProps {
  elements: ARElement[];
  onUpdateElement: (id: string, updates: Partial<ARElement>) => void;
  onDeleteElement: (id: string) => void;
  activeFilter?: { filter: string | null };
}

interface DraggableElementProps {
  element: ARElement;
  onUpdate: (updates: Partial<ARElement>) => void;
  onDelete: () => void;
}

const DraggableElement: React.FC<DraggableElementProps> = ({ 
  element, 
  onUpdate, 
  onDelete 
}) => {
  const translateX = useSharedValue(element.x * screenWidth);
  const translateY = useSharedValue(element.y * screenHeight);
  const scale = useSharedValue(element.scale || 1);
  const rotation = useSharedValue(element.rotation || 0);
  const [isSelected, setIsSelected] = useState(false);

  // Double tap gesture for deletion
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(onDelete)();
    });

  // Pan gesture for moving elements
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX + element.x * screenWidth;
      translateY.value = event.translationY + element.y * screenHeight;
    })
    .onEnd((event) => {
      const newX = translateX.value / screenWidth;
      const newY = translateY.value / screenHeight;
      
      // Keep elements within bounds
      const boundedX = Math.max(0.05, Math.min(0.95, newX));
      const boundedY = Math.max(0.1, Math.min(0.9, newY));
      
      runOnJS(onUpdate)({ x: boundedX, y: boundedY });
    });

  // Pinch gesture for scaling
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(0.5, Math.min(3, event.scale * (element.scale || 1)));
    })
    .onEnd(() => {
      runOnJS(onUpdate)({ scale: scale.value });
    });

  // Rotation gesture
  const rotationGesture = Gesture.Rotation()
    .onUpdate((event) => {
      rotation.value = event.rotation + (element.rotation || 0);
    })
    .onEnd(() => {
      runOnJS(onUpdate)({ rotation: rotation.value });
    });

  // Combined gesture with double tap
  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(
      panGesture,
      Gesture.Simultaneous(pinchGesture, rotationGesture)
    )
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}rad` },
      ],
    };
  });

  const handleLongPress = () => {
    setIsSelected(!isSelected);
  };

  const handleDoublePress = () => {
    onDelete();
  };

  const renderContent = () => {
    switch (element.type) {
      case 'sticker':
        return (
          <Text style={[styles.stickerContent, element.style]}>
            {element.content}
          </Text>
        );
      case 'text':
        return (
          <Text style={[styles.textContent, element.style]}>
            {element.content}
          </Text>
        );
      case 'draw':
        // Drawing implementation would go here
        return (
          <View style={styles.drawContent}>
            <Text style={styles.drawPlaceholder}>🎨</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View 
        style={[
          styles.draggableElement,
          animatedStyle,
          isSelected && styles.selectedElement
        ]}
        onTouchStart={() => setIsSelected(true)}
        onTouchEnd={() => setTimeout(() => setIsSelected(false), 2000)}
      >
        {renderContent()}
        
        {/* Selection indicators */}
        {isSelected && (
          <>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

export default function AROverlay({ 
  elements, 
  onUpdateElement, 
  onDeleteElement, 
  activeFilter 
}: AROverlayProps) {
  const overlayStyle = useAnimatedStyle(() => {
    if (activeFilter?.filter) {
      return {
        // Note: CSS filters don't work directly in React Native
        // For now, we'll use opacity/tint effects
        opacity: activeFilter.filter.includes('grayscale') ? 0.8 : 1,
      };
    }
    return {};
  });

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="box-none">
      {elements.map((element) => (
        <DraggableElement
          key={element.id}
          element={element}
          onUpdate={(updates) => onUpdateElement(element.id, updates)}
          onDelete={() => onDeleteElement(element.id)}
        />
      ))}
      
      {/* Filter overlay for visual effects */}
      {activeFilter?.filter && (
        <View style={[styles.filterOverlay, getFilterStyle(activeFilter.filter)]} />
      )}
      
      {/* Instructions */}
      {elements.length === 0 && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Tap the filters button to add stickers, text, or effects! ✨
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// Helper function to convert CSS-like filters to React Native styles
const getFilterStyle = (filter: string | null) => {
  if (!filter) return {};

  const styles: any = {};
  
  if (filter.includes('grayscale')) {
    styles.backgroundColor = 'rgba(0,0,0,0.1)';
  }
  
  if (filter.includes('sepia')) {
    styles.backgroundColor = 'rgba(255,223,186,0.2)';
  }
  
  if (filter.includes('hue-rotate(180deg)')) {
    styles.backgroundColor = 'rgba(0,100,200,0.15)';
  }
  
  return styles;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  draggableElement: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  selectedElement: {
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  stickerContent: {
    fontSize: 60,
    textAlign: 'center',
  },
  textContent: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  drawContent: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawPlaceholder: {
    fontSize: 30,
  },
  corner: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  topLeft: {
    top: -4,
    left: -4,
  },
  topRight: {
    top: -4,
    right: -4,
  },
  bottomLeft: {
    bottom: -4,
    left: -4,
  },
  bottomRight: {
    bottom: -4,
    right: -4,
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
    zIndex: 5,
  },
  instructionsContainer: {
    position: 'absolute',
    top: '45%',
    left: 20,
    right: 20,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  instructionsText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
}); 