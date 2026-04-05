/**
 * CSV Exporter - Metadata only, references to media files
 * Keeps CSV human-readable in Excel
 */

import { EnhancedRecord, ExportOptions, ExportResult } from '../types';
import { getTemplate } from '@farm-visit/shared';

export class CSVExporter {
  static export(
    records: EnhancedRecord[],
    options: ExportOptions
  ): ExportResult {
    if (records.length === 0) {
      throw new Error('No records to export');
    }
    
    // Get columns from template or use defaults
    const columns = this.getColumns(records, options);
    
    // Build CSV rows
    const rows = records.map(record => {
      return columns.map(col => {
        const value = this.getValue(record, col);
        return this.escapeCSV(value);
      });
    });
    
    // Combine header + rows
    const csv = [
      columns.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `farm_records_${new Date().toISOString().split('T')[0]}.csv`;
    
    return {
      success: true,
      format: 'csv',
      totalRecords: records.length,
      recordsByTask: this.countByTask(records),
      recordsWithPhotos: records.filter(r => r.photo_present).length,
      recordsWithAudio: records.filter(r => r.audio_present).length,
      photosIndexed: records.filter(r => r.index?.photo_caption).length,
      audiosTranscribed: records.filter(r => r.index?.audio_transcript).length,
      data: csv,
      filename,
      mimeType: 'text/csv',
      sizeBytes: blob.size,
    };
  }
  
  /**
   * Get CSV columns based on templates
   */
  private static getColumns(records: EnhancedRecord[], options: ExportOptions): string[] {
    // Base columns (always present)
    const baseColumns = ['id', 'ts', 'task_type', 'lat', 'lon', 'note'];
    
    // Get unique task types
    const taskTypes = [...new Set(records.map(r => r.task_type))];
    
    // Get template-specific columns
    const templateColumns: string[] = [];
    for (const taskType of taskTypes) {
      const template = getTemplate(taskType);
      if (template?.exportConfig?.csvColumns) {
        // Add task-specific columns (excluding base ones)
        const taskCols = template.exportConfig.csvColumns.filter(
          col => !baseColumns.includes(col) && !templateColumns.includes(col)
        );
        templateColumns.push(...taskCols);
      }
    }
    
    // Media columns
    const mediaColumns = [
      'photo_present',
      'photo_filename',
      'photo_caption',
      'audio_present',
      'audio_filename',
      'audio_transcript',
    ];
    
    return [...baseColumns, ...templateColumns, ...mediaColumns];
  }
  
  /**
   * Get value for a column
   */
  private static getValue(record: EnhancedRecord, column: string): any {
    // Base fields
    if (column in record) {
      const value = (record as any)[column];
      if (value === null || value === undefined) return '';
      if (column === 'ts') return new Date(value).toISOString();
      return value;
    }
    
    // Media fields
    if (column === 'photo_filename') {
      return record.media?.photo?.filename || '';
    }
    if (column === 'photo_caption') {
      return record.index?.photo_caption || '';
    }
    if (column === 'audio_filename') {
      return record.media?.audio?.filename || '';
    }
    if (column === 'audio_transcript') {
      return record.index?.audio_transcript || '';
    }
    
    return '';
  }
  
  /**
   * Escape CSV value
   */
  private static escapeCSV(value: any): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
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


