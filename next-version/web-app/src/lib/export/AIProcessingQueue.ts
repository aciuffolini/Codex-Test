/**
 * AI Processing Queue - Offline Support
 * Queues photo descriptions and audio transcriptions when offline
 * Processes automatically when connectivity is restored
 */

import { BaseRecord } from '@farm-visit/shared';
import { MediaProcessor } from './MediaProcessor';
import { visitDB } from '../db';
import { localWhisper } from '../agents/LocalWhisper';

export interface AIProcessingTask {
  id: string;
  recordId: string;
  taskType: 'photo_description' | 'audio_transcription' | 'both';
  photoData?: string;
  audioData?: string;
  context?: Record<string, any>;
  retries: number;
  lastAttempt: number;
  createdAt: number;
}

const QUEUE_KEY = 'farm_visit_ai_queue_v1';
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
   * Called when saving a record offline
   */
  queueProcessing(record: BaseRecord, apiKey?: string): void {
    if (!apiKey) {
      console.log('[AIQueue] No API key, skipping AI processing queue');
      return;
    }
    
    // Check if already processed
    if (this.isProcessed(record)) {
      return;
    }
    
    const tasks: AIProcessingTask[] = this.list();
    
    // Check if already queued
    if (tasks.some(t => t.recordId === record.id)) {
      return;
    }
    
    // Determine task type
    let taskType: 'photo_description' | 'audio_transcription' | 'both' = 'both';
    if (record.photo_present && record.photo_data && !record.audio_present) {
      taskType = 'photo_description';
    } else if (record.audio_present && record.audio_data && !record.photo_present) {
      taskType = 'audio_transcription';
    }
    
    // Create task
    const task: AIProcessingTask = {
      id: crypto.randomUUID(),
      recordId: record.id,
      taskType,
      photoData: record.photo_data,
      audioData: record.audio_data,
      context: this.buildContext(record),
      retries: 0,
      lastAttempt: Date.now(),
      createdAt: Date.now(),
    };
    
    tasks.push(task);
    this.save(tasks);
    
    console.log(`[AIQueue] Queued ${taskType} processing for record ${record.id}`);
    
    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }
  
  /**
   * Check if record already has AI index
   */
  private isProcessed(record: BaseRecord): boolean {
    // Check if record already has AI-generated index
    const r = record as any;
    return r.ai_indexed === true || 
           r.photo_caption !== undefined ||
           r.audio_transcript !== undefined;
  }
  
  /**
   * Build context for AI processing
   */
  private buildContext(record: BaseRecord): Record<string, any> {
    const context: Record<string, any> = {
      task_type: record.task_type,
      note: record.note,
      timestamp: new Date(record.ts || Date.now()).toISOString(),
    };
    
    // Add task-specific fields
    Object.keys(record).forEach(key => {
      if (!['id', 'ts', 'task_type', 'lat', 'lon', 'acc', 'note', 
            'photo_present', 'photo_data', 'audio_present', 'audio_data',
            'synced', 'createdAt', 'updatedAt'].includes(key)) {
        context[key] = (record as any)[key];
      }
    });
    
    return context;
  }
  
  /**
   * Get all queued tasks
   */
  list(): AIProcessingTask[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  /**
   * Save queue to localStorage
   */
  private save(tasks: AIProcessingTask[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error('[AIQueue] Failed to save queue:', err);
    }
  }
  
  /**
   * Remove task from queue
   */
  private remove(taskId: string): void {
    const tasks = this.list().filter(t => t.id !== taskId);
    this.save(tasks);
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
    
    const tasks = this.list();
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
        this.remove(task.id);
        continue;
      }
      
      try {
        await this.processTask(task);
        // Success: remove from queue
        this.remove(task.id);
        console.log(`[AIQueue] ✅ Processed task ${task.id} for record ${task.recordId}`);
      } catch (err) {
        // Failure: increment retries
        console.error(`[AIQueue] Task ${task.id} failed:`, err);
        task.retries++;
        task.lastAttempt = Date.now();
        this.save(this.list().map(t => t.id === task.id ? task : t));
      }
    }
  }
  
  /**
   * Process a single task
   */
  private async processTask(task: AIProcessingTask): Promise<void> {
    // Get record from database
    const record = await visitDB.get(task.recordId);
    if (!record) {
      throw new Error(`Record ${task.recordId} not found`);
    }
    
    const index: any = {};
    
    // Process photo
    if ((task.taskType === 'photo_description' || task.taskType === 'both') && task.photoData) {
      const description = await this.mediaProcessor.describePhoto(
        task.photoData,
        task.context || {}
      );
      index.photo_caption = description.caption;
      index.photo_detected_objects = description.detected_objects;
      index.photo_condition_assessment = description.condition_assessment;
    }
    
    // Process audio
    if ((task.taskType === 'audio_transcription' || task.taskType === 'both') && task.audioData) {
      let trText = '';
      let trSummary = '';
      let trLang = 'unknown';

      try {
        if (!navigator.onLine || localWhisper.isReady()) {
          console.log('[AIQueue] Using offline Whisper for STT');
          if (!localWhisper.isReady()) {
            await localWhisper.initialize();
          }
          const res = await fetch(task.audioData);
          const audioBlob = await res.blob();
          trText = await localWhisper.transcribe(audioBlob);
          trSummary = trText.substring(0, 200);
        } else {
          console.log('[AIQueue] Using Cloud API for STT');
          const transcription = await this.mediaProcessor.transcribeAudio(task.audioData);
          trText = transcription.transcript;
          trSummary = transcription.summary;
          trLang = transcription.language;
        }
      } catch (err: any) {
        console.error('[AIQueue] STT failed:', err);
        trSummary = `Audio available (STT Error: ${err.message})`;
      }

      index.audio_transcript = trText;
      index.audio_summary = trSummary;
      index.audio_language = trLang;
    }
    
    // Update record in database with AI-generated index
    await visitDB.update(task.recordId, {
      ...(index.photo_caption && { photo_caption: index.photo_caption }),
      ...(index.audio_transcript && { audio_transcript: index.audio_transcript }),
      ...(index.audio_summary && { audio_summary: index.audio_summary }),
      ai_indexed: true, // Mark as processed
      updatedAt: Date.now(),
    });
    
    console.log(`[AIQueue] Updated record ${task.recordId} with AI index`);
  }
  
  /**
   * Get processing status
   */
  getStatus(): { queued: number; processing: boolean } {
    return {
      queued: this.list().length,
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

