/**
 * SIMPLE LLM - Minimal working implementation
 * Just makes API calls work - no complex fallback logic
 */

import { simpleStreamChat } from '../api-simple';
import { getUserApiKey } from '../config/userKey';

export interface SimpleLLMInput {
  text: string;
  location?: { lat: number; lon: number };
  images?: string[];
  model?: string;
}

export class SimpleLLM {
  async *stream(input: SimpleLLMInput): AsyncGenerator<string> {
    // Check API key
    const apiKey = getUserApiKey();
    if (!apiKey) {
      throw new Error('API key required. Click 🔑 button to set it.');
    }

    // Check online
    if (!navigator.onLine) {
      throw new Error('Internet connection required for chat.');
    }

    // Build simple messages
    const messages: any[] = [
      {
        role: 'system',
        content: 'You are a helpful agricultural field visit assistant. Be concise and practical.'
      },
      {
        role: 'user',
        content: input.text
      }
    ];

    // Determine provider from API key
    const provider = apiKey.startsWith('sk-ant-') ? 'claude-code' : undefined;

    // Stream response - use simple version
    try {
      yield* simpleStreamChat(messages, provider);
    } catch (err: any) {
      throw new Error(`Chat error: ${err.message}`);
    }
  }
}

export const simpleLLM = new SimpleLLM();

