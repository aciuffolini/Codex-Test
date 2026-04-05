/**
 * CloudLLM - Handles online models (OpenAI, Anthropic)
 * Requires internet connection and API key
 * Uses test server in development, direct API in production
 */

import { streamChat } from '../api';
import { getUserApiKey } from '../config/userKey';

export interface CloudLLMInput {
  text: string;
  location?: { lat: number; lon: number };
  images?: string[];
  systemPrompt?: string;
  provider?: 'openai' | 'anthropic';
}

export class CloudLLM {
  /**
   * Stream response from cloud model
   */
  async *stream(input: CloudLLMInput): AsyncGenerator<string> {
    // Check online status
    if (!navigator.onLine) {
      throw new Error('Cloud LLM requires internet connection. You are currently offline.');
    }

    // Check API key
    const apiKey = getUserApiKey();
    if (!apiKey) {
      throw new Error('API key required for cloud models. Click the 🔑 button to set your API key.');
    }

    // Build messages array
    const messages: any[] = [];
    
    // Add system prompt if provided
    if (input.systemPrompt) {
      messages.push({
        role: 'system',
        content: input.systemPrompt,
      });
    }

    // Build user message
    let userContent: any = input.text;
    
    // Add location to user message if provided
    if (input.location) {
      userContent += `\n\nLocation: ${input.location.lat.toFixed(6)}, ${input.location.lon.toFixed(6)}`;
    }

    // Handle images (for vision models)
    if (input.images && input.images.length > 0) {
      // Format for OpenAI/Anthropic vision API
      const contentArray: any[] = [
        {
          type: 'text',
          text: userContent,
        },
      ];

      // Add images
      for (const img of input.images) {
        const dataUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
        
        // Determine provider and format accordingly
        if (input.provider === 'anthropic' || apiKey.startsWith('sk-ant-')) {
          // Anthropic format
          const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : img;
          const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
          
          contentArray.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Data,
            },
          });
        } else {
          // OpenAI format
          contentArray.push({
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          });
        }
      }

      messages.push({
        role: 'user',
        content: contentArray,
      });
    } else {
      // Text only
      messages.push({
        role: 'user',
        content: userContent,
      });
    }

    // Determine provider
    const provider = input.provider || (apiKey.startsWith('sk-ant-') ? 'anthropic' : 'openai');
    const providerHeader = provider === 'anthropic' ? 'claude-code' : undefined;

    try {
      console.log('[CloudLLM] Streaming from:', provider);
      yield* streamChat(messages, undefined, providerHeader);
    } catch (err: any) {
      // Provide helpful error messages
      if (err.message?.includes('Cannot connect') || 
          err.message?.includes('server') ||
          err.message?.includes('ECONNREFUSED')) {
        throw new Error('API server not running. For local development, start: node apps/web/test-server.js');
      }
      throw err;
    }
  }

  /**
   * Check if cloud LLM is available (online + has API key)
   */
  isAvailable(): boolean {
    return navigator.onLine && !!getUserApiKey();
  }

  /**
   * Get which cloud providers are available
   */
  getAvailableProviders(): {
    openai: boolean;
    anthropic: boolean;
  } {
    const apiKey = getUserApiKey();
    if (!apiKey) {
      return { openai: false, anthropic: false };
    }

    return {
      openai: apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-'),
      anthropic: apiKey.startsWith('sk-ant-'),
    };
  }
}



