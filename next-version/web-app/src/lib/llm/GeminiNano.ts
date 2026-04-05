/**
 * Gemini Nano Integration - On-Device Only
 * Uses ML Kit GenAI Prompt API (no API key needed)
 * Future: Multi-schema, task-dependent, multiple models
 */

import { Capacitor } from '@capacitor/core';
import GeminiNanoNative from './GeminiNanoNative';

export interface GeminiNanoConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiNanoInput {
  text?: string;
  image?: string; // base64 or dataURL (future)
  audio?: string; // base64 or dataURL (future)
  location?: { lat: number; lon: number };
}

export interface GeminiNanoOutput {
  text: string;
  structured?: unknown;
  confidence?: number;
}

export class GeminiNano {
  private config: GeminiNanoConfig;
  private initialized: boolean = false;
  private available: boolean = false;

  constructor(config: GeminiNanoConfig = {}) {
    this.config = {
      model: config.model || "gemini-nano",
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      ...config,
    };

    // Check availability on startup (if on Android)
    this.checkAvailability();
  }

  /**
   * Check if Gemini Nano is available on this device
   * IMPORTANT: On web, ALWAYS return false immediately to allow fallback to Cloud API
   */
  async checkAvailability(): Promise<boolean> {
    // On web, always return false - use Cloud API instead
    if (!Capacitor.isNativePlatform()) {
      this.available = false;
      console.log('[GeminiNano] Web platform - Gemini Nano not available, use Cloud API');
      return false;
    }

    try {
      const result = await GeminiNanoNative.isAvailable();
      this.available = result.available;
      
      if (this.available) {
        console.log('[GeminiNano] Available on device. Status:', result.status);
        
        // Auto-initialize if downloadable
        if (result.downloadable) {
          await this.initialize();
        }
      } else {
        console.warn('[GeminiNano] Not available:', result.reason);
      }
    } catch (err: any) {
      console.error('[GeminiNano] Error checking availability:', err);
      this.available = false;
    }

    return this.available;
  }

  /**
   * Initialize Gemini Nano model
   * Only works on Android 14+ devices with AICore
   */
  async initialize(): Promise<void> {
    // Only available on native Android platform
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Gemini Nano only available on Android 14+ devices with AICore');
    }

    try {
      const result = await GeminiNanoNative.initialize();
      this.initialized = result.initialized;
      
      if (this.initialized) {
        console.log('[GeminiNano] Initialized:', result.message);
      }
    } catch (err: any) {
      console.error('[GeminiNano] Initialization failed:', err);
      throw err;
    }
  }

  /**
   * Generate text completion
   */
  async generate(input: GeminiNanoInput): Promise<GeminiNanoOutput> {
    // On web, throw immediately - use Cloud API instead
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Gemini Nano not available on web - will fallback to Cloud API');
    }
    
    if (!this.available) {
      await this.checkAvailability();
      
      if (!this.available) {
        throw new Error('Gemini Nano not available on this device. Requires Android 14+ with AICore support.');
      }
    }

    if (!this.initialized) {
      await this.initialize();
    }

    if (!input.text) {
      throw new Error('Text input required');
    }

    // Check if input already contains a formatted prompt (from enhanced LLMProvider)
    // If it contains "User:" and "Assistant:" markers, use it directly
    // Otherwise, build prompt with context
    let prompt: string;
    if (input.text.includes('User:') && input.text.includes('Assistant:')) {
      // Enhanced prompt already formatted, use as-is
      prompt = input.text;
      console.log('[GeminiNano] Using enhanced prompt from LLMProvider');
    } else {
      // Build prompt with context (legacy behavior)
      prompt = this.buildPrompt(input);
    }

    try {
      const result = await GeminiNanoNative.generate({ prompt });
      
      return {
        text: result.text,
        structured: this.extractStructured(result.text),
        confidence: 0.9,
      };
    } catch (err: any) {
      console.error('[GeminiNano] Generation failed:', err);
      throw err;
    }
  }

  /**
   * Stream completion (for chat)
   * Uses Capacitor event listener pattern for async streaming
   */
  async *stream(input: GeminiNanoInput): AsyncGenerator<string> {
    // On web, throw immediately - use Cloud API instead
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Gemini Nano not available on web - will fallback to Cloud API');
    }
    
    if (!this.available) {
      await this.checkAvailability();
      
      if (!this.available) {
        throw new Error('Gemini Nano not available on this device. Requires Android 14+ with AICore support.');
      }
    }

    if (!this.initialized) {
      await this.initialize();
    }

    if (!input.text) {
      throw new Error('Text input required');
    }

    // Check if input already contains a formatted prompt (from enhanced LLMProvider)
    // If it contains "User:" and "Assistant:" markers, use it directly
    // Otherwise, build prompt with context
    let prompt: string;
    if (input.text.includes('User:') && input.text.includes('Assistant:')) {
      // Enhanced prompt already formatted, use as-is
      prompt = input.text;
      console.log('[GeminiNano] Using enhanced prompt from LLMProvider');
    } else {
      // Build prompt with context (legacy behavior)
      prompt = this.buildPrompt(input);
    }

    try {
      // Set up listener for stream chunks
      const chunks: string[] = [];
      let streamComplete = false;
      let streamError: Error | null = null;
      let listenerHandle: any = null;

      // Create promise that resolves when stream is complete
      const streamCompletePromise = new Promise<void>((resolve, reject) => {
        // Set up listener BEFORE starting stream
        listenerHandle = GeminiNanoNative.addListener('streamChunk', (data: any) => {
          try {
            if (data.done === true) {
              streamComplete = true;
              resolve();
            } else if (data.text !== undefined && data.text !== null) {
              chunks.push(data.text);
            }
          } catch (err: any) {
            streamError = err;
            streamComplete = true;
            reject(err);
          }
        });
      });

      // Start streaming (non-blocking)
      GeminiNanoNative.stream({ prompt }).catch((err: any) => {
        console.error('[GeminiNano] Stream start error:', err);
        streamError = err;
        streamComplete = true;
      });

      // Yield chunks as they arrive
      const maxWaitTime = 30000; // 30 seconds timeout
      const startTime = Date.now();

      while (!streamComplete || chunks.length > 0) {
        // Check timeout
        if (Date.now() - startTime > maxWaitTime) {
          console.warn('[GeminiNano] Stream timeout after 30s');
          break;
        }

        // Check for error
        if (streamError) {
          throw streamError;
        }

        // Yield available chunks
        while (chunks.length > 0) {
          const chunk = chunks.shift();
          if (chunk) {
            yield chunk;
          }
        }

        // Small delay to avoid busy-waiting
        await new Promise(resolve => setTimeout(resolve, 20));

        // Check if stream promise resolved (non-blocking check)
        try {
          // Use Promise.race to check if completed without blocking
          await Promise.race([
            streamCompletePromise,
            new Promise(resolve => setTimeout(resolve, 0))
          ]);
        } catch (err) {
          // Stream promise rejected, error already set
        }
      }

      // Cleanup listener
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        try {
          listenerHandle.remove();
        } catch (err) {
          console.warn('[GeminiNano] Error removing listener:', err);
        }
      }

      // Final yield of any remaining chunks
      while (chunks.length > 0) {
        const chunk = chunks.shift();
        if (chunk) {
          yield chunk;
        }
      }

    } catch (err: any) {
      console.error('[GeminiNano] Streaming failed:', err);
      // Fallback: generate non-streaming and simulate streaming
      try {
        const result = await this.generate(input);
        const words = result.text.split(' ');
        for (const word of words) {
          yield word + ' ';
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      } catch (fallbackErr: any) {
        throw new Error(`Streaming failed: ${err.message}. Fallback also failed: ${fallbackErr.message}`);
      }
    }
  }

  /**
   * Build prompt with context
   */
  private buildPrompt(input: GeminiNanoInput): string {
    const systemPrompt = `You are a helpful agricultural assistant for field visits. Help farmers with crop management, pest/disease identification, and field visit data extraction. Provide concise, practical advice in both English and Spanish when appropriate.`;

    let userPrompt = input.text || '';

    // Add location context if available
    if (input.location) {
      userPrompt += `\n\nLocation: ${input.location.lat.toFixed(6)}, ${input.location.lon.toFixed(6)}`;
    }

    return `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`;
  }

  /**
   * Extract structured data from response (basic)
   */
  private extractStructured(text: string): Record<string, any> {
    // Basic extraction - can be enhanced with Gemini's structured output
    const structured: Record<string, any> = {};
    
    // Simple pattern matching (will be replaced with structured output in future)
    const cropMatch = text.match(/\b(corn|wheat|soy|rice|cotton|maize|trigo|soja|arroz)\b/i);
    if (cropMatch) {
      structured.crop = cropMatch[1].toLowerCase();
    }

    return structured;
  }

  /**
   * Check if Gemini Nano is available
   * CRITICAL: On web, always returns false immediately without async checks
   */
  async isAvailable(): Promise<boolean> {
    // On web, return false immediately without any async operations
    if (!Capacitor.isNativePlatform()) {
      this.available = false;
      return false;
    }
    
    if (!this.available) {
      await this.checkAvailability();
    }
    return this.available;
  }
}

// Default instance
export const geminiNano = new GeminiNano();
