/**
 * Capacitor Bridge for Llama Local Plugin
 * Native Android integration using ONNX Runtime (to be implemented)
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export interface LlamaLocalNativePlugin {
  /**
   * Check if Llama Local model is available
   */
  isAvailable(): Promise<{
    available: boolean;
    reason?: string;
    modelSize?: number;
  }>;

  /**
   * Load the model (may download if not present)
   */
  loadModel(): Promise<{
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

// Web implementation (always returns not available)
class LlamaLocalNativeWeb {
  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    return {
      available: false,
      reason: 'Not available on web platform',
    };
  }

  async loadModel(): Promise<{ initialized: boolean; message: string }> {
    return {
      initialized: false,
      message: 'Not available on web platform',
    };
  }

  async generate(): Promise<{ text: string }> {
    throw new Error('Llama Local not available on web');
  }

  async stream(): Promise<void> {
    throw new Error('Llama Local not available on web');
  }

  addListener(): { remove: () => void } {
    return { remove: () => {} };
  }
}

const LlamaLocalNative = registerPlugin<LlamaLocalNativePlugin>('LlamaLocal', {
  web: () => new LlamaLocalNativeWeb(),
}) as LlamaLocalNativePlugin & {
  addListener: (eventName: string, listenerFunc: (data: any) => void) => { remove: () => void };
};

export default LlamaLocalNative;

