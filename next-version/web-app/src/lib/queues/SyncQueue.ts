/**
 * Sync Queue - Offline Record Synchronization
 * 
 * Queues unsynced records for server synchronization
 * Handles media upload separately
 */

import { visitDB, syncQueue, SyncQueueTask, VisitRecord } from '../db';
import { MediaStorage } from '../storage/MediaStorage';

const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

export interface SyncConfig {
  serverUrl: string;
  apiKey?: string;
}

export class SyncQueue {
  private config: SyncConfig | null = null;
  
  /**
   * Set server configuration
   */
  setConfig(config: SyncConfig): void {
    this.config = config;
  }
  
  /**
   * Queue a record for sync
   */
  async queueRecord(recordId: string): Promise<void> {
    // Check if already queued
    const existing = await syncQueue.getByRecord(recordId);
    if (existing) {
      return; // Already queued
    }
    
    await syncQueue.add({
      recordId,
      retries: 0,
      lastAttempt: Date.now(),
    });
    
    // Try to sync immediately if online
    if (navigator.onLine && this.config) {
      this.processQueue();
    }
  }
  
  /**
   * Process all queued sync tasks
   */
  async processQueue(): Promise<void> {
    if (!navigator.onLine || !this.config) {
      return;
    }
    
    const tasks = await syncQueue.list();
    if (tasks.length === 0) {
      return;
    }
    
    console.log(`[SyncQueue] Processing ${tasks.length} queued sync tasks...`);
    
    const now = Date.now();
    
    for (const task of tasks) {
      // Calculate exponential backoff delay
      const delay = Math.min(
        BASE_DELAY * Math.pow(2, task.retries),
        30000 // Max 30 seconds
      );
      
      // Skip if not enough time has passed
      if (now - task.lastAttempt < delay) continue;
      
      // Skip if max retries exceeded
      if (task.retries >= MAX_RETRIES) {
        console.warn(`[SyncQueue] Task ${task.id} exceeded max retries, marking as failed`);
        await visitDB.update(task.recordId, { syncStatus: 'failed' });
        await syncQueue.remove(task.id);
        continue;
      }
      
      try {
        await this.syncRecord(task.recordId);
        // Success: remove from queue and mark as synced
        await visitDB.markSynced(task.recordId);
        await syncQueue.remove(task.id);
        console.log(`[SyncQueue] ✅ Synced record ${task.recordId}`);
      } catch (err) {
        // Failure: increment retries
        console.error(`[SyncQueue] Task ${task.id} failed:`, err);
        await syncQueue.remove(task.id);
        await syncQueue.add({
          recordId: task.recordId,
          retries: task.retries + 1,
          lastAttempt: Date.now(),
        });
      }
    }
  }
  
  /**
   * Sync a single record to server
   */
  private async syncRecord(recordId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Sync config not set');
    }
    
    const record = await visitDB.get(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    
    // Update status to syncing
    await visitDB.update(recordId, { syncStatus: 'syncing' });
    
    // Prepare record payload (without media blobs)
    const payload: any = {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      task_type: record.task_type,
      lat: record.lat,
      lon: record.lon,
      acc: record.acc,
      note: record.note,
      photo_present: record.photo_present,
      audio_present: record.audio_present,
      photo_caption: record.photo_caption,
      audio_transcript: record.audio_transcript,
      audio_summary: record.audio_summary,
      aiStatus: record.aiStatus,
      // Include task-specific fields
      ...(record.field_id && { field_id: record.field_id }),
      ...(record.crop && { crop: record.crop }),
      ...(record.issue && { issue: record.issue }),
      ...(record.severity !== undefined && { severity: record.severity }),
    };
    
    // Sync record metadata
    const response = await fetch(`${this.config.serverUrl}/sync/visits/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.statusText} - ${errorText.substring(0, 200)}`);
    }
    
    // Upload media if present (non-blocking - continue even if media upload fails)
    if (record.photo_present && record.photo) {
      try {
        await this.uploadMedia(recordId, 'photo', record.photo);
        console.log(`[SyncQueue] ✅ Photo uploaded for ${recordId}`);
      } catch (err: any) {
        console.warn(`[SyncQueue] Photo upload failed for ${recordId}:`, err.message);
        // Don't fail the entire sync if media upload fails
      }
    }
    
    if (record.audio_present && record.audio) {
      try {
        await this.uploadMedia(recordId, 'audio', record.audio);
        console.log(`[SyncQueue] ✅ Audio uploaded for ${recordId}`);
      } catch (err: any) {
        console.warn(`[SyncQueue] Audio upload failed for ${recordId}:`, err.message);
        // Don't fail the entire sync if media upload fails
      }
    }
    
    // Note: Embedding generation is now automatic in /sync/visits/upsert
    // No need to call /rag/upsert separately
  }
  
  /**
   * Upload media to server
   */
  private async uploadMedia(
    recordId: string,
    type: 'photo' | 'audio',
    pointer: any
  ): Promise<void> {
    if (!this.config) {
      throw new Error('Sync config not set');
    }
    
    // Get media blob
    const media = await MediaStorage.getMedia(pointer);
    if (!media) {
      console.warn(`[SyncQueue] Media not found for ${type} in record ${recordId}`);
      return;
    }
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', media.data, `visit_${recordId}_${type}.${type === 'photo' ? 'jpg' : 'webm'}`);
    formData.append('visit_id', recordId);
    formData.append('type', type);
    
    // Upload
    const response = await fetch(`${this.config.serverUrl}/sync/media/upload`, {
      method: 'POST',
      headers: {
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Media upload failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update record with remote URI
    await visitDB.update(recordId, {
      [type]: {
        ...pointer,
        kind: 'remote',
        uri: result.uri,
      },
    });
  }
  
  /**
   * Sync all pending records
   */
  async syncAllPending(): Promise<void> {
    const unsynced = await visitDB.getUnsynced();
    for (const record of unsynced) {
      await this.queueRecord(record.id);
    }
    await this.processQueue();
  }
  
  /**
   * Get queue status
   */
  async getStatus(): Promise<{ queued: number; pending: number }> {
    const tasks = await syncQueue.list();
    const pending = await visitDB.getUnsynced();
    return {
      queued: tasks.length,
      pending: pending.length,
    };
  }
}

// Global instance
let globalSyncQueue: SyncQueue | null = null;

/**
 * Get or create global sync queue
 */
export function getSyncQueue(): SyncQueue {
  if (!globalSyncQueue) {
    globalSyncQueue = new SyncQueue();
  }
  return globalSyncQueue;
}

// Auto-sync on online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncQueue] Connectivity restored, processing sync queue...');
    const queue = getSyncQueue();
    queue.processQueue();
  });
  
  // Also sync on focus
  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      const queue = getSyncQueue();
      queue.processQueue();
    }
  });
}

