/**
 * Media Processor - AI-powered media analysis
 * Generates lightweight index (captions, transcripts) for RAG
 * Preserves raw media for on-demand deep analysis
 */

export interface PhotoDescription {
  caption: string;              // Quick description for search
  detected_objects?: string[];
  condition_assessment?: string;
}

export interface AudioTranscription {
  transcript: string;           // Full transcription
  summary: string;              // Brief summary
  language: string;
}

export class MediaProcessor {
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }
  
  /**
   * Generate lightweight caption for photo (for RAG index)
   * Preserves raw photo for on-demand deep analysis
   */
  async describePhoto(
    photoData: string,
    context: Record<string, any>
  ): Promise<PhotoDescription> {
    if (!this.apiKey) {
      return { caption: 'Photo available (no API key for description)' };
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Generate a brief caption (1-2 sentences) for this agricultural field photo.
Include: crop type, visible issues, condition. Keep it concise for search indexing.
Respond in JSON: {"caption": "string", "detected_objects": ["string"], "condition_assessment": "string"}`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Context: ${JSON.stringify(context)}`
                },
                {
                  type: 'image_url',
                  image_url: { url: photoData }
                }
              ]
            }
          ],
          max_tokens: 200,
        }),
      });
      
      const result = await response.json();
      const content = result.choices[0]?.message?.content || '';
      
      try {
        return JSON.parse(content);
      } catch {
        return { caption: content || 'Photo available' };
      }
    } catch (error: any) {
      console.warn('[MediaProcessor] Photo description failed:', error.message);
      return { caption: 'Photo available (description generation failed)' };
    }
  }
  
  /**
   * Transcribe audio (for RAG index)
   * Preserves raw audio for on-demand analysis
   */
  async transcribeAudio(audioData: string): Promise<AudioTranscription> {
    if (!this.apiKey) {
      return {
        transcript: '',
        summary: 'Audio available (no API key for transcription)',
        language: 'unknown',
      };
    }
    
    try {
      // Convert base64 to blob
      const base64 = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Detect mime type and determine file extension
      let mimeType = 'audio/webm';
      let fileExtension = 'webm';
      
      if (audioData.startsWith('data:')) {
        const mimeMatch = audioData.match(/data:([^;]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
          // Map mime types to file extensions for Whisper API
          if (mimeType.includes('webm')) {
            fileExtension = 'webm';
          } else if (mimeType.includes('mp3')) {
            fileExtension = 'mp3';
          } else if (mimeType.includes('wav')) {
            fileExtension = 'wav';
          } else if (mimeType.includes('m4a')) {
            fileExtension = 'm4a';
          } else if (mimeType.includes('mp4')) {
            fileExtension = 'mp4';
          } else {
            // Default to webm for unknown types
            fileExtension = 'webm';
          }
        }
      }
      
      const audioBlob = new Blob([bytes], { type: mimeType });
      
      // Check file size (Whisper API limit is 25MB)
      if (audioBlob.size > 25 * 1024 * 1024) {
        throw new Error(`Audio file too large: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB (max 25MB)`);
      }
      
      // Create form data for Whisper API
      const formData = new FormData();
      formData.append('file', audioBlob, `audio.${fileExtension}`);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      // Add language hint if available (optional, helps accuracy)
      // formData.append('language', 'es'); // Uncomment if you know the language
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          // Don't set Content-Type - let browser set it with boundary for FormData
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Whisper API error: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          errorMessage = `${errorMessage} - ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      return {
        transcript: result.text || '',
        summary: result.text ? result.text.substring(0, 200) + (result.text.length > 200 ? '...' : '') : '',
        language: result.language || 'unknown',
      };
    } catch (error: any) {
      console.error('[MediaProcessor] Audio transcription failed:', error.message);
      // Return empty transcript but don't fail completely
      return {
        transcript: '',
        summary: `Audio available (transcription failed: ${error.message})`,
        language: 'unknown',
      };
    }
  }
}

