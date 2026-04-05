/**
 * Capacitor Bridge for Gemini Nano Plugin
 * Native Android integration using ML Kit GenAI Prompt API
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export interface GeminiNanoNativePlugin {
  /**
   * Check if Gemini Nano is available on this device
   */
  isAvailable(): Promise<{
    available: boolean;
    reason?: string;
    status?: string;
    downloadable?: boolean;
  }>;

  /**
   * Initialize and download model if needed
   */
  initialize(): Promise<{
    initialized: boolean;
    message: string;
  }>;

  /**
   * Generate text (non-streaming)
   */
  generate(options: { prompt: string }): Promise<{
    text: string;
  }>;

  /**
   * Stream text completion
   */
  stream(options: { prompt: string }): Promise<void>;
}

const GeminiNanoNative = registerPlugin<GeminiNanoNativePlugin>('GeminiNano', {
  web: () => import('./GeminiNanoNative.web').then(m => new m.GeminiNanoNativeWeb()),
}) as GeminiNanoNativePlugin & {
  addListener: (eventName: string, listenerFunc: (data: any) => void) => { remove: () => void };
};

export default GeminiNanoNative;

