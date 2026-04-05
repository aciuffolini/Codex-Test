/**
 * ZIP Exporter - CSV + separate media files
 * Best for distribution and archival
 */

import JSZip from 'jszip';
import { EnhancedRecord, ExportOptions, ExportResult } from '../types';
import { CSVExporter } from './CSVExporter';
import { JSONExporter } from './JSONExporter';

export class ZipExporter {
  static async export(
    records: EnhancedRecord[],
    options: ExportOptions
  ): Promise<ExportResult> {
    if (records.length === 0) {
      throw new Error('No records to export');
    }
    
    const zip = new JSZip();
    
    // 1. Add CSV
    const csvResult = CSVExporter.export(records, options);
    zip.file('records.csv', csvResult.data as string);
    
    // 2. Add JSON (for programmatic access)
    const jsonResult = JSONExporter.export(records, { ...options, mediaFormat: 'referenced' });
    zip.file('records.json', jsonResult.data as string);
    
    // 3. Add media files
    const mediaFolder = zip.folder('media');
    if (mediaFolder) {
      for (const record of records) {
        // Add photo
        if (record.photo_data && record.photo_present) {
          const base64 = record.photo_data.includes(',') 
            ? record.photo_data.split(',')[1] 
            : record.photo_data;
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          mediaFolder.file(
            record.media?.photo?.filename || `visit_${record.id}_photo.jpg`,
            bytes
          );
        }
        
        // Add audio
        if (record.audio_data && record.audio_present) {
          const base64 = record.audio_data.includes(',')
            ? record.audio_data.split(',')[1]
            : record.audio_data;
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          mediaFolder.file(
            record.media?.audio?.filename || `visit_${record.id}_audio.webm`,
            bytes
          );
        }
      }
    }
    
    // 4. Add README
    const readme = this.generateReadme(records, options);
    zip.file('README.txt', readme);
    
    // 5. Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const filename = `farm_records_${new Date().toISOString().split('T')[0]}.zip`;
    
    return {
      success: true,
      format: 'zip',
      totalRecords: records.length,
      recordsByTask: this.countByTask(records),
      recordsWithPhotos: records.filter(r => r.photo_present).length,
      recordsWithAudio: records.filter(r => r.audio_present).length,
      photosIndexed: records.filter(r => r.index?.photo_caption).length,
      audiosTranscribed: records.filter(r => r.index?.audio_transcript).length,
      data: zipBlob,
      filename,
      mimeType: 'application/zip',
      sizeBytes: zipBlob.size,
    };
  }
  
  /**
   * Generate README for ZIP
   */
  private static generateReadme(records: EnhancedRecord[], options: ExportOptions): string {
    return `Farm Records Export
Generated: ${new Date().toISOString()}

Total Records: ${records.length}
Records with Photos: ${records.filter(r => r.photo_present).length}
Records with Audio: ${records.filter(r => r.audio_present).length}

Files:
- records.csv: Spreadsheet format with metadata and media references
- records.json: Full structured data with media references
- media/: Folder containing all photos and audio files

Task Types:
${Object.entries(this.countByTask(records)).map(([type, count]) => `  - ${type}: ${count}`).join('\n')}

Note: Media files are referenced by filename in CSV/JSON.
Raw media data is preserved for on-demand AI analysis.
`;
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


