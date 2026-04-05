/**
 * Export Types - Template-Aware Export System
 */

import { FarmRecord, BaseRecord } from '@farm-visit/shared';

/**
 * Enhanced record with AI-generated metadata and raw media preserved
 */
export interface EnhancedRecord extends FarmRecord {
  // AI-generated metadata (lightweight index)
  index?: {
    photo_caption?: string;        // Quick description for search
    audio_transcript?: string;      // Full transcription
    audio_summary?: string;         // Brief summary
    embedding_text?: string;        // Combined text for embedding
  };
  
  // Media metadata (without full data for CSV)
  media?: {
    photo?: {
      filename: string;
      sizeBytes: number;
      mimeType: string;
      present: boolean;
    };
    audio?: {
      filename: string;
      sizeBytes: number;
      mimeType: string;
      durationSeconds?: number;
      present: boolean;
    };
  };
}

/**
 * Export options - template-aware
 */
export interface ExportOptions {
  // Format selection
  format: 'csv' | 'json' | 'zip';
  
  // Task filtering
  taskTypes?: string[];              // Filter by task type: ['field_visit', 'pasture_rotation']
  
  // Media handling
  includeMedia: boolean;
  mediaFormat: 'embedded' | 'referenced' | 'separate';
  
  // AI processing (for index generation)
  generateIndex: boolean;            // Generate captions/transcripts for RAG
  apiKey?: string;                    // OpenAI API key for processing
  
  // Filtering
  fromDate?: Date;
  toDate?: Date;
  fieldIds?: string[];                // Generic field filter (works for any task)
  
  // Compression
  compressImages?: boolean;
  maxImageWidth?: number;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: string;
  
  // Stats
  totalRecords: number;
  recordsByTask: Record<string, number>;
  recordsWithPhotos: number;
  recordsWithAudio: number;
  
  // Processing results
  photosIndexed: number;
  audiosTranscribed: number;
  
  // Output
  data?: string | Blob;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  
  // Errors
  errors?: string[];
}


