/**
 * Local Database (IndexedDB via Dexie)
 * Stores visits locally for offline-first functionality
 * 
 * UPDATED: Supports new data model with:
 * - createdAt as primary timestamp
 * - Media pointers (not base64)
 * - Per-task AI status
 * - Sync status tracking
 */

import Dexie, { Table } from 'dexie';
import { BaseRecord, MediaPointer, AIStatus, SyncStatus } from '@farm-visit/shared';

/**
 * Visit Record Interface
 * Updated to match new BaseRecord schema
 */
export interface VisitRecord extends BaseRecord {
  // Task-specific fields (for field_visit template)
  field_id?: string;
  crop?: string;
  issue?: string;
  severity?: number;
  
  // Legacy fields (for migration)
  photo_data?: string; // @deprecated
  audio_data?: string; // @deprecated
  synced?: boolean; // @deprecated
  ts?: number; // @deprecated
}

/**
 * Database Schema Version 2
 * 
 * Changes from v1:
 * - Added createdAt, updatedAt indexes
 * - Added syncStatus index
 * - Added aiStatus fields
 * - Media pointers (photo, audio) instead of base64
 */
class FarmVisitDB extends Dexie {
  visits!: Table<VisitRecord>;
  aiQueue!: Table<AIQueueTask>;
  syncQueue!: Table<SyncQueueTask>;

  constructor() {
    super('FarmVisitDB');
    
    // Version 2: New schema with media pointers and AI status
    this.version(2).stores({
      visits: 'id, createdAt, updatedAt, syncStatus, task_type, field_id',
      aiQueue: 'id, recordId, taskType, createdAt',
      syncQueue: 'id, recordId, createdAt',
    });
    
    // Migration from v1 to v2
    this.version(2).upgrade(async (tx) => {
      const visits = tx.table('visits');
      const oldRecords = await visits.toArray();
      
      for (const record of oldRecords) {
        const updates: Partial<VisitRecord> = {};
        
        // Migrate timestamps
        if (!record.createdAt && (record as any).ts) {
          updates.createdAt = (record as any).ts;
        }
        if (!record.updatedAt) {
          updates.updatedAt = record.createdAt || Date.now();
        }
        
        // Migrate media from base64 to pointers
        if ((record as any).photo_data && !record.photo) {
          // Keep base64 for now, will be migrated on next save
          // This allows gradual migration
        }
        if ((record as any).audio_data && !record.audio) {
          // Keep base64 for now
        }
        
        // Migrate sync status
        if (record.synced !== undefined && !record.syncStatus) {
          updates.syncStatus = record.synced ? 'synced' : 'pending';
          if (record.synced) {
            updates.syncedAt = record.updatedAt || Date.now();
          }
        }
        
        // Initialize AI status if missing
        if (!record.aiStatus) {
          updates.aiStatus = {
            captionDone: !!(record as any).photo_caption,
            transcriptDone: !!(record as any).audio_transcript,
            embeddingDone: false,
          };
        }
        
        if (Object.keys(updates).length > 0) {
          await visits.update(record.id, updates);
        }
      }
    });
  }
}

export const db = new FarmVisitDB();

/**
 * AI Queue Task
 */
export interface AIQueueTask {
  id: string;
  recordId: string;
  taskType: 'photo_caption' | 'audio_transcript' | 'embedding';
  retries: number;
  lastAttempt: number;
  createdAt: number;
}

/**
 * Sync Queue Task
 */
export interface SyncQueueTask {
  id: string;
  recordId: string;
  retries: number;
  lastAttempt: number;
  createdAt: number;
}

// Helper functions
export const visitDB = {
  async list(limit = 50): Promise<VisitRecord[]> {
    return db.visits.orderBy('createdAt').reverse().limit(limit).toArray();
  },

  async get(id: string): Promise<VisitRecord | undefined> {
    return db.visits.get(id);
  },

  async insert(visit: Omit<VisitRecord, 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const record: VisitRecord = {
      ...visit,
      createdAt: (visit as any).createdAt || now,
      updatedAt: now,
      syncStatus: visit.syncStatus || 'pending',
      aiStatus: visit.aiStatus || {
        captionDone: false,
        transcriptDone: false,
        embeddingDone: false,
      },
    };
    await db.visits.add(record);
    return visit.id;
  },

  async update(id: string, updates: Partial<VisitRecord>): Promise<void> {
    await db.visits.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  async markSynced(id: string): Promise<void> {
    await db.visits.update(id, { 
      syncStatus: 'synced',
      syncedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async getUnsynced(): Promise<VisitRecord[]> {
    return db.visits.where('syncStatus').anyOf(['pending', 'failed']).toArray();
  },

  async clear(): Promise<void> {
    await db.visits.clear();
  },
};

/**
 * AI Queue helpers
 */
export const aiQueue = {
  async add(task: Omit<AIQueueTask, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    await db.aiQueue.add({
      ...task,
      id,
      createdAt: Date.now(),
    });
    return id;
  },

  async list(): Promise<AIQueueTask[]> {
    return db.aiQueue.orderBy('createdAt').toArray();
  },

  async remove(id: string): Promise<void> {
    await db.aiQueue.delete(id);
  },

  async getByRecord(recordId: string): Promise<AIQueueTask[]> {
    return db.aiQueue.where('recordId').equals(recordId).toArray();
  },
};

/**
 * Sync Queue helpers
 */
export const syncQueue = {
  async add(task: Omit<SyncQueueTask, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    await db.syncQueue.add({
      ...task,
      id,
      createdAt: Date.now(),
    });
    return id;
  },

  async list(): Promise<SyncQueueTask[]> {
    return db.syncQueue.orderBy('createdAt').toArray();
  },

  async remove(id: string): Promise<void> {
    await db.syncQueue.delete(id);
  },

  async getByRecord(recordId: string): Promise<SyncQueueTask | undefined> {
    return db.syncQueue.where('recordId').equals(recordId).first();
  },
};
