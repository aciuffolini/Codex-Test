/**
 * AI Processing Queue - Per-Task Idempotent
 * 
 * UPDATED:
 * - Uses IndexedDB instead of localStorage
 * - Per-task idempotency (photo_caption, audio_transcript, embedding)
 * - Tracks completion per task type
 */

import { BaseRecord, AIStatus } from '@farm-visit/shared';
import { MediaProcessor } from '../export/MediaProcessor';
import { visitDB, aiQueue, AIQueueTask } from '../db';

const MAX_RETRIES = 3;
const BASE_DELAY = 2000; // 2 seconds base delay

export class AIProcessingQueue {
  private mediaProcessor: MediaProcessor;
  
  constructor(apiKey?: string) {
    this.mediaProcessor = new MediaProcessor(apiKey);
  }
  
  /**
   * Update API key (when user sets it)
   */
  setApiKey(apiKey: string): void {
    this.mediaProcessor = new MediaProcessor(apiKey);
  }
  
  /**
   * Queue AI processing for a record
   * Only queues tasks that haven't been completed
   */
  async queueProcessing(record: BaseRecord, apiKey?: string): Promise<void> {
    if (!apiKey) {
      console.log('[AIQueue] No API key, skipping AI processing queue');
      return;
    }
    
    const tasks: string[] = [];
    
    // Check what needs processing
    const aiStatus = record.aiStatus || {
      captionDone: false,
      transcriptDone: false,
      embeddingDone: false,
    };
    
    // Queue photo caption if needed
    if (record.photo_present && !aiStatus.captionDone) {
      // Check if already queued
      const existing = await aiQueue.getByRecord(record.id);
      if (!existing.some(t => t.taskType === 'photo_caption')) {
        await aiQueue.add({
          recordId: record.id,
          taskType: 'photo_caption',
          retries: 0,
          lastAttempt: Date.now(),
        });
        tasks.push('photo_caption');
      }
    }
    
    // Queue audio transcript if needed
    if (record.audio_present && !aiStatus.transcriptDone) {
      const existing = await aiQueue.getByRecord(record.id);
      if (!existing.some(t => t.taskType === 'audio_transcript')) {
        await aiQueue.add({
          recordId: record.id,
          taskType: 'audio_transcript',
          retries: 0,
          lastAttempt: Date.now(),
        });
        tasks.push('audio_transcript');
      }
    }
    
    if (tasks.length > 0) {
      console.log(`[AIQueue] Queued tasks for record ${record.id}:`, tasks);
      
      // Try to process immediately if online
      if (navigator.onLine) {
        this.processQueue();
      }
    }
  }
  
  /**
   * Get all queued tasks
   */
  async getQueuedTasks(): Promise<AIQueueTask[]> {
    return aiQueue.list();
  }
  
  /**
   * Process all queued tasks
   * Called automatically when connectivity is restored
   */
  async processQueue(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[AIQueue] Offline, skipping processing');
      return;
    }
    
    const tasks = await aiQueue.list();
    if (tasks.length === 0) {
      return;
    }
    
    console.log(`[AIQueue] Processing ${tasks.length} queued tasks...`);
    
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
        console.warn(`[AIQueue] Task ${task.id} exceeded max retries, removing`);
        await aiQueue.remove(task.id);
        continue;
      }
      
      try {
        await this.processTask(task);
        // Success: remove from queue
        await aiQueue.remove(task.id);
        console.log(`[AIQueue] ✅ Processed task ${task.id} (${task.taskType}) for record ${task.recordId}`);
      } catch (err) {
        // Failure: increment retries
        console.error(`[AIQueue] Task ${task.id} failed:`, err);
        await aiQueue.remove(task.id);
        await aiQueue.add({
          recordId: task.recordId,
          taskType: task.taskType,
          retries: task.retries + 1,
          lastAttempt: Date.now(),
        });
      }
    }
  }
  
  /**
   * Process a single task
   */
  private async processTask(task: AIQueueTask): Promise<void> {
    // Get record from database
    const record = await visitDB.get(task.recordId);
    if (!record) {
      throw new Error(`Record ${task.recordId} not found`);
    }
    
    const updates: Partial<BaseRecord> = {};
    const aiStatus: AIStatus = record.aiStatus || {
      captionDone: false,
      transcriptDone: false,
      embeddingDone: false,
    };
    
    // Process based on task type
    if (task.taskType === 'photo_caption' && record.photo_present) {
      // Get photo data (handle both pointer and legacy base64)
      let photoData: string | undefined;
      const anyRecord = record as any;
      
      if (record.photo) {
        // New format: use MediaStorage to get blob
        const { MediaStorage } = await import('../storage/MediaStorage');
        const media = await MediaStorage.getMedia(record.photo);
        if (media) {
          photoData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(media.data);
          });
        }
      } else if (anyRecord.photo_data) {
        // Legacy format: use base64 directly
        photoData = anyRecord.photo_data;
      }
      
      if (photoData) {
        const description = await this.mediaProcessor.describePhoto(
          photoData,
          this.buildContext(record)
        );
        updates.photo_caption = description.caption;
        aiStatus.captionDone = true;
      }
    }
    
    if (task.taskType === 'audio_transcript' && record.audio_present) {
      // Get audio data
      let audioData: string | undefined;
      const anyRecord = record as any;
      
      if (record.audio) {
        const { MediaStorage } = await import('../storage/MediaStorage');
        const media = await MediaStorage.getMedia(record.audio);
        if (media) {
          audioData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(media.data);
          });
        }
      } else if (anyRecord.audio_data) {
        audioData = anyRecord.audio_data;
      }
      
      if (audioData) {
        const transcription = await this.mediaProcessor.transcribeAudio(audioData);
        updates.audio_transcript = transcription.transcript;
        updates.audio_summary = transcription.summary;
        aiStatus.transcriptDone = true;
      }
    }
    
    // Update record with AI-generated index
    updates.aiStatus = aiStatus;
    await visitDB.update(task.recordId, updates);
    
    console.log(`[AIQueue] Updated record ${task.recordId} with ${task.taskType} result`);
  }
  
  /**
   * Build context for AI processing
   */
  private buildContext(record: BaseRecord): Record<string, any> {
    const context: Record<string, any> = {
      task_type: record.task_type,
      note: record.note,
      timestamp: new Date(record.createdAt).toISOString(),
    };
    
    // Add task-specific fields
    Object.keys(record).forEach(key => {
      if (!['id', 'createdAt', 'updatedAt', 'ts', 'task_type', 'lat', 'lon', 'acc', 'note', 
            'photo_present', 'photo', 'photo_data', 'audio_present', 'audio', 'audio_data',
            'syncStatus', 'syncedAt', 'synced', 'aiStatus', 'photo_caption', 'audio_transcript', 'audio_summary'].includes(key)) {
        context[key] = (record as any)[key];
      }
    });
    
    return context;
  }
  
  /**
   * Get processing status
   */
  async getStatus(): Promise<{ queued: number; processing: boolean }> {
    const tasks = await aiQueue.list();
    return {
      queued: tasks.length,
      processing: false, // Could track active processing
    };
  }
}

// Global instance
let globalQueue: AIProcessingQueue | null = null;

/**
 * Get or create global AI processing queue
 */
export function getAIProcessingQueue(apiKey?: string): AIProcessingQueue {
  if (!globalQueue) {
    globalQueue = new AIProcessingQueue(apiKey);
  } else if (apiKey) {
    globalQueue.setApiKey(apiKey);
  }
  return globalQueue;
}

// Auto-process on online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[AIQueue] Connectivity restored, processing queue...');
    const queue = getAIProcessingQueue();
    queue.processQueue();
  });
  
  // Also process on focus (user might have reconnected)
  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      const queue = getAIProcessingQueue();
      queue.processQueue();
    }
  });
  
  // Process on app startup if online
  if (navigator.onLine) {
    setTimeout(() => {
      const queue = getAIProcessingQueue();
      queue.processQueue();
    }, 2000); // Wait 2 seconds for app to initialize
  }
}

