/**
 * LocalLLM - Handles offline models (Nano, Llama)
 * Works completely offline, no server needed
 * 
 * Priority:
 * 1. Gemini Nano (Android 14+ with AICore) - Best quality, multimodal
 * 2. Llama Local (Android 7+, any device) - Offline fallback, text-only
 */

import { Capacitor } from '@capacitor/core';
import { geminiNano } from './GeminiNano';
import { llamaLocal } from './LlamaLocal';

export interface LocalLLMInput {
  text: string;
  location?: { lat: number; lon: number };
  images?: string[];
  systemPrompt?: string;
}

export class LocalLLM {
  /**
   * Stream response from available local model
   */
  async *stream(input: LocalLLMInput): AsyncGenerator<string> {
    // Priority 1: Gemini Nano (Android 14+)
    if (Capacitor.isNativePlatform()) {
      try {
        const available = await geminiNano.isAvailable();
        if (available) {
          console.log('[LocalLLM] Using Gemini Nano');
          
          // Build prompt with system message if provided
          const fullPrompt = input.systemPrompt 
            ? `${input.systemPrompt}\n\nUser: ${input.text}\n\nAssistant:`
            : input.text;
          
          yield* geminiNano.stream({
            text: fullPrompt,
            location: input.location,
            image: input.images?.[0], // Nano supports single image
          });
          return;
        }
      } catch (err: any) {
        console.warn('[LocalLLM] Nano failed:', err.message);
        // Fall through to Llama
      }
    }

    // Priority 2: Llama Local (WebLLM / WebGPU)
    // Don't wait for initialization here — stream() throws immediately if
    // the engine isn't loaded.  The ChatDrawer effect handles background
    // download; this keeps the chat responsive.
    try {
      const available = await llamaLocal.checkAvailability();
      if (available) {
        console.log('[LocalLLM] Using Llama Local');

        yield* llamaLocal.stream({
          text: input.text,
          systemPrompt: input.systemPrompt,
          location: input.location,
        });
        return;
      }
    } catch (err: any) {
      console.warn('[LocalLLM] Llama failed:', err.message);
    }

    throw new Error('No local LLM available. Install Gemini Nano (Android 14+) or Llama Local.');
  }

  /**
   * Check if any local model is available
   */
  async isAvailable(): Promise<boolean> {
    // Check Nano first
    if (Capacitor.isNativePlatform()) {
      try {
        if (await geminiNano.isAvailable()) {
          return true;
        }
      } catch {
        // Continue to check Llama
      }
    }
    
    // Check Llama
    try {
      return await llamaLocal.checkAvailability();
    } catch {
      return false;
    }
  }

  /**
   * Get which local models are available
   */
  async getAvailableModels(): Promise<{
    nano: boolean;
    llama: boolean;
  }> {
    const nano = Capacitor.isNativePlatform() 
      ? await geminiNano.isAvailable().catch(() => false)
      : false;
    
    const llama = await llamaLocal.checkAvailability().catch(() => false);
    
    return { nano, llama };
  }
}



