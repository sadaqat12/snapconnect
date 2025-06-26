import { supabase } from './supabase';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';

// Production storage URL
const STORAGE_URL = 'https://zfwrwbtrdcnncyxvfcbd.supabase.co/storage/v1';

export interface SnapData {
  id?: string;
  creator_id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  thumbnail_url?: string;
  caption?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  recipient_ids: string[];
  read_by?: string[];
  duration_seconds?: number;
  expires_at: string;
  created_at?: string;
}

export interface UploadProgress {
  progress: number;
  total: number;
  loaded: number;
}

export class SnapService {
  /**
   * Upload media file to Supabase Storage
   */
  static async uploadMedia(
    uri: string,
    mediaType: 'photo' | 'video',
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Get file info and validate
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Media file not found');
      }
      if (fileInfo.size === 0) {
        throw new Error('Media file is empty');
      }
      console.log('File info:', fileInfo);

      // Validate file type
      const fileExt = uri.split('.').pop()?.toLowerCase() || '';
      if (mediaType === 'photo' && !['jpg', 'jpeg', 'png'].includes(fileExt)) {
        throw new Error('Invalid photo format. Use JPG or PNG.');
      }
      if (mediaType === 'video' && !['mp4', 'mov'].includes(fileExt)) {
        throw new Error('Invalid video format. Use MP4 or MOV.');
      }

      // Generate unique filename with correct extension
      const finalExt = mediaType === 'photo' ? 'jpg' : 'mp4';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${finalExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('File read as base64, length:', base64.length);

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Set correct content type
      const contentType = mediaType === 'photo' 
        ? 'image/jpeg'
        : 'video/mp4';

      // Upload using Supabase client with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;

      while (attempts < maxAttempts) {
        try {
          const { data, error } = await supabase.storage
            .from('media')
            .upload(filePath, decode(base64), {
              contentType,
              upsert: false,
            });

          if (error) throw error;

          console.log('Upload successful:', data);
          
          // Generate public URL
          const mediaUrl = `${STORAGE_URL}/object/public/media/${filePath}`;
          console.log('Generated media URL:', mediaUrl);

          return mediaUrl;
        } catch (error) {
          lastError = error;
          attempts++;
          if (attempts < maxAttempts) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          }
        }
      }

      // If we get here, all attempts failed
      console.error('Upload failed after', maxAttempts, 'attempts:', lastError);
      throw new Error(`Failed to upload ${mediaType} after ${maxAttempts} attempts: ${lastError?.message || lastError}`);
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Get current location for snap
   */
  static async getCurrentLocation(): Promise<SnapData['location'] | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Optional: Get address from coordinates
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        return {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address: address ? `${address.city}, ${address.country}` : undefined,
        };
      } catch {
        return {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
      }
    } catch (error) {
      console.error('Location error:', error);
      return null;
    }
  }

  /**
   * Create a new snap record in database
   */
  static async createSnap(snapData: Omit<SnapData, 'id'>): Promise<SnapData> {
    try {
      const { data, error } = await supabase
        .from('snaps')
        .insert([snapData])
        .select()
        .single();

      if (error) throw error;
      return data as SnapData;
    } catch (error) {
      console.error('Create snap error:', error);
      throw new Error(`Failed to create snap: ${error}`);
    }
  }

  /**
   * Complete snap creation workflow
   */
  static async createSnapFromMedia(
    uri: string,
    mediaType: 'photo' | 'video',
    options: {
      caption?: string;
      recipients?: string[];
      duration?: number;
      includeLocation?: boolean;
    } = {},
    onProgress?: (stage: string, progress?: number) => void
  ): Promise<SnapData> {
    try {
      onProgress?.('Preparing upload...');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Upload media
      onProgress?.('Uploading media...', 20);
      const mediaUrl = await this.uploadMedia(uri, mediaType);

      // Get location if requested
      onProgress?.('Getting location...', 60);
      const locationResult = options.includeLocation ? await this.getCurrentLocation() : null;
      const location = locationResult || undefined;

      // Create snap record
      onProgress?.('Creating snap...', 80);
      const snapData: Omit<SnapData, 'id'> = {
        creator_id: user.id,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: options.caption,
        location,
        recipient_ids: options.recipients || [user.id], // Default to self if no recipients
        duration_seconds: options.duration || 10,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      };

      const snap = await this.createSnap(snapData);
      
      onProgress?.('Complete!', 100);
      return snap;
    } catch (error) {
      console.error('Create snap workflow error:', error);
      throw error;
    }
  }

  /**
   * Get a snap by ID
   */
  static async getSnapById(snapId: string): Promise<SnapData> {
    try {
      const { data, error } = await supabase
        .from('snaps')
        .select('*')
        .eq('id', snapId)
        .single();

      if (error) throw error;
      
      // Convert URL to local storage URL
      return {
        ...data as SnapData,
        media_url: data.media_url.replace(/https:\/\/[^\/]+\/storage\/v1/, STORAGE_URL),
      };
    } catch (error) {
      console.error('Get snap by ID error:', error);
      throw new Error(`Failed to get snap: ${error}`);
    }
  }

  /**
   * Get user's snaps
   */
  static async getUserSnaps(userId?: string): Promise<SnapData[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const targetUserId = userId || user.id;

      const { data, error } = await supabase
        .from('snaps')
        .select('*')
        .eq('creator_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert URLs to local storage URLs
      return (data as SnapData[]).map(snap => ({
        ...snap,
        media_url: snap.media_url.replace(/https:\/\/[^\/]+\/storage\/v1/, STORAGE_URL),
      }));
    } catch (error) {
      console.error('Get user snaps error:', error);
      throw error;
    }
  }

  /**
   * Get snaps sent to user that they haven't read yet
   */
  static async getReceivedSnaps(): Promise<SnapData[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('snaps')
        .select('*')
        .contains('recipient_ids', [user.id])
        .not('read_by', 'cs', `{${user.id}}`) // Only get snaps not read by current user
        .gte('expires_at', new Date().toISOString()) // Only get non-expired snaps
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert URLs to local storage URLs
      return (data as SnapData[]).map(snap => ({
        ...snap,
        media_url: snap.media_url.replace(/https:\/\/[^\/]+\/storage\/v1/, STORAGE_URL),
      }));
    } catch (error) {
      console.error('Get received snaps error:', error);
      throw error;
    }
  }

  /**
   * Mark snap as read for current user
   */
  static async markSnapAsRead(snapId: string): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Get current snap
      const { data: snap, error: fetchError } = await supabase
        .from('snaps')
        .select('read_by, recipient_ids')
        .eq('id', snapId)
        .single();

      if (fetchError) {
        // If snap not found, it might have been deleted already
        if (fetchError.code === 'PGRST116') {
          console.log(`Snap ${snapId} was already deleted`);
          return;
        }
        throw fetchError;
      }

      // Add user to read_by array if not already there
      const readBy = snap.read_by || [];
      if (!readBy.includes(user.id)) {
        readBy.push(user.id);

        // Only delete the snap if all recipients have read it
        const allRecipientsRead = snap.recipient_ids.every((id: string) => readBy.includes(id));
        
        if (allRecipientsRead) {
          console.log('All recipients have viewed the snap, deleting:', snapId);
          await this.deleteSnap(snapId);
        } else {
          // Only update read_by if we're not deleting the snap
          const { error: updateError } = await supabase
            .from('snaps')
            .update({ read_by: readBy })
            .eq('id', snapId);

          if (updateError) throw updateError;
          console.log(`Snap ${snapId} marked as read by ${user.id}, ${readBy.length}/${snap.recipient_ids.length} recipients have viewed it`);
        }
      }
    } catch (error) {
      console.error('Mark snap as read error:', error);
      throw error;
    }
  }

  /**
   * Delete snap (and media from storage)
   */
  static async deleteSnap(snapId: string): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Get snap details first
      const { data: snap, error: fetchError } = await supabase
        .from('snaps')
        .select('media_url, creator_id, recipient_ids')
        .eq('id', snapId)
        .single();

      if (fetchError) throw fetchError;

      // Check if user is authorized (either creator or recipient)
      const isCreator = snap.creator_id === user.id;
      const isRecipient = snap.recipient_ids.includes(user.id);
      if (!isCreator && !isRecipient) {
        throw new Error('Not authorized to delete this snap');
      }

      // Only creator can delete the media from storage
      if (isCreator) {
        // Extract file path from URL
        const url = new URL(snap.media_url);
        const filePath = url.pathname.split('/').slice(-2).join('/'); // Get user_id/filename

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('media')
          .remove([filePath]);

        if (storageError) console.warn('Storage deletion error:', storageError);
      }

      // Delete snap record
      const { error: deleteError } = await supabase
        .from('snaps')
        .delete()
        .eq('id', snapId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error('Delete snap error:', error);
      throw error;
    }
  }

  /**
   * Clean up old snaps
   */
  static async cleanupOldSnaps(): Promise<void> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      // Get all snaps that are either:
      // 1. Expired (past expires_at)
      // 2. Unread but older than 24 hours
      const { data: snaps, error } = await supabase
        .from('snaps')
        .select('*')
        .or(`expires_at.lte.${new Date().toISOString()},and(read_by.eq.{},created_at.lte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()})`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Delete each snap
      for (const snap of snaps || []) {
        try {
          await this.deleteSnap(snap.id);
          console.log('Deleted old/expired snap:', snap.id);
        } catch (error) {
          console.error('Error deleting snap:', snap.id, error);
        }
      }
    } catch (error) {
      console.error('Error cleaning up snaps:', error);
      throw error;
    }
  }
}

// Helper function to decode base64
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
} 