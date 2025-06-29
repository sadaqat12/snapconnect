import { supabase } from './supabase';

export interface StorySnippetRequest {
  storyId: string;
  style?: 'adventurous' | 'reflective' | 'casual';
}

export interface StorySnippetResponse {
  success: boolean;
  snippet?: string;
  title?: string;
  error?: string;
}

export class StorySnippetService {
  /**
   * Generate a travel blog snippet from a story
   */
  static async generateStorySnippet(request: StorySnippetRequest): Promise<StorySnippetResponse> {
    try {
      console.log('📖 Generating story snippet:', request);

      // Get current user's auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('User not authenticated');
      }

      // Call the Edge Function using direct fetch (same as other working AI features)
      const SUPABASE_URL = 'https://zfwrwbtrdcnncyxvfcbd.supabase.co';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/story-snippet-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      console.log('🌐 Direct fetch response status:', response.status);
      
      let data = null;
      let error = null;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Direct fetch error:', errorText);
        error = new Error(`HTTP ${response.status}: ${errorText}`);
      } else {
        data = await response.json();
      }

      console.log('📖 Story snippet response:', { data, error });

      if (error) {
        console.error('Story snippet generation error:', error);
        throw error;
      }

      console.log('✅ Story snippet generated successfully');
      return data as StorySnippetResponse;

    } catch (error) {
      console.error('❌ Story snippet generation failed:', error);
      
      // Return fallback response
      return {
        success: false,
        error: (error as Error).message || 'Failed to generate story snippet',
        title: 'My Travel Adventure',
        snippet: 'What an amazing day of travel! From capturing beautiful moments to exploring new places, this journey has been filled with incredible experiences. Each photo tells a story of discovery, adventure, and the joy of exploring the world. Travel truly opens our hearts and minds to new possibilities! ✈️🌍📸'
      };
    }
  }

  /**
   * Get available writing styles
   */
  static getAvailableStyles(): Array<{
    id: 'adventurous' | 'reflective' | 'casual';
    name: string;
    description: string;
    icon: string;
  }> {
    return [
      {
        id: 'adventurous',
        name: 'Adventurous',
        description: 'Exciting and action-packed writing style',
        icon: '⚡'
      },
      {
        id: 'reflective',
        name: 'Reflective', 
        description: 'Thoughtful and contemplative tone',
        icon: '🌟'
      },
      {
        id: 'casual',
        name: 'Casual',
        description: 'Fun and friendly conversational style',
        icon: '😊'
      }
    ];
  }
} 