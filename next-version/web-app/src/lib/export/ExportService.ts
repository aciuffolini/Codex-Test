/**
 * Generic Export Service - Template-Aware
 * Works with any farm task template
 */

import { BaseRecord, getTemplate, TaskTemplate } from '@farm-visit/shared';
import { EnhancedRecord, ExportOptions, ExportResult } from './types';
import { MediaProcessor } from './MediaProcessor';
import { CSVExporter } from './formats/CSVExporter';
import { JSONExporter } from './formats/JSONExporter';
import { ZipExporter } from './formats/ZipExporter';

export class ExportService {
  private mediaProcessor: MediaProcessor;
  
  constructor(apiKey?: string) {
    this.mediaProcessor = new MediaProcessor(apiKey);
  }
  
  /**
   * Export records - template-aware
   */
  async export(
    records: BaseRecord[],
    options: ExportOptions
  ): Promise<ExportResult> {
    // 1. Filter records
    const filtered = this.filterRecords(records, options);
    
    // 2. Enhance with media and AI index
    const enhanced = await this.enhanceRecords(filtered, options);
    
    // 3. Export in requested format
    switch (options.format) {
      case 'csv':
        return CSVExporter.export(enhanced, options);
      case 'json':
        return JSONExporter.export(enhanced, options);
      case 'zip':
        return ZipExporter.export(enhanced, options);
      default:
        throw new Error(`Unknown format: ${options.format}`);
    }
  }
  
  /**
   * Filter records by options
   */
  private filterRecords(
    records: BaseRecord[],
    options: ExportOptions
  ): BaseRecord[] {
    let filtered = [...records];
    
    // Filter by task type
    if (options.taskTypes?.length) {
      filtered = filtered.filter(r => options.taskTypes!.includes(r.task_type));
    }
    
    // Filter by date range
    if (options.fromDate) {
      filtered = filtered.filter(r => (r.ts || 0) >= options.fromDate!.getTime());
    }
    if (options.toDate) {
      filtered = filtered.filter(r => (r.ts || Date.now()) <= options.toDate!.getTime());
    }
    
    // Filter by field IDs (generic - works for any task)
    if (options.fieldIds?.length) {
      filtered = filtered.filter(r => {
        // Check common field identifiers based on task type
        const template = getTemplate(r.task_type);
        if (!template) return false;
        
        // Check if record has any matching field identifier
        const fieldKey = this.getFieldKeyForTask(r.task_type);
        return fieldKey && options.fieldIds!.includes((r as any)[fieldKey] || '');
      });
    }
    
    return filtered;
  }
  
  /**
   * Get field identifier key for a task type
   */
  private getFieldKeyForTask(taskType: string): string | null {
    const mapping: Record<string, string> = {
      'field_visit': 'field_id',
      'pasture_rotation': 'paddock_id',
      'bunk_management': 'bunk_id',
    };
    return mapping[taskType] || null;
  }
  
  /**
   * Enhance records with media metadata and AI index
   */
  private async enhanceRecords(
    records: BaseRecord[],
    options: ExportOptions
  ): Promise<EnhancedRecord[]> {
    const enhanced: EnhancedRecord[] = [];
    
    for (const record of records) {
      const enhancedRecord: EnhancedRecord = { ...record };
      
      // Process photo
      if (record.photo_data && record.photo_present) {
        enhancedRecord.media = enhancedRecord.media || {};
        enhancedRecord.media.photo = {
          filename: `visit_${record.id}_photo.jpg`,
          sizeBytes: Math.round(record.photo_data.length * 0.75),
          mimeType: 'image/jpeg',
          present: true,
        };
        
        // Generate AI index (lightweight caption)
        if (options.generateIndex && options.apiKey) {
          const template = getTemplate(record.task_type);
          const context = this.buildContextForPhoto(record, template);
          
          const description = await this.mediaProcessor.describePhoto(
            record.photo_data,
            context
          );
          
          enhancedRecord.index = enhancedRecord.index || {};
          enhancedRecord.index.photo_caption = description.caption;
        }
      }
      
      // Process audio
      if (record.audio_data && record.audio_present) {
        enhancedRecord.media = enhancedRecord.media || {};
        enhancedRecord.media.audio = {
          filename: `visit_${record.id}_audio.webm`,
          sizeBytes: Math.round(record.audio_data.length * 0.75),
          mimeType: 'audio/webm',
          present: true,
        };
        
        // Transcribe audio
        if (options.generateIndex && options.apiKey) {
          const transcription = await this.mediaProcessor.transcribeAudio(
            record.audio_data
          );
          
          enhancedRecord.index = enhancedRecord.index || {};
          enhancedRecord.index.audio_transcript = transcription.transcript;
          enhancedRecord.index.audio_summary = transcription.summary;
        }
      }
      
      // Generate embedding text (for future RAG)
      if (enhancedRecord.index) {
        const template = getTemplate(record.task_type);
        if (template?.ragConfig?.generateEmbeddingText) {
          enhancedRecord.index.embedding_text = template.ragConfig.generateEmbeddingText(record);
        }
      }
      
      enhanced.push(enhancedRecord);
    }
    
    return enhanced;
  }
  
  /**
   * Build context for photo description based on task type
   */
  private buildContextForPhoto(record: BaseRecord, template?: TaskTemplate): Record<string, any> {
    const context: Record<string, any> = {
      task_type: record.task_type,
      note: record.note,
    };
    
    // Add task-specific fields
    if (template) {
      const taskFields = template.ragConfig?.embeddingFields || [];
      for (const field of taskFields) {
        if ((record as any)[field]) {
          context[field] = (record as any)[field];
        }
      }
    }
    
    return context;
  }
}


