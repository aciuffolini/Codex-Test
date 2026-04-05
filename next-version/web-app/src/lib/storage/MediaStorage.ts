/**
 * Media Storage Service
 * 
 * Handles media storage across platforms:
 * - Web: Blob in IndexedDB
 * - Android: Filesystem via Capacitor
 * 
 * Provides unified API for storing/retrieving photos and audio
 */

import { MediaPointer } from '@farm-visit/shared';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface MediaBlob {
  data: Blob;
  mimeType: string;
  size: number;
}

/**
 * Media Storage Service
 */
export class MediaStorage {
  private static readonly MEDIA_DIR = 'farm_visit_media';
  
  /**
   * Store photo
   * @param dataUrl - Base64 data URL or Blob
   * @param visitId - Visit record ID
   * @returns Media pointer
   */
  static async storePhoto(dataUrl: string | Blob, visitId: string): Promise<MediaPointer> {
    if (Capacitor.isNativePlatform()) {
      return this.storePhotoAndroid(dataUrl, visitId, 'photo');
    } else {
      return this.storePhotoWeb(dataUrl, visitId, 'photo');
    }
  }
  
  /**
   * Store audio
   * @param dataUrl - Base64 data URL or Blob
   * @param visitId - Visit record ID
   * @returns Media pointer
   */
  static async storeAudio(dataUrl: string | Blob, visitId: string): Promise<MediaPointer> {
    if (Capacitor.isNativePlatform()) {
      return this.storePhotoAndroid(dataUrl, visitId, 'audio');
    } else {
      return this.storePhotoWeb(dataUrl, visitId, 'audio');
    }
  }
  
  /**
   * Store photo on Android (Filesystem)
   */
  private static async storePhotoAndroid(
    dataUrl: string | Blob,
    visitId: string,
    type: 'photo' | 'audio'
  ): Promise<MediaPointer> {
    // Convert to base64 if needed
    let base64Data: string;
    let mimeType: string;
    
    if (dataUrl instanceof Blob) {
      const arrayBuffer = await dataUrl.arrayBuffer();
      base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      mimeType = dataUrl.type;
    } else if (dataUrl.startsWith('data:')) {
      const [header, data] = dataUrl.split(',');
      base64Data = data;
      const mimeMatch = header.match(/data:([^;]+)/);
      mimeType = (mimeMatch && mimeMatch[1]) || (type === 'photo' ? 'image/jpeg' : 'audio/webm');
    } else {
      base64Data = dataUrl;
      mimeType = type === 'photo' ? 'image/jpeg' : 'audio/webm';
    }
    
    // Determine file extension
    const ext = type === 'photo' 
      ? (mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('png') ? 'png' : 'jpg')
      : (mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'webm');
    
    // Create directory if needed
    const dirPath = `${this.MEDIA_DIR}/${visitId}`;
    try {
      await Filesystem.mkdir({
        path: dirPath,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (err) {
      // Directory might already exist, ignore
    }
    
    // Write file
    const fileName = `${type}_${Date.now()}.${ext}`;
    const filePath = `${dirPath}/${fileName}`;
    
    await Filesystem.writeFile({
      path: filePath,
      data: base64Data,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    
    // Get file URI
    const uri = await Filesystem.getUri({
      path: filePath,
      directory: Directory.Data,
    });
    
    return {
      kind: 'file',
      uri: uri.uri,
      mimeType,
      size: Math.floor(base64Data.length * 0.75), // Approximate size
    };
  }
  
  /**
   * Store photo on Web (IndexedDB Blob)
   */
  private static async storePhotoWeb(
    dataUrl: string | Blob,
    visitId: string,
    type: 'photo' | 'audio'
  ): Promise<MediaPointer> {
    let blob: Blob;
    let mimeType: string;
    
    if (dataUrl instanceof Blob) {
      blob = dataUrl;
      mimeType = dataUrl.type;
    } else if (dataUrl.startsWith('data:')) {
      const [header, data] = dataUrl.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      mimeType = (mimeMatch && mimeMatch[1]) || (type === 'photo' ? 'image/jpeg' : 'audio/webm');
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blobOptions1: BlobPropertyBag = { type: mimeType };
      blob = new Blob([bytes], blobOptions1);
    } else {
      // Assume it's base64 without data URL prefix
      mimeType = type === 'photo' ? 'image/jpeg' : 'audio/webm';
      const binaryString = atob(dataUrl);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blobOptions: BlobPropertyBag = { type: mimeType };
      blob = new Blob([bytes], blobOptions);
    }
    
    // Store in IndexedDB
    const blobKey = await this.storeBlobInIndexedDB(blob, visitId, type);
    
    return {
      kind: 'blob',
      blobKey,
      mimeType,
      size: blob.size,
    };
  }
  
  /**
   * Store blob in IndexedDB (web only)
   */
  private static async storeBlobInIndexedDB(
    blob: Blob,
    visitId: string,
    type: 'photo' | 'audio'
  ): Promise<string> {
    // Use a simple IndexedDB store for blobs
    const dbName = 'FarmVisitMediaDB';
    const storeName = 'media';
    const blobKey = `${visitId}_${type}_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          // Create store if it doesn't exist
          db.close();
          const upgradeRequest = indexedDB.open(dbName, 2);
          upgradeRequest.onupgradeneeded = () => {
            const db = upgradeRequest.result;
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName);
            }
          };
          upgradeRequest.onsuccess = () => {
            const db = upgradeRequest.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            store.put(blob, blobKey);
            transaction.oncomplete = () => resolve(blobKey);
            transaction.onerror = () => reject(transaction.error);
          };
          upgradeRequest.onerror = () => reject(upgradeRequest.error);
        } else {
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          store.put(blob, blobKey);
          transaction.oncomplete = () => resolve(blobKey);
          transaction.onerror = () => reject(transaction.error);
        }
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
    });
  }
  
  /**
   * Retrieve media as Blob
   */
  static async getMedia(pointer: MediaPointer): Promise<MediaBlob | null> {
    if (pointer.kind === 'blob') {
      return this.getBlobFromIndexedDB(pointer.blobKey!);
    } else if (pointer.kind === 'file') {
      return this.getBlobFromAndroid(pointer.uri!);
    } else if (pointer.kind === 'remote') {
      // Fetch from remote URL
      const response = await fetch(pointer.uri!);
      const blob = await response.blob();
      return {
        data: blob,
        mimeType: pointer.mimeType || blob.type,
        size: blob.size,
      };
    }
    return null;
  }
  
  /**
   * Get blob from IndexedDB (web)
   */
  private static async getBlobFromIndexedDB(blobKey: string): Promise<MediaBlob | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FarmVisitMediaDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getRequest = store.get(blobKey);
        
        getRequest.onsuccess = () => {
          const blob = getRequest.result as Blob | undefined;
          if (blob) {
            resolve({
              data: blob,
              mimeType: blob.type,
              size: blob.size,
            });
          } else {
            resolve(null);
          }
        };
        
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }
  
  /**
   * Get blob from Android Filesystem
   */
  private static async getBlobFromAndroid(uri: string): Promise<MediaBlob | null> {
    try {
      // Read file as base64
      const file = await Filesystem.readFile({
        path: uri,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      
      let bytes: Uint8Array;
      if (typeof file.data === 'string') {
        const binaryString = atob(file.data);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } else {
        const arrayBuffer = await (file.data as Blob).arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      }
      
      // Determine mime type from URI
      const mimeType = uri.includes('.jpg') || uri.includes('.jpeg') 
        ? 'image/jpeg' 
        : uri.includes('.png') 
        ? 'image/png'
        : uri.includes('.webm')
        ? 'audio/webm'
        : uri.includes('.mp3')
        ? 'audio/mp3'
        : 'application/octet-stream';
      
      const blobOptions2: BlobPropertyBag = { type: mimeType };
      return {
        data: new Blob([bytes as any], blobOptions2),
        mimeType,
        size: bytes.length,
      };
    } catch (err) {
      console.error('[MediaStorage] Failed to read file:', err);
      return null;
    }
  }
  
  /**
   * Convert media pointer to data URL (for display/legacy compatibility)
   */
  static async toDataUrl(pointer: MediaPointer): Promise<string | null> {
    const media = await this.getMedia(pointer);
    if (!media) return null;
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(media.data);
    });
  }
  
  /**
   * Delete media
   */
  static async deleteMedia(pointer: MediaPointer): Promise<void> {
    if (pointer.kind === 'file' && pointer.uri) {
      try {
        await Filesystem.deleteFile({
          path: pointer.uri,
          directory: Directory.Data,
        });
      } catch (err) {
        console.warn('[MediaStorage] Failed to delete file:', err);
      }
    } else if (pointer.kind === 'blob' && pointer.blobKey) {
      // Delete from IndexedDB
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('FarmVisitMediaDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['media'], 'readwrite');
          const store = transaction.objectStore('media');
          store.delete(pointer.blobKey!);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        };
      });
    }
    // Remote media: no-op (server handles deletion)
  }
}

