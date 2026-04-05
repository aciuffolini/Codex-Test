/**
 * Farm Task Template System
 * 
 * Scalable architecture for different farm management tasks:
 * - Field Visits (crop issues, pest management)
 * - Pasture Management (rotational grazing)
 * - Bunk Management (feed inventory)
 * - Health Management (animal health records)
 * - Future tasks...
 */

import { z } from "zod";

/**
 * Media Pointer - Unified storage abstraction
 * Supports: Blob (web), File (Android), Remote (server)
 */
export const MediaPointerSchema = z.object({
  kind: z.enum(['blob', 'file', 'remote']),
  uri: z.string().optional(), // File path (Android) or remote URL
  blobKey: z.string().optional(), // IndexedDB blob key (web)
  mimeType: z.string().optional(),
  size: z.number().int().optional(),
});

export type MediaPointer = z.infer<typeof MediaPointerSchema>;

/**
 * AI Status - Per-task completion tracking
 */
export const AIStatusSchema = z.object({
  captionDone: z.boolean().default(false),
  transcriptDone: z.boolean().default(false),
  embeddingDone: z.boolean().default(false),
  lastError: z.string().optional(),
});

export type AIStatus = z.infer<typeof AIStatusSchema>;

/**
 * Sync Status
 */
export const SyncStatusSchema = z.enum(['pending', 'syncing', 'synced', 'failed']);

export type SyncStatus = z.infer<typeof SyncStatusSchema>;

/**
 * Base Record - Common fields for all farm tasks
 * 
 * CHANGES:
 * - Uses createdAt as primary timestamp (ts deprecated but kept for migration)
 * - Media stored as pointers (not base64)
 * - AI status tracked per-task
 * - Sync status tracked separately
 */
export const BaseRecordSchema = z.object({
  id: z.string().default(() => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      return globalThis.crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }),
  
  // Timestamps: createdAt is primary, ts kept for backward compatibility
  createdAt: z.number().int().default(() => Date.now()),
  updatedAt: z.number().int().default(() => Date.now()),
  ts: z.number().int().optional(), // Deprecated - use createdAt
  
  task_type: z.string(), // Template identifier: "field_visit", "pasture_rotation", "bunk_management", etc.
  
  // Location (always available)
  lat: z.number().optional(),
  lon: z.number().optional(),
  acc: z.number().int().optional(),
  
  // Media pointers (replaces base64 storage)
  photo_present: z.boolean().default(false),
  photo: MediaPointerSchema.optional(),
  audio_present: z.boolean().default(false),
  audio: MediaPointerSchema.optional(),
  
  // Legacy base64 fields (for migration - will be removed)
  photo_data: z.string().optional(), // @deprecated - use photo pointer
  audio_data: z.string().optional(), // @deprecated - use audio pointer
  
  // Notes (always available)
  note: z.string().optional(),
  
  // AI artifacts (generated from media)
  photo_caption: z.string().optional(),
  audio_transcript: z.string().optional(),
  audio_summary: z.string().optional(),
  
  // AI status (per-task completion)
  aiStatus: AIStatusSchema.default({ captionDone: false, transcriptDone: false, embeddingDone: false }),
  
  // Sync status
  syncStatus: SyncStatusSchema.default('pending'),
  syncedAt: z.number().int().optional(),
  
  // Legacy sync flag (for migration)
  synced: z.boolean().optional(), // @deprecated - use syncStatus
});

export type BaseRecord = z.infer<typeof BaseRecordSchema>;

/**
 * Task Template Definition
 * Defines the schema and behavior for a specific farm task type
 */
export interface TaskTemplate {
  /** Unique identifier: "field_visit", "pasture_rotation", etc. */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of what this task type is for */
  description: string;
  
  /** Icon/emoji for UI */
  icon?: string;
  
  /** Zod schema for task-specific fields */
  schema: z.ZodObject<any>;
  
  /** Default values for new records */
  defaults?: Record<string, any>;
  
  /** Field definitions for UI forms */
  fields: TaskField[];
  
  /** Validation rules */
  validators?: {
    beforeSave?: (record: any) => Promise<void> | void;
    afterSave?: (record: any) => Promise<void> | void;
  };
  
  /** Export configuration */
  exportConfig?: {
    csvColumns?: string[];
    jsonTransform?: (record: any) => any;
  };
  
  /** RAG indexing configuration */
  ragConfig?: {
    /** Fields to include in embedding text */
    embeddingFields?: string[];
    /** Custom text generator for embeddings */
    generateEmbeddingText?: (record: any) => string;
  };
}

/**
 * Field Definition for UI
 */
export interface TaskField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean' | 'textarea';
  required?: boolean;
  options?: { value: string; label: string }[]; // For select fields
  placeholder?: string;
  helpText?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Complete Record = Base + Task-Specific Fields
 */
export type FarmRecord<T = any> = BaseRecord & T;
