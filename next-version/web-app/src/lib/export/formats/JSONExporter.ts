/**
 * JSON Exporter - Full data with embedded media (hybrid approach)
 * Preserves raw media for on-demand analysis + lightweight index for RAG
 */

import { EnhancedRecord, ExportOptions, ExportResult } from '../types';
import { getTemplate } from '@farm-visit/shared';

export class JSONExporter {
  static export(
    records: EnhancedRecord[],
    options: ExportOptions
  ): ExportResult {
    if (records.length === 0) {
      throw new Error('No records to export');
    }
    
    // Transform records based on format
    const transformed = records.map(record => this.transformRecord(record, options));
    
    const exportData = {
      exportDate: new Date().toISOString(),
      format: 'json',
      version: '1.0',
      totalRecords: records.length,
      recordsByTask: this.countByTask(records),
      records: transformed,
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = `farm_records_${new Date().toISOString().split('T')[0]}.json`;
    
    return {
      success: true,
      format: 'json',
      totalRecords: records.length,
      recordsByTask: this.countByTask(records),
      recordsWithPhotos: records.filter(r => r.photo_present).length,
      recordsWithAudio: records.filter(r => r.audio_present).length,
      photosIndexed: records.filter(r => r.index?.photo_caption).length,
      audiosTranscribed: records.filter(r => r.index?.audio_transcript).length,
      data: json,
      filename,
      mimeType: 'application/json',
      sizeBytes: blob.size,
    };
  }
  
  /**
   * Transform record based on media format option
   */
  private static transformRecord(record: EnhancedRecord, options: ExportOptions): any {
    const template = getTemplate(record.task_type);
    
    // Base structure
    const transformed: any = {
      id: record.id,
      ts: record.ts,
      timestamp: new Date(record.ts).toISOString(),
      task_type: record.task_type,
      lat: record.lat,
      lon: record.lon,
      acc: record.acc,
      note: record.note,
      synced: record.synced,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    
    // Add task-specific fields
    if (template) {
      const taskFields = template.ragConfig?.embeddingFields || [];
      for (const field of taskFields) {
        if ((record as any)[field] !== undefined) {
          transformed[field] = (record as any)[field];
        }
      }
      // Add all other task-specific fields
      Object.keys(record).forEach(key => {
        if (!['id', 'ts', 'task_type', 'lat', 'lon', 'acc', 'note', 'photo_present', 
              'photo_data', 'audio_present', 'audio_data', 'synced', 'createdAt', 
              'updatedAt', 'index', 'media'].includes(key)) {
          transformed[key] = (record as any)[key];
        }
      });
    }
    
    // Media handling
    if (options.includeMedia) {
      if (options.mediaFormat === 'embedded' && record.photo_data) {
        transformed.raw_media = {
          photo_data: record.photo_data,
          audio_data: record.audio_data,
        };
      } else if (options.mediaFormat === 'referenced') {
        transformed.media_references = {
          photo: record.media?.photo?.filename,
          audio: record.media?.audio?.filename,
        };
      }
    }
    
    // Index (lightweight for RAG)
    if (record.index) {
      transformed.index = {
        photo_caption: record.index.photo_caption,
        audio_transcript: record.index.audio_transcript,
        audio_summary: record.index.audio_summary,
        embedding_text: record.index.embedding_text,
      };
    }
    
    return transformed;
  }
  
  /**
   * Count records by task type
   */
  private static countByTask(records: EnhancedRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const record of records) {
      counts[record.task_type] = (counts[record.task_type] || 0) + 1;
    }
    return counts;
  }
}


