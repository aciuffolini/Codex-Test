/**
 * Local Offline Whisper instance using Transformers.js
 * Converts Audio Blobs to Text (STT) locally via WebGPU/WASM
 */
import { pipeline, env } from '@huggingface/transformers';

// Disable local models cache if we want strictly HuggingFace Hub downloads
env.allowLocalModels = false;
env.useBrowserCache = true; // Use IndexedDB

export type WhisperInitCallback = (progressInfo: any) => void;

export class LocalWhisper {
  private transcriber: any = null;
  private initializing: boolean = false;
  private lastProgressText: string = '';
  private readonly MODEL_ID = 'Xenova/whisper-tiny';

  async initialize(onProgress?: WhisperInitCallback): Promise<void> {
    if (this.transcriber) return;
    if (this.initializing) throw new Error('Already initializing Whisper Local model. Please wait.');

    this.initializing = true;
    try {
      console.log(`[LocalWhisper] Loading ${this.MODEL_ID}...`);
      this.transcriber = await pipeline('automatic-speech-recognition', this.MODEL_ID, {
        device: typeof navigator !== 'undefined' && (navigator as any).gpu ? 'webgpu' : 'wasm',
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            this.lastProgressText = `Downloading Whisper: ${Math.round((progress.loaded / progress.total) * 100)}%`;
          } else if (progress.status === 'ready') {
            this.lastProgressText = 'Whisper Ready';
          }
          if (onProgress) onProgress(progress);
        },
      });
      console.log('[LocalWhisper] Engine initialized successfully!');
    } catch (err: any) {
      console.error('[LocalWhisper] Initialization failed:', err);
      this.transcriber = null;
      throw new Error(`Failed to load Whisper model: ${err.message}`);
    } finally {
      this.initializing = false;
    }
  }

  isReady(): boolean {
    return this.transcriber !== null;
  }

  getProgress(): string {
    return this.lastProgressText;
  }

  /**
   * Transcribe an Audio Blob locally to text
   */
  async transcribe(audioBlob: Blob, language: string = 'english'): Promise<string> {
    if (!this.transcriber) {
      throw new Error('Whisper is not initialized. Please load the model first.');
    }

    try {
      // We must resample the audio Blob to 16kHz Float32Array PCM
      const audioData = await this.readAndResampleAudio(audioBlob);

      // Generate the transcript
      const result = await this.transcriber(audioData, {
        chunk_length_s: 30, // For long audio support
        stride_length_s: 5,
        language: language,
        task: 'transcribe',
      });
      
      return result.text;
    } catch (err: any) {
      console.error('[LocalWhisper] Transcription failed:', err);
      throw new Error(`Transcription failed: ${err.message}`);
    }
  }

  /**
   * Reads an audio Blob and converts it to 16,000Hz PCM Float32Array required by Whisper
   */
  private async readAndResampleAudio(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000 
    });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer.getChannelData(0); // Mono channel 0
  }
}

export const localWhisper = new LocalWhisper();
