import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

interface TemplateProps {
  itinerary: ItineraryDay[];
  templateType: 'overview' | 'daily' | 'story';
  destination?: string;
  year?: number;
}

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

// Trip Overview Template - Detailed day-by-day view
export const TripOverviewTemplate: React.FC<TemplateProps> = ({ itinerary }) => {
  const renderItineraryItem = (item: ItineraryItem) => (
    <View key={item.id} style={styles.dailyItem}>
      <Text style={styles.dailyTime}>{item.time || 'TBD'}</Text>
      <View style={styles.dailyContent}>
        <View style={styles.dailyItemHeader}>
          <Ionicons 
            name={getTypeIcon(item.type) as any} 
            size={14} 
            color={getTypeColor(item.type)} 
          />
          <Text style={styles.dailyItemTitle}>{item.title}</Text>
        </View>
        <Text style={styles.dailyLocation}>{item.location}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.overviewContainer}>
      {/* Header */}
      <View style={styles.overviewHeader}>
        <Text style={styles.overviewTitle}>My Travel Itinerary</Text>
        <Text style={styles.overviewDates}>
          {itinerary.length} {itinerary.length === 1 ? 'Day' : 'Days'} • {itinerary.flatMap(d => d.items).length} Activities
        </Text>
      </View>

      {/* Days */}
      {itinerary.map((day, index) => (
        <View key={index} style={styles.daySection}>
          <Text style={styles.dayTitle}>{day.date}</Text>
          {day.items.map(renderItineraryItem)}
        </View>
      ))}

      {/* Footer */}
      <View style={styles.footerBrand}>
        <Text style={styles.brandText}>Created with SnapConnect</Text>
      </View>
    </View>
  );
};



// Story Format Template - Compact stats and highlights view
export const StoryFormatTemplate: React.FC<TemplateProps> = ({ itinerary, destination, year }) => {
  const allItems = itinerary.flatMap(day => day.items);
  const startDate = itinerary[0]?.date;
  const endDate = itinerary[itinerary.length - 1]?.date;

  // Use AI-provided destination and year, with fallbacks
  const finalDestination = destination || 'Travel';
  const dynamicTitle = year 
    ? `My ${finalDestination} Trip - ${year}`
    : `My ${finalDestination} Trip`;

  // Log template dimensions for debugging
  const templateWidth = Math.min(screenWidth * 0.6, 240);
  const templateHeight = Math.min(screenHeight * 0.45, 360);
  console.log('Story template dimensions (SMALLER):', { templateWidth, templateHeight, screenWidth, screenHeight });

  return (
    <View style={styles.storyFormatContainer}>
      {/* Header */}
      <View style={[styles.overviewHeader, { marginBottom: 10 }]}>
        <Text style={[styles.overviewTitle, { fontSize: 16 }]} numberOfLines={1}>{dynamicTitle}</Text>
        <Text style={[styles.overviewDates, { fontSize: 10 }]}>
          {startDate} {endDate !== startDate ? `- ${endDate}` : ''}
        </Text>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { marginBottom: 12, paddingVertical: 10 }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { fontSize: 16 }]}>{itinerary.length}</Text>
          <Text style={[styles.statLabel, { fontSize: 8 }]}>Days</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { fontSize: 16 }]}>{allItems.length}</Text>
          <Text style={[styles.statLabel, { fontSize: 8 }]}>Activities</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { fontSize: 16 }]}>
            {allItems.filter(item => item.type === 'restaurant').length}
          </Text>
          <Text style={[styles.statLabel, { fontSize: 8 }]}>Dining</Text>
        </View>
      </View>

      {/* Highlights */}
      <View style={[styles.highlightsSection, { marginBottom: 10 }]}>
        <Text style={[styles.highlightsTitle, { fontSize: 14, marginBottom: 6 }]}>Trip Highlights</Text>
        {allItems.slice(0, 4).map((item, index) => (
          <View key={item.id} style={[styles.highlightItem, { marginBottom: 6 }]}>
            <View style={[styles.highlightIcon, { backgroundColor: getTypeColor(item.type) + '20', width: 24, height: 24, borderRadius: 12 }]}>
              <Ionicons name={getTypeIcon(item.type) as any} size={12} color={getTypeColor(item.type)} />
            </View>
            <View style={styles.highlightContent}>
              <Text style={[styles.highlightTitle, { fontSize: 11 }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.highlightLocation, { fontSize: 9 }]} numberOfLines={1}>{item.location}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footerBrand}>
        <Text style={styles.brandText}>Created with SnapConnect</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Overview Template Styles
  overviewContainer: {
    width: 400,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
  },
  storyFormatContainer: {
    width: Math.min(screenWidth * 0.6, 240), // Much smaller: 60% of screen width, max 240px
    height: Math.min(screenHeight * 0.45, 360), // Smaller height: 45% of screen height, max 360px
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 10,
  },
  overviewHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  overviewDates: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  highlightsSection: {
    marginBottom: 20,
  },
  highlightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  highlightContent: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  highlightLocation: {
    fontSize: 12,
    color: '#6B7280',
  },


  daySection: {
    marginBottom: 20,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dailyItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dailyTime: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    minWidth: 60,
    marginRight: 12,
  },
  dailyContent: {
    flex: 1,
  },
  dailyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dailyItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 6,
  },
  dailyLocation: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Story Template Styles
  storyContainer: {
    width: 300,
    height: 533, // Instagram story aspect ratio
    borderRadius: 16,
    overflow: 'hidden',
  },
  storyBackground: {
    flex: 1,
    backgroundColor: '#1e40af', // Deeper blue for travel theme
    padding: 20,
    justifyContent: 'space-between',
    position: 'relative',
  },
  storyBackgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 64, 175, 0.85)', // Semi-transparent overlay
  },
  cityWatermark: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 0,
  },
  cityWatermarkText: {
    fontSize: 48,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.1)',
    letterSpacing: 4,
    transform: [{ rotate: '-15deg' }],
  },
  storyHeader: {
    alignItems: 'center',
    marginTop: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  storyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  storyDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  storySubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    zIndex: 10,
    paddingVertical: 20,
  },
  storyItem: {
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  storyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storyTextContent: {
    flex: 1,
  },
  storyItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  storyItemTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  storyItemLocation: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  storyMore: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  storyMoreText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontStyle: 'italic',
  },
  storyCTA: {
    alignItems: 'center',
    paddingVertical: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    marginHorizontal: -8,
  },
  storyCTAText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  storyFooter: {
    alignItems: 'center',
    zIndex: 10,
  },
  storyBrand: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // Shared Styles
  footerBrand: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  brandText: {
    fontSize: 12,
    color: '#6B7280',
  },
}); 