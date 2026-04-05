/**
 * Web implementation fallback (when not on Android)
 * 
 * NOTE: Gemini Nano is ONLY available on Android 14+ devices with AICore.
 * On web, this always returns unavailable to allow fallback to Cloud API.
 * No mock mode - use Cloud API for web development/testing.
 */
export class GeminiNanoNativeWeb {
  async isAvailable(): Promise<{ 
    available: boolean; 
    reason?: string; 
    status?: string;
    downloadable?: boolean;
  }> {
    // Always return false on web - use Cloud API instead
    return {
      available: false,
      reason: 'Gemini Nano is only available on Android 14+ devices. Use Cloud API on web.',
      status: 'NOT_AVAILABLE',
      downloadable: false,
    };
  }

  async initialize(): Promise<{ initialized: boolean; message: string }> {
    return {
      initialized: false,
      message: 'Gemini Nano not available on web platform',
    };
  }

  async generate(options: { prompt: string }): Promise<{ text: string }> {
    throw new Error('Gemini Nano not available on web. Use Cloud API instead.');
  }

  async stream(options: { prompt: string }): Promise<void> {
    throw new Error('Gemini Nano not available on web. Use Cloud API instead.');
  }

  addListener(eventName: string, listenerFunc: (data: any) => void): { remove: () => void } {
    // No-op on web since streaming is not available
    return {
      remove: () => {
        // No-op
      },
    };
  }
}

