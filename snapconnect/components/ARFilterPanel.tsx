import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ARFilter {
  id: string;
  name: string;
  type: 'sticker' | 'text' | 'filter' | 'draw';
  icon: string;
  data?: any;
}

export interface ARElement {
  id: string;
  type: 'sticker' | 'text' | 'draw';
  x: number;
  y: number;
  content: string;
  style?: any;
  rotation?: number;
  scale?: number;
}

interface ARFilterPanelProps {
  visible: boolean;
  onClose: () => void;
  onAddElement: (element: ARElement) => void;
  onApplyFilter: (filter: ARFilter) => void;
}

const TRAVEL_STICKERS = [
  { id: 'plane', emoji: '✈️', name: 'Airplane' },
  { id: 'camera', emoji: '📸', name: 'Camera' },
  { id: 'map', emoji: '🗺️', name: 'Map' },
  { id: 'luggage', emoji: '🧳', name: 'Luggage' },
  { id: 'compass', emoji: '🧭', name: 'Compass' },
  { id: 'mountain', emoji: '🏔️', name: 'Mountain' },
  { id: 'beach', emoji: '🏖️', name: 'Beach' },
  { id: 'city', emoji: '🏙️', name: 'City' },
  { id: 'sunset', emoji: '🌅', name: 'Sunrise' },
  { id: 'world', emoji: '🌍', name: 'World' },
  { id: 'ticket', emoji: '🎫', name: 'Ticket' },
  { id: 'hotel', emoji: '🏨', name: 'Hotel' },
];

const COLOR_FILTERS = [
  { id: 'none', name: 'Original', filter: null },
  { id: 'warm', name: 'Warm', filter: 'sepia(0.5) saturate(1.2)' },
  { id: 'cool', name: 'Cool', filter: 'hue-rotate(180deg) saturate(1.1)' },
  { id: 'vintage', name: 'Vintage', filter: 'sepia(0.8) contrast(1.2) brightness(0.9)' },
  { id: 'bw', name: 'B&W', filter: 'grayscale(1) contrast(1.1)' },
  { id: 'vibrant', name: 'Vibrant', filter: 'saturate(1.5) contrast(1.1)' },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FF6B6B', '#4ECDC4', '#45B7D1', 
  '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'
];

export default function ARFilterPanel({ 
  visible, 
  onClose, 
  onAddElement, 
  onApplyFilter 
}: ARFilterPanelProps) {
  const [activeTab, setActiveTab] = useState<'stickers' | 'text' | 'filters' | 'draw'>('stickers');
  const [textInput, setTextInput] = useState('');
  const [selectedTextColor, setSelectedTextColor] = useState('#FFFFFF');
  const [showTextModal, setShowTextModal] = useState(false);

  const handleAddSticker = (sticker: typeof TRAVEL_STICKERS[0]) => {
    const element: ARElement = {
      id: `sticker_${Date.now()}`,
      type: 'sticker',
      x: 0.4, // Center position (relative to screen)
      y: 0.4,
      content: sticker.emoji,
      style: { fontSize: 60 },
    };
    onAddElement(element);
  };

  const handleAddText = () => {
    if (textInput.trim()) {
      const element: ARElement = {
        id: `text_${Date.now()}`,
        type: 'text',
        x: 0.4,
        y: 0.4,
        content: textInput.trim(),
        style: { 
          color: selectedTextColor,
          fontSize: 24,
          fontWeight: 'bold',
          textAlign: 'center',
        },
      };
      onAddElement(element);
      setTextInput('');
      setShowTextModal(false);
    }
  };

  const handleApplyFilter = (filter: typeof COLOR_FILTERS[0]) => {
    const filterObj: ARFilter = {
      id: filter.id,
      name: filter.name,
      type: 'filter',
      icon: '🎨',
      data: { filter: filter.filter },
    };
    onApplyFilter(filterObj);
  };

  const renderStickers = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
      {TRAVEL_STICKERS.map((sticker) => (
        <TouchableOpacity
          key={sticker.id}
          style={styles.stickerButton}
          onPress={() => handleAddSticker(sticker)}
        >
          <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
          <Text style={styles.stickerName}>{sticker.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTextTool = () => (
    <View style={styles.textToolContainer}>
      <TouchableOpacity
        style={styles.addTextButton}
        onPress={() => setShowTextModal(true)}
      >
        <Ionicons name="text" size={24} color="#FFFFFF" />
        <Text style={styles.toolButtonText}>Add Text</Text>
      </TouchableOpacity>
      
      <Text style={styles.sectionTitle}>Text Colors</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {TEXT_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              { backgroundColor: color },
              selectedTextColor === color && styles.selectedColor
            ]}
            onPress={() => setSelectedTextColor(color)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
      {COLOR_FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter.id}
          style={styles.filterButton}
          onPress={() => handleApplyFilter(filter)}
        >
          <View style={[styles.filterPreview, { 
            backgroundColor: filter.id === 'none' ? '#666' : '#4ECDC4',
            opacity: filter.id === 'bw' ? 0.5 : 1 
          }]} />
          <Text style={styles.filterName}>{filter.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderDrawTool = () => (
    <View style={styles.drawToolContainer}>
      <TouchableOpacity
        style={styles.toolButton}
        onPress={() => {
          // This will be implemented when we add drawing functionality
          const element: ARElement = {
            id: `draw_${Date.now()}`,
            type: 'draw',
            x: 0.5,
            y: 0.5,
            content: 'drawing_path', // This would contain actual drawing data
          };
          onAddElement(element);
        }}
      >
        <Ionicons name="brush" size={24} color="#FFFFFF" />
        <Text style={styles.toolButtonText}>Start Drawing</Text>
      </TouchableOpacity>
      <Text style={styles.comingSoon}>🚧 Drawing tool coming soon!</Text>
    </View>
  );

  const renderTextModal = () => (
    <Modal
      visible={showTextModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowTextModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.textModalContainer}>
          <Text style={styles.modalTitle}>Add Text</Text>
          
          <TextInput
            style={[styles.textInput, { color: selectedTextColor }]}
            placeholder="Enter your text..."
            placeholderTextColor="#666"
            value={textInput}
            onChangeText={setTextInput}
            multiline
            autoFocus
          />
          
          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowTextModal(false);
                setTextInput('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            
            <Pressable
              style={[styles.modalButton, styles.addButton]}
              onPress={handleAddText}
            >
              <Text style={styles.addButtonText}>Add Text</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['stickers', 'text', 'filters', 'draw'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons 
              name={
                tab === 'stickers' ? 'happy-outline' :
                tab === 'text' ? 'text' :
                tab === 'filters' ? 'color-palette-outline' :
                'brush-outline'
              } 
              size={20} 
              color={activeTab === tab ? '#6366f1' : '#FFFFFF'} 
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'stickers' && renderStickers()}
        {activeTab === 'text' && renderTextTool()}
        {activeTab === 'filters' && renderFilters()}
        {activeTab === 'draw' && renderDrawTool()}
      </View>

      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {renderTextModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  tabText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
  },
  activeTabText: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    minHeight: 120,
  },
  horizontalScroll: {
    paddingVertical: 10,
  },
  stickerButton: {
    alignItems: 'center',
    marginRight: 20,
    padding: 10,
  },
  stickerEmoji: {
    fontSize: 40,
    marginBottom: 5,
  },
  stickerName: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  textToolContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  addTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
  },
  toolButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  filterButton: {
    alignItems: 'center',
    marginRight: 20,
    padding: 10,
  },
  filterPreview: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginBottom: 5,
  },
  filterName: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  drawToolContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  comingSoon: {
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textModalContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  addButton: {
    backgroundColor: '#6366f1',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  addButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
}); 