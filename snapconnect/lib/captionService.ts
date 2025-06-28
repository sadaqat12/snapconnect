import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

export interface CaptionRequest {
  imageUrl: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  userProfile?: {
    travel_style_tags?: string[];
    preferences?: Record<string, any>;
  };
}

export interface CaptionResponse {
  captions: string[];
  success: boolean;
  error?: string;
}

export class CaptionService {
  /**
   * Generate travel captions for an image using AI
   */
  static async generateCaptions(request: CaptionRequest): Promise<CaptionResponse> {
    try {
      // Get the current session for authorization
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ Session error:', sessionError);
        throw new Error('User not authenticated');
      }

      console.log('🔐 Session check:', {
        hasSession: !!session,
        hasAccessToken: !!session.access_token,
        tokenLength: session.access_token?.length,
        expiresAt: session.expires_at
      });

      let publicImageUrl = request.imageUrl;

      // If the image URL is a local file, upload it to Supabase Storage first
      if (request.imageUrl.startsWith('file://') || request.imageUrl.startsWith('/')) {
        console.log('🔄 Uploading local image to Supabase Storage...');
        
        try {
          // Create a unique filename that matches RLS policy expectations
          const timestamp = Date.now();
          const randomString = Math.random().toString(36).substring(7);
          const filename = `${session.user.id}/caption-${timestamp}-${randomString}.jpg`;

          // Read file as base64
          const base64 = await FileSystem.readAsStringAsync(request.imageUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Decode base64 to Uint8Array
          const fileData = decode(base64);

          // Upload the file data to Supabase Storage with public access
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('media')
            .upload(filename, fileData, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'image/jpeg'
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }

          // Get the public URL using the correct method
          const { data: urlData } = supabase.storage
            .from('media')
            .getPublicUrl(filename);

          publicImageUrl = urlData.publicUrl;
          console.log('✅ Image uploaded successfully:', publicImageUrl);

          // Verify the URL is accessible by making a HEAD request
          try {
            const testResponse = await fetch(publicImageUrl, { method: 'HEAD' });
            if (!testResponse.ok) {
              throw new Error(`Image URL not accessible: ${testResponse.status}`);
            }
            console.log('✅ Image URL verified as accessible');
          } catch (urlError) {
            console.error('Image URL verification failed:', urlError);
            throw new Error('Uploaded image is not publicly accessible');
          }

        } catch (uploadError) {
          console.error('Failed to upload image for caption analysis:', uploadError);
          throw new Error('Failed to prepare image for AI analysis');
        }
      } else {
        // For URLs that are already public, verify they're accessible
        try {
          const testResponse = await fetch(publicImageUrl, { method: 'HEAD' });
          if (!testResponse.ok) {
            throw new Error(`Image URL not accessible: ${testResponse.status}`);
          }
          console.log('✅ Existing image URL verified as accessible');
        } catch (urlError) {
          console.error('Image URL verification failed:', urlError);
          throw new Error('Image URL is not accessible to AI service');
        }
      }

      // Call the Edge Function with the verified public URL
      console.log('🧭 Calling Caption Compass with:', { 
        imageUrl: publicImageUrl.substring(0, 80) + '...', 
        hasLocation: !!request.location,
        hasUserProfile: !!request.userProfile,
        tokenPreview: session.access_token.substring(0, 50) + '...'
      });

      // Try direct fetch instead of supabase.functions.invoke
      const SUPABASE_URL = 'https://zfwrwbtrdcnncyxvfcbd.supabase.co';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/caption-compass`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          imageUrl: publicImageUrl
        })
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

      console.log('🧭 Caption Compass response:', { data, error });

      if (error) {
        console.error('Caption generation error:', error);
        throw error;
      }

      return data as CaptionResponse;
    } catch (error) {
      console.error('Caption service error:', error);
      
      // Return fallback captions if service fails
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        captions: [
          "🌟 Travel memories in the making!",
          "✈️ Adventure awaits around every corner",
          "📸 Capturing moments that matter"
        ]
      };
    }
  }

  /**
   * Get user's travel profile for better caption personalization
   */
  static async getUserTravelProfile(): Promise<CaptionRequest['userProfile']> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return undefined;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('travel_style_tags, preferences')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return undefined;
      }

      return {
        travel_style_tags: profile?.travel_style_tags || [],
        preferences: profile?.preferences || {}
      };
    } catch (error) {
      console.error('Error getting user travel profile:', error);
      return undefined;
    }
  }
}

// Helper function to decode base64 to Uint8Array
function decode(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = new Uint8Array(Math.floor(base64.length * 3 / 4));
  let bufferLength = 0;
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < base64.length; i++) {
    const char = base64[i];
    if (char === '=') break;
    
    const value = chars.indexOf(char);
    if (value === -1) continue;
    
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    
    if (bitsCollected >= 8) {
      result[bufferLength++] = (buffer >> (bitsCollected - 8)) & 255;
      bitsCollected -= 8;
    }
  }
  
  return result.slice(0, bufferLength);
} 