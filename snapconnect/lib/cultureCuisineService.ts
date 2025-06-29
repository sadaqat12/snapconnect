import { supabase } from './supabase';
import * as Location from 'expo-location';

// Interface matching the Edge Function types
export interface CultureCuisineRequest {
  imageUrl?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
    country?: string;
    city?: string;
  };
  analysisType?: 'culture' | 'cuisine' | 'both';
  userPreferences?: {
    dietary_restrictions?: string[];
    cultural_interests?: string[];
    spice_tolerance?: number;
  };
}

export interface CultureTip {
  id: string;
  category: 'etiquette' | 'customs' | 'language' | 'dining' | 'traditions';
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  context?: string;
}

export interface CuisineDish {
  id: string;
  name: string;
  description: string;
  category: 'main' | 'appetizer' | 'dessert' | 'drink' | 'snack';
  spiceLevel: number;
  mustTry: boolean;
  price: string;
  ingredients?: string[];
  allergens?: string[];
  culturalSignificance?: string;
}

export interface CultureCuisineResponse {
  success: boolean;
  error?: string;
  analysisType: string;
  location?: string;
  cultureTips?: CultureTip[];
  cuisineDishes?: CuisineDish[];
  imageAnalysis?: string;
  recommendations?: string;
}

export class CultureCuisineService {
  private static readonly FUNCTION_NAME = 'culture-cuisine-coach';

  // Get user's culture and cuisine preferences (optional - graceful fallback)
  static async getUserPreferences(): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return this.getDefaultPreferences();

      const { data, error } = await supabase
        .from('user_travel_preferences')
        .select('dietary_restrictions, cultural_interests, spice_tolerance')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // Silently fall back to defaults if table doesn't exist or other errors
        return this.getDefaultPreferences();
      }

      return {
        dietary_restrictions: data?.dietary_restrictions || [],
        cultural_interests: data?.cultural_interests || [],
        spice_tolerance: data?.spice_tolerance || 3,
      };
    } catch (error) {
      // Graceful fallback to defaults
      return this.getDefaultPreferences();
    }
  }

  // Default preferences for users without saved preferences
  private static getDefaultPreferences() {
    return {
      dietary_restrictions: [],
      cultural_interests: ['local customs', 'food culture'],
      spice_tolerance: 3, // Medium spice tolerance
    };
  }

  // Get current location with reverse geocoding
  static async getCurrentLocationWithDetails(): Promise<CultureCuisineRequest['location'] | null> {
    try {
      // Check location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return null;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Reverse geocode to get address details
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        return {
          lat: latitude,
          lng: longitude,
          address: `${place.street || ''} ${place.city || ''} ${place.region || ''} ${place.country || ''}`.trim(),
          city: place.city || undefined,
          country: place.country || undefined,
        };
      }

      return {
        lat: latitude,
        lng: longitude,
      };
    } catch (error) {
      console.warn('Error getting location:', error);
      return null;
    }
  }

  // Main function to get culture and cuisine recommendations
  static async getCultureCuisineRecommendations(
    request: CultureCuisineRequest
  ): Promise<CultureCuisineResponse> {
    try {
      console.log('🎭 Calling Culture & Cuisine Coach:', request.analysisType);

      // Get user preferences if not provided
      if (!request.userPreferences) {
        request.userPreferences = await this.getUserPreferences();
      }

      // Get current location if not provided
      if (!request.location) {
        const currentLocation = await this.getCurrentLocationWithDetails();
        if (currentLocation) {
          request.location = currentLocation;
        }
      }

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke(this.FUNCTION_NAME, {
        body: request,
      });

      if (error) {
        console.error('Edge Function error:', error);
        return this.getFallbackResponse(request.analysisType || 'both', error.message);
      }

      if (!data?.success) {
        console.error('Service error:', data?.error);
        return this.getFallbackResponse(request.analysisType || 'both', data?.error);
      }

      console.log('✅ Culture & Cuisine Coach response received');
      return data;
    } catch (error) {
      console.error('Culture & Cuisine Service error:', error);
      return this.getFallbackResponse(request.analysisType || 'both', 'Network or service error');
    }
  }

  // Fallback response when AI service is unavailable
  private static getFallbackResponse(analysisType: string, errorMessage?: string): CultureCuisineResponse {
    const fallbackCultureTips: CultureTip[] = [
      {
        id: 'fallback-1',
        category: 'etiquette',
        title: 'Basic Courtesy',
        description: 'Be respectful of local customs and dress codes. When in doubt, observe locals and follow their lead.',
        importance: 'high',
        context: 'Universal travel etiquette',
      },
      {
        id: 'fallback-2',
        category: 'dining',
        title: 'Dining Manners',
        description: 'Wait for others to start eating and keep your phone away during meals. Tipping customs vary by location.',
        importance: 'medium',
        context: 'Restaurant and dining situations',
      },
      {
        id: 'fallback-3',
        category: 'language',
        title: 'Language Basics',
        description: 'Learn basic phrases like "please," "thank you," and "excuse me" in the local language.',
        importance: 'medium',
        context: 'Daily interactions',
      },
    ];

    const fallbackCuisineDishes: CuisineDish[] = [
      {
        id: 'fallback-1',
        name: 'Local Specialty',
        description: 'Ask locals for their favorite traditional dish - it\'s usually the best way to experience authentic flavors.',
        category: 'main',
        spiceLevel: 2,
        mustTry: true,
        price: 'Varies',
        culturalSignificance: 'Represents authentic local cuisine',
      },
      {
        id: 'fallback-2',
        name: 'Street Food',
        description: 'Popular local street food is often the most authentic and affordable way to experience local cuisine.',
        category: 'snack',
        spiceLevel: 3,
        mustTry: true,
        price: 'Usually $5-15',
        culturalSignificance: 'Part of daily local food culture',
      },
      {
        id: 'fallback-3',
        name: 'Traditional Dessert',
        description: 'Don\'t miss the local dessert - it often tells a story about the region\'s history and ingredients.',
        category: 'dessert',
        spiceLevel: 0,
        mustTry: false,
        price: 'Usually $3-10',
        culturalSignificance: 'Reflects local ingredients and traditions',
      },
    ];

    return {
      success: false,
      error: errorMessage || 'Service temporarily unavailable',
      analysisType,
      location: 'Current location',
      cultureTips: analysisType === 'culture' || analysisType === 'both' ? fallbackCultureTips : undefined,
      cuisineDishes: analysisType === 'cuisine' || analysisType === 'both' ? fallbackCuisineDishes : undefined,
      recommendations: 'Connect to internet for personalized AI recommendations. In the meantime, explore local favorites and ask locals for their recommendations!',
    };
  }

  // Convenience method for culture tips only
  static async getCultureTips(imageUrl?: string): Promise<CultureCuisineResponse> {
    return this.getCultureCuisineRecommendations({
      imageUrl,
      analysisType: 'culture',
    });
  }

  // Convenience method for cuisine recommendations only
  static async getCuisineRecommendations(imageUrl?: string): Promise<CultureCuisineResponse> {
    return this.getCultureCuisineRecommendations({
      imageUrl,
      analysisType: 'cuisine',
    });
  }

  // Convenience method for both culture and cuisine
  static async getBothRecommendations(imageUrl?: string): Promise<CultureCuisineResponse> {
    return this.getCultureCuisineRecommendations({
      imageUrl,
      analysisType: 'both',
    });
  }
} 